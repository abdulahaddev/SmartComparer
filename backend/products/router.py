from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from auth.dependencies import get_current_user
from schemas import ProductOut, ProductListOut, PriceHistoryOut, SyncResult
from products import service


router = APIRouter(prefix="/products", tags=["Products"])


@router.get("", response_model=ProductListOut)
async def list_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """List all products with optional filters and pagination."""
    total, products = service.get_products(db, skip, limit, is_active, search)
    return ProductListOut(total=total, products=[ProductOut.model_validate(p) for p in products])


@router.get("/{product_id}", response_model=ProductOut)
async def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """Get a single product by ID."""
    product = service.get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return ProductOut.model_validate(product)


@router.get("/{product_id}/price-history", response_model=list[PriceHistoryOut])
async def get_price_history(
    product_id: int,
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """Get price history for a specific product."""
    product = service.get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    history = service.get_price_history(db, product_id, limit)
    return [PriceHistoryOut(**h) for h in history]


@router.post("/sync", response_model=SyncResult)
async def sync_products(
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """Trigger WordPress product sync."""
    result = service.sync_from_wordpress(db)
    return SyncResult(**result)
