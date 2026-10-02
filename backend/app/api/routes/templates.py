"""Template CRUD endpoints."""

from fastapi import APIRouter, HTTPException

from app.core.templates import delete_template, get_template, list_templates, save_template
from app.schemas.config import TemplateSaveRequest, TemplateResponse

router = APIRouter()


@router.get("/")
async def list_all_templates():
    return list_templates()


@router.get("/{template_id}")
async def get_single_template(template_id: str):
    t = get_template(template_id)
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return t


@router.post("/", response_model=TemplateResponse)
async def create_template(req: TemplateSaveRequest):
    tid = save_template(req.name, req.config)
    return TemplateResponse(id=tid, name=req.name, config=req.config)


@router.delete("/{template_id}")
async def remove_template(template_id: str):
    if not delete_template(template_id):
        raise HTTPException(status_code=404, detail="Template not found")
    return {"deleted": True}
