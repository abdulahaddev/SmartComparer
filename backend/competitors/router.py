from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from auth.dependencies import get_current_user
from schemas import CompetitorOut, CompetitorCreate, CompetitorUpdate
from competitors import service


router = APIRouter(prefix="/competitors", tags=["Competitors"])


@router.get("", response_model=list[CompetitorOut])
async def list_competitors(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """List all competitors."""
    competitors = service.get_competitors(db, include_inactive)
    return [CompetitorOut.model_validate(c) for c in competitors]


@router.get("/{competitor_id}", response_model=CompetitorOut)
async def get_competitor(
    competitor_id: int,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """Get a single competitor by ID."""
    competitor = service.get_competitor_by_id(db, competitor_id)
    if not competitor:
        raise HTTPException(status_code=404, detail="Competitor not found")
    return CompetitorOut.model_validate(competitor)


@router.post("", response_model=CompetitorOut, status_code=201)
async def create_competitor(
    data: CompetitorCreate,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """Create a new competitor."""
    competitor = service.create_competitor(db, data.name, data.base_url)
    return CompetitorOut.model_validate(competitor)


@router.put("/{competitor_id}", response_model=CompetitorOut)
async def update_competitor(
    competitor_id: int,
    data: CompetitorUpdate,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """Update a competitor."""
    competitor = service.update_competitor(
        db, competitor_id, data.name, data.base_url, data.is_active
    )
    if not competitor:
        raise HTTPException(status_code=404, detail="Competitor not found")
    return CompetitorOut.model_validate(competitor)


@router.delete("/{competitor_id}")
async def delete_competitor(
    competitor_id: int,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """Soft-delete a competitor."""
    success = service.delete_competitor(db, competitor_id)
    if not success:
        raise HTTPException(status_code=404, detail="Competitor not found")
    return {"message": "Competitor deactivated"}
