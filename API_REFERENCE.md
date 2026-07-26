# API Reference — AI Candidate Screener

Base URL: `http://localhost:5000/api`

All endpoints return JSON. Protected endpoints require a **Bearer token** in the `Authorization` header.

---

## Authentication

All auth endpoints live under `/api/auth`.

---

### `POST /api/auth/register`

Create a new user account.

**Authentication:** None

**Request Body:**

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "securePass123!",
  "role": "candidate"
}
```

| Field    | Type   | Required | Description                        |
|----------|--------|----------|------------------------------------|
| `name`   | string | yes      | Display name                       |
| `email`  | string | yes      | Email address (case-insensitive)   |
| `password` | string | yes    | Plain-text password                |
| `role`   | string | no       | `"candidate"` (default) or `"admin"` |

**Success Response `201 Created`**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "candidate"
  }
}
```

| Field         | Type   | Description                        |
|---------------|--------|------------------------------------|
| `token`       | string | JWT (expires in 7 days)            |
| `user.id`     | number | Unique user ID                     |
| `user.name`   | string | Display name                       |
| `user.email`  | string | Normalized lowercase email         |
| `user.role`   | string | `"candidate"` or `"admin"`         |

**Error Responses**

| Status | Body                                  | When                                  |
|--------|---------------------------------------|---------------------------------------|
| 400    | `{ "error": "Name is required" }`     | Missing or empty name                 |
| 400    | `{ "error": "Email is required" }`    | Missing or empty email                |
| 400    | `{ "error": "Password is required" }` | Missing or empty password             |
| 400    | `{ "error": "Role must be candidate or admin" }` | Invalid role value         |
| 400    | `{ "error": "Request body must be a JSON object" }` | Body is not valid JSON |
| 409    | `{ "error": "User already exists" }`  | Email already registered              |
| 500    | `{ "error": "Failed to register user" }` | Server/database error              |

---

### `POST /api/auth/login`

Authenticate with email and password.

**Authentication:** None

**Request Body:**

```json
{
  "email": "jane@example.com",
  "password": "securePass123!"
}
```

**Success Response `200 OK`**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "candidate"
  }
}
```

**Error Responses**

| Status | Body                                          | When                              |
|--------|-----------------------------------------------|-----------------------------------|
| 400    | `{ "error": "Email is required" }`            | Missing email                     |
| 400    | `{ "error": "Password is required" }`         | Missing password                  |
| 400    | `{ "error": "Request body must be a JSON object" }` | Body is not valid JSON      |
| 401    | `{ "error": "Invalid email or password" }`    | Wrong email or password           |
| 500    | `{ "error": "Failed to login" }`              | Server/database error             |

---

### `GET /api/auth/me`

Get the currently authenticated user's profile.

**Authentication:** Bearer token required

**Headers:** `Authorization: Bearer <token>`

**Success Response `200 OK`**

```json
{
  "id": 1,
  "name": "Jane Doe",
  "email": "jane@example.com",
  "role": "candidate"
}
```

**Error Responses**

| Status | Body                                               | When                |
|--------|----------------------------------------------------|---------------------|
| 401    | `{ "error": "Authorization token is required" }`   | Missing token       |

---

### `GET /api/auth/admins`

List all admin users.

**Authentication:** Bearer token required (any role)

**Success Response `200 OK`**

```json
[
  {
    "id": 2,
    "name": "Admin User",
    "email": "admin@example.com",
    "role": "admin"
  }
]
```

**Error Responses**

| Status | Body                                               | When                           |
|--------|----------------------------------------------------|--------------------------------|
| 401    | `{ "error": "Authorization token is required" }`   | Missing or invalid token       |
| 500    | `{ "error": "Failed to fetch admins" }`            | Database error                 |

---

## Candidates

All candidate endpoints live under `/api/candidates`.

**Note:** All candidate endpoints require a Bearer token.

---

### `GET /api/candidates`

List candidates. **Admins** see all candidates. **Candidates** see only their own profile.

**Authentication:** Bearer token required (any role)

**Success Response `200 OK`**

```json
[
  {
    "id": 1,
    "user_id": 1,
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+1-555-0123",
    "linkedin": "https://linkedin.com/in/janedoe",
    "github": "https://github.com/janedoe",
    "pdf_url": "http://localhost:5000/uploads/1712345678901-resume.pdf",
    "skills": ["TypeScript", "React", "Node.js", "Express", "SQL"],
    "experience": [
      {
        "title": "Full-Stack Developer",
        "company": "Tech Corp",
        "duration": "2021 — Present",
        "description": "Built full-stack applications with React and Node.js."
      }
    ],
    "projects": [
      {
        "name": "AI Candidate Screener",
        "description": "Resume screening and analysis platform.",
        "technologies": ["TypeScript", "React", "Node.js"]
      }
    ],
    "summary": {
      "en": "Strong candidate with solid full-stack fundamentals.",
      "fr": "Candidat solide avec de bonnes bases full-stack.",
      "ar": "مرشح قوي يمتلك أساسيات متينة في التطوير الشامل."
    },
    "score": 88,
    "created_at": "2025-07-24 10:30:00"
  }
]
```

**Error Responses**

| Status | Body                                               | When                     |
|--------|----------------------------------------------------|--------------------------|
| 401    | `{ "error": "Authorization token is required" }`   | Missing token            |
| 500    | `{ "error": "Failed to fetch candidates" }`        | Database error           |

---

### `POST /api/candidates`

Manually create a candidate profile (without AI analysis).

**Authentication:** Bearer token required (`candidate` role only)

**Request Body:**

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "skills": ["TypeScript", "React"],
  "summary": "Experienced full-stack developer.",
  "score": 78
}
```

