import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from ..config import (
    get_all_rules,
    get_rule_by_id,
    save_or_update_rule,
    delete_rule,
    toggle_rule
)

router = APIRouter(prefix="/api/rules", tags=["Rules"])


class RuleSchema(BaseModel):
    id: Optional[str] = None
    name: str
    camera_id: Optional[str] = None
    cameraId: Optional[str] = None
    channel_type: Optional[str] = None
    channelType: Optional[str] = None
    alarm_type: Optional[str] = None
    alarmType: Optional[str] = None
    text_key: Optional[str] = None
    textKey: Optional[str] = None
    face_groups: Optional[str] = None
    faceGroups: Optional[str] = None
    device_id: Optional[str] = None
    deviceId: Optional[str] = None
    stream_id: Optional[int] = None
    streamId: Optional[int] = None
    enable_source: Optional[bool] = None
    enableSource: Optional[bool] = None
    source: Optional[str] = "Senturian_AI"
    enable_caption: Optional[bool] = None
    enableCaption: Optional[bool] = None
    caption: Optional[str] = ""
    enable_description: Optional[bool] = None
    enableDescription: Optional[bool] = None
    description: Optional[str] = ""
    enabled: Optional[bool] = None


def format_rule_response(r: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not r:
        return None
    res = dict(r)
    res["cameraId"] = res.get("camera_id")
    res["channelType"] = res.get("channel_type")
    res["alarmType"] = res.get("alarm_type")
    res["textKey"] = res.get("text_key")
    res["face_groups"] = res.get("face_groups")
    res["faceGroups"] = res.get("face_groups")
    res["deviceId"] = res.get("device_id")
    res["streamId"] = res.get("stream_id")
    res["enableSource"] = bool(res.get("enable_source", 1))
    res["enableCaption"] = bool(res.get("enable_caption", 1))
    res["enableDescription"] = bool(res.get("enable_description", 0))
    res["enabled"] = bool(res.get("enabled", 1))
    return res


def normalize_rule_input(data: Dict[str, Any]) -> Dict[str, Any]:
    # Stream ID: check streamId first, then stream_id, fallback 1
    s_id = data.get("streamId")
    if s_id is None:
        s_id = data.get("stream_id")
    try:
        stream_val = int(s_id) if s_id is not None else 1
    except (ValueError, TypeError):
        stream_val = 1
    data["stream_id"] = stream_val
    data["streamId"] = stream_val

    # Camera ID
    c_id = data.get("cameraId") or data.get("camera_id") or ""
    data["camera_id"] = c_id
    data["cameraId"] = c_id

    # Device ID
    d_id = data.get("deviceId") or data.get("device_id") or ""
    data["device_id"] = d_id
    data["deviceId"] = d_id

    # Channel Type
    ch = data.get("channelType") or data.get("channel_type") or ""
    data["channel_type"] = ch
    data["channelType"] = ch

    # Alarm Type
    al = data.get("alarmType") if data.get("alarmType") is not None else data.get("alarm_type")
    data["alarm_type"] = al
    data["alarmType"] = al

    # Text Key
    tk = data.get("textKey") or data.get("text_key")
    data["text_key"] = tk
    data["textKey"] = tk

    # Face Groups (case-sensitive text verbatim)
    fg = data.get("face_groups") if data.get("face_groups") is not None else data.get("faceGroups")
    data["face_groups"] = fg
    data["faceGroups"] = fg

    # Booleans
    es = data.get("enableSource") if data.get("enableSource") is not None else data.get("enable_source", True)
    data["enable_source"] = bool(es)
    data["enableSource"] = bool(es)

    ec = data.get("enableCaption") if data.get("enableCaption") is not None else data.get("enable_caption", True)
    data["enable_caption"] = bool(ec)
    data["enableCaption"] = bool(ec)

    ed = data.get("enableDescription") if data.get("enableDescription") is not None else data.get("enable_description", False)
    data["enable_description"] = bool(ed)
    data["enableDescription"] = bool(ed)

    en = data.get("enabled") if data.get("enabled") is not None else True
    data["enabled"] = bool(en)

    return data


@router.get("")
async def list_rules():
    """List all configured event rules."""
    rules = get_all_rules()
    return [format_rule_response(r) for r in rules]


@router.post("")
async def create_rule(rule: RuleSchema):
    """Create a new event forwarding rule."""
    data = normalize_rule_input(rule.dict())
    if not data.get("id"):
        data["id"] = f"rule-{int(uuid.uuid4().int % 1000000000)}"

    saved = save_or_update_rule(data)
    if not saved:
        raise HTTPException(status_code=500, detail="Failed to create rule")
    return format_rule_response(saved)


@router.put("/{rule_id}")
async def update_rule(rule_id: str, rule: RuleSchema):
    """Update an existing rule by ID."""
    existing = get_rule_by_id(rule_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Rule not found")

    data = normalize_rule_input(rule.dict())
    data["id"] = rule_id
    saved = save_or_update_rule(data)
    return format_rule_response(saved)


@router.delete("/{rule_id}")
async def remove_rule(rule_id: str):
    """Delete a rule by ID."""
    success = delete_rule(rule_id)
    if not success:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {"success": True, "message": "Rule deleted successfully"}


@router.patch("/{rule_id}/toggle")
async def toggle_rule_status(rule_id: str):
    """Toggle enabled status of a rule."""
    updated = toggle_rule(rule_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Rule not found")
    return format_rule_response(updated)
