"""Forge Configuration editor endpoints (options, steps, constraints)."""

from typing import Any

from fastapi import APIRouter, Body, HTTPException

from app.core import forge_config

router = APIRouter()


def _state() -> dict[str, Any]:
    data = forge_config.load_all()
    return {
        **data,
        "customized": {n: forge_config.is_customized(n) for n in forge_config.CONFIG_NAMES},
        "known_fields": forge_config.known_fields(data["options"]),
    }


def _check_name(name: str) -> None:
    if name not in forge_config.CONFIG_NAMES:
        raise HTTPException(status_code=404, detail="Unknown config file")


@router.get("")
async def get_config():
    return _state()


@router.get("/export")
async def export_config():
    return forge_config.export_pack()


@router.post("/import")
async def import_config(pack: dict[str, Any] = Body(...)):
    try:
        forge_config.import_pack(pack)
    except forge_config.ConfigValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors)
    return _state()


@router.put("")
async def save_configs(updates: dict[str, Any] = Body(...)):
    """Save several files at once, e.g. removing an option group and the steps that used it."""
    try:
        forge_config.save_many(updates)
    except forge_config.ConfigValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors)
    return _state()


@router.put("/{name}")
async def save_config(name: str, data: Any = Body(...)):
    _check_name(name)
    try:
        forge_config.save(name, data)
    except forge_config.ConfigValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors)
    return _state()


@router.delete("/{name}")
async def reset_config(name: str):
    _check_name(name)
    try:
        forge_config.reset(name)
    except forge_config.ConfigValidationError as e:
        raise HTTPException(status_code=422, detail=e.errors)
    return _state()


@router.delete("")
async def reset_all_config():
    forge_config.reset()
    return _state()