| Field     | Type     | Required | Description                         |
|-----------|----------|----------|-------------------------------------|
| `name`    | string   | yes      | Candidate name                      |
| `email`   | string   | no       | Email address                       |
| `skills`  | string[] | yes      | Array of skill strings              |
| `summary` | string   | no       | Profile summary (auto-localized)    |
| `score`   | number   | yes      | Integer from 1 to 100               |

**Success Response `201 Created`**

Same shape as a single candidate object in the `GET /api/candidates` response.

**Error Responses**

| Status | Body                                                     | When                             |
|--------|----------------------------------------------------------|----------------------------------|
| 400    | `{ "error": "Name is required" }`                        | Missing name                     |
| 400    | `{ "error": "Skills must be an array of strings" }`      | Invalid skills format            |
| 400    | `{ "error": "Score must be an integer from 1 to 100" }`  | Invalid score                    |
| 401    | `{ "error": "Authorization token is required" }`         | Missing token                    |
| 403    | `{ "error": "Only candidates can submit resumes" }`      | Non-candidate role               |
| 409    | `{ "error": "Candidate profile already belongs to another account" }` | Ownership conflict (named-based uniqueness) |
| 500    | `{ "error": "Failed to create candidate" }`              | Database error                   |

---

### `POST /api/candidates/analyze`

Analyze raw resume text using AI and create/update the candidate profile.

**Authentication:** Bearer token required (`candidate` role only)

**Request Body:**

```json
{
  "resumeText": "Jane Doe\njane@example.com\n... full resume text ..."
}
```

**Success Response `201 Created`**

Same shape as a candidate object. The `summary` field will contain AI-generated multilingual summaries (en, fr, ar). Skills, experience, projects, and score are all AI-extracted.

**Error Responses**

| Status | Body                                                             | When                             |
|--------|------------------------------------------------------------------|----------------------------------|
| 400    | `{ "error": "Resume text is required" }`                         | Missing or empty text            |
| 401    | `{ "error": "Authorization token is required" }`                 | Missing token                    |
| 403    | `{ "error": "Only candidates can submit resumes" }`              | Non-candidate role               |
| 409    | `{ "error": "Candidate profile already belongs to another account" }` | Ownership conflict           |
| 500    | `{ "error": "Failed to analyze resume" }`                        | AI service or database error     |

