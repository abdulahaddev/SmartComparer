# Backend cPanel Deployment Guide

Deploying a FastAPI backend on cPanel requires a specific setup because cPanel uses Phusion Passenger to run Python applications. Passenger natively understands `WSGI` apps, but FastAPI is an asynchronous `ASGI` app. 

I've already created the adapter file (`passenger_wsgi.py`) and updated `requirements.txt` to bridge this gap automatically. Follow these steps to push your backend live!

## Phase 1: Uploading the Files
1. Create a new folder outside of your `public_html` directory for security. For example: `/home/yourusername/smartcompare_api`.
2. Delete the `venv/` folder, `scratch/` folder, and `__pycache__` folders from your local machine. You **must not** upload these.
3. ZIP up the entire `backend/` folder.
4. Upload the ZIP file into the folder you created in Step 1 (`/home/yourusername/smartcompare_api`) using the cPanel File Manager.
5. Extract the ZIP file there.

## Phase 2: Setup Python App
1. Go to your cPanel dashboard and click **Setup Python App**.
2. Click **Create Application**.
3. Configure the following fields:
   - **Python Version**: Select `3.10` or higher.
   - **Application Root**: `smartcompare_api` (The folder you created in Phase 1).
   - **Application URL**: `smartcompare/api` (If hosting on `nabatechshop.com`, this means the api will live at `nabatechshop.com/smartcompare/api`).
   - **Application startup file**: `passenger_wsgi.py`
   - **Application Entry point**: `application`
4. Click **Create**.

## Phase 3: Install Dependencies
1. Scroll down on the Python App dashboard until you see the **Configuration files** section.
2. In the "Add another file" box, type `requirements.txt` and click **Add**.
3. A button will appear that says **Run Pip Install**. Click it. Wait 1-3 minutes for it to finish installing FastAPI, SQLAlchemy, and a2wsgi.

> [!CAUTION]
> **Playwright Warning**
> Playwright requires a headless browser to run. However, shared cPanel hosting often lacks the necessary Linux system dependencies (like `libxshmfence`) required to run headless Chromium. 
> 
> * If your scraper begins failing strictly on WAF-protected WAF/Cloudflare sites after deployment, your host server likely does not support Chromium. You will need to upgrade to a VPS or run the scrape worker component locally.

## Phase 4: Environment Configuration
Your live backend needs a MySQL database string, because right now it points to your local machine!
1. In cPanel, go to **MySQL Databases** and create a new database (e.g., `naba_smartcompare`) and a new User. Connect the User to the database with **All Privileges**.
2. Open the File Manager and edit `.env` inside your `smartcompare_api` folder.
3. Update the `DATABASE_URL` with your exact live database credentials:
   `DATABASE_URL=mysql+pymysql://naba_user:YOUR_PASSWORD@localhost:3306/naba_smartcompare`
4. Go back to **Setup Python App** and click **Restart**.

Your backend API is now fully live! You can verify it by opening `https://nabatechshop.com/smartcompare/api/docs` in your browser.
