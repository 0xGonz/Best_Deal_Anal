# DealFlowLifecyclev1  
*A full-stack platform for orchestrating the entire investment deal lifecycle*

![Build](https://img.shields.io/badge/build-passing-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue)

---

## 1. Project Description
DealFlowLifecyclev1 (DFL) is an end-to-end investment deal lifecycle management platform.  
It empowers funds, family offices, and venture firms to track, collaborate on, and execute deals—from initial sourcing through closing and post-investment monitoring—while maintaining a single source of truth for documents, capital calls, analytics, and stakeholder communications.

---

## 2. Key Features
| Domain | Highlights |
|--------|------------|
| Deal Tracking | Kanban-style pipeline, stage gating, star/vote system, audit trail |
| Document Management | Upload, version, and render PDFs in-browser; Postgres BLOB fallback; automated path reconciliation |
| Calendar Integration | Central calendar for closings, capital calls, meetings & key dates |
| Capital Calls & Fund Admin | Create calls, monitor payments, enforce limits, vintage tracking |
| Analytics & Reporting | Real-time dashboard widgets and AI-powered document analysis |
| Notifications | In-app + email alerts driven by an event bus |
| Security | JWT authentication, RBAC, rate limiting, CORS hardening |

---

## 3. Tech Stack
- **Frontend:** React + TypeScript, Vite, TailwindCSS, React Query  
- **Backend:** Node.js, Express, TypeScript, Drizzle ORM, PostgreSQL  
- **Shared:** Zod schemas, universal path resolver, shared utils  
- **Tooling:** Jest/Vitest, ESLint, Prettier, GitHub Actions CI  

---

## 4. Architecture Overview
```
monorepo/
├── client      # React SPA
├── server      # Express API & jobs
├── shared      # Isomorphic models/utilities
└── scripts     # DB and storage migrations
```
The server follows a service-oriented pattern: each bounded context (deals, documents, capital calls, etc.) exposes a controller, service, and route module. Communication with async background jobs (notifications, reports) is abstracted via `JobQueue`.  

---

## 5. Installation & Setup

### 5.1 Prerequisites
- Node >= 18  
- pnpm (or npm/yarn)  
- PostgreSQL 14+  

### 5.2 Clone & bootstrap
```bash
git clone https://github.com/0xGonz/DealFlowLifecyclev1.git
cd DealFlowLifecyclev1

# install server + client deps
pnpm install            # or npm ci
```

### 5.3 Environment variables
Copy the template and fill in your secrets:
```bash
cp .env.example .env
```
Critical vars  
```
DATABASE_URL=postgres://user:pass@localhost:5432/dealflow
JWT_SECRET=superlongsecret
APP_BASE_URL=http://localhost:5173
```

### 5.4 Database migration / seed
```bash
pnpm run db:push        # runs Drizzle migrations
pnpm run seed           # optional sample data
```

### 5.5 Run the platform
```bash
# in root (concurrently)
pnpm run dev
```
- Client: http://localhost:5173  
- Server: http://localhost:3000/api  

---

## 6. Project Structure
| Path | Purpose |
|------|---------|
| `client/` | React components, pages, hooks, Tailwind theme |
| `server/` | Express app, services, controllers, jobs |
| `shared/` | Type-safe models & helpers reused by both tiers |
| `scripts/` | One-off maintenance and migration utilities |

---

## 7. Core Components

### Authentication
- Email/password with session cookies or JWT fallback  
- Refresh token rotation and `@auth/*` routes  

### Deal Management
- `/api/deals` CRUD, pipeline stages, star voting  
- Workflow service enforces state transitions

### Document System
- Uploads stored on disk or Postgres BLOB (`unified-document-storage`)  
- PDF rendered via `react-pdf` with correctly versioned pdfjs worker

### Calendar Module
- `/api/calendar` aggregates meetings, capital calls, closings  
- Client hook `use-calendar-events` feeds FullCalendar UI

### Notifications
- Background job scans events and inserts rows into `notifications` table  
- `/api/notifications/unread-count` powers badge counters

---

## 8. API Overview (v1)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/deals` | List deals |
| POST   | `/api/deals` | Create deal |
| GET    | `/api/deals/:id/documents` | Deal documents |
| POST   | `/api/documents/upload` | Upload file |
| GET    | `/api/calendar` | Combined calendar feed |
| GET    | `/api/capital-calls` | List calls |
| POST   | `/api/auth/login` | Auth user |
*(see `server/routes/` for full list & query params)*

---

## 9. Development Scripts
| Command | What it does |
|---------|--------------|
| `pnpm run dev` | Concurrent client & server w/ hot reload |
| `pnpm run lint` | ESLint + Prettier check |
| `pnpm run test` | Vitest unit tests |
| `pnpm run db:push` | Apply Drizzle migrations |
| `pnpm run build` | Production bundle (client) |

---

## 10. Feature Walkthrough
- **Dashboard:** KPIs for AUM, IRR projections, unread docs  
- **Pipeline:** Drag-and-drop Kanban of deal stages  
- **Funds:** Vintage, target return, allocation breakdowns  
- **Capital Calls:** Schedule, collect, reconcile payments  
- **Reporting:** Auto-generated PDFs & Excel exports  
- **AI Analysis:** GPT-powered document summarization (experimental)  

---

## 11. Contributing
1. Fork & clone repo  
2. Create feature branch: `git checkout -b feat/<topic>`  
3. Commit w/ Conventional Commits  
4. Open PR against `main`. All checks (lint, tests) must pass.

---

## 12. License
This project is licensed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

BG
