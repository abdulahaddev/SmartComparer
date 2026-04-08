import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session

from database import get_db
from auth.dependencies import get_current_user
from schemas import ScrapeRunOut, ScrapeLogOut
from scraping import service
from scraper.runner import run_scrape


router = APIRouter(prefix="/scrape", tags=["Scraping"])


@router.post("/run", response_model=ScrapeRunOut)
async def trigger_scrape(
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """Trigger a new scrape run. Runs synchronously and returns result."""
    run = await run_scrape(db)
    return ScrapeRunOut.model_validate(run)


@router.get("/runs", response_model=list[ScrapeRunOut])
async def list_runs(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """List past scrape runs."""
    runs = service.get_runs(db, limit)
    return [ScrapeRunOut.model_validate(r) for r in runs]


@router.get("/runs/{run_id}", response_model=ScrapeRunOut)
async def get_run(
    run_id: int,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """Get details of a specific scrape run."""
    run = service.get_run_by_id(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Scrape run not found")
    return ScrapeRunOut.model_validate(run)


@router.get("/runs/{run_id}/logs", response_model=list[ScrapeLogOut])
async def get_run_logs(
    run_id: int,
    db: Session = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """Get scrape logs for a specific run."""
    run = service.get_run_by_id(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Scrape run not found")
    logs = service.get_run_logs(db, run_id)
    return [ScrapeLogOut(**log) for log in logs]
