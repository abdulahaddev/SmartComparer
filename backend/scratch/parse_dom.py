import asyncio
from playwright.async_api import async_playwright
from selectolax.lexbor import LexborHTMLParser
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto('https://www.electronics.com.bd/arduino-uno-r3-board')
        await asyncio.sleep(5)
        
        parser = LexborHTMLParser(await page.content())
        for node in parser.css('div, span'):
            classes = node.attributes.get('class', '')
            if classes and 'price' in classes.lower():
                print(f"[{node.tag}] class: {classes}")
                print(f"     text: {repr(node.text(strip=True))}")
        
        # Check specific selector
        el = await page.query_selector("div.final-price")
        print("\nPlaywright Locator check (div.final-price):")
        if el:
            print("text_content:", repr(await el.text_content()))
            print("inner_html:", repr(await el.inner_html()))
        else:
            print("Not found")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
