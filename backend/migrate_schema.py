from sqlalchemy import create_engine, text
import pymysql

try:
    engine = create_engine('mysql+pymysql://admin:admin@127.0.0.1/wpdb')
    with engine.connect() as conn:
        conn.execute(text('ALTER TABLE price_history MODIFY COLUMN price_diff_percent DECIMAL(10, 2);'))
        conn.commit()
    print('Schema updated successfully')
except Exception as e:
    print(f'Error: {e}')