> **Fallback behavior:** If the Groq API key (`GROQ_API_KEY`) is not set or the API call fails, the service falls back to a **mock analysis** with hardcoded skills, experience, and a score of `88`. This allows local development without an AI provider.

---

### `POST /api/candidates/upload-pdf`

Upload a PDF resume, extract text, analyze via AI, and create/update the profile. Uses **multipart/form-data**.

**Authentication:** Bearer token required (`candidate` role only)

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**

| Field  | Type | Required | Description         |
|--------|------|----------|---------------------|
| `file` | File | yes      | PDF file (max 5 MB) |

**Success Response `201 Created`**

Same shape as a candidate object. The `pdf_url` field will contain the server URL to the uploaded PDF file.

**Error Responses**

| Status | Body                                                        | When                                    |
|--------|-------------------------------------------------------------|-----------------------------------------|
| 400    | `{ "error": "PDF file is required" }`                       | No file uploaded                        |
| 400    | `{ "error": "Only PDF files are allowed" }`                 | Non-PDF file uploaded                   |
| 400    | `{ "error": "File too large" }`                             | Exceeds 5 MB limit (Multer default)     |
| 400    | `{ "error": "PDF did not contain extractable text" }`       | Empty/scanned PDF (no text layer)       |
| 401    | `{ "error": "Authorization token is required" }`            | Missing token                           |
| 403    | `{ "error": "Only candidates can submit resumes" }`         | Non-candidate role                      |
| 409    | `{ "error": "Candidate profile already belongs to another account" }` | Ownership conflict                |
| 500    | `{ "error": "Failed to process PDF resume" }`               | AI/PDF extraction/server error          |

---

### `DELETE /api/candidates/:id`

Delete a candidate profile and all related data (messages, notifications).

**Authentication:** Bearer token required (any role)

- **Admins** can delete any candidate.
- **Candidates** can only delete their own profile.
- Deleting a candidate cascades: all messages and notifications for that candidate are also deleted.

**Success Response `200 OK`**

```json
{
  "message": "Candidate deleted successfully"
}
```

**Error Responses**

| Status | Body                                               | When                               |
|--------|----------------------------------------------------|------------------------------------|
| 401    | `{ "error": "Authorization token is required" }`   | Missing token                      |
| 404    | `{ "error": "Candidate not found" }`               | Invalid ID or not owned by user    |
| 500    | `{ "error": "Failed to delete candidate" }`        | Server error                       |

---

## Chat

All chat endpoints live under `/api/chat`.

---

### `POST /api/chat/send`

Send a message to another user about a candidate.

**Authentication:** Bearer token required (any role)

**Request Body:**

```json
{
  "receiver_id": 2,
  "candidate_id": 1,
  "content": "Hi Jane, thanks for your application! Would you be available for a call this week?"
}
```

| Field          | Type   | Required | Description                   |
|----------------|--------|----------|-------------------------------|
| `receiver_id`  | number | yes      | ID of the message recipient   |
| `candidate_id` | number | yes      | ID of the candidate to discuss |
| `content`      | string | yes      | Message body text             |

**Success Response `201 Created`**

```json
{
  "id": 15,
  "sender_id": 2,
  "receiver_id": 1,
  "candidate_id": 1,
  "content": "Hi Jane, thanks for your application! Would you be available for a call this week?",
  "is_read": 0,
  "created_at": "2025-07-24 14:30:00"
}
```

| Field         | Type   | Description                           |
|---------------|--------|---------------------------------------|
| `id`          | number | Auto-generated message ID             |
| `sender_id`   | number | Sender user ID                        |
| `receiver_id` | number | Recipient user ID                     |
| `candidate_id`| number | Related candidate ID                  |
| `content`     | string | Message body                          |
| `is_read`     | 0 or 1 | Read status (`0` = Sent, `1` = Seen) |
| `created_at`  | string | Timestamp                             |

