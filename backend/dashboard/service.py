from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from models import Product, Competitor, CompetitorProduct, ScrapeRun, PriceHistory
from dashboard.intelligence import compute_price_intelligence


def get_summary(db: Session) -> dict:
    """Get dashboard summary statistics."""
    total_products = db.query(Product).count()
    active_products = db.query(Product).filter(Product.is_active == True).count()
    total_competitors = db.query(Competitor).filter(Competitor.is_active == True).count()
    total_mappings = db.query(CompetitorProduct).filter(CompetitorProduct.is_active == True).count()
    total_scrape_runs = db.query(ScrapeRun).count()

    last_run = (
        db.query(ScrapeRun)
        .order_by(ScrapeRun.started_at.desc())
        .first()
    )

    # Calculate Market Distribution
    comparison = get_price_comparison(db)
    distribution = {"leader": 0, "competitive": 0, "overpriced": 0}
    for item in comparison:
        intel = item.get("intelligence")
        if intel and "status" in intel:
            status = str(intel["status"]).lower()
            if status in distribution:
                distribution[status] += 1

    return {
        "total_products": total_products,
        "active_products": active_products,
        "total_competitors": total_competitors,
        "total_mappings": total_mappings,
        "total_scrape_runs": total_scrape_runs,
        "status_distribution": distribution,
        "last_run": last_run,
    }


def get_price_comparison(db: Session) -> List[dict]:
    """Get side-by-side price comparison for all active products.
    
    For each product, shows our price and the latest competitor prices.
    """
    products = (
        db.query(Product)
        .filter(Product.is_active == True)
        .order_by(Product.name)
        .all()
    )

    results = []
    for product in products:
        # Get all active mappings for this product
        mappings = (
            db.query(CompetitorProduct)
            .filter(
                CompetitorProduct.product_id == product.id,
                CompetitorProduct.is_active == True,
            )
            .all()
        )

        competitor_prices = []
        for mapping in mappings:
            # Get latest price for this mapping
            latest = (
                db.query(PriceHistory)
                .filter(PriceHistory.competitor_product_id == mapping.id)
                .order_by(PriceHistory.scraped_at.desc())
                .first()
            )
            if latest:
                competitor_prices.append({
                    "competitor_id": mapping.competitor_id,
                    "competitor_name": mapping.competitor.name if mapping.competitor else "Unknown",
                    "price": float(latest.price) if latest.price else None,
                    "stock": latest.stock,
                    "price_diff": float(latest.price_diff) if latest.price_diff else None,
                    "price_diff_percent": float(latest.price_diff_percent) if latest.price_diff_percent else None,
                    "scraped_at": latest.scraped_at.isoformat() if latest.scraped_at else None,
                })

        # 3. Compute Price Intelligence
        raw_competitor_prices = [p["price"] for p in competitor_prices if p["price"] is not None]
        intelligence = None
        if product.current_price is not None:
             intelligence = compute_price_intelligence(float(product.current_price), raw_competitor_prices)

        results.append({
            "product_id": product.id,
            "product_name": product.name,
            "our_price": float(product.current_price) if product.current_price else None,
            "competitor_prices": competitor_prices,
            "intelligence": intelligence
        })

    return results
