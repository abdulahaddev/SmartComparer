from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from auth.dependencies import get_current_user
from schemas import DashboardSummary, ScrapeRunOut, PriceComparisonItem
from dashboard import service


router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def get_summary(
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """Get dashboard summary statistics."""
    result = service.get_summary(db)
    last_run = None
    if result["last_run"]:
        last_run = ScrapeRunOut.model_validate(result["last_run"])
    return DashboardSummary(
        total_products=result["total_products"],
        active_products=result["active_products"],
        total_competitors=result["total_competitors"],
        total_mappings=result["total_mappings"],
        total_scrape_runs=result["total_scrape_runs"],
        last_run=last_run,
    )


@router.get("/price-comparison", response_model=list[PriceComparisonItem])
async def get_price_comparison(
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """Get side-by-side price comparison for all products."""
    results = service.get_price_comparison(db)
    return [PriceComparisonItem(**r) for r in results]
