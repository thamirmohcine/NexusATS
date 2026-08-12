# Backend Clean Architecture Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Express backend so routes only map HTTP endpoints while controllers, middleware, and database config own the business logic and infrastructure setup.

**Architecture:** Keep existing repositories as data-access boundaries and move request orchestration into controller factories. Route factory options continue to inject repositories and services for tests. Shared JWT authentication and PDF upload setup move into dedicated middleware modules.

**Tech Stack:** Node.js, Express 5, TypeScript, PostgreSQL via pg (node-postgres), multer, bcryptjs, jsonwebtoken, pnpm.

## Global Constraints

- TypeScript First: Use strict TypeScript and never use `any`.
- Error Handling: Standardize API JSON error responses as `{ "error": "Description" }`.
- Clean Code: Keep functions small and modular.
- Preserve existing API routes and response shapes.
- Preserve current tests and repository injection patterns.

---

### Task 1: Config And Shared Middleware

**Files:**
- Create: `server/src/config/db.ts`
- Modify: `server/src/db.ts`
- Create: `server/src/http.ts`
- Create: `server/src/middleware/auth.ts`
- Create: `server/src/middleware/upload.ts`

**Interfaces:**
- Produces: `db`, `databaseUrl` from `server/src/config/db.ts`.
- Produces: `sendError(response, statusCode, message)` and `parsePositiveInteger(value)`.
- Produces: `createAuthMiddleware({ jwtSecret, userRepository })` returning `{ requireAuth, requireAdmin }`.
- Produces: `createUploadSinglePdf(uploadsDirectory)` and `buildPdfUrl(request, fileName)`.

- [ ] **Step 1: Add failing expectations by running the backend build after imports are updated**

Run after route/controller imports change: `pnpm build` in `server`.
Expected before implementation: TypeScript cannot find new config/middleware modules.

- [ ] **Step 2: Implement config and middleware**

Move database construction into `server/src/config/db.ts`, re-export it from `server/src/db.ts`, and add shared helper modules exactly named above.

- [ ] **Step 3: Verify**

Run: `pnpm build` in `server`.
Expected: no TypeScript errors from config or middleware exports.

### Task 2: Controllers

**Files:**
- Create: `server/src/controllers/authController.ts`
- Create: `server/src/controllers/candidateController.ts`
- Create: `server/src/controllers/chatController.ts`
- Create: `server/src/controllers/notificationController.ts`

**Interfaces:**
- Consumes: repositories, services, auth middleware, upload middleware, `sendError`.
- Produces: `createAuthController(...)`, `createCandidateController(...)`, `createChatController(...)`, `createNotificationController(...)`.
- Each controller returns named handler methods used directly by routes.

- [ ] **Step 1: Move auth business logic**

Move register, login, current user, and admins handlers into `authController.ts`.

- [ ] **Step 2: Move candidate business logic**

Move candidate list/create/analyze/upload/delete logic into `candidateController.ts`.

- [ ] **Step 3: Move chat and notification business logic**

Move chat send/read logic into `chatController.ts` and notification get/read logic into `notificationController.ts`.

- [ ] **Step 4: Verify**

Run: `pnpm test` in `server`.
Expected: all existing route behavior remains green.

### Task 3: Thin Routes And Entry Point

**Files:**
- Modify: `server/src/routes/auth.ts`
- Modify: `server/src/routes/candidates.ts`
- Modify: `server/src/routes/chat.ts`
- Modify: `server/src/routes/notifications.ts`
- Modify: `server/src/index.ts`

**Interfaces:**
- Routes create controllers and map endpoints only.
- `server/src/index.ts` imports `./config/db.js` for initialization and serves uploads from the same location as before.

- [ ] **Step 1: Replace route bodies**

Each route file should instantiate its controller and only call `router.get`, `router.post`, `router.patch`, or `router.delete`.

- [ ] **Step 2: Update entry point**

Import database initialization from `server/src/config/db.ts` rather than `server/src/db.ts`.

- [ ] **Step 3: Verify**

Run: `pnpm test` and `pnpm build` in `server`.
Expected: all tests pass and TypeScript compiles.

### Task 4: Final Checks

**Files:**
- All changed backend files.

**Interfaces:**
- No route path, request body, response body, or auth behavior changes.

- [ ] **Step 1: Strict type scan**

Run: `rg -n "(:|as|<)\s*any\b|\bany\[\]" server/src server/tests`.
Expected: no matches.

- [ ] **Step 2: Completion verification**

Run: `pnpm test` and `pnpm build` in `server`.
Expected: both exit 0.
