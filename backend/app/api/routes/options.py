"""Options and validation endpoints."""

from fastapi import APIRouter

from app.core.constraints import has_blockers, load_constraints, validate
from app.core.options import load_options, load_steps
from app.schemas.config import (
    ConstraintResultSchema,
    ScaffoldConfigSchema,
    ValidationResponse,
)

router = APIRouter()


@router.get("/options")
async def get_options():
    """Return all available options and constraints."""
    return {
        "options": load_options(),
        "constraints": load_constraints(),
        "steps": load_steps(),
    }


@router.post("/validate", response_model=ValidationResponse)
async def validate_config(config: ScaffoldConfigSchema):
    """Validate a scaffold config against all constraints."""
    sc = config.to_model()
    results = validate(sc)
    return ValidationResponse(
        valid=not has_blockers(results),
        has_blockers=has_blockers(results),
        results=[
            ConstraintResultSchema(
                constraint_id=r.constraint_id,
                severity=r.severity.value,
                message=r.message,
                war_story=r.war_story,
                then=r.then,
            )
            for r in results
        ],
    )
