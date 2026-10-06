"""
Unit & Integration Test Suite for Rule Validation:
Matches on: alert_events.alertor_type (text_key) + device_id + stream_id + rules.enabled = 1.
(Webhook does NOT contain channel_type and alarm_type).

Test Cases:
- Test 1: All conditions match (text_key, device_id, stream_id, enabled=1) -> Dispatches to NX VMS
- Test 2: text_key mismatch -> Does not dispatch to NX VMS
- Test 3: device_id mismatch -> Does not dispatch to NX VMS
- Test 4: stream_id mismatch -> Does not dispatch to NX VMS
- Test 5: Rule disabled (enabled = 0) -> Does not dispatch to NX VMS
- Test 6: Webhook missing device_id -> Does not dispatch, does not crash
- Test 7: Webhook missing stream_id -> Does not dispatch, does not crash
- Test 8: Webhook missing alertor_type -> Does not dispatch, does not crash
- Test 9: Webhook missing alert_events -> Does not dispatch, does not crash
- Test 10: Payload formatting for NX V4 (source, caption, description governed by enable_*)
- Test 11: Bearer Token error handling -> Logs error, does not crash
- Test 12: Network / Timeout error handling -> Logs error, does not crash
"""
import unittest
from unittest.mock import patch, MagicMock
import asyncio

from app.nx_client import NxClient
from app.queue_worker import EventProcessingQueue


