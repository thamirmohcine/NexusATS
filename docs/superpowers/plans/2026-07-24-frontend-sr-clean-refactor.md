# Frontend SR Clean Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the React client so types, HTTP services, hooks, and presentational UI each have one clear responsibility.

**Architecture:** Keep the existing user flows and visual design intact while moving interfaces to `client/src/types`, HTTP calls to `client/src/services`, side effects/state to `client/src/hooks`, and large UI sections to focused components. Keep `client/src/api.ts` as a compatibility barrel during the transition so existing tests can migrate safely.

**Tech Stack:** React 19, Vite, TypeScript strict mode, Tailwind CSS, Node test runner via `tsx`.

## Global Constraints

- TypeScript First: Use strict TypeScript. Never use `any`.
- Architecture: Keep Frontend in `./client` and Backend in `./server`.
- Error Handling: Preserve API error handling from `{ "error": "Description" }`.
- Clean Code: Keep functions small and modular.
- Preserve current auth, candidate, chat, notification, and dashboard behavior.

---

### Task 1: Types And Services

**Files:**
- Create: `client/src/types/auth.ts`
- Create: `client/src/types/candidate.ts`
- Create: `client/src/types/chat.ts`
- Create: `client/src/types/notification.ts`
- Create: `client/src/services/http.ts`
- Create: `client/src/services/authService.ts`
- Create: `client/src/services/candidateService.ts`
- Create: `client/src/services/chatService.ts`
- Create: `client/src/services/notificationService.ts`
- Modify: `client/src/api.ts`
- Modify: `client/tests/api.test.ts`

**Interfaces:**
- Produces domain service functions with the same names as the old API exports.
- Produces a barrel `api.ts` that re-exports all services and types.

- [ ] **Step 1: Write tests against service module imports**

Update `client/tests/api.test.ts` to import service functions from `client/src/services/*` and types from `client/src/types/*`.

- [ ] **Step 2: Run tests to verify missing modules fail**

Run: `pnpm test` in `client`.
Expected: FAIL because service/type modules do not exist yet.

- [ ] **Step 3: Add type and service modules**

Move interfaces from `api.ts` into domain type files and move HTTP functions into service files using shared `getErrorMessage` and `getAuthHeaders`.

- [ ] **Step 4: Verify services**

Run: `pnpm test` in `client`.
Expected: service tests pass.

### Task 2: Hooks

**Files:**
- Create: `client/src/hooks/useAuth.ts`
- Create: `client/src/hooks/useCandidates.ts`
- Create: `client/src/hooks/useChat.ts`
- Create: `client/src/hooks/useNotifications.ts`
- Modify: `client/src/components/Auth.tsx`
- Modify: `client/src/components/ChatDrawer.tsx`
- Modify: `client/src/components/NotificationBell.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- `useAuth()` owns stored session, authentication success, and logout.
- `useCandidates(authSession)` owns candidate loading, admin users, visible candidates, mutation helpers, and candidate operations.
- `useChat({ authToken, candidateId, isOpen })` owns chat polling and sending.
- `useNotifications(authToken)` owns notification polling, unread count, and read mutations.

- [ ] **Step 1: Extract auth and candidate state**

Move localStorage session logic to `useAuth.ts` and candidate load/delete/analyze/upload/filter logic to `useCandidates.ts`.

- [ ] **Step 2: Extract chat and notification effects**

Move chat polling/sending from `ChatDrawer.tsx` to `useChat.ts`, and notification polling/read logic from `NotificationBell.tsx` to `useNotifications.ts`.

- [ ] **Step 3: Verify**

Run: `pnpm build` in `client`.
Expected: TypeScript compiles with hooks owning stateful logic.

### Task 3: Presentational Components

**Files:**
- Create: `client/src/components/auth/AuthForm.tsx`
- Modify: `client/src/components/Auth.tsx`
- Create: `client/src/components/layout/AppHeader.tsx`
- Create: `client/src/components/candidate/CandidatePortal.tsx`
- Create: `client/src/components/candidate/AdminDashboard.tsx`
- Create: `client/src/components/candidate/CandidateProfileModal.tsx`
- Create: `client/src/components/candidate/PdfPreviewModal.tsx`
- Create: `client/src/components/ui/icons.tsx`
- Create: `client/src/components/ui/StatusBanner.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- `App.tsx` orchestrates hooks and selected modal state.
- Presentational components receive data and callbacks only.

- [ ] **Step 1: Extract Auth form UI**

Move form markup from `Auth.tsx` to `components/auth/AuthForm.tsx`, leaving `Auth.tsx` as auth-flow container.

- [ ] **Step 2: Extract dashboard sections**

Move header, candidate portal, admin dashboard, profile modal, PDF modal, icons, and status banner into focused components.

- [ ] **Step 3: Verify**

Run: `pnpm lint`, `pnpm test`, and `pnpm build` in `client`.
Expected: all pass.

### Task 4: Final Checks

**Files:**
- All changed frontend files.

**Interfaces:**
- No visible workflow regression: unauthenticated users see auth UI; candidates see only portal; admins see dashboard; chat/notifications still poll.

- [ ] **Step 1: Strict type scan**

Run: `rg -n "(:|as|<)\s*any\b|\bany\[\]" client/src client/tests`.
Expected: no matches.

- [ ] **Step 2: Route/import scan**

Run: `rg -n "from './api'|from '../api'" client/src`.
Expected: either no matches or only compatibility imports intentionally left during transition.
