import re
import logging
from urllib.parse import urljoin, urlparse, quote

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, Response

from auth.dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/proxy", tags=["Proxy"])

NEUTRALIZER_SCRIPT = """
<script id="sc-neutralizer">
(function() {
  const PROXY_TOKEN = "{{TOKEN}}";
  const TARGET_ORIGIN = "{{TARGET_ORIGIN}}";
  const PROXY_RE = "/proxy/res";
  const LOCAL_ORIGIN = window.location.origin;
  
  // Helper to rewrite URLs to go through our proxy
  const interceptUrl = (url) => {
    if (!url || typeof url !== 'string') return url;
    if (url.includes(PROXY_RE)) return url; // Already proxied
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('javascript:')) return url;
    
    try {
      const resolved = new URL(url, TARGET_ORIGIN).href;
      const parsed = new URL(resolved);
      
      // Skip if it's already our own proxy server
      if (parsed.origin === LOCAL_ORIGIN) return url;
      
      // Proxy ALL external HTTP/HTTPS requests to avoid CORS
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return `${LOCAL_ORIGIN}${PROXY_RE}?url=${encodeURIComponent(resolved)}&token=${PROXY_TOKEN}`;
      }
    } catch(e) {}
    return url;
  };

  // 1. Prevent History API SecurityErrors
  const originalPush = window.history.pushState;
  const originalReplace = window.history.replaceState;
  
  const wrapHistory = (fn) => function(state, title, url) {
    try {
      if (url) {
        const parsed = new URL(url, window.location.href);
        if (parsed.origin !== window.location.origin) {
          url = parsed.pathname + parsed.search + parsed.hash;
        }
      }
      return fn.call(this, state, title, url);
    } catch (e) {
      // Silently handle Next.js router errors
    }
  };
  
  window.history.pushState = wrapHistory(originalPush);
  window.history.replaceState = wrapHistory(originalReplace);

  // 2. Intercept Fetch and XMLHttpRequest to bypass CORS
  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    try {
      if (typeof input === 'string') {
        input = interceptUrl(input);
      } else if (input instanceof Request) {
        const newUrl = interceptUrl(input.url);
        if (newUrl !== input.url) {
          input = new Request(newUrl, input);
        }
      }
    } catch(e) {}
    return originalFetch.call(this, input, init);
  };

  const originalXHR = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function(method, url) {
    try {
      arguments[1] = interceptUrl(url);
    } catch(e) {}
    return originalXHR.apply(this, arguments);
  };

  // 3. Intercept dynamic script/img/link creation
  const originalSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    if ((name === 'src' || name === 'href') && typeof value === 'string') {
      try {
        const tag = this.tagName.toLowerCase();
        // Only intercept script src and link[rel=stylesheet] href
        if (tag === 'script' || (tag === 'link' && this.getAttribute('rel') === 'stylesheet')) {
          // Don't intercept these - they need to load normally for page render
        }
      } catch(e) {}
    }
    return originalSetAttribute.call(this, name, value);
  };

  // 4. Fake out annoying frame busters
  if (window.top !== window.self) {
    Object.defineProperty(window, 'top', { value: window.self, configurable: false, writable: false });
    Object.defineProperty(window, 'parent', { value: window.self, configurable: false, writable: false });
  }

  // 4. Force enable right-click and selection (bypass aggressive anti-bot scripts)
  window.addEventListener('contextmenu', e => e.stopPropagation(), true);
  window.addEventListener('selectstart', e => e.stopPropagation(), true);
  window.addEventListener('copy', e => e.stopPropagation(), true);
  window.addEventListener('paste', e => e.stopPropagation(), true);
  
  // Revert inline styles blocking selection once DOM loads
  const observer = new MutationObserver(() => {
    if(document.body) {
      document.body.style.userSelect = 'auto';
      document.body.style.webkitUserSelect = 'auto';
    }
  });
  observer.observe(document.documentElement, {childList: true, subtree: true});

  // 5. Bypass basic ServiceWorker caching restrictions
  if (navigator.serviceWorker) {
    try {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          register: () => Promise.resolve({}),
          ready: Promise.resolve({}),
          controller: null
        },
        configurable: true
      });
    } catch(e) {}
  }

  // 5. Suppress common third-party errors
  window.addEventListener('error', function(e) {
    if (e.message && (e.message.includes('CORS') || e.message.includes('cross-origin'))) {
      e.preventDefault();
    }
  }, true);

  window.addEventListener('unhandledrejection', function(e) {
    if (e.reason && String(e.reason).includes('CORS')) {
      e.preventDefault();
    }
  });
})();
</script>
"""

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

  // ─── CSS Selector Generator (Intelligent & Robust) ───────
  function generateSelector(el) {
    // 1. Level 0: Perfect Match (Unique ID)
    if (el.id && !isGeneric(el.id)) {
      const idSelector = `#${CSS.escape(el.id)}`;
      if (document.querySelectorAll(idSelector).length === 1) return idSelector;
    }

    // 2. Level 1: Semantic Attributes
    const semanticAttrs = ['itemprop', 'data-testid', 'data-sku', 'data-id', 'name', 'title'];
    for (const attr of semanticAttrs) {
      const val = el.getAttribute(attr);
      if (val && !isGeneric(val)) {
        const sel = `${el.tagName.toLowerCase()}[${attr}="${CSS.escape(val)}"]`;
        if (document.querySelectorAll(sel).length === 1) return sel;
      }
    }

    // 3. Level 2: Unique Classes
    const classes = Array.from(el.classList).filter(c => !isGenericClass(c));
    for (const c of classes) {
      const sel = `${el.tagName.toLowerCase()}.${CSS.escape(c)}`;
      if (document.querySelectorAll(sel).length === 1) return sel;
    }

    // 4. Level 3: Minimal Hierarchical Path (Semantic Parent)
    let path = [];
    let current = el;
    let depth = 0;
    while (current && current !== document.body && depth < 5) {
      let selector = getBestLocalSelector(current);
      path.unshift(selector);
      
      const fullSelector = path.join(' > ');
      if (document.querySelectorAll(fullSelector).length === 1) return fullSelector;
      
      current = current.parentElement;
      depth++;
    }

    // 5. Fallback: Tag + Nth-Child (Last Resort, limited depth)
    return getFullFallbackPath(el);
  }

  function isGeneric(val) {
    return /^(col-|row|container|wrapper|clearfix|d-|p-|m-|flex|grid|layout|content|inner|outer|section|div|span|section|main|body)/i.test(val) || val.length < 2;
  }

  function isGenericClass(c) {
    return /^(js-|wp-|wp_|col-|row|container|wrapper|clearfix|d-|p-|m-|flex|grid|active|selected|hidden|show|hide|btn|card|item)/i.test(c) || c.length < 2;
  }

  function getBestLocalSelector(el) {
    const tag = el.tagName.toLowerCase();
    
    // Try unique ID on this node
    if (el.id && !isGeneric(el.id)) return `#${CSS.escape(el.id)}`;
    
    // Try semantic attributes
    const semanticAttrs = ['itemprop', 'data-product', 'name'];
    for (const attr of semanticAttrs) {
      const val = el.getAttribute(attr);
      if (val && !isGeneric(val)) return `${tag}[${attr}="${CSS.escape(val)}"]`;
    }

    // Try significant classes
    const classes = Array.from(el.classList).filter(c => !isGenericClass(c));
    if (classes.length > 0) return `${tag}.${CSS.escape(classes[0])}`;

    // Nth-child fallback for this level
    const parent = el.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const sameTagSiblings = siblings.filter(s => s.tagName === el.tagName);
      if (sameTagSiblings.length > 1) {
        return `${tag}:nth-of-type(${sameTagSiblings.indexOf(el) + 1})`;
      }
    }

    return tag;
  }

  function getFullFallbackPath(el) {
    const path = [];
    let current = el;
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }
      path.unshift(selector);
      current = current.parentElement;
      if (path.length > 5) break; // Don't go too deep
    }
    return path.join(' > ');
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

    # Handle srcset (comma separated values)
    def fix_srcset(match):
        attr = match.group(1)
        val = match.group(2)
        parts = []
        for p in val.split(','):
            p = p.strip()
            if not p: continue
            subparts = p.split()
            if subparts:
                url = subparts[0]
                if not url.startswith(('http', 'data:', 'javascript:')):
                    subparts[0] = urljoin(base_url, url)
                parts.append(' '.join(subparts))
        return f'{attr}="{", ".join(parts)}"'

    html = re.sub(r'(srcset)="([^"]+)"', fix_srcset, html)

    return html


