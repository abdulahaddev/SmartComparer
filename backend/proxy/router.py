import re
import logging
from urllib.parse import urljoin, urlparse, quote

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse

from auth.dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/proxy", tags=["Proxy"])

# The DOM selection script injected into proxied pages (price-only, captures attributes)
SELECTOR_SCRIPT = """
<script>
(function() {
  // ─── State ───────────────────────────────────────────────
  let currentMode = null;       // 'price' or null
  let hoveredEl = null;
  let selectedElements = {};

  // ─── Overlay ─────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'sc-overlay';
  overlay.style.cssText = `
    position: fixed; pointer-events: none; z-index: 999999;
    border: 3px solid #22c55e; border-radius: 4px;
    background: rgba(34, 197, 94, 0.08);
    transition: all 0.1s ease; display: none;
  `;
  document.body.appendChild(overlay);

  // Tooltip
  const tooltip = document.createElement('div');
  tooltip.id = 'sc-tooltip';
  tooltip.style.cssText = `
    position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
    z-index: 1000000; padding: 10px 24px; border-radius: 10px;
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: white; font-family: 'Inter', sans-serif; font-size: 14px;
    font-weight: 600; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    display: none; pointer-events: none;
  `;
  document.body.appendChild(tooltip);

  // ─── CSS Selector Generator ──────────────────────────────
  function generateSelector(el) {
    if (el.id) {
      return '#' + CSS.escape(el.id);
    }
    const path = [];
    let current = el;
    while (current && current !== document.body && current !== document.documentElement) {
      let selector = current.tagName.toLowerCase();
      const classes = Array.from(current.classList).filter(c =>
        c.length > 1 && !c.match(/^(js-|wp-|wp_|col-|row|container|wrapper|clearfix|d-|p-|m-|flex|grid)/)
      );
      if (classes.length > 0) {
        selector += '.' + classes.map(c => CSS.escape(c)).join('.');
        const test = document.querySelectorAll(buildFullSelector(path, selector));
        if (test.length === 1) {
          path.unshift(selector);
          break;
        }
      }
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
        if (siblings.length > 1) {
          const idx = siblings.indexOf(current) + 1;
          selector += ':nth-child(' + idx + ')';
        }
      }
      path.unshift(selector);
      current = current.parentElement;
    }
    return path.join(' > ');
  }

  function buildFullSelector(existingPath, newPart) {
    return [...existingPath, newPart].join(' > ');
  }

  // ─── Collect element attributes ──────────────────────────
  function getAttributes(el) {
    const attrs = [];
    for (const attr of el.attributes) {
      attrs.push({ name: attr.name, value: attr.value.substring(0, 300) });
    }
    return attrs;
  }

  // ─── Highlight on Hover ──────────────────────────────────
  document.addEventListener('mousemove', function(e) {
    if (!currentMode) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === overlay || el === tooltip || el.id?.startsWith('sc-')) return;
    hoveredEl = el;
    const rect = el.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.left = rect.left + 'px';
    overlay.style.top = rect.top + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
  }, true);

  // ─── Click to Select ────────────────────────────────────
  document.addEventListener('click', function(e) {
    if (!currentMode) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (!hoveredEl) return;

    const selector = generateSelector(hoveredEl);
    const text = (hoveredEl.textContent || '').trim().substring(0, 300);
    const attributes = getAttributes(hoveredEl);
    const innerHTML = hoveredEl.innerHTML.substring(0, 500);

    selectedElements[currentMode] = { selector, text, tagName: hoveredEl.tagName };

    window.parent.postMessage({
      type: 'sc-element-selected',
      mode: currentMode,
      selector: selector,
      text: text,
      tagName: hoveredEl.tagName,
      attributes: attributes,
      innerHTML: innerHTML,
    }, '*');

    // Done — exit selection mode
    currentMode = null;
    overlay.style.display = 'none';
    tooltip.style.display = 'none';
    document.body.style.cursor = '';
  }, true);

  // Prevent navigation
  document.addEventListener('click', function(e) {
    if (currentMode) {
      const link = e.target.closest('a');
      if (link) { e.preventDefault(); e.stopPropagation(); }
    }
  }, true);

  // ─── Messages from Parent ────────────────────────────────
  window.addEventListener('message', function(e) {
    const data = e.data;
    if (!data || !data.type) return;

    if (data.type === 'sc-set-mode') {
      currentMode = data.mode; // 'price' or null
      if (currentMode) {
        overlay.style.display = 'none';
        tooltip.style.display = 'block';
        tooltip.textContent = '💰 Click on the PRICE element';
        document.body.style.cursor = 'crosshair';
      } else {
        overlay.style.display = 'none';
        tooltip.style.display = 'none';
        document.body.style.cursor = '';
      }
    }

    if (data.type === 'sc-test-selector') {
      try {
        const els = document.querySelectorAll(data.selector);
        const results = Array.from(els).slice(0, 5).map(el => ({
          text: (el.textContent || '').trim().substring(0, 200),
          tagName: el.tagName,
          attributes: getAttributes(el),
        }));
        window.parent.postMessage({
          type: 'sc-test-result',
          selector: data.selector,
          matchCount: els.length,
          results: results,
        }, '*');
      } catch (err) {
        window.parent.postMessage({
          type: 'sc-test-result',
          selector: data.selector,
          matchCount: 0,
          results: [],
          error: err.message,
        }, '*');
      }
    }
  });


  window.parent.postMessage({ type: 'sc-ready' }, '*');
})();
</script>
"""


