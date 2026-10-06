import json
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
from ..queue_worker import event_queue

router = APIRouter(prefix="/api/webhook", tags=["Webhook"])


@router.post("/senturian")
async def receive_senturian_webhook(request: Request):
    """
    Webhook endpoint for Senturian AI video analytics:
    - Receives incoming HTTP POST data.
    - Strips heavy image/photo fields ("photo", "fullImage", etc.).
    - Enqueues into in-memory FIFO queue.
    - Returns HTTP 200 OK immediately (<5ms) to prevent timeout or retries from Senturian.
    - Background worker processes event and immediately releases memory.
    """
    client_ip = request.client.host if request.client else "unknown"

    try:
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type:
            payload = await request.json()
        else:
            raw_body = await request.body()
            try:
                payload = json.loads(raw_body.decode("utf-8"))
            except Exception:
                payload = {"raw_text": raw_body.decode("utf-8", errors="replace")}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid webhook payload: {str(e)}")

    # Enqueue into asynchronous processing queue
    result = await event_queue.enqueue(payload, client_ip)

    return JSONResponse(
        status_code=200,
        content={
            "status": "success",
            "message": "Event received and queued for processing",
            "event_id": result["event_id"],
            "queued_at": result["queued_at"]
        }
    )


@router.get("/stats")
async def get_webhook_stats():
    """Retrieve event queue metrics (queue size, total received, total processed, etc.)."""
    return event_queue.get_stats()
