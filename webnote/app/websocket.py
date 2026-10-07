import logging
from typing import Set
from fastapi import WebSocket

logger = logging.getLogger("webnote.websocket")

class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info(f"WebSocket client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message: dict, exclude: WebSocket | None = None):
        dead_connections = []
        for connection in list(self.active_connections):
            if connection == exclude:
                continue
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.warning(f"Error broadcasting to client, removing: {e}")
                dead_connections.append(connection)

        for dead in dead_connections:
            self.disconnect(dead)

manager = ConnectionManager()