**Error Responses**

| Status | Body                                                     | When                              |
|--------|----------------------------------------------------------|-----------------------------------|
| 400    | `{ "error": "Receiver id must be a positive integer" }`  | Invalid receiver_id               |
| 400    | `{ "error": "Candidate id must be a positive integer" }` | Invalid candidate_id              |
| 400    | `{ "error": "Message content is required" }`             | Missing/empty content             |
| 401    | `{ "error": "Authorization token is required" }`         | Missing token                     |
| 404    | `{ "error": "Candidate not found" }`                     | Candidate doesn't exist or no access |
| 404    | `{ "error": "Receiver not found" }`                      | Receiver user doesn't exist       |
| 500    | `{ "error": "Failed to send message" }`                  | Server/database error             |

> **Automatic notification:** When a message is sent, a notification of type `"message"` is automatically created for the recipient.

---

### `GET /api/chat/:candidate_id`

Get all messages for a specific candidate. Marks incoming messages as read.

**Authentication:** Bearer token required (any role)

- **Admins** can view messages for any candidate.
- **Candidates** can only view messages for their own profile.

**Success Response `200 OK`**

```json
[
  {
    "id": 14,
    "sender_id": 1,
    "receiver_id": 2,
    "candidate_id": 1,
    "content": "Hello! I'm interested in the position.",
    "is_read": 0,
    "created_at": "2025-07-24 14:25:00"
  },
  {
    "id": 15,
    "sender_id": 2,
    "receiver_id": 1,
    "candidate_id": 1,
    "content": "Hi Jane, thanks for your application!",
    "is_read": 1,
    "created_at": "2025-07-24 14:30:00"
  }
]
```

> **Read receipt behavior:** When this endpoint is called, all messages sent to the current user for this candidate are automatically marked as `is_read = 1`. This implements the "Seen" status.

**Error Responses**

| Status | Body                                               | When                               |
|--------|----------------------------------------------------|------------------------------------|
| 401    | `{ "error": "Authorization token is required" }`   | Missing token                      |
| 404    | `{ "error": "Candidate not found" }`               | Invalid ID or no access            |
| 500    | `{ "error": "Failed to fetch messages" }`          | Server/database error              |

---

## Notifications

All notification endpoints live under `/api/notifications`.

---

### `GET /api/notifications`

Get unread notifications for the current user.

**Authentication:** Bearer token required (any role)

- **Candidates:** See notifications addressed directly to them (`user_id` match) or role-targeted to `candidate`.
- **Admins:** See notifications addressed directly to them **and** all role-targeted notifications for `admin` (e.g., new candidate applications).

**Success Response `200 OK`**

```json
[
  {
    "id": 5,
    "user_id": null,
    "target_role": "admin",
    "candidate_id": 1,
    "sender_id": 1,
    "type": "candidate_application",
    "title": "New candidate application",
    "content": "Jane Doe submitted a resume.",
    "is_read": 0,
    "created_at": "2025-07-24 14:30:00"
  },
  {
    "id": 6,
    "user_id": 1,
    "target_role": null,
    "candidate_id": 1,
    "sender_id": 2,
    "type": "message",
    "title": "New message",
    "content": "Admin User sent a message.",
    "is_read": 0,
    "created_at": "2025-07-24 14:30:05"
  }
]
```

| Field          | Type         | Description                                           |
|----------------|--------------|-------------------------------------------------------|
| `id`           | number       | Auto-generated notification ID                        |
| `user_id`      | number|null | Direct recipient user ID (`null` for role-targeted)   |
| `target_role`  | string|null  | Role to target (`"admin"`, `"candidate"`, or `null`)  |
| `candidate_id` | number|null  | Related candidate (if applicable)                     |
| `sender_id`    | number|null  | User who triggered the notification                   |
| `type`         | string       | `"candidate_application"` or `"message"`              |
| `title`        | string       | Short title                                           |
| `content`      | string       | Detail text                                           |
| `is_read`      | 0 or 1       | `0` = unread, `1` = read                              |
| `created_at`   | string       | Timestamp                                             |

