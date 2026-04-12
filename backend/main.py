import logging
import asyncio
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
from auth.router import router as auth_router
from products.router import router as products_router
from competitors.router import router as competitors_router
from competitor_products.router import router as cp_router
from scraping.router import router as scraping_router
from dashboard.router import router as dashboard_router
from proxy.router import router as proxy_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

# Fix Windows asyncio loop for Playwright/Subprocesses
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create database tables on startup."""
    Base.metadata.create_all(bind=engine)
    logging.info("Database tables created/verified")
    yield


app = FastAPI(
    title="SmartCompare API",
    description="Price intelligence system for WooCommerce",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow Angular dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://127.0.0.1:4200", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(products_router)
app.include_router(competitors_router)
app.include_router(cp_router)
app.include_router(scraping_router)
app.include_router(dashboard_router)
app.include_router(proxy_router)


@app.get("/", tags=["Root"])
async def root():
    return {
        "name": "SmartCompare API",
        "version": "1.0.0",
        "docs": "/docs",
    }
