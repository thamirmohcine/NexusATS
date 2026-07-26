# AI Candidate Screener Agent Guide

This file is the contribution contract for AI agents and developers working in this repository. Follow it before changing code, UI, database shape, or API behavior.

## Product Context

AI Candidate Screener is a full-stack resume screening and recruitment portal.

- Frontend: React, Vite, TypeScript, Tailwind CSS
- Backend: Node.js, Express, TypeScript
- Database: SQLite with `better-sqlite3`
- AI: OpenAI-compatible chat completions, currently Groq-compatible through the OpenAI SDK
- Package manager: `pnpm`

## Non-Negotiable Rules

- Use strict TypeScript. Do not use `any`; define explicit interfaces and narrow unknown values safely.
- Keep API error responses in the standard shape: `{ "error": "Description" }`.
- Keep changes scoped to the requested behavior. Avoid unrelated refactors.
- Preserve existing user work. Do not run destructive git or filesystem commands unless explicitly requested.
- Use `rg` or `rg --files` for search.
- Do not commit secrets, API keys, database files, uploads, or generated build output.
- Prefer small functions, clear names, and straightforward data flow over clever abstractions.

## Coding Rules

### Styling & Design System Standards

- Enforce a single source of truth for application styling in `client/src/index.css`.
- Define brand colors, surfaces, text colors, borders, status colors, radii, shadows, focus rings, and transitions as centralized theme tokens or CSS variables.
- Use the shared component classes from `client/src/index.css` for common UI patterns, including buttons, cards, inputs, badges, modals, drawers, alerts, and empty states.
- Do not add hardcoded hex colors in React component files.
- Do not add arbitrary color values or one-off Tailwind color utility clusters in component `className` strings when an existing theme token or shared class can express the same style.
- All new React components must support both Light and Dark modes seamlessly using centralized CSS theme variables or Tailwind's `dark:` modifier.
- Keep component classes focused on layout, spacing, responsive behavior, and state-specific composition. Visual styling belongs in the centralized CSS classes and theme tokens.
- When a new repeated visual pattern appears, add or extend a reusable class in `client/src/index.css` before using it across components.

### Internationalization (i18n) Standards

- Do not hardcode user-facing text strings directly in React JSX components.
- Use the `useTranslation()` hook for component copy, labels, button text, aria labels, placeholders, empty states, loading states, and error or success messages rendered in the UI.
- Store all user-facing strings in the matching translation resources under `client/src/locales/*.json`.
- When adding or changing UI copy, update `client/src/locales/en.json`, `client/src/locales/fr.json`, and `client/src/locales/ar.json` together.
- Keep translation keys stable, descriptive, and grouped by product area such as `auth`, `candidatePortal`, `adminDashboard`, `chat`, and `notifications`.

## Codebase Structure

### Root

- `client/`: React application.
- `server/`: Express API.
- `docs/superpowers/plans/`: implementation plans for large refactors or multi-step work.
- `AGENTS.md`: this file. Update it when architectural rules change.

### Frontend Structure

- `client/src/App.tsx`: app composition and role-based view switching only.
- `client/src/types/`: shared TypeScript models by domain.
- `client/src/services/`: HTTP/API functions by domain.
  - `authService.ts`
  - `candidateService.ts`
  - `chatService.ts`
  - `notificationService.ts`
  - `http.ts`
- `client/src/hooks/`: state, effects, polling, persistence, and workflow logic.
  - `useAuth`
  - `useCandidates`
  - `useChat`
  - `useNotifications`
- `client/src/components/`: UI components grouped by domain.
  - `auth/`: authentication forms.
  - `candidate/`: candidate portal, admin dashboard, profile and PDF modals.
  - `chat/` or chat components: chat drawer and message UI.
  - `notification/` or notification components: notification bell and dropdown UI.
  - `layout/`: app shell, navigation, header.
  - `ui/`: small reusable primitives such as status banners and icons.
- `client/src/api.ts`: compatibility barrel only. New API implementation belongs in `services/`.

Frontend boundaries:

- Components render UI and call typed callbacks. They should not contain direct `fetch`, `localStorage`, polling intervals, or business rules.
- Hooks own stateful workflows, side effects, polling, token persistence, and derived view data.
- Services own HTTP calls and response parsing.
- Types are centralized in `types/`; avoid redefining API models inside components.
- Candidate display helpers may live near candidate components when they are purely presentational.

### Backend Structure

- `server/src/index.ts`: app setup, middleware registration, static uploads, route mounting, and listen logic.
- `server/src/config/db.ts`: SQLite connection and database initialization entrypoint.
- `server/src/databaseSchema.ts`: schema creation and safe column migrations.
- `server/src/routes/`: lightweight route declarations only.
- `server/src/controllers/`: request validation, orchestration, status codes, and JSON responses.
- `server/src/*Repository.ts`: SQL queries and persistence logic. If repository modules are moved into `repositories/`, move them consistently.
- `server/src/services/`: external or domain services such as AI analysis and PDF parsing.
- `server/src/middleware/`: authentication, role checks, upload configuration, and request middleware.
- `server/src/http.ts`: shared HTTP helpers and response utilities.
- `server/src/db.ts`: legacy compatibility re-export only.

