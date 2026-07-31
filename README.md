<div align="center">

# 🤖 AI Candidate Screener

**AI-powered resume screening and recruitment portal**

[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/Frontend-React-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Build-Vite-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Express](https://img.shields.io/badge/Backend-Express-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/Database-SQLite-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Groq](https://img.shields.io/badge/AI-Groq-F55036?logo=groq&logoColor=white)](https://groq.com/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![pnpm](https://img.shields.io/badge/Package_Manager-pnpm-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Environment Variables](#-environment-variables)
- [Project Structure](#-project-structure)
- [Scripts](#-scripts)
- [API Overview](#-api-overview)
- [Architecture Documentation](#-architecture-documentation)
- [Testing](#-testing)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🚀 Overview

AI Candidate Screener is a full-stack recruitment SaaS that automates resume analysis using AI. Candidates can upload their resumes (PDF or plain text) and the system extracts structured data — skills, experience, contact details, and a match score — using Groq's LLM. Administrators get a dashboard to search, filter, sort, and chat with candidates about their profiles.

**Core workflows:**

1. **Candidates** → Upload resume → AI extracts structured profile → View and manage your data
2. **Admins** → Browse analyzed candidates → Filter by skills → Preview PDFs → Chat with candidates
3. **Notifications** → Real-time alerts for messages and status changes

---

## ✨ Features

| Feature | Description |
|---|---|
| **🤖 AI Resume Parsing** | Extracts skills, experience, projects, score (1–100), and contact info from PDFs or text via Groq LLM |
| **📄 PDF Upload & Preview** | Drag-and-drop resume upload with Multer; in-browser PDF preview modal |
| **🔐 Auth & RBAC** | JWT-based authentication with bcryptjs password hashing; admin vs candidate role enforcement |
| **📊 Admin Dashboard** | Candidate search, skill filtering, sorting, CSV export, profile modals, chat, and delete controls |
| **👤 Candidate Portal** | Upload/replace/delete your own resume; view your AI-extracted profile with scores |
| **💬 Chat System** | Admin–candidate messaging with optimistic updates, read receipts ("Sent" vs "Seen"), and polling-based refresh |
| **🔔 Notifications** | Real-time notification bell for new messages; mark individual or all as read |
| **🌐 i18n** | English, French, and Arabic with full RTL/LTR dynamic direction switching |
| **🌙 Dark/Light Mode** | Persistent theme toggle with CSS custom properties for seamless switching |
| **📂 CSV Export** | One-click export of visible candidates as CSV |

---

## 🛠 Tech Stack

### Frontend (`client/`)

| Technology | Purpose |
|---|---|
| **React 19** | UI library with hooks-based architecture |
| **TypeScript 6** | Strict type safety across the entire codebase |
| **Vite 8** | Fast dev server and optimized production builds |
| **Tailwind CSS 4** | Utility-first styling with `@theme` tokens |
| **react-i18next** | Internationalization (en, fr, ar) with auto-detected language |
| **CSS Custom Properties** | Dark/light theme via `:root` and `:root.dark` selectors |

### Backend (`server/`)

| Technology | Purpose |
|---|---|
| **Express 5** | HTTP server with middleware-based routing |
| **TypeScript 7** | Full type coverage for controllers, repositories, and services |
| **better-sqlite3** | Synchronous SQLite driver with prepared statements |
| **jsonwebtoken** | JWT issuance and verification |
| **bcryptjs** | Password hashing and comparison |
| **Multer** | Multipart file upload handling |
| **pdf-parse** | PDF text extraction |
| **OpenAI SDK** | Groq-compatible AI inference via `https://api.groq.com/openai/v1` |

### Infrastructure

| Component | Details |
|---|---|
| **Database** | SQLite (single-file `screener.db`) with foreign keys, cascading deletes, and unique constraints |
| **AI Provider** | Groq (Llama 3.3 70B) — mock fallback when API key is absent |
| **Package Manager** | pnpm — workspace-free monorepo with `client/` and `server/` as sibling packages |

---

## 📋 Prerequisites

- **Node.js** >= 22
- **pnpm** >= 9 (`npm install -g pnpm`)
- A **Groq API key** ([get one free](https://console.groq.com/keys)) — the app falls back to mock data without one

---

## ⚡ Quick Start

```bash
# 1. Clone the repository
git clone <repo-url>
cd ai-candidate-screener

# 2. Install dependencies (both client and server)
pnpm --prefix client install
pnpm --prefix server install

# 3. Create environment file
cp .env.example .env   # or create manually (see below)

# 4. Start the backend (runs on port 5000 by default)
pnpm --prefix server dev

# 5. In a second terminal, start the frontend (runs on port 5173 by default)
pnpm --prefix client dev
```

Open **http://localhost:5173** in your browser. The first user to register becomes an admin automatically.

---

## 🔑 Environment Variables

Create a `.env` file in the project root (or in `server/` — both are loaded):

```env
# Required for AI-powered resume analysis (get one free at https://console.groq.com/keys)
GROQ_API_KEY=gsk_your_api_key_here

# JWT secret for token signing (default used if omitted; set a strong secret in production)
JWT_SECRET=your-256-bit-secret

# Server port (default: 5000)
PORT=5000
```

> ⚠️ **Without `GROQ_API_KEY`:** The AI analysis endpoint returns structured mock data so development is never blocked. The chat, auth, and notification systems work independently of the AI provider.

---

## 📁 Project Structure

```
├── client/                          # React + Vite frontend
│   ├── src/
│   │   ├── components/              # UI components by domain
│   │   │   ├── auth/               # Auth form components
│   │   │   ├── candidate/          # AdminDashboard, CandidatePortal, modals
│   │   │   ├── common/             # ThemeToggle, LanguageSwitcher
│   │   │   ├── layout/             # AppHeader
│   │   │   └── ui/                 # StatusBanner, icons
│   │   ├── hooks/                  # useAuth, useCandidates, useChat, useNotifications
│   │   ├── services/               # HTTP/API callers (authService, candidateService, ...)
│   │   ├── types/                  # Shared TypeScript models (candidate, auth, chat, notification)
│   │   ├── locales/                # i18n resources (en.json, fr.json, ar.json)
│   │   ├── App.tsx                 # Root component with role-based routing
│   │   ├── main.tsx                # Entry point
│   │   └── index.css               # SSOT for all styling (CSS variables + component classes)
│   ├── tests/                      # Frontend tests (api, i18n, theme, candidateUtils)
│   ├── package.json
│   └── vite.config.ts
│
├── server/                          # Express + TypeScript backend
│   ├── src/
│   │   ├── routes/                 # Route definitions (auth, candidates, chat, notifications)
│   │   ├── controllers/           # Request validation, orchestration, JSON responses
│   │   ├── middleware/             # JWT auth, admin check, file upload
│   │   ├── services/              # AI analysis (Groq), PDF parsing
│   │   ├── candidateRepository.ts  # SQL queries for candidates
│   │   ├── userRepository.ts       # SQL queries for users
│   │   ├── messageRepository.ts    # SQL queries for messages
│   │   ├── notificationRepository.ts # SQL queries for notifications
│   │   ├── config/db.ts           # SQLite connection + initialization
│   │   ├── databaseSchema.ts       # Schema creation and migrations
│   │   ├── candidateResponse.ts    # API response shaping helpers
│   │   ├── localizedSummary.ts     # Multi-language summary builder
│   │   └── index.ts               # App setup, middleware, routes, listen
│   ├── tests/                      # Backend tests (routes, repositories, services)
│   ├── package.json
│   └── tsconfig.json
│
├── API_REFERENCE.md                 # Complete API endpoint documentation
├── AGENTS.md                        # AI agent contribution contract & architecture rules
├── PROJECT_ARCHITECTURE_EXPLAINED.md       # Full architecture guide (Arabic)
├── PROJECT_ARCHITECTURE_EXPLAINED_EN.md    # Full architecture guide (English)
├── docs/superpowers/plans/          # Implementation plans for refactors
└── README.md                        # This file
```

### Architecture Philosophy

The codebase follows **Clean Architecture / Single Responsibility** principles:

```
Browser
   │
   ▼
 React Components  ───► Custom Hooks ───► Services ───► HTTP API
(client/src/)        (hooks/)          (services/)        (fetch)
                                                            │
                                                          API
                                                            │
                                                          Express
                                                            │
 Route ───► Controller ───► Repository ───► SQLite DB
(routes/)   (controllers/)   (*Repository.ts)
                │
                └──► Services (AI, PDF, ...)
```

- **Routes** own URL mapping only
- **Controllers** validate input, orchestrate logic, return JSON
- **Repositories** own SQL queries and data mapping
- **Services** own external I/O (AI, file parsing)
- **Middleware** owns auth, role checks, uploads
- **UI Components** render and call typed callbacks — no direct `fetch`, `localStorage`, or business logic

---

## 📜 Scripts

### Backend (`cd server`)

| Script | Command | Description |
|---|---|---|
| `dev` | `tsx watch src/index.ts` | Hot-reload development server |
| `build` | `tsc` | TypeScript compilation to `dist/` |
| `test` | `pnpm test:node && pnpm test:jest` | Run all tests |
| `test:node` | `tsx --test ...` | Node test runner for unit tests |
| `test:jest` | `jest --config jest.config.cjs` | Jest test runner for integration tests |

### Frontend (`cd client`)

| Script | Command | Description |
|---|---|---|
| `dev` | `vite` | Vite dev server with HMR |
| `build` | `tsc -b && vite build` | TypeScript check + production build |
| `preview` | `vite preview` | Preview production build locally |
| `lint` | `eslint .` | ESLint static analysis |
| `test` | `tsx --test tests/*.test.ts` | Run all tests |

### Root level commands

```bash
# Install dependencies
pnpm --prefix client install
pnpm --prefix server install

# Backend
cd server && pnpm dev         # Start API server
cd server && pnpm test        # Run backend tests

# Frontend
cd client && pnpm dev         # Start UI dev server
cd client && pnpm test        # Run frontend tests
cd client && pnpm build       # Production build
```

---

## 🌐 API Overview

The API exposes **16 endpoints** across 6 resource groups. All endpoints documented in detail at [`API_REFERENCE.md`](./API_REFERENCE.md).

| Group | Base Path | Auth Required | Key Endpoints |
|---|---|---|---|
| **Auth** | `/api/auth` | No (register/login), Yes (me/admins) | `POST /register`, `POST /login`, `GET /me`, `GET /admins` |
| **Candidates** | `/api/candidates` | Yes | `GET /`, `POST /`, `POST /analyze`, `POST /upload-pdf`, `DELETE /:id` |
| **Chat** | `/api/chat` | Yes | `POST /send`, `GET /:candidate_id` |
| **Notifications** | `/api/notifications` | Yes | `GET /`, `PATCH /read-all`, `PATCH /:id/read` |
| **Health** | `/api/health` | No | `GET /` |
| **Static** | `/uploads/:filename` | No | PDF file serving |

Standard response format: `{ "error": "Description" }` for errors.

---

## 📚 Architecture Documentation

Comprehensive architecture deep-dives are available in two languages:

- 🇸🇦 **[PROJECT_ARCHITECTURE_EXPLAINED.md](./PROJECT_ARCHITECTURE_EXPLAINED.md)** — Arabic (عربي) — Full system analysis with Mermaid diagrams
- 🇬🇧 **[PROJECT_ARCHITECTURE_EXPLAINED_EN.md](./PROJECT_ARCHITECTURE_EXPLAINED_EN.md)** — English — Complete architecture guide with Mermaid diagrams

Both documents cover:
- Executive project overview & vision
- Backend architecture (Express, auth, uploads, database, error handling)
- AI pipeline & prompt engineering (Groq integration)
- Frontend architecture (React, hooks, styling, i18n, polling)
- Database ER diagram with full schema relationships
- Auth, resume upload, and chat flow diagrams
- 10 critical interview Q&A with engineering trade-offs

---

## 🧪 Testing

```bash
# Run all backend tests
cd server && pnpm test

# Run all frontend tests
cd client && pnpm test

# TypeScript checks
cd client && npx tsc --noEmit
cd server && pnpm build
```

### Test Coverage

**Backend (9 test files):**
- Auth routes (register, login, JWT, role checks, error handling)
- Candidate routes & repository (CRUD, RBAC, upsert, search, filter, sort)
- Chat routes (send, read receipts, get messages)
- Notification routes & repository (read, mark as read, role-targeted dispatch)
- AI service (Groq integration, mock fallback, JSON parsing)
- PDF service (file extraction, error handling)
- Integration tests (end-to-end flows)

**Frontend (4 test files):**
- API service calls (auth, candidates, chat, notifications)
- i18n (translation keys, language switching, RTL direction)
- Theme toggle (persistence, dark/light class switching)
- Candidate utilities (CSV export formatting)

---

## 🤝 Contributing

See [`AGENTS.md`](./AGENTS.md) for the full contribution contract, coding standards, and architecture rules.

Key principles:
- Strict TypeScript — no `any` types
- Single Responsibility — one reason to change per file
- Role-Based Access Control — never trust client-provided identity
- Resilience — mock fallback when external services are unavailable
- Consistent error responses — always `{ "error": "Message" }`

---

## 📄 License

**MIT** — See [LICENSE](./LICENSE) for details.

---

<div align="center">
  <sub>Built with ❤️ using React, Express, TypeScript, SQLite, and Groq AI</sub>
</div>
