import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse

from app.database import init_db, get_document, update_document
from app.websocket import manager
from app.api import router as api_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("webnote")

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("WebNote initialized database and storage.")
    yield

app = FastAPI(title="WebNote", lifespan=lifespan)
app.include_router(api_router)

STATIC_DIR = Path(__file__).parent / "static"

@app.api_route("/", methods=["GET", "HEAD"])
async def get_index():
    return FileResponse(STATIC_DIR / "index.html")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        doc = get_document()
        await websocket.send_json({
            "type": "init",
            "version": doc["version"],
            "line1": doc["line1"],
            "line2": doc["line2"],
            "line3": doc["line3"],
            "content": doc["content"],
            "updated_at": doc["updated_at"]
        })

        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
            except Exception:
                logger.warning("Received invalid JSON message")
                continue

            msg_type = msg.get("type")

            if msg_type in ("update", "update_lines", "save_editor"):
                line1 = msg.get("line1")
                line2 = msg.get("line2")
                line3 = msg.get("line3")
                content = msg.get("content")
                client_version = msg.get("version")

                updated_doc = update_document(
                    line1=line1,
                    line2=line2,
                    line3=line3,
                    content=content,
                    client_version=client_version
                )

                broadcast_msg = {
                    "type": "document_update",
                    "subtype": msg_type,
                    "version": updated_doc["version"],
                    "line1": updated_doc["line1"],
                    "line2": updated_doc["line2"],
                    "line3": updated_doc["line3"],
                    "content": updated_doc["content"],
                    "updated_at": updated_doc["updated_at"]
                }
                await websocket.send_json({
                    "type": "ack",
                    "subtype": msg_type,
                    "version": updated_doc["version"]
                })
                await manager.broadcast(broadcast_msg, exclude=websocket)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
