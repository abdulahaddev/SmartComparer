from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Any, Literal
from pydantic import BaseModel, Field


# ─── Auth ────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    username: str


# ─── Product ─────────────────────────────────────────────────────────────────

class ProductOut(BaseModel):
    id: int
    wp_product_id: int
    name: str
    current_price: Optional[Decimal] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProductListOut(BaseModel):
    total: int
    products: List[ProductOut]


# ─── Competitor ──────────────────────────────────────────────────────────────

class CompetitorCreate(BaseModel):
    name: str = Field(..., max_length=100)
    base_url: str = Field(..., max_length=255)


class CompetitorUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    base_url: Optional[str] = Field(None, max_length=255)
    is_active: Optional[bool] = None


class CompetitorOut(BaseModel):
    id: int
    name: str
    base_url: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Competitor Product (Mapping) ────────────────────────────────────────────

class CompetitorProductCreate(BaseModel):
    product_id: int
    competitor_id: int
    url: str = Field(..., max_length=500)
    strategy_json: Optional[dict] = None


class CompetitorProductUpdate(BaseModel):
    url: Optional[str] = Field(None, max_length=500)
    strategy_json: Optional[dict] = None
    is_active: Optional[bool] = None


class CompetitorProductOut(BaseModel):
    id: int
    product_id: int
    competitor_id: int
    url: str
    strategy_json: Optional[dict] = None
    is_active: bool
    last_scraped_at: Optional[datetime] = None
    created_at: datetime
    product_name: Optional[str] = None
    competitor_name: Optional[str] = None

    model_config = {"from_attributes": True}


# ─── Scrape Run ──────────────────────────────────────────────────────────────

class ScrapeRunOut(BaseModel):
    id: int
    started_at: datetime
    finished_at: Optional[datetime] = None
    status: str
    total_products: int
    success_count: int
    failure_count: int

    model_config = {"from_attributes": True}


# ─── Price History ───────────────────────────────────────────────────────────

class PriceHistoryOut(BaseModel):
    id: int
    competitor_product_id: int
    run_id: int
    price: Optional[Decimal] = None
    stock: Optional[str] = None
    price_diff: Optional[Decimal] = None
    price_diff_percent: Optional[Decimal] = None
    scraped_at: datetime
    competitor_name: Optional[str] = None

    model_config = {"from_attributes": True}


# ─── Scrape Log ──────────────────────────────────────────────────────────────

class ScrapeLogOut(BaseModel):
    id: int
    competitor_product_id: int
    run_id: int
    status: str
    attempt_count: int
    error_message: Optional[str] = None
    created_at: datetime
    product_name: Optional[str] = None
    competitor_name: Optional[str] = None

    model_config = {"from_attributes": True}


# ─── Dashboard ───────────────────────────────────────────────────────────────

class PriceIntelligence(BaseModel):
    min_price: Optional[float]
    max_price: Optional[float]
    avg_price: Optional[float]
    rank: int
    total_competitors: int
    status: Literal["OVERPRICED", "COMPETITIVE", "LEADER"]
    alert: Optional[Literal["HIGH_RISK", "MEDIUM_RISK"]]
    opportunity: Optional[Literal["INCREASE_PRICE", "DECREASE_PRICE"]]
    is_quick_win: bool = False
    is_margin_booster: bool = False
    market_type: Literal["VOLATILE", "STABLE"]
    recommended_price: float

class StatusDistribution(BaseModel):
    leader: int = 0
    competitive: int = 0
    overpriced: int = 0

class DashboardSummary(BaseModel):
    total_products: int
    active_products: int
    total_competitors: int
    total_mappings: int
    total_scrape_runs: int
    status_distribution: StatusDistribution = StatusDistribution()
    last_run: Optional[ScrapeRunOut] = None

class PriceComparisonItem(BaseModel):
    product_id: int
    product_name: str
    our_price: Optional[Decimal] = None
    competitor_prices: List[dict] = []
    intelligence: Optional[PriceIntelligence] = None


# ─── Sync ────────────────────────────────────────────────────────────────────

class SyncResult(BaseModel):
    inserted: int
    updated: int
    deactivated: int
    total_wp_products: int
