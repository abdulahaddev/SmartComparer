from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from auth.dependencies import get_current_user
from schemas import CompetitorProductOut, CompetitorProductCreate, CompetitorProductUpdate
from competitor_products import service


router = APIRouter(prefix="/competitor-products", tags=["Competitor Products"])


@router.get("", response_model=list[CompetitorProductOut])
async def list_mappings(
    product_id: Optional[int] = None,
    competitor_id: Optional[int] = None,
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """List all competitor product mappings with optional filters."""
    results = service.get_all(db, product_id, competitor_id, include_inactive)
    return [CompetitorProductOut(**r) for r in results]


@router.get("/{cp_id}", response_model=CompetitorProductOut)
async def get_mapping(
    cp_id: int,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """Get a single mapping by ID."""
    cp = service.get_by_id(db, cp_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Mapping not found")

    product = cp.product
    competitor = cp.competitor
    return CompetitorProductOut(
        id=cp.id,
        product_id=cp.product_id,
        competitor_id=cp.competitor_id,
        url=cp.url,
        strategy_json=cp.strategy_json,
        is_active=cp.is_active,
        last_scraped_at=cp.last_scraped_at,
        created_at=cp.created_at,
        product_name=product.name if product else None,
        competitor_name=competitor.name if competitor else None,
    )


@router.post("", response_model=CompetitorProductOut, status_code=201)
async def create_mapping(
    data: CompetitorProductCreate,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """Create a new competitor product mapping."""
    try:
        cp = service.create(db, data.product_id, data.competitor_id, data.url, data.strategy_json)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    product = cp.product
    competitor = cp.competitor
    return CompetitorProductOut(
        id=cp.id,
        product_id=cp.product_id,
        competitor_id=cp.competitor_id,
        url=cp.url,
        strategy_json=cp.strategy_json,
        is_active=cp.is_active,
        last_scraped_at=cp.last_scraped_at,
        created_at=cp.created_at,
        product_name=product.name if product else None,
        competitor_name=competitor.name if competitor else None,
    )


@router.put("/{cp_id}", response_model=CompetitorProductOut)
async def update_mapping(
    cp_id: int,
    data: CompetitorProductUpdate,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """Update a competitor product mapping."""
    cp = service.update(db, cp_id, data.url, data.strategy_json, data.is_active)
    if not cp:
        raise HTTPException(status_code=404, detail="Mapping not found")

    product = cp.product
    competitor = cp.competitor
    return CompetitorProductOut(
        id=cp.id,
        product_id=cp.product_id,
        competitor_id=cp.competitor_id,
        url=cp.url,
        strategy_json=cp.strategy_json,
        is_active=cp.is_active,
        last_scraped_at=cp.last_scraped_at,
        created_at=cp.created_at,
        product_name=product.name if product else None,
        competitor_name=competitor.name if competitor else None,
    )


@router.delete("/{cp_id}")
async def delete_mapping(
    cp_id: int,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """Soft-delete a mapping."""
    success = service.delete(db, cp_id)
    if not success:
        raise HTTPException(status_code=404, detail="Mapping not found")
    return {"message": "Mapping deactivated"}
