# QuickPoll – Real-Time Opinion Polling Platform

QuickPoll is a full-stack prototype built to showcase rapid research, architecture, and delivery across FastAPI and Next.js with modern UI components (shadcn). Users can launch multi-option polls, cast votes, like polls, and watch the results refresh instantly via WebSocket updates.

## Architecture Overview

- **Backend**: FastAPI + SQLModel with a lightweight SQLite store. It exposes REST endpoints for poll management and a WebSocket channel for real-time broadcasts. A connection manager fans out `poll_snapshot`, `poll_created`, and `poll_updated` events to every client.
- **Frontend**: Next.js (App Router, TypeScript, TailwindCSS, shadcn-inspired component library). A custom `useRealtimePolls` hook manages initial REST hydration, WebSocket subscriptions, and optimistic refreshes. The UI focuses on clarity, responsiveness, and touch-friendly interactions.
- **Real-time transport**: Native FastAPI WebSocket endpoint (`/ws`) with in-memory fan-out. The frontend reconnects automatically and merges events into local state.
- **Persistence**: SQLite (via SQLModel) for fast local development. Tables are auto-created on startup; no manual migrations required for the prototype.

## Repository Layout

```
.
├── backend
│   ├── app
│   │   ├── database.py
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   └── websocket_manager.py
│   └── requirements.txt
├── frontend
│   ├── package.json
│   ├── src
│   │   ├── app
│   │   ├── components
│   │   ├── hooks
│   │   ├── lib
│   │   └── types
│   └── tailwind.config.ts
└── README.md
```

## Backend – FastAPI

- **Tech stack**: FastAPI, SQLModel, Uvicorn.
- **Key endpoints**:
  - `GET /polls` – List polls with options, votes, and likes.
  - `POST /polls` – Create a poll with ≥2 unique options.
  - `GET /polls/{poll_id}` – Fetch a single poll.
  - `POST /polls/{poll_id}/vote` – Increment the vote count for an option.
  - `POST /polls/{poll_id}/like` – Increment the poll like counter.
  - `WebSocket /ws` – Push snapshots and incremental updates to clients.
- **Database**: SQLite file `polls.db` (auto-generated alongside the server). For deployments, point `DATABASE_URL` to Postgres/MySQL and the rest of the code remains unchanged.
- **Real-time flow**: Every successful mutation (`create`, `vote`, `like`) rebroadcasts the canonical poll payload so clients stay in sync without polling.

### Running the backend locally

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`, and the WebSocket endpoint at `ws://localhost:8000/ws`.

## Frontend – Next.js + shadcn UI

- **Tech stack**: Next.js 14 (App Router), TypeScript, TailwindCSS, shadcn-style component system (Button, Card, Input, etc.).
- **State management**: A dedicated `useRealtimePolls` hook handles REST hydration, WebSocket subscriptions, and auto-reconnect with exponential back-off.
- **Notable UI features**:
  - Creation form with validation and dynamic option inputs (up to six choices).
  - Responsive poll cards showing vote totals, percentages, likes, and relative timestamps.
  - Subtle loading skeletons and toasts for feedback.

### Frontend environment variables

The app reads the backend base URL from optional environment variables:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_WS_BASE_URL=ws://localhost:8000
```

If omitted, it defaults to `http://localhost:8000` and the matching WebSocket scheme.

### Running the frontend locally

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` in the browser. The dev server proxies requests directly to the FastAPI backend (CORS is enabled on the API).

### Quality checks

```bash
# Type-check, lint, and produce a production build
npm run build

# Lint only
npm run lint
```

## Suggested Development Workflow

1. Start the backend: `uvicorn app.main:app --reload`.
2. Start the frontend dev server: `npm run dev`.
3. Visit `http://localhost:3000` to create polls, vote, and like in real time (open multiple browser windows to observe live updates).

## Deployment Notes

- **Backend**: Deploy to services such as Render, Railway, or Deta. Remember to persist or provision the SQLite/Postgres storage and set CORS origins appropriately.
- **Frontend**: Ship to Vercel, Netlify, or Cloudflare Pages. Configure `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_WS_BASE_URL` to point at the hosted backend (use `wss://` for secure WebSockets).
- **Scaling considerations** (future enhancements):
  - Swap SQLite for Postgres and add proper migrations.
  - Use Redis or a message broker for horizontal WebSocket fan-out.
  - Introduce authentication and per-user vote limits.
  - Add analytics/dashboard views for admins.

## Testing Status

- `python3 -m compileall backend/app` – ensures backend modules import cleanly.
- `npm run lint` & `npm run build` – passes without warnings or type errors.

## References & Research

- FastAPI WebSocket docs – https://fastapi.tiangolo.com/advanced/websockets/
- SQLModel relationship patterns – https://sqlmodel.tiangolo.com/
- shadcn UI inspiration – https://ui.shadcn.com/

---

Feel free to fork this repository, extend the data model (e.g., per-user vote tracking), or add more sophisticated analytics dashboards. QuickPoll is intentionally lightweight so you can iterate quickly during the challenge.
