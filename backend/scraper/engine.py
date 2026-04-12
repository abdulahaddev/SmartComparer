import asyncio
import logging
import httpx
from typing import Optional
from playwright.async_api import async_playwright
from selectolax.lexbor import LexborHTMLParser
from scraper.parser import parse_price
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
        strategy: Dict with keys like:
            - price_selector: CSS selector for the price element
            - price_attribute: 'textContent' or an attribute name (e.g., 'content')
            - remove_chars: list of characters to strip from price text
            - wait_for: CSS selector to wait for before extraction
        timeout: Timeout in seconds (defaults to settings.SCRAPE_TIMEOUT_SECONDS).

    Returns:
        dict with keys: 'price', 'raw_price', 'success', 'error'
    """
    if timeout is None:
        timeout = settings.SCRAPE_TIMEOUT_SECONDS

    price_selector = strategy.get("price_selector", "")
    wait_for = strategy.get("wait_for", price_selector)
    price_attribute = strategy.get("price_attribute", "textContent")
    remove_chars = strategy.get("remove_chars", None)

    if not price_selector:
        return {
            "price": None,
            "raw_price": "",
            "success": False,
            "error": "No price_selector in strategy",
        }

    # --- Phase 1: Fast HTTP Fetch (No JS) ---
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            response = await client.get(url, headers=headers)
            
            if response.status_code == 200:
                parser = LexborHTMLParser(response.text)
                element = parser.css_first(price_selector)
                
                if element:
                    raw_price = ""
                    if price_attribute == "textContent":
                        raw_price = element.text() or ""
                    else:
                        raw_price = element.attributes.get(price_attribute, "")
                    
                    price = parse_price(raw_price.strip(), remove_chars=remove_chars)
                    if price is not None:
                        logger.info(f"✓ Fast Scrape Success for {url}")
                        return {
                            "price": price,
                            "raw_price": raw_price.strip(),
                            "success": True,
                            "error": None,
                            "method": "http"
                        }
                
                logger.debug(f"Selector {price_selector} not found in static HTML for {url}, falling back to Playwright")
            else:
                logger.warning(f"HTTP fetch failed for {url} (Status: {response.status_code}), falling back to Playwright")

    except Exception as e:
        logger.debug(f"HTTP fetch error for {url}: {str(e)}, falling back to Playwright")

    # --- Phase 2: Full Browser Fallback (JS Enabled) ---
    async with async_playwright() as p:
        try:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()

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

            # Parse price
            price = parse_price(raw_price.strip(), remove_chars=remove_chars)

            return {
                "price": price,
                "raw_price": raw_price.strip(),
                "success": price is not None,
                "error": None if price is not None else "Failed to extract price",
                "method": "playwright"
            }

        except Exception as e:
            logger.error(f"Scraping error for {url}: {str(e)}")
            return {
                "price": None,
                "raw_price": "",
                "success": False,
                "error": str(e),
                "method": "failed"
            }
        finally:
            if 'browser' in locals():
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
        "raw_price": "",
        "success": False,
        "error": last_error,
        "attempts": max_retries,
    }
