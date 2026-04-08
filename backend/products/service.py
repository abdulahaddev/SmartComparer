from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List
from models import Product, PriceHistory, CompetitorProduct
from wp_database import WPSessionLocal
from config import settings


def get_products(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
):
    """Get paginated list of products with optional filters."""
    query = db.query(Product)
    if is_active is not None:
        query = query.filter(Product.is_active == is_active)
    if search:
        query = query.filter(Product.name.ilike(f"%{search}%"))
    total = query.count()
    products = query.order_by(Product.name).offset(skip).limit(limit).all()
    return total, products


def get_product_by_id(db: Session, product_id: int) -> Optional[Product]:
    """Get a single product by ID."""
    return db.query(Product).filter(Product.id == product_id).first()


def get_price_history(
    db: Session,
    product_id: int,
    limit: int = 100,
) -> List[dict]:
    """Get price history for a product across all competitors."""
    # Get all competitor_product mappings for this product
    mappings = (
        db.query(CompetitorProduct)
        .filter(CompetitorProduct.product_id == product_id)
        .all()
    )
    mapping_ids = [m.id for m in mappings]

    if not mapping_ids:
        return []

    histories = (
        db.query(PriceHistory)
        .filter(PriceHistory.competitor_product_id.in_(mapping_ids))
        .order_by(PriceHistory.scraped_at.desc())
        .limit(limit)
        .all()
    )

    results = []
    for h in histories:
        cp = db.query(CompetitorProduct).filter(CompetitorProduct.id == h.competitor_product_id).first()
        competitor_name = cp.competitor.name if cp and cp.competitor else "Unknown"
        results.append({
            "id": h.id,
            "competitor_product_id": h.competitor_product_id,
            "run_id": h.run_id,
            "price": h.price,
            "stock": h.stock,
            "price_diff": h.price_diff,
            "price_diff_percent": h.price_diff_percent,
            "scraped_at": h.scraped_at,
            "competitor_name": competitor_name,
        })

    return results


def sync_from_wordpress(db: Session) -> dict:
    """Sync products from WordPress database into SmartCompare."""
    wp_db = WPSessionLocal()
    prefix = settings.WP_TABLE_PREFIX

    try:
        # Query WP products (simple + variations)
        sql = text(f"""
            SELECT p.ID, p.post_title, pm.meta_value AS price
            FROM {prefix}posts p
            LEFT JOIN {prefix}postmeta pm ON p.ID = pm.post_id AND pm.meta_key = '_price'
            WHERE p.post_type IN ('product', 'product_variation')
              AND p.post_status = 'publish'
        """)
        wp_products = wp_db.execute(sql).fetchall()

        inserted = 0
        updated = 0
        wp_ids = set()
        seen_ids = set()

        for row in wp_products:
            wp_id = row[0]
            name = row[1] or ""
            price = row[2]
            wp_ids.add(wp_id)

            # Skip if we already processed this wp_id in this batch
            if wp_id in seen_ids:
                continue
            seen_ids.add(wp_id)

            # Try to parse price
            try:
                price_val = float(price) if price else None
            except (ValueError, TypeError):
                price_val = None

            # Check if product exists
            existing = db.query(Product).filter(Product.wp_product_id == wp_id).first()

            if existing:
                # Update if changed
                changed = False
                if existing.name != name:
                    existing.name = name
                    changed = True
                if price_val is not None and existing.current_price != price_val:
                    existing.current_price = price_val
                    changed = True
                if not existing.is_active:
                    existing.is_active = True
                    changed = True
                if changed:
                    updated += 1
            else:
                # Insert new
                new_product = Product(
                    wp_product_id=wp_id,
                    name=name,
                    current_price=price_val,
                    is_active=True,
                )
                db.add(new_product)
                db.flush()  # Flush so subsequent queries find this product
                inserted += 1

        # Deactivate products no longer in WP
        deactivated = 0
        all_sc_products = db.query(Product).filter(Product.is_active == True).all()
        for p in all_sc_products:
            if p.wp_product_id not in wp_ids:
                p.is_active = False
                deactivated += 1

        db.commit()

        return {
            "inserted": inserted,
            "updated": updated,
            "deactivated": deactivated,
            "total_wp_products": len(wp_products),
        }

    finally:
        wp_db.close()