def make_urls_absolute(html: str, base_url: str) -> str:
    """Convert relative URLs in HTML to absolute using the base URL."""
    parsed = urlparse(base_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"

    # Fix src and href attributes with relative paths
    # Handle src="//..." (protocol-relative)
    html = re.sub(
        r'(src|href|action)="(//)([^"]*)"',
        rf'\1="https://\3"',
        html
    )

    # Handle src="/..." (absolute path)
    html = re.sub(
        r'(src|href|action)="(/[^/"][^"]*)"',
        rf'\1="{origin}\2"',
        html
    )

    # Handle src="relative/..." (relative path, no leading /)
    html = re.sub(
        r'(src|href|action)="(?!https?://|//|#|data:|javascript:|mailto:)([^"]+)"',
        lambda m: f'{m.group(1)}="{urljoin(base_url, m.group(2))}"',
        html
    )

    # Fix CSS url() references
    html = re.sub(
        r"url\([\'\"]?(/[^)\'\"]+)[\'\"]?\)",
        lambda m: f"url('{origin}{m.group(1)}')",
        html
    )

    return html


def inject_script_and_clean(html: str, base_url: str) -> str:
    """Inject selector script, remove CSP, fix base URL."""
    # Remove Content-Security-Policy meta tags
    html = re.sub(
        r'<meta[^>]*http-equiv=["\']Content-Security-Policy["\'][^>]*>',
        '',
        html,
        flags=re.IGNORECASE
    )

    # Add <base> tag for relative URLs
    base_tag = f'<base href="{base_url}" target="_blank">'
    if '<head>' in html.lower():
        html = re.sub(r'<head[^>]*>', lambda m: m.group(0) + base_tag, html, count=1, flags=re.IGNORECASE)
    elif '<html>' in html.lower():
        html = re.sub(r'<html[^>]*>', lambda m: m.group(0) + '<head>' + base_tag + '</head>', html, count=1, flags=re.IGNORECASE)

    # Make relative URLs absolute
    html = make_urls_absolute(html, base_url)

    # Inject the selector script before </body>
    if '</body>' in html.lower():
        html = re.sub(r'</body>', SELECTOR_SCRIPT + '</body>', html, count=1, flags=re.IGNORECASE)
    else:
        html += SELECTOR_SCRIPT

    return html


@router.get("/page", response_class=HTMLResponse)
async def proxy_page(
    url: str = Query(..., description="URL to proxy"),
    token: str = Query(None, description="JWT token (for iframe access)"),
):
    """Fetch a competitor page, inject selection script, and serve it.
    
    Accepts JWT token as query param since iframes cannot send Authorization headers.
    """
    # Validate token
    from auth.jwt import verify_token
    if not token:
        raise HTTPException(status_code=401, detail="Token required")
    username = verify_token(token)
    if not username:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    # Validate URL
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Invalid URL scheme")

    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=30.0,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            },
        ) as client:
            response = await client.get(url)
            response.raise_for_status()

    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Upstream returned {e.response.status_code}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch URL: {str(e)}")

    content_type = response.headers.get("content-type", "")
    if "text/html" not in content_type and "application/xhtml" not in content_type:
        raise HTTPException(status_code=400, detail="URL did not return HTML content")

    html = response.text

    # Inject script and fix URLs
    modified_html = inject_script_and_clean(html, url)

    return HTMLResponse(
        content=modified_html,
        headers={
            "X-Frame-Options": "ALLOWALL",
            "Content-Security-Policy": "",
        },
    )
