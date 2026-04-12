import asyncio
import os
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        print("Navigating...")
        await page.goto('https://www.electronics.com.bd/arduino-uno-r3-board')
        print("Waiting...")
        await asyncio.sleep(5)
        print("Screenshotting...")
        await page.screenshot(path=os.path.join(os.path.dirname(__file__), '..', '..', 'artifacts', 'electronics_bd.png'))
        print("Done")
        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