**Error Responses**

| Status | Body                                               | When                     |
|--------|----------------------------------------------------|--------------------------|
| 401    | `{ "error": "Authorization token is required" }`   | Missing token            |
| 500    | `{ "error": "Failed to fetch notifications" }`     | Database error           |

---

### `PATCH /api/notifications/read-all`

Mark all unread notifications as read for the current user.

**Authentication:** Bearer token required (any role)

**Success Response `200 OK`**

```json
{
  "message": "Notifications marked as read"
}
```

**Error Responses**

| Status | Body                                               | When                     |
|--------|----------------------------------------------------|--------------------------|
| 401    | `{ "error": "Authorization token is required" }`   | Missing token            |
| 500    | `{ "error": "Failed to mark notifications as read" }` | Server error          |

---

### `PATCH /api/notifications/:id/read`

Mark a single notification as read.

**Authentication:** Bearer token required (any role)

**Success Response `200 OK`**

```json
{
  "message": "Notification marked as read"
}
```

**Error Responses**

| Status | Body                                               | When                          |
|--------|----------------------------------------------------|-------------------------------|
| 401    | `{ "error": "Authorization token is required" }`   | Missing token                 |
| 404    | `{ "error": "Notification not found" }`            | Invalid ID or not owned by user |
| 500    | `{ "error": "Failed to mark notification as read" }` | Server error               |

---

## Health

---

### `GET /api/health`

Server health check.

**Authentication:** None

**Success Response `200 OK`**

```json
{
  "status": "ok",
  "message": "Server is running"
}
```

---

## Static Files

Uploaded PDFs are served under the `/uploads` path.

```
GET http://localhost:5000/uploads/1712345678901-resume.pdf
```

- Files are stored on disk in `server/uploads/`.
- URL is returned as `pdf_url` in candidate responses.
- Only PDF files are accepted (enforced by Multer).

---

## Authentication Flow Summary

```
                    ┌──────────────────────────────┐
                    │     Client Application        │
                    └──────────┬───────────────────┘
                               │
                    POST /api/auth/register
                    POST /api/auth/login
                               │
                               ▼
                    ┌──────────────────────────────┐
                    │     JWT Token Returned        │
                    └──────────┬───────────────────┘
                               │
              Store token (localStorage in frontend)
                               │
                    ┌──────────────────────────────┐
                    │   Include in Header:          │
                    │   Authorization: Bearer <token>│
                    └──────────┬───────────────────┘
                               │
                               ▼
                    ┌──────────────────────────────┐
                    │   Backend verifyToken Middleware│
                    │   1. Extract Bearer token      │
                    │   2. Verify JWT signature      │
                    │   3. Extract user ID (sub)     │
                    │   4. Fetch user from DB        │
                    │   5. Attach to request object  │
                    └──────────┬───────────────────┘
                               │
                    ┌──────────────────────────────┐
                    │   Optional: checkAdmin        │
                    │   (checks user.role === admin)│
                    └──────────┬───────────────────┘
                               │
                               ▼
                    ┌──────────────────────────────┐
                    │      Controller Executes      │
                    └──────────────────────────────┘
```

---

## Common Error Response Format

All errors follow this shape:

```json
{
  "error": "Human-readable error description"
}
```

### Status Code Reference

| Code | Meaning              | Typical Causes                             |
|------|----------------------|--------------------------------------------|
| 200  | OK                   | Successful reads, updates, deletes, login  |
| 201  | Created              | Successful registration, candidate creation, message sent |
| 400  | Bad Request          | Invalid/missing input, validation failure  |
| 401  | Unauthorized         | Missing, invalid, or expired token         |
| 403  | Forbidden            | Authenticated but insufficient permissions |
| 404  | Not Found            | Resource doesn't exist or not accessible   |
| 409  | Conflict             | Duplicate email, ownership conflict        |
| 500  | Internal Server Error| Unexpected server or database failure      |

