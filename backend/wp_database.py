from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from config import settings

# WordPress database engine (read-only access)
wp_engine = create_engine(settings.WP_DATABASE_URL, echo=False, pool_pre_ping=True)
WPSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=wp_engine)


def get_wp_db():
    """Dependency that provides a read-only WordPress database session."""
    db = WPSessionLocal()
    try:
        yield db
    finally:
        db.close()
