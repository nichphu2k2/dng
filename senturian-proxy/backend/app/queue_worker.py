import os
import time
import json
import uuid
import asyncio
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

from .config import (
    LOGS_DIR,
    get_all_rules,
    get_all_settings,
    get_active_face_rules,
    get_all_rules_by_text_key,
    find_matching_rules,
    is_valid_channel_alarm,
    get_text_key_by_channel_alarm,
    increment_success_records_count
)
from .nx_client import NxClient

# Configure logging to backend logs/senturian.log
LOG_FILE = LOGS_DIR / "senturian.log"

logger = logging.getLogger("senturian_webhook")
logger.setLevel(logging.INFO)

if not logger.handlers:
    file_handler = logging.FileHandler(str(LOG_FILE), encoding="utf-8")
    formatter = logging.Formatter("%(asctime)s | %(levelname)s | %(message)s")
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

# List of heavy image/binary payload fields stripped immediately on receipt
FIELDS_TO_STRIP = {
    "photo",
    "photo_md5",
    "photo_crop",
    "photo_crop_md5",
    "crop_photo",
    "crop_photo_md5",
    "fullImage",
    "fullImage_md5",
    "face_photo",
    "face_image"
}


def strip_heavy_fields(obj: Any) -> Any:
    """
    Recursively remove large base64 image/md5 fields (photo, fullImage, ...)
    to minimize memory consumption immediately upon request arrival.
    """
    if isinstance(obj, dict):
        return {
            k: strip_heavy_fields(v)
            for k, v in obj.items()
            if k not in FIELDS_TO_STRIP
        }
    elif isinstance(obj, list):
        return [strip_heavy_fields(item) for item in obj]
    return obj


