# Use Python 3.12 slim image to keep the size manageable
FROM python:3.12-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Install system dependencies required for Playwright and Chromium
# We install these as root during the build process
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    && apt-get install -y --no-install-recommends \
    # Standard Chromium dependencies
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    # Cleanup to reduce image size
    && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install the Playwright Chromium browser binary
# The system dependencies are already installed above
RUN playwright install chromium

# Copy the rest of the application code
COPY . .

# Expose the port (Render uses 10000 by default but provides $PORT)
EXPOSE 8000

# Use shell form for CMD to allow environment variable expansion
CMD gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:${PORT:-8000} --timeout 120