Backend boundaries:

- Routes must not contain business logic or SQL.
- Controllers must not manually open database connections.
- Repositories own SQL statements and database row mapping.
- Middleware owns token verification, role enforcement, and upload parsing.
- Services own external I/O, AI parsing, PDF extraction, and reusable domain operations.

## Architecture Principles

- Single Responsibility: each file should have one reason to change.
- Dependency Direction: UI calls hooks, hooks call services, services call APIs. Routes call controllers, controllers call repositories/services.
- Role-Based Access Control: never trust client-provided role or user id. Derive identity from the verified JWT.
- Candidate Data Isolation: candidates can fetch, replace, upload, chat about, and delete only their own profile. Admins can access all candidate profiles.
- Consistent Contracts: when API response fields change, update backend types, frontend types, services, hooks, and UI together.
- Safe Persistence: do not drop existing SQLite tables or user data during routine schema changes. Use additive migrations and default values.
- Local Development Resilience: AI analysis must keep a mock fallback when the API key is missing or the provider fails.

## API Standards

- Return JSON for every API response.
- Error responses must be `{ "error": "Message" }`.
- Use meaningful status codes:
  - `200` for successful reads, updates, deletes, and login.
  - `201` for created or upserted candidate analysis results.
  - `400` for invalid input.
  - `401` for missing or invalid authentication.
  - `403` for authenticated users without permission.
  - `404` when the target record does not exist or is not visible to the user.
  - `409` for true uniqueness conflicts when an upsert is not appropriate.
  - `500` for unexpected server failures.
- Validate request bodies before using them.
- Keep route paths stable unless the user asks for an API change.

## Database Rules

- Candidate arrays and nested data are stored as JSON strings in SQLite and returned as parsed JSON objects to the client.
- Candidate records include ownership through `user_id`; all candidate-role queries must filter by it.
- Uploaded PDF files use the static `/uploads/...` URL stored in `pdf_url`.
- Passwords must be hashed with `bcryptjs`.
- Reset tokens must be generated securely and cleared after successful reset.
- Chat messages and notifications must preserve sender, receiver, candidate profile, read status, and timestamps.

## Design System Rules

The app is a practical recruiting dashboard, not a marketing site. Build dense, calm, scan-friendly interfaces.

- Use Tailwind CSS utilities and existing component patterns.
- Prefer neutral surfaces with restrained accent colors such as emerald, sky, amber, rose, and zinc.
- Avoid one-note palettes dominated by purple, blue gradients, beige, brown, or dark slate.
- Do not use decorative gradient orbs, bokeh blobs, or unrelated hero illustrations.
- Cards should be for repeated records, modals, and framed tools. Do not nest cards inside cards.
- Keep card radius at `rounded-lg` or less unless an existing component requires otherwise.
- Use stable dimensions for toolbars, icon buttons, badges, candidate cards, modals, and PDF viewers so content does not shift unexpectedly.
- Text must not overflow, overlap, or be hidden at mobile or desktop sizes.
- Use icons for common actions such as delete, upload, search, export, preview, send, and close.
- Buttons need visible focus states, disabled states, and loading states when they trigger async work.
- Use score badges consistently:
  - Green for scores `>= 80`
  - Yellow for scores `60-79`
  - Red for scores `< 60`
- Skill pills should be compact, readable, clickable when used as filters, and keyboard accessible when interactive.
- Modals must have clear close controls and should not hide important actions below the fold.
- Candidate portal UI must show only the signed-in candidate's own profile and upload/replace/delete actions.
- Admin dashboard UI must show candidate search, skill filtering, sorting, CSV export, PDF preview, profile view, chat, and delete controls.

## AI And Resume Processing

- AI responses must be requested as strict JSON objects.
- Parse and validate model output before saving it.
- Keep the mock fallback path when `GROQ_API_KEY` is missing or the API call fails.
- Do not let local development block on external AI availability.
- PDF parsing should fail gracefully with a standard JSON error response.
- Store extracted rich resume data consistently: name, email, phone, links, skills, experience, projects, summary, score, and PDF URL when available.

## Authentication, Chat, And Notifications

- Authentication state lives in the frontend auth hook and persisted storage controlled by that hook.
- Protected backend routes must use token middleware.
- Admin-only actions must use role middleware or explicit controller checks.
- Chat polling belongs in chat hooks/components designed for that purpose.
- Opening a chat should mark incoming messages as read.
- Message notifications should deep-link into the relevant candidate chat when the UI has the callback available.
- Notification reads must update server state and clear local unread counts.

## Verification Commands

Run the smallest meaningful verification for the change.

Backend:

```bash
cd server
pnpm build
pnpm test
```

Frontend:

```bash
cd client
pnpm lint
pnpm test
pnpm build
```

For documentation-only changes, verify the edited file renders as valid Markdown and explain that no code tests were run.

## Contribution Checklist

Before finishing a task:

1. Confirm the change follows this file and the user's latest request.
2. Update TypeScript types when data contracts change.
3. Keep frontend role-based UI and backend role-based authorization aligned.
4. Preserve standard error responses.
5. Run appropriate verification commands or clearly state why they were skipped.
6. Summarize changed files, behavior, and any remaining risk.
