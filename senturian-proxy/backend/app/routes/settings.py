import os
import socket
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any

from ..config import get_all_settings, update_settings, get_host_lan_ip, get_success_records_count
from ..nx_client import NxClient
from ..queue_worker import event_queue

router = APIRouter(prefix="/api", tags=["Settings & System"])


class SettingsUpdateSchema(BaseModel):
    vms_ip: Optional[str] = None
    vms_port: Optional[int] = None
    vms_user: Optional[str] = None
    vms_password: Optional[str] = None
    sync_enabled: Optional[int] = None


class NxTestSchema(BaseModel):
    ip: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None


def generate_webhook_url(request: Request) -> str:
    """
    Generate dynamic webhook URL:
    - Resolves caller host from headers: X-Forwarded-Host or Host.
    - Preserves external port (e.g. 8080) when accessing through reverse proxy.
    - Strips default :80 port for HTTP.
    - Falls back to host LAN IP.
    """
    proto = request.headers.get("x-forwarded-proto") or "http"

    # Check X-Forwarded-Host first (passed from reverse proxy like Nginx), then Host
    raw_host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    if raw_host:
        host = raw_host.split(",")[0].strip()
        forwarded_port = request.headers.get("x-forwarded-port", "").strip()
        if ":" not in host and forwarded_port and forwarded_port not in ("80", "443"):
            host = f"{host}:{forwarded_port}"

        # Strip standard HTTP :80
        if host.endswith(":80"):
            host = host[:-3]
        return f"{proto}://{host}/api/webhook/senturian"

    lan_ip = get_host_lan_ip()
    port = int(os.getenv("PORT", "8000"))
    port_str = "" if port == 80 else f":{port}"
    return f"{proto}://{lan_ip}{port_str}/api/webhook/senturian"


@router.get("/system/info")
async def get_system_info(request: Request):
    """
    Return host system and network status:
    - Hostname and auto-detected LAN IP
    - Dynamic Webhook URL matching current caller host
    - Event queue metrics
    """
    lan_ip = get_host_lan_ip()
    port = int(os.getenv("PORT", "8000"))
    webhook_url = generate_webhook_url(request)

    return {
        "status": "online",
        "hostname": socket.gethostname(),
        "lan_ip": lan_ip,
        "port": port,
        "webhook_url": webhook_url,
        "success_records": get_success_records_count(),
        "queue_stats": event_queue.get_stats()
    }


@router.get("/settings")
async def get_settings(request: Request):
    """Get active system settings (passwords masked for security)."""
    settings = get_all_settings()
    webhook_url = generate_webhook_url(request)

    return {
        "vms_ip": settings.get("vms_ip", ""),
        "vms_port": int(settings.get("vms_port", 7001)),
        "vms_user": settings.get("vms_user", ""),
        "has_password": bool(settings.get("vms_password")),
        "sync_enabled": int(settings.get("sync_enabled", 1)),
        "webhook_url": webhook_url,
        "success_records": get_success_records_count()
    }


@router.put("/settings")
async def save_settings(data: SettingsUpdateSchema, request: Request):
    """Persist system settings and reinitialize NxClient connection."""
    updates = {}

    if data.vms_ip is not None:
        updates["vms_ip"] = data.vms_ip.strip()
    if data.vms_port is not None:
        updates["vms_port"] = str(data.vms_port)
    if data.vms_user is not None:
        updates["vms_user"] = data.vms_user.strip()
    if data.vms_password and data.vms_password.strip():
        updates["vms_password"] = data.vms_password.strip()
    if data.sync_enabled is not None:
        updates["sync_enabled"] = str(data.sync_enabled)

    update_settings(updates)

    # Reinitialize NxClient with updated settings in queue worker
    event_queue.initialize_nx_client()

    return {
        "success": True,
        "message": "Settings saved successfully",
        "settings": await get_settings(request)
    }


@router.post("/settings/nx/test")
async def test_nx_connection(data: NxTestSchema):
    """
    Test connectivity and credentials against NX VMS Server:
    - Log in and acquire Bearer token via REST API.
    - Verify token session status.
    - Query active recording cameras count.
    """
    settings = get_all_settings()

    ip = data.ip or settings.get("vms_ip", "")
    port = data.port or int(settings.get("vms_port", 7001))
    username = data.username or settings.get("vms_user", "")
    password = data.password or settings.get("vms_password", "")

    if not ip or not username or not password:
        raise HTTPException(status_code=400, detail="Missing NX Server connection parameters (IP, Username, and Password required)")

    tester = NxClient(
        ip=ip,
        port=port,
        username=username,
        password=password,
        timeout_s=8.0,
        verify_ssl=False
    )

    try:
        # 1. Log in and acquire token
        login_res = tester.login()
        token = login_res["token"]
        masked_token = f"{token[:12]}...{token[-6:]}" if len(token) > 18 else token

        # 2. Check session validity
        session_res = tester.check_session(token)

        # 3. Query active cameras
        cameras = []
        try:
            cameras = tester.get_recording_cameras()
        except Exception:
            pass

        return {
            "success": True,
            "message": "Connected to NX VMS Server successfully!",
            "bearer_token": masked_token,
            "expires_in_seconds": login_res.get("expiresInS"),
            "session_valid": session_res.get("valid", False),
            "recording_cameras_count": len(cameras),
            "sample_cameras": [
                {"id": c["id"], "name": c["name"], "status": c["status"]}
                for c in cameras[:5]
            ]
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Connection failed: {str(e)}"
        }
