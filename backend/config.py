import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    # SmartCompare Database
    DB_HOST: str = os.getenv("DB_HOST", "127.0.0.1")
    DB_PORT: int = int(os.getenv("DB_PORT", "3306"))
    DB_NAME: str = os.getenv("DB_NAME", "smartcompare")
    DB_USER: str = os.getenv("DB_USER", "admin")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "admin")

    # WordPress Database (read-only)
    WP_DB_HOST: str = os.getenv("WP_DB_HOST", "127.0.0.1")
    WP_DB_PORT: int = int(os.getenv("WP_DB_PORT", "3306"))
    WP_DB_NAME: str = os.getenv("WP_DB_NAME", "wpdb")
    WP_DB_USER: str = os.getenv("WP_DB_USER", "admin")
    WP_DB_PASSWORD: str = os.getenv("WP_DB_PASSWORD", "admin")
    WP_TABLE_PREFIX: str = os.getenv("WP_TABLE_PREFIX", "wp_")

    # Auth
    ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "admin123")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me")
    JWT_EXPIRY_HOURS: int = int(os.getenv("JWT_EXPIRY_HOURS", "24"))

    # Scraper
    MAX_CONCURRENCY: int = int(os.getenv("MAX_CONCURRENCY", "5"))
    REQUEST_DELAY_SECONDS: int = int(os.getenv("REQUEST_DELAY_SECONDS", "2"))
    SCRAPE_TIMEOUT_SECONDS: int = int(os.getenv("SCRAPE_TIMEOUT_SECONDS", "30"))
    MAX_RETRIES: int = int(os.getenv("MAX_RETRIES", "3"))
    ENABLE_BROWSER_SCRAPING: bool = os.getenv("ENABLE_BROWSER_SCRAPING", "true").lower() == "true"

    @property
    def DATABASE_URL(self) -> str:
        return f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    @property
    def WP_DATABASE_URL(self) -> str:
        return f"mysql+pymysql://{self.WP_DB_USER}:{self.WP_DB_PASSWORD}@{self.WP_DB_HOST}:{self.WP_DB_PORT}/{self.WP_DB_NAME}"


settings = Settings()
