# GridPilot MVP v4 — Working Tesla Button

This version makes the Tesla button work locally by sending the browser directly to:

```text
http://localhost:8000/auth/tesla/redirect
```

The backend then builds the Tesla OAuth authorization URL and redirects the browser to Tesla.

## Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

Test:

```text
http://localhost:8000/health
```

## Backend `.env`

```env
TESLA_CLIENT_ID=your_tesla_client_id
TESLA_CLIENT_SECRET=your_tesla_client_secret
TESLA_REDIRECT_URI=http://localhost:8000/auth/tesla/callback
TESLA_AUDIENCE=https://fleet-api.prd.na.vn.cloud.tesla.com
FRONTEND_CALLBACK_URL=http://localhost:3000/tesla/callback
DRY_RUN=true
ENCRYPTION_KEY=dev-only-change-me
```

Start with:

```env
DRY_RUN=true
```

Then switch to:

```env
DRY_RUN=false
```

after the Tesla Developer Portal redirect URI is registered exactly as:

```text
http://localhost:8000/auth/tesla/callback
```

## Frontend

```bash
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

Frontend `.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Test flow

1. Start FastAPI backend on port 8000
2. Start Next.js frontend on port 3000
3. Visit `http://localhost:3000`
4. Click `Connect Tesla`
5. Browser should go to Tesla login
6. Tesla redirects to backend callback
7. Backend redirects to frontend callback page

## Important

This MVP still stores OAuth state/tokens in memory. Restarting the backend clears the connection. Next step is PostgreSQL + encrypted token storage.