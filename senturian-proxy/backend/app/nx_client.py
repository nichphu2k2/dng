import time
import urllib.parse
import requests
from typing import Dict, Any, List, Optional
import urllib3

# Suppress self-signed SSL certificate warnings (Nx Witness uses self-signed certificates by default)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class NxClient:
    """
    Network Optix (NX) VMS REST API Client
    Compatible with: Nx Witness, DW Spectrum, Hanwha WAVE, and Nx Meta.
    Manages Bearer token authentication, session verification, device discovery, and generic events.
    """

    def __init__(
        self,
        ip: str = "",
        port: int = 7001,
        username: str = "",
        password: str = "",
        timeout_s: float = 10.0,
        verify_ssl: bool = False
    ):
        self.ip = str(ip or "").strip()
        self.port = int(port or 7001)
        self.username = str(username or "").strip()
        self.password = str(password or "")
        self.timeout_s = timeout_s
        self.verify_ssl = verify_ssl

        self.token: Optional[str] = None
        self.token_expires_at: float = 0.0  # Unix timestamp in seconds

    def update_config(self, ip: Optional[str] = None, port: Optional[int] = None,
                      username: Optional[str] = None, password: Optional[str] = None):
        """Update connection parameters and reset active session token."""
        if ip is not None:
            self.ip = str(ip).strip()
        if port is not None:
            self.port = int(port)
        if username is not None:
            self.username = str(username).strip()
        if password is not None:
            self.password = str(password)
        self.token = None
        self.token_expires_at = 0.0

    def is_configured(self) -> bool:
        return bool(self.ip and self.username and self.password)

    def _get_base_url(self) -> str:
        return f"https://{self.ip}:{self.port}"

    def login(self) -> Dict[str, Any]:
        """
        Log in to NX Server and obtain a Bearer session token.
        POST /rest/v3/login/sessions
        """
        if not self.is_configured():
            raise ValueError("NX Server configuration incomplete (ip, username, and password required)")

        url = f"{self._get_base_url()}/rest/v3/login/sessions"
        payload = {
            "username": self.username,
            "password": self.password
        }

        try:
            res = requests.post(
                url,
                json=payload,
                headers={"Content-Type": "application/json", "Accept": "application/json"},
                timeout=self.timeout_s,
                verify=self.verify_ssl
            )
        except Exception as e:
            raise ConnectionError(f"Failed to connect to NX Server at {self.ip}:{self.port} - {str(e)}")

        if res.status_code < 200 or res.status_code >= 300:
            error_msg = res.text
            try:
                err_json = res.json()
                error_msg = err_json.get("errorString") or err_json.get("message") or res.text
            except Exception:
                pass
            raise ConnectionError(f"NX Server login failed (HTTP {res.status_code}): {error_msg}")

        data = res.json()
        token = data.get("token")
        if not token:
            raise ValueError("NX Server did not return a session token in login response")

        expires_in_s = int(data.get("expiresInS", 86400 * 30))  # Default to 30 days if unspecified
        self.token = token
        self.token_expires_at = time.time() + expires_in_s

        return {
            "success": True,
            "token": token,
            "expiresInS": expires_in_s,
            "expiresAt": self.token_expires_at
        }

    def get_valid_token(self) -> str:
        """Get valid Bearer token, automatically re-authenticating if expiring within 24h."""
        ONE_DAY_S = 86400
        is_near_expiry = not self.token or (self.token_expires_at - time.time() <= ONE_DAY_S)
        if is_near_expiry:
            login_res = self.login()
            return login_res["token"]
        return self.token

    def check_session(self, token: Optional[str] = None) -> Dict[str, Any]:
        """
        Verify the validity of a session token.
        GET /rest/v3/login/sessions/{token}
        """
        t = token or self.token
        if not t:
            return {"valid": False, "reason": "Empty token or not logged in"}

        url = f"{self._get_base_url()}/rest/v3/login/sessions/{urllib.parse.quote(t)}"
        try:
            res = requests.get(
                url,
                headers={"Authorization": f"Bearer {t}", "Accept": "application/json"},
                timeout=self.timeout_s,
                verify=self.verify_ssl
            )
            if res.status_code == 200:
                data = res.json()
                expires_in_s = data.get("expiresInS", 0)
                return {
                    "valid": True,
                    "expiresInS": expires_in_s,
                    "status": 200
                }
            return {
                "valid": False,
                "status": res.status_code,
                "reason": res.text
            }
        except Exception as e:
            return {"valid": False, "reason": str(e)}

    def fetch_devices(self) -> List[Dict[str, Any]]:
        """
        Fetch device list from NX Server.
        GET /rest/v3/devices?_with=id,deviceType,name,status
        """
        token = self.get_valid_token()
        url = f"{self._get_base_url()}/rest/v3/devices?_with=id,deviceType,name,status"

        res = requests.get(
            url,
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
            timeout=self.timeout_s,
            verify=self.verify_ssl
        )

        # Retry login once if token has unexpectedly expired (401/403)
        if res.status_code in (401, 403):
            token = self.login()["token"]
            res = requests.get(
                url,
                headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
                timeout=self.timeout_s,
                verify=self.verify_ssl
            )

        if res.status_code < 200 or res.status_code >= 300:
            raise RuntimeError(f"Failed to fetch NX devices (HTTP {res.status_code}): {res.text}")

        devices = res.json()
        if not isinstance(devices, list):
            raise ValueError("NX device list response is not an array")

        return devices

    def get_recording_cameras(self) -> List[Dict[str, Any]]:
        """Retrieve list of cameras currently in 'Recording' state with RTSP stream URLs."""
        devices = self.fetch_devices()
        recording_cams = []

        for item in devices:
            if (
                isinstance(item, dict) and
                str(item.get("deviceType")) == "Camera" and
                str(item.get("status")) == "Recording" and
                item.get("id") and
                item.get("name")
            ):
                cam_id = str(item.get("id")).strip()
                cam_name = str(item.get("name")).strip()
                recording_cams.append({
                    "id": cam_id,
                    "name": cam_name,
                    "deviceType": item.get("deviceType"),
                    "status": item.get("status"),
                    "rtspPrimary": self.build_rtsp_url(cam_id, 0),
                    "rtspSecondary": self.build_rtsp_url(cam_id, 1)
                })

        return recording_cams

    def build_rtsp_url(self, camera_id: str, stream_index: int = 0) -> str:
        """Construct standard NX Server RTSP stream URL."""
        user = urllib.parse.quote(self.username or "")
        pwd = urllib.parse.quote(self.password or "")
        return f"rtsp://{user}:{pwd}@{self.ip}:{self.port}/{camera_id}?stream={stream_index}"

    def send_generic_event_v4(
        self,
        rule: Dict[str, Any],
        camera_id: Optional[str] = None,
        override_caption: Optional[str] = None,
        override_description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send Generic Event to NX VMS via REST API v4:
        POST /rest/v4/events/generic
        Header:
          Authorization: Bearer <token>
          Content-Type: application/json
        Body defaults:
          { "state": "instant", "timestamp": "now" }
        Additional fields added according to rule configuration:
          - source: only when enable_source == 1
          - caption: only when enable_caption == 1 (or override_caption provided)
          - description: only when enable_description == 1
          - deviceIds: ["<camera_id>"] if camera_id has value
        """
        token = self.get_valid_token()
        url = f"{self._get_base_url()}/rest/v4/events/generic"

        payload: Dict[str, Any] = {
            "state": "instant",
            "timestamp": "now"
        }

        # 1. source: only add when enable_source is True
        enable_source = bool(rule.get("enable_source", rule.get("enableSource", False)))
        if enable_source:
            payload["source"] = str(rule.get("source") or "Senturian_AI")

        # 2. caption:
        # If override_caption is provided (e.g. Face flow), caption is explicitly set
        if override_caption is not None:
            payload["caption"] = str(override_caption)
        else:
            enable_caption = bool(rule.get("enable_caption", rule.get("enableCaption", False)))
            if enable_caption:
                payload["caption"] = str(rule.get("caption") or "")

        # 3. description: only add when enable_description is True
        enable_description = bool(rule.get("enable_description", rule.get("enableDescription", False)))
        if enable_description:
            if override_description is not None:
                payload["description"] = str(override_description)
            else:
                payload["description"] = str(rule.get("description") or "")

        # 4. deviceIds
        cam = camera_id or rule.get("camera_id") or rule.get("cameraId")
        if cam:
            cam_str = str(cam).strip()
            clean_cam = cam_str.strip("{}")
            if clean_cam:
                payload["deviceIds"] = [clean_cam]

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        res = requests.post(
            url,
            json=payload,
            headers=headers,
            timeout=self.timeout_s,
            verify=self.verify_ssl
        )

        # Retry login once if session token expired unexpectedly (401/403)
        if res.status_code in (401, 403):
            new_token = self.login()["token"]
            headers["Authorization"] = f"Bearer {new_token}"
            res = requests.post(
                url,
                json=payload,
                headers=headers,
                timeout=self.timeout_s,
                verify=self.verify_ssl
            )

        return {
            "status_code": res.status_code,
            "success": 200 <= res.status_code < 300,
            "response": res.text,
            "payload_sent": payload
        }

    def send_generic_event(
        self,
        caption: str,
        description: str = "",
        source: str = "Senturian_AI",
        camera_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Trigger Generic Event in Nx Witness for event rules, bookmarking, and notifications.
        GET/POST /api/createEvent (v3 backward compatibility)
        """
        token = self.get_valid_token()
        url = f"{self._get_base_url()}/api/createEvent"

        params = {
            "timestamp": int(time.time()),
            "caption": caption or "Senturian AI Event",
            "description": description or "",
            "source": source or "Senturian_AI",
            "eventType": "userDefinedEvent"
        }
        if camera_id:
            params["cameraId"] = camera_id

        res = requests.get(
            url,
            params=params,
            headers={"Authorization": f"Bearer {token}"},
            timeout=self.timeout_s,
            verify=self.verify_ssl
        )

        return {
            "status_code": res.status_code,
            "success": res.status_code == 200,
            "response": res.text
        }
