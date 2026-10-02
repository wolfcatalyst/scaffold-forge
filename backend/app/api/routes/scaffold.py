"""Scaffold generation endpoints."""

from fastapi import APIRouter
from fastapi.responses import Response

from app.core.constraints import has_blockers, validate
from app.core.generator import build_file_tree, generate_zip, render_ai_prompt, render_tree_display
from app.schemas.config import AiPromptResponse, ScaffoldConfigSchema, TreePreviewResponse

router = APIRouter()


@router.post("/preview", response_model=TreePreviewResponse)
async def preview_tree(config: ScaffoldConfigSchema):
    """Return a folder tree preview without generating files."""
    sc = config.to_model()
    files = build_file_tree(sc)
    return TreePreviewResponse(
        files=files,
        tree_display=render_tree_display(files),
    )


@router.post("/prompt", response_model=AiPromptResponse)
async def ai_prompt(config: ScaffoldConfigSchema):
    """A ready-to-paste prompt asking any AI assistant to review the plan."""
    return AiPromptResponse(prompt=render_ai_prompt(config.to_model()))


@router.post("/generate")
async def generate_scaffold(config: ScaffoldConfigSchema):
    """Generate and return a scaffold zip file."""
    sc = config.to_model()

    # Check for blockers before generating
    results = validate(sc)
    if has_blockers(results):
        blockers = [r for r in results if r.blocks]
        return Response(
            content=f"Cannot generate: {len(blockers)} blocking constraint(s). Resolve them first.",
            status_code=422,
        )

    zip_bytes = generate_zip(sc)
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={sc.project_name}.zip"},
    )
