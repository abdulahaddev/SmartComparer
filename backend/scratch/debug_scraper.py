import asyncio
import sys
import os
sys.path.append(os.getcwd())

from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models
from scraper.runner import run_scrape
import logging

logging.basicConfig(level=logging.INFO)

async def main():
    db = SessionLocal()
    try:
        print("Checking active mappings...")
        mappings = db.query(models.CompetitorProduct).filter(models.CompetitorProduct.is_active == True).all()
        print(f"Found {len(mappings)} active mappings.")
        for m in mappings:
            print(f"- ID: {m.id}, URL: {m.url}")
        
        print("\nStarting scrape run...")
        run = await run_scrape(db)
        print(f"\nScrape Run Result: Status={run.status}, Success={run.success_count}, Failed={run.failure_count}")
        
        # Check logs for failures
        failures = db.query(models.ScrapeLog).filter(models.ScrapeLog.run_id == run.id, models.ScrapeLog.status == "failed").all()
        if failures:
            print("\nFailures detected:")
            for f in failures:
                mapping = db.query(models.CompetitorProduct).filter(models.CompetitorProduct.id == f.competitor_product_id).first()
                print(f"URL: {mapping.url if mapping else 'Unknown'}")
                print(f"Error: {f.error_message}")
                print("-" * 20)
        else:
            print("\nNo failures in this run.")
            
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(main())
