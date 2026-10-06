import os
import sys
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from .config import init_database, get_host_lan_ip
from .queue_worker import event_queue
from .routes import webhook, settings, rules


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables and default data
    init_database()
    # Start background event processing worker
    event_queue.start_worker()

    port = int(os.getenv("PORT", "8000"))
    lan_ip = get_host_lan_ip()
    port_str = "" if port == 80 else f":{port}"

    print("==================================================================")
    print("   SENTURIAN TO NX_VMS INTEGRATION PROXY SERVICE (PYTHON BACKEND) ")
    print("==================================================================")
    print(f" * Backend API       : http://{lan_ip}{port_str}/")
    print(f" * Senturian Webhook : http://{lan_ip}{port_str}/api/webhook/senturian")
    print(f" * API Documentation : http://{lan_ip}{port_str}/docs")
    print("==================================================================")

    yield

    # Stop background queue worker on application shutdown
    await event_queue.stop_worker()


app = FastAPI(
    title="Senturian to NX_VMS Integration Proxy",
    description="AI Event Forwarding & Camera Event Mapping Bridge between Senturian and Network Optix (NX) VMS",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS to allow frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(webhook.router)
app.include_router(settings.router)
app.include_router(rules.router)


@app.api_route("/", methods=["GET", "HEAD"], response_class=HTMLResponse)
async def serve_index():
    """Health status endpoint for root path."""
    return HTMLResponse("<h1>Senturian to NX_VMS Proxy Backend is Running</h1>")
