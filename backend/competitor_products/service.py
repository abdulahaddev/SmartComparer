from sqlalchemy.orm import Session
from typing import Optional, List
from models import CompetitorProduct, Product, Competitor


def get_all(
    db: Session,
    product_id: Optional[int] = None,
    competitor_id: Optional[int] = None,
    include_inactive: bool = False,
) -> List[dict]:
    """Get all competitor product mappings with related names."""
    query = db.query(CompetitorProduct)
    if product_id:
        query = query.filter(CompetitorProduct.product_id == product_id)
    if competitor_id:
        query = query.filter(CompetitorProduct.competitor_id == competitor_id)
    if not include_inactive:
        query = query.filter(CompetitorProduct.is_active == True)

    mappings = query.order_by(CompetitorProduct.id).all()
    results = []
    for m in mappings:
        product = db.query(Product).filter(Product.id == m.product_id).first()
        competitor = db.query(Competitor).filter(Competitor.id == m.competitor_id).first()
        results.append({
            "id": m.id,
            "product_id": m.product_id,
            "competitor_id": m.competitor_id,
            "url": m.url,
            "strategy_json": m.strategy_json,
            "is_active": m.is_active,
            "last_scraped_at": m.last_scraped_at,
            "created_at": m.created_at,
            "product_name": product.name if product else None,
            "competitor_name": competitor.name if competitor else None,
        })
    return results


def get_by_id(db: Session, cp_id: int) -> Optional[CompetitorProduct]:
    """Get a single mapping by ID."""
    return db.query(CompetitorProduct).filter(CompetitorProduct.id == cp_id).first()


def create(
    db: Session,
    product_id: int,
    competitor_id: int,
    url: str,
    strategy_json: Optional[dict] = None,
) -> CompetitorProduct:
    """Create a new competitor product mapping.
    
    If an inactive mapping already exists for this product+competitor,
    reactivate it with the new URL/strategy instead of creating a duplicate.
    """
    # Validate foreign keys
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise ValueError(f"Product with id {product_id} not found")

    competitor = db.query(Competitor).filter(Competitor.id == competitor_id).first()
    if not competitor:
        raise ValueError(f"Competitor with id {competitor_id} not found")

    # Check for existing inactive mapping — reactivate instead of duplicating
    existing = (
        db.query(CompetitorProduct)
        .filter(
            CompetitorProduct.product_id == product_id,
            CompetitorProduct.competitor_id == competitor_id,
        )
        .first()
    )

    if existing:
        existing.url = url
        existing.strategy_json = strategy_json
        existing.is_active = True
        db.commit()
        db.refresh(existing)
        return existing

    cp = CompetitorProduct(
        product_id=product_id,
        competitor_id=competitor_id,
        url=url,
        strategy_json=strategy_json,
    )
    db.add(cp)
    db.commit()
    db.refresh(cp)
    return cp


def update(
    db: Session,
    cp_id: int,
    url: Optional[str] = None,
    strategy_json: Optional[dict] = None,
    is_active: Optional[bool] = None,
) -> Optional[CompetitorProduct]:
    """Update a competitor product mapping."""
    cp = get_by_id(db, cp_id)
    if not cp:
        return None

    if url is not None:
        cp.url = url
    if strategy_json is not None:
        cp.strategy_json = strategy_json
    if is_active is not None:
        cp.is_active = is_active
    elif not cp.is_active:
        # Auto-reactivate: if someone updates a deleted mapping, they want it back
        cp.is_active = True

    db.commit()
    db.refresh(cp)
    return cp


def delete(db: Session, cp_id: int) -> bool:
    """Soft-delete a mapping."""
    cp = get_by_id(db, cp_id)
    if not cp:
        return False
    cp.is_active = False
    db.commit()
    return True