def inject_script_and_clean(html: str, base_url: str, token: str) -> str:
    """Inject selector script, remove CSP, fix base URL."""
    # Remove Content-Security-Policy meta tags
    html = re.sub(
        r'<meta[^>]*http-equiv=["\']Content-Security-Policy["\'][^>]*>',
        '',
        html,
        flags=re.IGNORECASE
    )

    # Add <base> tag for relative URLs
    base_tag = f'<base href="{base_url}">'
    
    # Inject Neutralizer as very first thing in head
    parsed = urlparse(base_url)
    target_origin = f"{parsed.scheme}://{parsed.netloc}"
    
    tokenized_neutralizer = NEUTRALIZER_SCRIPT.replace("{{TOKEN}}", token).replace("{{TARGET_ORIGIN}}", target_origin)
    head_injection = base_tag + tokenized_neutralizer
    
    if '<head>' in html.lower():
        html = re.sub(r'<head[^>]*>', lambda m: m.group(0) + head_injection, html, count=1, flags=re.IGNORECASE)
    elif '<html>' in html.lower():
        html = re.sub(r'<html[^>]*>', lambda m: m.group(0) + '<head>' + head_injection + '</head>', html, count=1, flags=re.IGNORECASE)

    # Make relative URLs absolute
    html = make_urls_absolute(html, base_url)

    # Inject the selector script before </body>
    if '</body>' in html.lower():
        html = re.sub(r'</body>', SELECTOR_SCRIPT + '</body>', html, count=1, flags=re.IGNORECASE)
    else:
        html += SELECTOR_SCRIPT

    return html


