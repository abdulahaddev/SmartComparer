import random
from datetime import datetime, timedelta
import sys
import os

# Add parent directory to sys.path to allow importing from parent
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models import Product, Competitor, CompetitorProduct, ScrapeRun, PriceHistory, ScrapeLog

def seed():
    db = SessionLocal()
    try:
        # 1. Define Competitors
        competitor_names = [
            "TechLand", 
            "Ryans Computers", 
            "Star Tech", 
            "Gadget & Gear", 
            "Pickaboo"
        ]
        competitors = []
        for name in competitor_names:
            comp = db.query(Competitor).filter(Competitor.name == name).first()
            if not comp:
                comp = Competitor(name=name, base_url=f"https://www.{name.lower().replace(' ', '')}.com.bd")
                db.add(comp)
                db.flush()
            competitors.append(comp)
        
        print(f"Ensured {len(competitors)} competitors exist.")

        # 2. Get all products
        products = db.query(Product).all()
        if not products:
            print("No products found to seed. Please sync from WooCommerce first.")
            return

        print(f"Seeding data for {len(products)} products.")

        # 3. Create Mappings (if not exist)
        for prod in products:
            for comp in competitors:
                mapping = db.query(CompetitorProduct).filter(
                    CompetitorProduct.product_id == prod.id,
                    CompetitorProduct.competitor_id == comp.id
                ).first()
                if not mapping:
                    mapping = CompetitorProduct(
                        product_id=prod.id,
                        competitor_id=comp.id,
                        url=f"{comp.base_url}/p/{prod.wp_product_id}",
                        strategy_json={"price_selector": ".price", "wait_for": ".price"}
                    )
                    db.add(mapping)
        db.flush()
        print("Mappings created.")

        # 4. Generate 30 Days of History
        mappings = db.query(CompetitorProduct).all()
        start_date = datetime.utcnow() - timedelta(days=30)
        
        # We'll pre-determine the "Strategy" for each product:
        # ~65% should be Competitive (Us cheap), ~35% Overpriced (They cheap)
        product_strategies = {}
        for prod in products:
            product_strategies[prod.id] = "COMPETITIVE" if random.random() < 0.65 else "OVERPRICED"

        for day_offset in range(31):
            run_date = start_date + timedelta(days=day_offset)
            
            # Create a Scrape Run for this day
            run = ScrapeRun(
                started_at=run_date,
                finished_at=run_date + timedelta(minutes=random.randint(5, 15)),
                status="completed",
                total_products=len(mappings),
                success_count=len(mappings),
                failure_count=0
            )
            db.add(run)
            db.flush()

            for mapping in mappings:
                prod = mapping.product
                strategy = product_strategies.get(prod.id, "COMPETITIVE")
                our_price = float(prod.current_price) if prod.current_price else 1000.0
                
                # Base market price for this mapping
                # Initialize base on first day, then drift
                if day_offset == 0:
                    if strategy == "COMPETITIVE":
                        # We are top 1-2. Competitors should be slightly higher.
                        # Variance 10-15%
                        base_price = our_price * (1 + random.uniform(0.01, 0.15))
                    else:
                        # We are overpriced. At least one competitor is cheaper.
                        # Some competitors cheap, some high
                        if random.random() < 0.4: # 40% chance this specific comp is the "beater"
                            base_price = our_price * (1 - random.uniform(0.05, 0.15))
                        else:
                            base_price = our_price * (1 + random.uniform(0.05, 0.15))
                    
                    # Store mapping specific base to drift from (using a hacky local state or just recalculating)
                    # For simplicity in this script, we'll re-derive with drift
                    mapping._temp_price = base_price
                else:
                    # Apply daily drift +/- 0.5%
                    drift = 1 + random.uniform(-0.005, 0.005)
                    # We need to persist the price from the previous iteration.
                    # Since we are iterating day by day, we can just use the mapping object's temp attr
                    mapping._temp_price = getattr(mapping, '_temp_price', our_price) * drift

                current_price = mapping._temp_price
                
                # Price stats
                diff = current_price - our_price
                diff_pct = (diff / our_price) * 100 if our_price else 0

                history = PriceHistory(
                    competitor_product_id=mapping.id,
                    run_id=run.id,
                    price=current_price,
                    stock="In Stock" if random.random() > 0.05 else "Out of Stock",
                    price_diff=diff,
                    price_diff_percent=diff_pct,
                    scraped_at=run_date
                )
                db.add(history)
            
            if day_offset % 5 == 0:
                print(f"Processed Day {day_offset}/30...")
                db.commit() # Intermittent commits for safety

        db.commit()
        print("Success! seeded 30 days of history and 5 competitors.")

    except Exception as e:
        db.rollback()
        print(f"Error seeding data: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    seed()
