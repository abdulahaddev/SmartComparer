import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        print("Navigating...")
        await page.goto('https://www.electronics.com.bd/arduino-uno-r3-board', wait_until="domcontentloaded")
        await asyncio.sleep(2)
        print("Extracting...")
        el = await page.query_selector('div.final-price')
        if el is None:
            print("Element not found")
        else:
            print("Element found!")
            print("Text:", repr(await el.text_content()))
            print("HTML:", await el.inner_html())
        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
