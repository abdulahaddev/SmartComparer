from sqlalchemy.orm import Session
from typing import Optional, List
from models import Competitor


def get_competitors(db: Session, include_inactive: bool = False) -> List[Competitor]:
    """Get all competitors."""
    query = db.query(Competitor)
    if not include_inactive:
        query = query.filter(Competitor.is_active == True)
    return query.order_by(Competitor.name).all()


def get_competitor_by_id(db: Session, competitor_id: int) -> Optional[Competitor]:
    """Get a single competitor by ID."""
    return db.query(Competitor).filter(Competitor.id == competitor_id).first()


def create_competitor(db: Session, name: str, base_url: str) -> Competitor:
    """Create a new competitor."""
    competitor = Competitor(name=name, base_url=base_url)
    db.add(competitor)
    db.commit()
    db.refresh(competitor)
    return competitor


def update_competitor(
    db: Session,
    competitor_id: int,
    name: Optional[str] = None,
    base_url: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> Optional[Competitor]:
    """Update an existing competitor."""
    competitor = get_competitor_by_id(db, competitor_id)
    if not competitor:
        return None

    if name is not None:
        competitor.name = name
    if base_url is not None:
        competitor.base_url = base_url
    if is_active is not None:
        competitor.is_active = is_active

    db.commit()
    db.refresh(competitor)
    return competitor


def delete_competitor(db: Session, competitor_id: int) -> bool:
    """Soft-delete a competitor (set is_active = False)."""
    competitor = get_competitor_by_id(db, competitor_id)
    if not competitor:
        return False
    competitor.is_active = False
    db.commit()
    return True
