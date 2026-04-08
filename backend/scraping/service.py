from sqlalchemy.orm import Session
from typing import Optional, List
from models import ScrapeRun, ScrapeLog, CompetitorProduct


def get_runs(db: Session, limit: int = 50) -> List[ScrapeRun]:
    """Get past scrape runs ordered by most recent."""
    return (
        db.query(ScrapeRun)
        .order_by(ScrapeRun.started_at.desc())
        .limit(limit)
        .all()
    )


def get_run_by_id(db: Session, run_id: int) -> Optional[ScrapeRun]:
    """Get a single scrape run by ID."""
    return db.query(ScrapeRun).filter(ScrapeRun.id == run_id).first()


def get_run_logs(db: Session, run_id: int) -> List[dict]:
    """Get all scrape logs for a specific run with related names."""
    logs = (
        db.query(ScrapeLog)
        .filter(ScrapeLog.run_id == run_id)
        .order_by(ScrapeLog.created_at)
        .all()
    )

    results = []
    for log in logs:
        cp = db.query(CompetitorProduct).filter(CompetitorProduct.id == log.competitor_product_id).first()
        product_name = cp.product.name if cp and cp.product else None
        competitor_name = cp.competitor.name if cp and cp.competitor else None
        results.append({
            "id": log.id,
            "competitor_product_id": log.competitor_product_id,
            "run_id": log.run_id,
            "status": log.status,
            "attempt_count": log.attempt_count,
            "error_message": log.error_message,
            "created_at": log.created_at,
            "product_name": product_name,
            "competitor_name": competitor_name,
        })
    return results