class EventProcessingQueue:
    def __init__(self):
        self.queue: asyncio.Queue = asyncio.Queue()
        self.total_received = 0
        self.total_processed = 0
        self.last_event_time: Optional[str] = None
        self._worker_task: Optional[asyncio.Task] = None
        self.nx_client: Optional[NxClient] = None

    def initialize_nx_client(self):
        settings = get_all_settings()
        self.nx_client = NxClient(
            ip=settings.get("vms_ip", ""),
            port=int(settings.get("vms_port", 7001)),
            username=settings.get("vms_user", ""),
            password=settings.get("vms_password", "")
        )

    def start_worker(self):
        if self._worker_task is None or self._worker_task.done():
            self.initialize_nx_client()
            self._worker_task = asyncio.create_task(self._process_queue())
            logger.info("Senturian Event Queue Worker started.")

    async def stop_worker(self):
        if self._worker_task and not self._worker_task.done():
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
            self._worker_task = None
            logger.info("Senturian Event Queue Worker stopped.")

    async def enqueue(self, raw_data: Any, client_ip: str) -> Dict[str, Any]:
        """
        Enqueue incoming webhook event:
        1. Strip heavy image fields.
        2. Put into FIFO queue.
        3. Increment counters.
        """
        cleaned_data = strip_heavy_fields(raw_data)
        event_id = str(uuid.uuid4())
        now_iso = datetime.now().isoformat()

        queue_item = {
            "event_id": event_id,
            "received_at": now_iso,
            "client_ip": client_ip,
            "payload": cleaned_data
        }

        self.total_received += 1
        self.last_event_time = now_iso
        await self.queue.put(queue_item)

        return {
            "success": True,
            "event_id": event_id,
            "queued_at": now_iso,
            "queue_size": self.queue.qsize()
        }

    async def _process_queue(self):
        """
        Asynchronous processing loop:
        - Dequeue incoming events sequentially.
        - Log cleaned payload to log file.
        - Match active forwarding rules and dispatch to NX VMS.
        - Promptly de-reference completed event payload to free RAM.
        """
        while True:
            item = None
            try:
                item = await self.queue.get()
                event_id = item.get("event_id")
                client_ip = item.get("client_ip")
                payload = item.get("payload")

                # 1. Log cleaned payload with pretty-printed multi-line JSON format
                formatted_json = json.dumps(payload, indent=2, ensure_ascii=False)
                log_msg = f"[Event {event_id}] Received from {client_ip}:\n{formatted_json}"
                logger.info(log_msg)

                # 2. Dispatch event to NX VMS based on matching rules
                await self._dispatch_to_nx(payload)

                # 3. Mark task completed
                self.total_processed += 1
                self.queue.task_done()

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error processing queued event: {str(e)}")
                if item:
                    self.queue.task_done()
            finally:
                if item:
                    del item

    async def _dispatch_to_nx(self, payload: Dict[str, Any]):
        """
        Evaluate webhook payload and dispatch generic event to NX VMS:
        1. Primary flow with alert_events:
           Strict evaluation of all criteria:
             - alert_events.alertor_type matches rule.text_key
             - webhook.device_id matches rule.device_id
             - webhook.stream_id matches rule.stream_id
             - rule.enabled == 1
        2. Backward compatibility flow:
           Fallback matching for legacy Senturian event structures.
        """
        if not isinstance(payload, dict):
            return

        # ==============================================================================
        # FLOW 0: FACE-HUMAN & RECON. SPECIAL HANDLING
        # Rules with channel_type = "Face-human & Recon." and enabled = 1
        # ==============================================================================
        active_face_rules = get_active_face_rules()
        if active_face_rules:
            # Check objType: valid values are "face" or "human"
            raw_obj_type = payload.get("objType")
            obj_type = str(raw_obj_type).strip().lower() if raw_obj_type is not None else ""

            if obj_type in ("face", "human"):
                # Extract device_id
                raw_dev = payload.get("device_id") or payload.get("deviceId")
                payload_dev = str(raw_dev).strip() if raw_dev is not None else ""

                # Extract video_number (maps to rule.stream_id)
                raw_video_number = payload.get("video_number")
                if raw_video_number is None:
                    raw_video_number = payload.get("stream_id") if "stream_id" in payload else payload.get("streamId")

                payload_stream = None
                if raw_video_number is not None and str(raw_video_number).strip() != "":
                    try:
                        payload_stream = int(raw_video_number)
                    except (ValueError, TypeError):
                        payload_stream = None

                if payload_dev and payload_stream is not None:
                    for rule in active_face_rules:
                        rule_dev = str(rule.get("device_id") or "").strip()
                        try:
                            rule_stream = int(rule.get("stream_id", 1))
                        except (ValueError, TypeError):
                            rule_stream = 1

                        # Condition 1: device_id match
                        if payload_dev != rule_dev:
                            continue

                        # Condition 2: video_number == stream_id
                        if payload_stream != rule_stream:
                            continue

                        # Condition 3: objType is already verified ("face" or "human")
                        # Rule MATCHED! Proceed to check alertGroup.groupName
                        rule_id = rule.get("id")
                        rule_name = rule.get("name")
                        logger.info(
                            f"✓ Rule MATCH (Face-human & Recon.): rule_id={rule_id} name='{rule_name}' "
                            f"device_id='{payload_dev}' video_number={payload_stream} objType='{obj_type}'"
                        )

                        # Extract alertGroup.groupName
                        # Handle alertGroup safely: list, dict, missing, null, empty
                        alert_group = payload.get("alertGroup")
                        group_name: Optional[str] = None

                        if isinstance(alert_group, list):
                            for g in alert_group:
                                if isinstance(g, dict) and g.get("groupName"):
                                    gn = str(g["groupName"]).strip()
                                    if gn:
                                        group_name = gn
                                        break
                        elif isinstance(alert_group, dict) and alert_group.get("groupName"):
                            gn = str(alert_group["groupName"]).strip()
                            if gn:
                                group_name = gn

                        # Determine caption
                        if group_name:
                            final_caption = group_name
                        else:
                            final_caption = "Stranger"

                        # Determine description
                        # if rules.enable_description == 1:
                        #     if alertGroup.groupName exists:
                        #         if senturian.Description exists: description = senturian.Description
                        #         else: description = rules.description
                        #     else: description = rules.description
                        # else: do not include description
                        enable_desc = bool(rule.get("enable_description", rule.get("enableDescription", 0)))
                        final_description = None
                        if enable_desc:
                            if group_name:
                                desc_field = payload.get("Description") or payload.get("description")
                                if desc_field and str(desc_field).strip():
                                    final_description = str(desc_field).strip()
                                else:
                                    final_description = str(rule.get("description") or "")
                            else:
                                final_description = str(rule.get("description") or "")

                        # Dispatch NX VMS Generic Event
                        if not self.nx_client or not self.nx_client.is_configured():
                            self.initialize_nx_client()

                        if not self.nx_client or not self.nx_client.is_configured():
                            logger.error(
                                f"❌ [NX VMS CONFIG ERROR] rule_id={rule_id} -> "
                                f"NX VMS configuration incomplete (IP/User/Password required)"
                            )
                            continue

                        try:
                            loop = asyncio.get_running_loop()
                            result = await loop.run_in_executor(
                                None,
                                lambda r=rule, c=final_caption, d=final_description: self.nx_client.send_generic_event_v4(
                                    rule=r,
                                    override_caption=c,
                                    override_description=d
                                )
                            )

                            status = result.get("status_code")
                            if result.get("success"):
                                new_total = increment_success_records_count()
                                logger.info(
                                    f"✓ [NX VMS SUCCESS] (Face-human & Recon.) rule_id={rule_id} HTTP {status} | "
                                    f"Generic Event dispatched (caption='{final_caption}', Total Recorded: {new_total})"
                                )
                            else:
                                logger.error(
                                    f"❌ [NX VMS HTTP ERROR] (Face-human & Recon.) rule_id={rule_id} "
                                    f"HTTP {status} | Response: {result.get('response')}"
                                )

                        except ConnectionError as conn_err:
                            logger.error(f"❌ [NX VMS CONNECTION/AUTH ERROR] rule_id={rule_id} -> {str(conn_err)}")
                        except Exception as ex:
                            logger.error(f"❌ [NX VMS UNEXPECTED ERROR] rule_id={rule_id} -> {str(ex)}")

                    return

        # ==============================================================================
        # FLOW 1: NX VMS GENERIC EVENT MATCHING VIA alert_events + device_id + stream_id
        # ==============================================================================
        alert_events = payload.get("alert_events")
        if alert_events:
            event_items = []
            if isinstance(alert_events, list):
                event_items = [ev for ev in alert_events if isinstance(ev, dict)]
            elif isinstance(alert_events, dict):
                event_items = [alert_events]

            if not event_items:
                logger.info("NX VMS Rule evaluation skipped: reason=empty_alert_events")
                return

            # 1. Extract alertor_type(s) (text_key)
            alertor_types = []
            for ev in event_items:
                at = ev.get("alertor_type")
                if at and str(at).strip() and str(at).strip() not in alertor_types:
                    alertor_types.append(str(at).strip())

            if not alertor_types:
                logger.info("NX VMS Rule evaluation skipped: reason=missing_alertor_type -> No valid alertor_type found in alert_events")
                return

            # 2. Extract device_id
            raw_device_id = payload.get("device_id") or payload.get("deviceId")
            if not raw_device_id or not str(raw_device_id).strip():
                logger.info(f"NX VMS Rule evaluation skipped: alertor_types={alertor_types} reason=missing_device_id")
                return
            device_id = str(raw_device_id).strip()

            # 3. Extract stream_id
            raw_stream_id = payload.get("stream_id") if "stream_id" in payload else payload.get("streamId")
            if raw_stream_id is None or str(raw_stream_id).strip() == "":
                logger.info(f"NX VMS Rule evaluation skipped: alertor_types={alertor_types} reason=missing_stream_id")
                return
            try:
                stream_id = int(raw_stream_id)
            except (ValueError, TypeError):
                logger.warning(f"NX VMS Rule evaluation skipped: alertor_types={alertor_types} reason=invalid_stream_id value={raw_stream_id}")
                return

            for text_key in alertor_types:
                logger.info(
                    f"NX VMS Rule evaluation: text_key='{text_key}' device_id='{device_id}' stream_id={stream_id}"
                )

                # 4. Find rules matching text_key, device_id, stream_id
                matched_rules = find_matching_rules(
                    text_key=text_key,
                    device_id=device_id,
                    stream_id=stream_id
                )

                if not matched_rules:
                    rules_by_key = get_all_rules_by_text_key(text_key)
                    if not rules_by_key:
                        logger.warning(f"Rule not matched: reason=rule_not_found text_key='{text_key}'")
                    else:
                        sample_r = rules_by_key[0]
                        reasons = []
                        if str(sample_r.get("device_id") or "").strip() != device_id:
                            reasons.append(f"device_id_mismatch (webhook='{device_id}' != rule='{sample_r.get('device_id')}')")
                        if int(sample_r.get("stream_id") or 1) != stream_id:
                            reasons.append(f"stream_id_mismatch (webhook={stream_id} != rule={sample_r.get('stream_id')})")
                        logger.warning(f"Rule not matched: reason={'; '.join(reasons) or 'mismatch'} text_key='{text_key}' rule_id={sample_r.get('id')}")
                    continue

                # 5. Process matched rules
                for rule in matched_rules:
                    rule_id = rule.get("id")
                    is_enabled = bool(rule.get("enabled", 0))

                    # Check if rule is active
                    if not is_enabled:
                        logger.info(f"Rule not matched: reason=rule_inactive text_key='{text_key}' rule_id={rule_id}")
                        continue

                    logger.info(f"✓ Rule MATCH: text_key='{text_key}' rule_id={rule_id} name='{rule.get('name')}'. Sending NX VMS Generic Event...")

                    if not self.nx_client or not self.nx_client.is_configured():
                        self.initialize_nx_client()

                    if not self.nx_client or not self.nx_client.is_configured():
                        logger.error(f"❌ [NX VMS CONFIG ERROR] text_key='{text_key}' rule_id={rule_id} -> NX VMS configuration incomplete (IP/User/Password required)")
                        continue

                    # Send request to NX VMS via REST API v4
                    try:
                        loop = asyncio.get_running_loop()
                        result = await loop.run_in_executor(
                            None,
                            lambda r=rule: self.nx_client.send_generic_event_v4(rule=r)
                        )

                        status = result.get("status_code")
                        if result.get("success"):
                            new_total = increment_success_records_count()
                            logger.info(f"✓ [NX VMS SUCCESS] text_key='{text_key}' rule_id={rule_id} HTTP {status} | Generic Event dispatched to /rest/v4/events/generic (Total Recorded: {new_total})")
                        else:
                            logger.error(f"❌ [NX VMS HTTP ERROR] text_key='{text_key}' rule_id={rule_id} endpoint=/rest/v4/events/generic HTTP {status} | Response: {result.get('response')}")

                    except ConnectionError as conn_err:
                        logger.error(f"❌ [NX VMS CONNECTION/AUTH ERROR] text_key='{text_key}' rule_id={rule_id} -> {str(conn_err)}")
                    except Exception as ex:
                        logger.error(f"❌ [NX VMS UNEXPECTED ERROR] text_key='{text_key}' rule_id={rule_id} -> {str(ex)}")

            return

        # ==============================================================================
        # FLOW 2: BACKWARD COMPATIBILITY FOR LEGACY SENTURIAN EVENTS
        # ==============================================================================
        rules = get_all_rules()
        active_rules = [r for r in rules if r.get("enabled") and str(r.get("channel_type") or "").strip() != "Face-human & Recon."]
        if not active_rules:
            return

        screen_token = str(payload.get("screen_token") or payload.get("channel_id") or "").strip()
        channel_type = str(payload.get("channel_type") or payload.get("channelType") or "").strip()
        alarm_type = str(payload.get("alarm_type") or payload.get("alarmType") or "").strip()
        device_id = str(payload.get("device_id") or payload.get("deviceId") or "").strip()

        for rule in active_rules:
            rule_cam_id = str(rule.get("camera_id") or "").strip()
            rule_channel = str(rule.get("channel_type") or "").strip()
            rule_alarm = str(rule.get("alarm_type") or "").strip()
            rule_device = str(rule.get("device_id") or "").strip()

            match_camera = not rule_cam_id or (rule_cam_id == screen_token) or (rule_device and rule_device == device_id)
            match_channel = not rule_channel or (rule_channel.lower() in channel_type.lower())
            match_alarm = True
            if rule_alarm:
                match_alarm = (rule_alarm.lower() in alarm_type.lower())

            if match_camera and match_channel and match_alarm:
                if not self.nx_client or not self.nx_client.is_configured():
                    self.initialize_nx_client()

                if self.nx_client and self.nx_client.is_configured():
                    try:
                        loop = asyncio.get_running_loop()
                        await loop.run_in_executor(
                            None,
                            lambda r=rule: self.nx_client.send_generic_event_v4(rule=r)
                        )
                        logger.info(f"✓ [Legacy Flow] Sent Generic Event to NX VMS for rule '{rule.get('name')}'")
                    except Exception as err:
                        logger.error(f"❌ [Legacy Flow] Failed to send event to NX VMS: {str(err)}")
                break

    def get_stats(self) -> Dict[str, Any]:
        return {
            "queue_size": self.queue.qsize(),
            "total_received": self.total_received,
            "total_processed": self.total_processed,
            "last_event_time": self.last_event_time,
            "worker_running": self._worker_task is not None and not self._worker_task.done()
        }


# Global singleton queue instance
event_queue = EventProcessingQueue()
