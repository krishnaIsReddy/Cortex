# Cortex

A Codebase Ownership & Bus-Factor Risk Dashboard.

Cortex mines a team's git history to identify and visualize "bus-factor" risk — the risk that knowledge about a critical part of a codebase is concentrated in too few people.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite, Recharts/D3 |
| API | FastAPI (Python) |
| Backend Services | Python (GitPython / PyDriller) |
| Database | PostgreSQL |
| AI | Hosted LLM API (score explainer only) |

## Project Structure

```
src/
├── api/                    # FastAPI application
│   ├── routes/             # Route handlers (one file per resource)
│   ├── schemas/            # Pydantic request/response models
│   └── deps/               # Shared dependencies (auth, db session, etc.)
│
├── services/
│   ├── ingestion/          # Clone/pull repos & parse commit metadata   [Krishna]
│   ├── scoring/            # Ownership & risk-score computation         [Shared]
│   └── alerting/           # Email/Slack digest for high-risk files     [Muhammad]
│
├── db/
│   ├── models/             # SQLAlchemy / ORM models
│   └── repositories/       # Data-access layer (repository pattern)
│
├── ai/                     # Stateless LLM explainer service
│
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── auth/       # OAuth & repo-URL input components          [Josh]
│       │   ├── dashboard/  # Heatmap & file-list components             [Hardeep]
│       │   └── common/     # Shared UI (buttons, layout, etc.)
│       ├── hooks/          # Custom React hooks
│       ├── services/       # API client / fetch helpers
│       └── pages/          # Top-level route pages
│
└── tests/
    ├── unit/
    └── integration/
```

## MVP Issue Ownership

| Owner | GitHub Issue | Primary Folders |
|-------|-------------|-----------------|
| **Josh** | GitHub OAuth / repo URL connection | `src/api/routes/`, `src/api/deps/`, `src/frontend/src/components/auth/`, `src/frontend/src/pages/` |
| **Krishna** | History ingestion (clone, parse, store) | `src/services/ingestion/`, `src/db/models/`, `src/db/repositories/` |
| **Hardeep** | Heatmap dashboard (v1) | `src/frontend/src/components/dashboard/`, `src/frontend/src/hooks/`, `src/frontend/src/services/` |
| **Muhammad** | High-risk file alerting / digest | `src/services/alerting/`, `src/api/routes/` |

> Each person works primarily in their listed folders. Shared code (DB models, schemas, scoring) should be coordinated via PR reviews.

## Getting Started

```bash
# Clone the repo
git clone <repo-url>
cd Cortex

# Backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn src.api.main:app --reload

# Frontend
cd src/frontend
npm install
npm run dev
```

## Development Guidelines

- **Branch naming**: `feature/<issue-short-name>` (e.g. `feature/github-oauth`, `feature/history-ingestion`)
- **PRs**: Always open a PR to `main`. At least one teammate reviews before merge.
- **Commits**: Use conventional commits (`feat:`, `fix:`, `docs:`, etc.)
- **Conflicts**: Stay in your assigned folders to minimize merge conflicts.

## Auth setup (first run)

1. Register a GitHub App at https://github.com/settings/apps/new
   - Redirect URI: http://localhost:8000/api/auth/github/callback
   - Check "Request user authorization (OAuth) during installation"
   - Uncheck Webhook -> Active
   - Repository permissions -> Contents: Read-only
2. Copy the Client ID; generate a Client secret.
3. `cp .env.example .env` and paste both values.
4. `uvicorn src.main:app --reload`
