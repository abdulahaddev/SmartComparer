import asyncio
import logging
from typing import Optional
from playwright.async_api import async_playwright
from scraper.parser import parse_price, parse_stock
from config import settings

logger = logging.getLogger(__name__)


async def scrape_product(
    url: str,
    strategy: dict,
    timeout: int = None,
) -> dict:
    """Scrape a single product page using Playwright.

    Args:
        url: The full URL of the product page.
        strategy: Dict with keys like 'price_selector', 'stock_selector', 'wait_for', 'currency_symbol'.
        timeout: Timeout in seconds (defaults to settings.SCRAPE_TIMEOUT_SECONDS).

    Returns:
        dict with keys: 'price', 'stock', 'raw_price', 'raw_stock', 'success', 'error'
    """
    if timeout is None:
        timeout = settings.SCRAPE_TIMEOUT_SECONDS

    price_selector = strategy.get("price_selector", "")
    stock_selector = strategy.get("stock_selector", "")
    wait_for = strategy.get("wait_for", price_selector)
    currency_symbol = strategy.get("currency_symbol", None)
    price_attribute = strategy.get("price_attribute", "textContent")

    if not price_selector:
        return {
            "price": None,
            "stock": "unknown",
            "raw_price": "",
            "raw_stock": "",
            "success": False,
            "error": "No price_selector in strategy",
        }

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        try:
            await page.goto(url, timeout=timeout * 1000, wait_until="domcontentloaded")

            # Wait for the target element to appear
            if wait_for:
                await page.wait_for_selector(wait_for, timeout=timeout * 1000)

            # Extract price
            raw_price = ""
            price_element = await page.query_selector(price_selector)
            if price_element:
                if price_attribute == "textContent":
                    raw_price = await price_element.text_content() or ""
                else:
                    raw_price = await price_element.get_attribute(price_attribute) or ""

            # Extract stock
            raw_stock = ""
            if stock_selector:
                stock_element = await page.query_selector(stock_selector)
                if stock_element:
                    raw_stock = await stock_element.text_content() or ""

            # Parse values
            price = parse_price(raw_price.strip(), currency_symbol)
            stock = parse_stock(raw_stock.strip()) if raw_stock else "unknown"

            return {
                "price": price,
                "stock": stock,
                "raw_price": raw_price.strip(),
                "raw_stock": raw_stock.strip(),
                "success": price is not None,
                "error": None if price is not None else "Failed to extract price",
            }

        except Exception as e:
            logger.error(f"Scraping error for {url}: {str(e)}")
            return {
                "price": None,
                "stock": "unknown",
                "raw_price": "",
                "raw_stock": "",
                "success": False,
                "error": str(e),
            }
        finally:
            await browser.close()


async def scrape_with_retry(
    url: str,
    strategy: dict,
    max_retries: int = None,
    delay: int = None,
) -> dict:
    """Scrape a product page with retry logic.

    Returns dict with additional key 'attempts'.
    """
    if max_retries is None:
        max_retries = settings.MAX_RETRIES
    if delay is None:
        delay = settings.REQUEST_DELAY_SECONDS

    last_error = None

    for attempt in range(1, max_retries + 1):
        result = await scrape_product(url, strategy)

        if result["success"]:
            result["attempts"] = attempt
            return result

        last_error = result.get("error", "Unknown error")
        logger.warning(f"Attempt {attempt}/{max_retries} failed for {url}: {last_error}")

        if attempt < max_retries:
            await asyncio.sleep(delay)

    return {
        "price": None,
        "stock": "unknown",
        "raw_price": "",
        "raw_stock": "",
        "success": False,
        "error": last_error,
        "attempts": max_retries,
    }
