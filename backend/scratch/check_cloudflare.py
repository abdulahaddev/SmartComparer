import asyncio
import os
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto('https://www.electronics.com.bd/arduino-uno-r3-board', wait_until='networkidle')
        title = await page.title()
        print(f"Final Page Title: {title}")
        html = await page.content()
        print(f"Page size: {len(html)} bytes")
        
        if "cloudflare" in html.lower() or "just a moment" in title.lower() or "security" in title.lower():
            print("Cloudflare / Security block detected.")
            
        el = await page.query_selector('div.final-price')
        if el:
            print("Found div.final-price!")
            print("Text content:", await el.text_content())
        else:
            print("div.final-price NOT FOUND.")
            
        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