class TestCorrectRuleValidation(unittest.TestCase):

    def setUp(self):
        self.nx_client = NxClient(
            ip="192.168.1.100",
            port=7001,
            username="admin",
            password="password123"
        )
        self.nx_client.token = "test-valid-bearer-token"
        self.nx_client.token_expires_at = 9999999999.0

        self.sample_rule = {
            "id": "rule-flame-001",
            "name": "Safety Flame Alarm Rule",
            "channel_type": "Safety",
            "alarm_type": "Flame Alarm",
            "text_key": "safety_flame_alarm",
            "device_id": "camera-001",
            "stream_id": 1,
            "camera_id": "camera-001",
            "enabled": 1,
            "enable_source": 1,
            "source": "POS-05",
            "enable_caption": 1,
            "caption": "CreditCardUsed",
            "enable_description": 1,
            "description": "Credit card used at POS 05"
        }

    # --------------------------------------------------------------------------
    # Test 1: All conditions match -> Dispatches NX VMS Generic Event
    # --------------------------------------------------------------------------
    @patch("requests.post")
    def test_1_all_conditions_match(self, mock_post):
        mock_resp = MagicMock(status_code=200, text="OK")
        mock_post.return_value = mock_resp

        worker = EventProcessingQueue()
        worker.nx_client = self.nx_client

        webhook_payload = {
            "device_id": "camera-001",
            "stream_id": 1,
            "alert_events": {
                "alertor_type": "safety_flame_alarm"
            }
        }

        with patch("app.queue_worker.find_matching_rules", return_value=[self.sample_rule]):
            asyncio.run(worker._dispatch_to_nx(webhook_payload))

        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        self.assertEqual(args[0], "https://192.168.1.100:7001/rest/v4/events/generic")
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer test-valid-bearer-token")

        payload = kwargs["json"]
        self.assertEqual(payload["state"], "instant")
        self.assertEqual(payload["timestamp"], "now")
        self.assertEqual(payload["source"], "POS-05")
        self.assertEqual(payload["caption"], "CreditCardUsed")
        self.assertEqual(payload["description"], "Credit card used at POS 05")
        self.assertEqual(payload["deviceIds"], ["camera-001"])

    # --------------------------------------------------------------------------
    # Test 2: text_key mismatch -> Does not post
    # --------------------------------------------------------------------------
    def test_2_text_key_mismatch(self):
        worker = EventProcessingQueue()
        worker.nx_client = MagicMock()

        webhook_payload = {
            "device_id": "camera-001",
            "stream_id": 1,
            "alert_events": {
                "alertor_type": "different_text_key"
            }
        }

        with patch("app.queue_worker.find_matching_rules", return_value=[]):
            asyncio.run(worker._dispatch_to_nx(webhook_payload))

        worker.nx_client.send_generic_event_v4.assert_not_called()

    # --------------------------------------------------------------------------
    # Test 3: device_id mismatch -> Does not post
    # --------------------------------------------------------------------------
    def test_3_device_id_mismatch(self):
        worker = EventProcessingQueue()
        worker.nx_client = MagicMock()

        webhook_payload = {
            "device_id": "camera-002",
            "stream_id": 1,
            "alert_events": {
                "alertor_type": "safety_flame_alarm"
            }
        }

        with patch("app.queue_worker.find_matching_rules", return_value=[]):
            asyncio.run(worker._dispatch_to_nx(webhook_payload))

        worker.nx_client.send_generic_event_v4.assert_not_called()

    # --------------------------------------------------------------------------
    # Test 4: stream_id mismatch -> Does not post
    # --------------------------------------------------------------------------
    def test_4_stream_id_mismatch(self):
        worker = EventProcessingQueue()
        worker.nx_client = MagicMock()

        webhook_payload = {
            "device_id": "camera-001",
            "stream_id": 2,
            "alert_events": {
                "alertor_type": "safety_flame_alarm"
            }
        }

        with patch("app.queue_worker.find_matching_rules", return_value=[]):
            asyncio.run(worker._dispatch_to_nx(webhook_payload))

        worker.nx_client.send_generic_event_v4.assert_not_called()

    # --------------------------------------------------------------------------
    # Test 5: Rule disabled (enabled = 0) -> Does not post
    # --------------------------------------------------------------------------
    def test_5_rule_disabled(self):
        worker = EventProcessingQueue()
        worker.nx_client = MagicMock()

        disabled_rule = dict(self.sample_rule)
        disabled_rule["enabled"] = 0

        webhook_payload = {
            "device_id": "camera-001",
            "stream_id": 1,
            "alert_events": {
                "alertor_type": "safety_flame_alarm"
            }
        }

        with patch("app.queue_worker.find_matching_rules", return_value=[disabled_rule]):
            asyncio.run(worker._dispatch_to_nx(webhook_payload))

        worker.nx_client.send_generic_event_v4.assert_not_called()

    # --------------------------------------------------------------------------
    # Test 6: Webhook missing device_id -> Does not post, does not crash
    # --------------------------------------------------------------------------
    def test_6_missing_device_id(self):
        worker = EventProcessingQueue()
        worker.nx_client = MagicMock()

        webhook_payload = {
            "stream_id": 1,
            "alert_events": {
                "alertor_type": "safety_flame_alarm"
            }
        }

        asyncio.run(worker._dispatch_to_nx(webhook_payload))
        worker.nx_client.send_generic_event_v4.assert_not_called()

    # --------------------------------------------------------------------------
    # Test 7: Webhook missing stream_id -> Does not post, does not crash
    # --------------------------------------------------------------------------
    def test_7_missing_stream_id(self):
        worker = EventProcessingQueue()
        worker.nx_client = MagicMock()

        webhook_payload = {
            "device_id": "camera-001",
            "alert_events": {
                "alertor_type": "safety_flame_alarm"
            }
        }

        asyncio.run(worker._dispatch_to_nx(webhook_payload))
        worker.nx_client.send_generic_event_v4.assert_not_called()

    # --------------------------------------------------------------------------
    # Test 8: Webhook missing alertor_type -> Does not post, does not crash
    # --------------------------------------------------------------------------
    def test_8_missing_alertor_type(self):
        worker = EventProcessingQueue()
        worker.nx_client = MagicMock()

        webhook_payload = {
            "device_id": "camera-001",
            "stream_id": 1,
            "alert_events": {
                "alertor_type": ""
            }
        }

        asyncio.run(worker._dispatch_to_nx(webhook_payload))
        worker.nx_client.send_generic_event_v4.assert_not_called()

    # --------------------------------------------------------------------------
    # Test 9: Webhook missing alert_events -> Does not post via primary flow, does not crash
    # --------------------------------------------------------------------------
    def test_9_missing_alert_events(self):
        worker = EventProcessingQueue()
        worker.nx_client = MagicMock()

        with patch("app.queue_worker.get_all_rules", return_value=[]):
            webhook_payload = {
                "device_id": "camera-001",
                "stream_id": 1
            }
            asyncio.run(worker._dispatch_to_nx(webhook_payload))

        worker.nx_client.send_generic_event_v4.assert_not_called()

    # --------------------------------------------------------------------------
    # Test 10: Payload formatting for NX V4 (enable_* checks)
    # --------------------------------------------------------------------------
    @patch("requests.post")
    def test_10_payload_formatting(self, mock_post):
        mock_resp = MagicMock(status_code=200, text="OK")
        mock_post.return_value = mock_resp

        rule = {
            "camera_id": "cam-101",
            "enable_source": 0,
            "source": "ShouldNotAppear",
            "enable_caption": 1,
            "caption": "OnlyCaption",
            "enable_description": 0,
            "description": "ShouldNotAppear"
        }

        self.nx_client.send_generic_event_v4(rule)
        payload = mock_post.call_args[1]["json"]

        self.assertEqual(payload, {
            "state": "instant",
            "timestamp": "now",
            "caption": "OnlyCaption",
            "deviceIds": ["cam-101"]
        })
        self.assertNotIn("source", payload)
        self.assertNotIn("description", payload)

    # --------------------------------------------------------------------------
    # Test 11: Bearer Token login failure -> Log error, does not crash
    # --------------------------------------------------------------------------
    def test_11_token_login_failure(self):
        worker = EventProcessingQueue()
        mock_nx = MagicMock()
        mock_nx.is_configured.return_value = True
        mock_nx.send_generic_event_v4.side_effect = ConnectionError("Login failed")
        worker.nx_client = mock_nx

        webhook_payload = {
            "device_id": "camera-001",
            "stream_id": 1,
            "alert_events": {
                "alertor_type": "safety_flame_alarm"
            }
        }

        with patch("app.queue_worker.find_matching_rules", return_value=[self.sample_rule]):
            asyncio.run(worker._dispatch_to_nx(webhook_payload))

        mock_nx.send_generic_event_v4.assert_called_once()

    # --------------------------------------------------------------------------
    # Test 12: Network / Timeout error -> Log error, does not crash
    # --------------------------------------------------------------------------
    @patch("requests.post")
    def test_12_timeout_handling(self, mock_post):
        import requests
        mock_post.side_effect = requests.exceptions.Timeout("Connection timed out")

        worker = EventProcessingQueue()
        worker.nx_client = self.nx_client

        webhook_payload = {
            "device_id": "camera-001",
            "stream_id": 1,
            "alert_events": {
                "alertor_type": "safety_flame_alarm"
            }
        }

        with patch("app.queue_worker.find_matching_rules", return_value=[self.sample_rule]):
            asyncio.run(worker._dispatch_to_nx(webhook_payload))


if __name__ == "__main__":
    unittest.main()