@router.api_route("/page", methods=["GET", "OPTIONS"], response_class=HTMLResponse)
async def proxy_page(
    request: Request,
    url: str = Query(..., description="URL to proxy"),
    token: str = Query(..., description="JWT token (for iframe access)"),
):
    """Fetch a competitor page, inject selection script, and serve it."""
    # Handle preflight
    if request.method == "OPTIONS":
        return Response(
            status_code=200,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Max-Age": "86400",
            },
        )

    # Validate token
    from auth.jwt import verify_token
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
            verify=False,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Referer": f"{parsed.scheme}://{parsed.netloc}/",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
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
    modified_html = inject_script_and_clean(html, url, token)

    return HTMLResponse(
        content=modified_html,
        headers={
            "X-Frame-Options": "ALLOWALL",
            "Content-Security-Policy": "",
            "Access-Control-Allow-Origin": "*",
            "Permissions-Policy": "unload=*",
        },
    )


@router.api_route("/res", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
async def proxy_resource(
    request: Request,
    url: str = Query(..., description="URL to proxy"),
    token: str = Query(..., description="JWT token"),
):
    """Generic proxy for sub-resources (JSON, assets) to bypass CORS.
    
    Supports all HTTP methods and forwards bodies/headers.
    """
    # Handle preflight immediately
    if request.method == "OPTIONS":
        return Response(
            status_code=200,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Max-Age": "86400",
            },
        )

    from auth.jwt import verify_token
    if not verify_token(token):
        raise HTTPException(status_code=401)

    parsed = urlparse(url)
    
    # Filter headers to pass to target
    forbidden_headers = {'host', 'connection', 'content-length', 'transfer-encoding', 'accept-encoding'}
    headers = {k: v for k, v in request.headers.items() if k.lower() not in forbidden_headers}
    headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    headers["Referer"] = f"{parsed.scheme}://{parsed.netloc}/"
    headers["Origin"] = f"{parsed.scheme}://{parsed.netloc}"
    # Remove our proxy host header
    headers.pop("host", None)

    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=30.0,
            verify=False
        ) as client:
            resp = await client.request(
                method=request.method,
                url=url,
                content=await request.body(),
                headers=headers,
            )
            
            # Build response headers - strip problematic upstream headers
            resp_headers = {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Expose-Headers": "*",
            }
            
            # Forward cache headers from upstream if present
            for h in ['cache-control', 'etag', 'last-modified']:
                if h in resp.headers:
                    resp_headers[h] = resp.headers[h]
            
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                media_type=resp.headers.get("content-type"),
                headers=resp_headers,
            )
    except Exception as e:
        logger.error(f"Proxy Resource Error: {str(e)}")
        raise HTTPException(status_code=502, detail=str(e))
