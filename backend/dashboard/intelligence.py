from typing import List, Optional, Dict, Any
from decimal import Decimal

def compute_price_intelligence(our_price: float, competitor_prices: List[float]) -> Dict[str, Any]:
    """
    Computes pricing insights based on market positioning.
    
    Rules follows the deterministic structure provided in user requirements.
    """
    if not competitor_prices:
        return {
            "min_price": None,
            "max_price": None,
            "avg_price": None,
            "rank": 1,
            "total_competitors": 0,
            "status": "LEADER",
            "alert": None,
            "opportunity": None,
            "market_type": "STABLE",
            "recommended_price": our_price
        }

    # 1. Base Metrics
    valid_prices = sorted(competitor_prices)
    min_price = valid_prices[0]
    max_price = valid_prices[-1]
    avg_price = sum(valid_prices) / len(valid_prices)
    
    # Calculate Rank (1-based)
    all_prices = sorted(valid_prices + [our_price])
    # Use index of first occurrence for our_price rank
    rank = all_prices.index(our_price) + 1
    
    price_diff = our_price - min_price
    price_diff_percent = (price_diff / min_price) * 100 if min_price > 0 else 0

    # 2. Insight Rules
    # 3.1 Price Position
    if our_price > min_price:
        status = "OVERPRICED"
    elif our_price == min_price:
        status = "COMPETITIVE"
    else:
        status = "LEADER"

    # 3.2 Risk Detection
    alert = None
    if price_diff_percent > 5:
        alert = "HIGH_RISK"
    elif price_diff_percent > 0:
        alert = "MEDIUM_RISK"

    # 3.3 Pricing Opportunity
    opportunity = None
    if our_price < min_price:
        opportunity = "INCREASE_PRICE"
    elif our_price > min_price:
        opportunity = "DECREASE_PRICE"

    # 3.4 Market Structure
    spread = max_price - min_price
    spread_percent = (spread / min_price) * 100 if min_price > 0 else 0
    market_type = "VOLATILE" if spread_percent > 20 else "STABLE"

    # 3.5 Recommended Price
    if status == "OVERPRICED":
        recommended_price = min_price - 1
    elif status == "LEADER":
        # Rule: min(our_price * 1.05, min_price)
        recommended_price = min(our_price * 1.05, min_price)
    else:
        recommended_price = our_price

    # Rounding for recommended price (Professional look)
    # If >= 10, round to integer. If < 10, round to 1 decimal.
    if recommended_price >= 10:
        recommended_price = float(round(recommended_price))
    else:
        recommended_price = float(round(recommended_price, 1))

    # 3.6 Advanced Opportunity Detection
    is_quick_win = False
    is_margin_booster = False
    
    if status == "OVERPRICED" and price_diff_percent <= 2:
        is_quick_win = True
    
    if status == "LEADER":
        # Find the market price closest to ours (but higher)
        higher_competitors = [p for p in valid_prices if p > our_price]
        if higher_competitors:
            next_min = min(higher_competitors)
            # If gap to next cheapest is > 5%
            if ((next_min - our_price) / our_price * 100) > 5:
                is_margin_booster = True

    return {
        "min_price": round(min_price, 2),
        "max_price": round(max_price, 2),
        "avg_price": round(avg_price, 2),
        "rank": rank,
        "total_competitors": len(valid_prices),
        "status": status,
        "alert": alert,
        "opportunity": opportunity,
        "is_quick_win": is_quick_win,
        "is_margin_booster": is_margin_booster,
        "market_type": market_type,
        "recommended_price": recommended_price
    }