---

## Data Models

### User (backing type)

| Column              | Type     | Constraints                  |
|---------------------|----------|------------------------------|
| `id`                | INTEGER  | PK, AUTOINCREMENT            |
| `name`              | TEXT     | NOT NULL                     |
| `email`             | TEXT     | UNIQUE, NOT NULL             |
| `password`          | TEXT     | NOT NULL (bcrypt hash)       |
| `role`              | TEXT     | NOT NULL, CHECK (`candidate`/`admin`) |

| `created_at`        | DATETIME | DEFAULT CURRENT_TIMESTAMP    |

### Candidate (backing type)

| Column       | Type        | Constraints                          |
|--------------|-------------|--------------------------------------|
| `id`         | INTEGER     | PK, AUTOINCREMENT                    |
| `user_id`    | INTEGER     | FK → users(id)                       |
| `name`       | TEXT        | NOT NULL, UNIQUE (case-insensitive)  |
| `email`      | TEXT        | UNIQUE (case-insensitive, nullable)  |
| `phone`      | TEXT        | NULLABLE                             |
| `linkedin`   | TEXT        | NULLABLE                             |
| `github`     | TEXT        | NULLABLE                             |
| `pdf_url`    | TEXT        | NULLABLE                             |
| `skills`     | TEXT        | JSON string, parsed to `string[]`    |
| `experience` | TEXT        | JSON string, parsed to `ResumeExperience[]` |
| `projects`   | TEXT        | JSON string, parsed to `ResumeProject[]` |
| `summary`    | TEXT        | JSON string (`LocalizedSummary` or plain text) |
| `score`      | INTEGER     | CHECK 1–100, NULLABLE               |
| `created_at` | DATETIME    | DEFAULT CURRENT_TIMESTAMP            |

### Message (backing type)

| Column         | Type     | Constraints                          |
|----------------|----------|--------------------------------------|
| `id`           | INTEGER  | PK, AUTOINCREMENT                    |
| `sender_id`    | INTEGER  | FK → users(id), NOT NULL             |
| `receiver_id`  | INTEGER  | FK → users(id), NOT NULL             |
| `candidate_id` | INTEGER  | FK → candidates(id), NOT NULL        |
| `content`      | TEXT     | NOT NULL                             |
| `is_read`      | INTEGER  | NOT NULL DEFAULT 0, CHECK (0 or 1)  |
| `created_at`   | DATETIME | DEFAULT CURRENT_TIMESTAMP            |

### Notification (backing type)

| Column         | Type        | Constraints                          |
|----------------|-------------|--------------------------------------|
| `id`           | INTEGER     | PK, AUTOINCREMENT                    |
| `user_id`      | INTEGER     | FK → users(id), NULLABLE             |
| `target_role`  | TEXT        | CHECK (`candidate`/`admin`/NULL)    |
| `candidate_id` | INTEGER     | FK → candidates(id), ON DELETE SET NULL |
| `sender_id`    | INTEGER     | FK → users(id), ON DELETE SET NULL   |
| `type`         | TEXT        | NOT NULL (`candidate_application` or `message`) |
| `title`        | TEXT        | NOT NULL                             |
| `content`      | TEXT        | NOT NULL                             |
| `is_read`      | INTEGER     | NOT NULL DEFAULT 0, CHECK (0 or 1)  |
| `created_at`   | DATETIME    | DEFAULT CURRENT_TIMESTAMP            |

---

## Notification Types

| Type                      | Trigger                         | Target              |
|---------------------------|---------------------------------|---------------------|
| `candidate_application`   | Candidate analyzes/creates profile | All admin users   |
| `message`                 | User sends a chat message       | The message recipient |

---

## Rate Limits & File Upload Constraints

| Constraint         | Value                      |
|--------------------|----------------------------|
| Max PDF file size  | 5 MB                       |
| Allowed file types | `.pdf` only                |
| Token expiry       | 7 days                     |
| Password hash cost | 10 bcrypt salt rounds      |
