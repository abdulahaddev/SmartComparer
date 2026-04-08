import re
from decimal import Decimal, InvalidOperation
from typing import Optional


# Common currency symbols to strip
CURRENCY_SYMBOLS = [
    "৳", "$", "€", "£", "¥", "₹", "₽", "₩", "฿",
    "BDT", "USD", "EUR", "GBP", "INR", "TK", "Tk",
]


def parse_price(raw_text: str, currency_symbol: Optional[str] = None) -> Optional[Decimal]:
    """Parse a price string into a Decimal value.

    Handles:
    - Currency symbols (৳, $, €, etc.)
    - Commas as thousand separators
    - Whitespace and non-breaking spaces
    - Ranges (takes the first price)
    
    Returns None if parsing fails.
    """
    if not raw_text or not raw_text.strip():
        return None

    text = raw_text.strip()

    # Remove specific currency symbol if provided
    if currency_symbol:
        text = text.replace(currency_symbol, "")

    # Remove common currency symbols
    for symbol in CURRENCY_SYMBOLS:
        text = text.replace(symbol, "")

    # Remove whitespace (including non-breaking spaces)
    text = text.replace("\u00a0", "").replace("\xa0", "").strip()

    # If there's a range like "1,200 - 1,500", take the first number
    if " - " in text or " – " in text:
        text = re.split(r"\s*[-–]\s*", text)[0]

    # Remove commas (thousand separators)
    text = text.replace(",", "")

    # Remove any remaining non-numeric characters except . and -
    text = re.sub(r"[^\d.\-]", "", text)

    if not text:
        return None

    try:
        return Decimal(text)
    except InvalidOperation:
        return None


def parse_stock(raw_text: str) -> str:
    """Parse stock status text into a normalized string.
    
    Returns: 'in_stock', 'out_of_stock', or the raw text lowered.
    """
    if not raw_text:
        return "unknown"

    text = raw_text.strip().lower()

    in_stock_keywords = ["in stock", "available", "in-stock", "instock", "স্টকে আছে"]
    out_of_stock_keywords = ["out of stock", "unavailable", "out-of-stock", "outofstock", "স্টকে নেই"]

    for kw in in_stock_keywords:
        if kw in text:
            return "in_stock"

    for kw in out_of_stock_keywords:
        if kw in text:
            return "out_of_stock"

    return text
