import re
from decimal import Decimal, InvalidOperation
from typing import Optional, List


# Common currency symbols to strip (used as fallback)
CURRENCY_SYMBOLS = [
    "৳", "$", "€", "£", "¥", "₹", "₽", "₩", "฿",
    "BDT", "USD", "EUR", "GBP", "INR", "TK", "Tk",
]


def parse_price(
    raw_text: str,
    currency_symbol: Optional[str] = None,
    remove_chars: Optional[List[str]] = None,
) -> Optional[Decimal]:
    """Parse a price string into a Decimal value.

    Handles:
    - Currency symbols (৳, $, €, etc.)
    - Commas as thousand separators
    - Whitespace and non-breaking spaces
    - Ranges (takes the first price)
    - Custom character removal via remove_chars list

    Returns None if parsing fails.
    """
    if not raw_text or not raw_text.strip():
        return None

    text = raw_text.strip()

    # Remove custom characters (from visual mapper configuration)
    if remove_chars:
        for ch in remove_chars:
            text = text.replace(ch, " ")

    # Remove specific currency symbol if provided
    if currency_symbol:
        text = text.replace(currency_symbol, "")

    # Remove common currency symbols (fallback)
    for symbol in CURRENCY_SYMBOLS:
        text = text.replace(symbol, "")

    # Remove whitespace (including non-breaking spaces and suspect control chars)
    text = text.replace("\u00a0", "").replace("\xa0", "").replace("\ufffd", "").strip()

    # If there's a range like "1,200 - 1,500", take the first number
    if " - " in text or " – " in text:
        text = re.split(r"\s*[-–]\s*", text)[0]

    # Handle comma vs dot as decimal separator
    comma_count = text.count(",")
    dot_count = text.count(".")

    if comma_count > 0 and dot_count > 0:
        # Both present: comma is thousand separator, dot is decimal
        text = text.replace(",", "")
    elif comma_count == 1 and dot_count == 0:
        # Single comma: might be decimal separator (e.g., 950,04)
        parts = text.split(",")
        if len(parts[1]) <= 2:
            text = text.replace(",", ".")
        else:
            text = text.replace(",", "")
    elif comma_count > 0:
        # Multiple commas: thousand separators
        text = text.replace(",", "")

    # Remove any remaining non-numeric characters except ., -, and spaces
    text = re.sub(r"[^\d.\-\s]", "", text)

    if not text:
        return None

    # Take only the first continuous number block to handle appended percentages
    # like "750.00-13.04" becoming "750.00".
    match = re.search(r"\d+(?:\.\d+)?", text)
    if not match:
        return None
        
    text = match.group(0)

    try:
        return Decimal(text)
    except InvalidOperation:
        return None
