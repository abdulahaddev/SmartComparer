import asyncio
import logging
from datetime import datetime
from decimal import Decimal
from sqlalchemy.orm import Session

from models import CompetitorProduct, ScrapeRun, PriceHistory, ScrapeLog, Product
from scraper.engine import scrape_with_retry
from config import settings

logger = logging.getLogger(__name__)


async def run_scrape(db: Session) -> ScrapeRun:
    """Execute a full scrape run.
    
    1. Creates a scrape_run entry
    2. Gets all active competitor_product mappings
    3. Scrapes each one with concurrency limits
    4. Stores results in price_history and scrape_logs
    5. Updates the scrape_run with results
    """
    # 1. Create run
    run = ScrapeRun(status="running")
    db.add(run)
    db.commit()
    db.refresh(run)
    logger.info(f"Started scrape run #{run.id}")

    # 2. Get active mappings
    mappings = (
        db.query(CompetitorProduct)
        .filter(CompetitorProduct.is_active == True)
        .all()
    )
    run.total_products = len(mappings)
    db.commit()

    if not mappings:
        run.status = "completed"
        run.finished_at = datetime.utcnow()
        db.commit()
        logger.info("No active mappings to scrape")
        return run

    # 3. Scrape with concurrency limit
    semaphore = asyncio.Semaphore(settings.MAX_CONCURRENCY)
    success_count = 0
    failure_count = 0

    async def scrape_one(mapping: CompetitorProduct):
        nonlocal success_count, failure_count

        async with semaphore:
            # Add delay between requests
            await asyncio.sleep(settings.REQUEST_DELAY_SECONDS)

            strategy = mapping.strategy_json or {}
            result = await scrape_with_retry(mapping.url, strategy)

            # Get our product's current price for diff calculation
            product = db.query(Product).filter(Product.id == mapping.product_id).first()
            our_price = product.current_price if product else None

            # Calculate price diff
            price_diff = None
            price_diff_percent = None
            if result["price"] is not None and our_price is not None:
                try:
                    scraped = Decimal(str(result["price"]))
                    ours = Decimal(str(our_price))
                    price_diff = scraped - ours
                    if ours > 0:
                        price_diff_percent = (price_diff / ours) * 100
                except Exception:
                    pass

            # 4. Store price history
            history = PriceHistory(
                competitor_product_id=mapping.id,
                run_id=run.id,
                price=result["price"],
                stock=result.get("stock", "unknown"),
                price_diff=price_diff,
                price_diff_percent=price_diff_percent,
            )
            db.add(history)

            # Store scrape log
            log_status = "success" if result["success"] else "failed"
            log = ScrapeLog(
                competitor_product_id=mapping.id,
                run_id=run.id,
                status=log_status,
                attempt_count=result.get("attempts", 1),
                error_message=result.get("error"),
            )
            db.add(log)

            # Update last_scraped_at
            mapping.last_scraped_at = datetime.utcnow()

            if result["success"]:
                success_count += 1
                logger.info(f"✓ Scraped {mapping.url} — price: {result['price']}")
            else:
                failure_count += 1
                logger.warning(f"✗ Failed {mapping.url} — {result.get('error')}")

            db.commit()

    # Run all scrape tasks
    try:
        tasks = [scrape_one(m) for m in mappings]
        await asyncio.gather(*tasks, return_exceptions=True)
        run.status = "completed"
    except Exception as e:
        logger.error(f"Scrape run #{run.id} failed: {str(e)}")
        run.status = "failed"

    # 5. Update run summary
    run.success_count = success_count
    run.failure_count = failure_count
    run.finished_at = datetime.utcnow()
    db.commit()
    db.refresh(run)

    logger.info(
        f"Scrape run #{run.id} finished — "
        f"success: {success_count}, failed: {failure_count}"
    )
    return run
