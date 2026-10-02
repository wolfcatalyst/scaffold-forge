"""App preferences and runtime/port endpoints."""

from fastapi import APIRouter, HTTPException

from app.core import settings
from app.schemas.config import PortsUpdate, SettingsUpdate

router = APIRouter()


@router.get("")
async def get_settings():
    return settings.load_settings()


@router.put("")
async def update_settings(update: SettingsUpdate):
    try:
        return settings.save_settings(update.model_dump(exclude_none=True))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/runtime")
async def get_runtime():
    return settings.runtime_info()


@router.get("/ports/check")
async def check_port(port: int):
    return {"port": port, "available": settings.port_available(port)}


@router.put("/ports")
async def update_ports(update: PortsUpdate):
    try:
        settings.save_ports(update.backend_port, update.frontend_port)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return settings.runtime_info()
