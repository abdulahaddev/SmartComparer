import sys
import os

# 1. Set the system path to the root of the backend folder
sys.path.insert(0, os.path.dirname(__file__))

# 2. Import the main FastAPI application instance
from main import app

# 3. Convert the ASGI app to a WSGI app using a2wsgi.
# cPanel Passenger only natively supports the WSGI specification, while FastAPI is ASGI.
from a2wsgi import ASGIMiddleware
application = ASGIMiddleware(app)
