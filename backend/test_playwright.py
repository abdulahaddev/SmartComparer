import asyncio
from playwright.async_api import async_playwright

async def test_playwright():
    try:
        async with async_playwright() as p:
            print("Launching browser...")
            browser = await p.chromium.launch(headless=True)
            print("Browser launched successfully")
            await browser.close()
            print("Browser closed")
    except Exception as e:
        print(f"Playwright failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_playwright())
