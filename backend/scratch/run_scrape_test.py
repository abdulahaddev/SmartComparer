import asyncio
import sys
import os

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

sys.path.insert(0, os.path.dirname(__file__) + "/..")

from database import SessionLocal
from models import CompetitorProduct
from scraper.engine import scrape_with_retry

async def main():
    db = SessionLocal()
    mappings = db.query(CompetitorProduct).filter(CompetitorProduct.is_active == True).all()
    
    print(f"Found {len(mappings)} active mappings\n")
    
    for m in mappings:
        strategy = m.strategy_json or {}
        print(f"Scraping ID:{m.id} — {m.url[:60]}...")
        result = await scrape_with_retry(m.url, strategy)
        status = "✓" if result["success"] else "✗"
        price = result.get("price", "N/A")
        error = result.get("error", "")
        attempts = result.get("attempts", 0)
        method = result.get("method", "?")
        raw_price = result.get("raw_price", "")
        print(f"  {status} Price: {price} | Method: {method} | Attempts: {attempts}")
        if error:
            print(f"  Error: {error}")
            print(f"  Raw Extracted Text: '{raw_price}'")
        print()
    
    db.close()

if __name__ == "__main__":
    asyncio.run(main())
