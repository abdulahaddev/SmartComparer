import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.getcwd())

from database import SessionLocal
from scraper.runner import run_scrape
from models import ScrapeLog

async def main():
    db = SessionLocal()
    try:
        print("Starting scrape run...")
        res = await run_scrape(db)
        print(f"Run ID: {res.id}, Status: {res.status}")
        
        logs = db.query(ScrapeLog).filter(ScrapeLog.run_id == res.id).all()
        for l in logs:
            msg = l.error_message if l.status == "failed" else "Success"
            print(f" - Product {l.competitor_product_id}: {l.status} ({msg})")
            
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(main())
