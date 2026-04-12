from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Numeric, Boolean, DateTime, Text, Enum, JSON,
    ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import relationship
from database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    wp_product_id = Column(Integer, unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    current_price = Column(Numeric(10, 2), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    competitor_products = relationship("CompetitorProduct", back_populates="product")


class Competitor(Base):
    __tablename__ = "competitors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    base_url = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    competitor_products = relationship("CompetitorProduct", back_populates="competitor")


class CompetitorProduct(Base):
    __tablename__ = "competitor_products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    competitor_id = Column(Integer, ForeignKey("competitors.id"), nullable=False, index=True)
    url = Column(String(500), nullable=False)
    strategy_json = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    last_scraped_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    product = relationship("Product", back_populates="competitor_products")
    competitor = relationship("Competitor", back_populates="competitor_products")
    price_history = relationship("PriceHistory", back_populates="competitor_product")
    scrape_logs = relationship("ScrapeLog", back_populates="competitor_product")


class ScrapeRun(Base):
    __tablename__ = "scrape_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    finished_at = Column(DateTime, nullable=True)
    status = Column(Enum("running", "completed", "failed", name="scrape_run_status"), default="running", nullable=False)
    total_products = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failure_count = Column(Integer, default=0)

    # Relationships
    price_histories = relationship("PriceHistory", back_populates="scrape_run")
    scrape_logs = relationship("ScrapeLog", back_populates="scrape_run")


class PriceHistory(Base):
    __tablename__ = "price_history"
    __table_args__ = (
        UniqueConstraint("competitor_product_id", "run_id", name="uq_price_per_run"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    competitor_product_id = Column(Integer, ForeignKey("competitor_products.id"), nullable=False, index=True)
    run_id = Column(Integer, ForeignKey("scrape_runs.id"), nullable=False, index=True)
    price = Column(Numeric(10, 2), nullable=True)
    stock = Column(String(50), nullable=True)
    price_diff = Column(Numeric(10, 2), nullable=True)
    price_diff_percent = Column(Numeric(10, 2), nullable=True)
    scraped_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    competitor_product = relationship("CompetitorProduct", back_populates="price_history")
    scrape_run = relationship("ScrapeRun", back_populates="price_histories")


class ScrapeLog(Base):
    __tablename__ = "scrape_logs"
    __table_args__ = (
        UniqueConstraint("competitor_product_id", "run_id", name="uq_log_per_run"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    competitor_product_id = Column(Integer, ForeignKey("competitor_products.id"), nullable=False, index=True)
    run_id = Column(Integer, ForeignKey("scrape_runs.id"), nullable=False, index=True)
    status = Column(Enum("success", "failed", name="scrape_log_status"), nullable=False)
    attempt_count = Column(Integer, default=1)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    competitor_product = relationship("CompetitorProduct", back_populates="scrape_logs")
    scrape_run = relationship("ScrapeRun", back_populates="scrape_logs")
