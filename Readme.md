# Synetra

**Real-time collaborative document editor** — write, share, and co-edit documents with live cursors, presence awareness, and threaded comments.

![CI](https://github.com/your-org/synetra/actions/workflows/ci.yml/badge.svg)
![Node](https://img.shields.io/badge/node-20.x-brightgreen)
![License](https://img.shields.io/badge/license-ISC-blue)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Running Locally](#running-locally)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
  - [REST Endpoints](#rest-endpoints)
  - [GraphQL](#graphql)
  - [WebSocket Events](#websocket-events)
- [Testing](#testing)
- [CI/CD Pipeline](#cicd-pipeline)
- [Contributing](#contributing)

---

## Overview

Synetra is a full-stack collaborative document editor. Multiple users can open the same document simultaneously and see each other's changes in real time — including live cursor positions, coloured presence avatars, and auto-saved content. Documents can be shared with fine-grained `view` or `edit` permissions, and any collaborator can leave threaded comments on a document.

---

## Features

- **Real-time co-editing** — changes are broadcast via Socket.IO the moment a user types; every peer receives the delta and applies it without overwriting concurrent edits.
- **Live cursor presence** — each collaborator's caret position is forwarded to all peers and rendered as a coloured inline decoration using a custom Tiptap extension.
- **Active-user avatars** — a presence bar shows initials and cursor-matched colours for everyone currently in the document; multi-tab awareness ensures a user is only removed when their last tab disconnects.
- **Granular sharing** — document owners can invite any registered user with `view` (read-only) or `edit` permission; permissions can be upgraded/downgraded or revoked at any time from the Share modal.
- **Threaded comments** — users with access can add top-level comments or reply in threads, powered by a GraphQL API.
- **Debounced auto-save** — content is persisted to MongoDB 1 second after the user stops typing; optimistic cache updates keep the UI responsive.
- **Dark mode** — system-aware theme toggle stored in `localStorage`.
- **JWT authentication** — stateless auth with 7-day tokens; the middleware validates every REST request and socket connection.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| Rich text editor | Tiptap v3 (ProseMirror) |
| State management | TanStack Query v5 |
| Real-time | Socket.IO v4 (client + server) |
| API | Express 4, REST + Apollo Server 4 (GraphQL) |
| Database | MongoDB via Mongoose 9 |
| Auth | JSON Web Tokens (`jsonwebtoken`) + bcryptjs |
| Testing (backend) | Jest 30 + Supertest + mongodb-memory-server |
| Testing (frontend) | Vitest + React Testing Library + MSW v2 |
| E2E testing | Playwright |
| CI | GitHub Actions |

---

## Architecture

```
┌──────────────────────────────────────────────┐
│                   Browser                    │
│                                              │
│  React + TanStack Query  ←→  MSW (test only) │
│       ↕ REST/GraphQL          ↕ Socket.IO    │
└──────────────────────────────────────────────┘
              ↕ HTTP                ↕ WS
┌──────────────────────────────────────────────┐
│               Express Server                 │
│                                              │
│  /api/auth   – register, login, me           │
│  /api/documents – CRUD, access control       │
│  /api/share  – invite / revoke               │
│  /graphql    – Apollo Server (comments)      │
│  Socket.IO   – real-time collab layer        │
└──────────────────────────────────────────────┘
              ↕ Mongoose
┌──────────────────────────────────────────────┐
│                  MongoDB                     │
│   Users · Documents · Comments               │
└──────────────────────────────────────────────┘
```

The backend runs a single HTTP server that mounts Express middleware, Apollo Server (via `expressMiddleware`), and Socket.IO side-by-side.

Real-time flow for a document edit:

1. User types → Tiptap fires `onUpdate` → `socketService.sendChanges(docId, json, html)`.
2. Server validates permission, then broadcasts `receive-changes` to every peer in the room.
3. Each peer applies the incoming JSON delta with `editor.commands.setContent`, guarded by a `preventUpdate` transaction meta flag to suppress re-broadcast loops.
4. A debounced save (1 s) also persists the HTML to MongoDB via `PUT /api/documents/:id`.

---

## Getting Started

### Prerequisites

- **Node.js 20+**
- **MongoDB** — local instance or a free [Atlas](https://www.mongodb.com/atlas) cluster
- **npm 9+**

### Environment Variables

#### `backend/.env`

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/synetra
JWT_SECRET=your_super_secret_key_here
CLIENT_URL=http://localhost:3000
```

#### `frontend/.env`

```env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
VITE_GRAPHQL_URL=http://localhost:5000/graphql
```

> **Never commit real secrets.** Both `.env` files are listed in `.gitignore`.

### Running Locally

**1. Clone the repository**

```bash
git clone https://github.com/your-org/synetra.git
cd synetra
```

**2. Start the backend**

```bash
cd backend
npm install
npm run dev        # nodemon — auto-restarts on file changes
```

The server starts on `http://localhost:5000`. The GraphQL playground is available at `http://localhost:5000/graphql`.

**3. Start the frontend**

```bash
cd frontend
npm install
npm run dev        # Vite dev server with HMR
```

Open `http://localhost:3000` in your browser.

---

## Project Structure

```
synetra/
├── backend/
│   ├── config/
│   │   └── db.js                  # Mongoose connection
│   ├── graphql/
│   │   ├── typeDefs.js            # Comment schema (SDL)
│   │   ├── resolvers.js           # Query / Mutation / field resolvers
│   │   └── schema.js              # makeExecutableSchema
│   ├── middleware/
│   │   └── auth.js                # JWT auth middleware + graphqlAuth helper
│   ├── models/
│   │   ├── User.js                # bcrypt password hashing, comparePassword()
│   │   ├── Document.js            # owner, sharedWith[], updatedAt hook
│   │   └── Comment.js             # parentComment for threading
│   ├── routes/
│   │   ├── auth.js                # POST /register, POST /login, GET /me
│   │   ├── document.js            # CRUD + permission checks
│   │   └── share.js               # POST /:docId, DELETE /:docId/:userId
│   ├── socket/
│   │   └── documentSocket.js      # All Socket.IO event handlers
│   └── server.js                  # Express + Apollo + Socket.IO bootstrap
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── auth/              # Login, Register, PrivateRoute
    │   │   ├── comments/          # CommentSection, CommentItem, CommentForm
    │   │   ├── common/            # Button, Input, Loading, Modal
    │   │   ├── document/          # DocumentEditor, DocumentHeader,
    │   │   │                      #   DocumentList, ActiveUsers, ShareModal
    │   │   └── layout/            # Navbar, Layout
    │   ├── context/
    │   │   ├── AuthContext.jsx    # useAuth() provider backed by TanStack Query
    │   │   └── ThemeContext.jsx   # Dark/light theme toggle
    │   ├── extensions/
    │   │   └── RemoteCursorsExtension.js  # Custom Tiptap ProseMirror plugin
    │   ├── hooks/
    │   │   ├── useAuth.js         # useLogin, useRegister, useLogout, useAuthQuery
    │   │   ├── useDocuments.js    # useDocuments, useDocument, useCreateDocument, …
    │   │   └── useShare.js        # useShareDocument, useRemoveAccess
    │   ├── pages/                 # Home, LoginPage, RegisterPage, DocumentPage
    │   ├── services/
    │   │   ├── api.jsx            # Axios instance with auth + error interceptors
    │   │   ├── apollo.jsx         # Apollo Client setup
    │   │   └── socket.jsx         # SocketService class (singleton)
    │   └── utils/
    │       ├── constants.jsx      # API URLs, QUERY_KEYS, PERMISSIONS
    │       └── helpers.jsx        # getInitials, formatDate, truncateText,
    │                              #   token helpers, debounce
    └── vite.config.js
```

---

## API Reference

### REST Endpoints

All protected routes require `Authorization: Bearer <token>`.

#### Auth — `/api/auth`

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `POST` | `/register` | Public | Create account. Body: `{ name, email, password }`. Returns `{ token, user }`. |
| `POST` | `/login` | Public | Sign in. Body: `{ email, password }`. Returns `{ token, user }`. |
| `GET` | `/me` | Private | Returns the authenticated user object. |

#### Documents — `/api/documents`

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `GET` | `/` | Private | List all documents owned by or shared with the user. |
| `POST` | `/` | Private | Create a document. Body: `{ title? }`. Defaults to `"Untitled Document"`. |
| `GET` | `/:id` | Private | Fetch a single document. Returns `403` if the user has no access. |
| `PUT` | `/:id` | Private | Update `title` and/or `content`. Requires `owner` or `edit` permission. |
| `DELETE` | `/:id` | Private | Delete a document. Owner only. |

#### Sharing — `/api/share`

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `POST` | `/:documentId` | Owner | Share with a user. Body: `{ email, permission: "view" \| "edit" }`. Also updates permission if already shared. |
| `DELETE` | `/:documentId/:userId` | Owner | Revoke a user's access. |

### GraphQL

Endpoint: `POST /graphql`

Queries and mutations are authenticated via the `Authorization` header (same Bearer token as REST).

**Queries**

```graphql
# Returns top-level comments for a document the caller has access to.
getComments(documentId: ID!): [Comment!]!

# Returns a single comment by ID.
getComment(commentId: ID!): Comment
```

**Mutations**

```graphql
# Create a top-level or reply comment (set parentCommentId for replies).
createComment(documentId: ID!, content: String!, parentCommentId: ID): Comment!

# Edit your own comment.
updateComment(commentId: ID!, content: String!): Comment!

# Delete your own comment and all its replies.
deleteComment(commentId: ID!): String!
```

**Types**

```graphql
type Comment {
  id: ID!
  document: ID!
  author: User!
  content: String!
  parentComment: Comment
  replies: [Comment!]!
  createdAt: String!   # ISO 8601
  updatedAt: String!   # ISO 8601
}

type User {
  id: ID!
  name: String!
  email: String!
  avatar: String
}
```

### WebSocket Events

The Socket.IO namespace is the root `/`. All events require the client to authenticate first.

**Client → Server**

| Event | Payload | Description |
|-------|---------|-------------|
| `authenticate` | `token: string` | Send JWT immediately after `connect`. Server replies with `authenticated`. |
| `join-document` | `{ documentId }` | Join a document room. Server loads the document and emits `load-document`. |
| `leave-document` | `{ documentId }` | Leave the room explicitly (e.g. navigating away). |
| `send-changes` | `{ documentId, delta, json }` | Broadcast an edit. `json` is the Tiptap JSON; `delta` is the HTML fallback. |
| `cursor-position` | `{ documentId, position: { from, to } }` | Broadcast caret position for remote cursor rendering. |
| `title-change` | `{ documentId, title }` | Persist and broadcast a title update (owner/edit permission required). |

**Server → Client**

| Event | Payload | Description |
|-------|---------|-------------|
| `authenticated` | `{ success, message? }` | Result of the `authenticate` handshake. |
| `load-document` | `{ content, title }` | Initial document state on joining. |
| `receive-changes` | `{ delta, json, senderId }` | An edit from a peer. Apply with `preventUpdate` meta to avoid loops. |
| `cursor-update` | `{ userId, position, user }` | A peer's cursor moved. |
| `active-users` | `{ users[] }` | Current presence list on join (excludes the joining user). |
| `user-joined` | `{ user }` | A new peer entered the document. |
| `user-left` | `{ userId }` | A peer closed their last tab. |
| `title-updated` | `{ title }` | A peer changed the document title. |
| `request-cursor-broadcast` | — | Asks existing peers to re-emit their cursor so the joining user sees them immediately. |
| `error` | `{ message }` | A server-side error (auth failure, access denied, etc.). |

---

## Testing

### Backend

Tests use Jest with an in-memory MongoDB instance — no real database required.

```bash
cd backend
npm test
```

Coverage is collected for `routes/`, `socket/`, `middleware/`, and `models/`.

The test suite covers:

- **Auth routes** — register (validation, duplicates), login (correct/wrong credentials), `GET /me`
- **Document routes** — CRUD operations, ownership enforcement, 403/404 responses
- **Share routes** — invite, access check after share, self-share rejection, non-owner share attempt
- **Auth middleware** — valid token, missing token, tampered token, expired token
- **Models** — password hashing, `comparePassword`, unique email constraint, `updatedAt` hook
- **Socket** — JWT authentication handshake, `join-document` + `load-document` flow, cursor-position forwarding between two clients

### Frontend

Tests use Vitest with jsdom and React Testing Library. MSW v2 intercepts all HTTP calls so no network is needed.

```bash
cd frontend
npm test
```

The test suite covers:

- **Utils** — `getInitials`, `truncateText`, `formatDate`, token localStorage helpers
- **Components** — `ActiveUsers` (rendering, count labels, cursor colours), `Button` (click, disabled state), `Loading`
- **Hooks** — `useDocuments` (success, loading state, server error handling)

### E2E

Playwright tests run against a live backend + Vite preview server.

```bash
# Start backend and frontend first, then:
cd frontend
npm run test:e2e
```

Test suites: authentication flow, document creation and editing, collaborative presence (two-user scenarios across browser contexts).

---

## CI/CD Pipeline

Six jobs run in parallel (with dependency gates) on every push to `main`, `master`, or `develop`, and on all pull requests.

```
lint ──────────────────────────────────────────────────────────┐
backend-tests ────────────────────────────────────────────────┤
frontend-tests ───────────────────────────────────────────────┼──► e2e ──► all-checks-pass
build-check ─────────────────────────────────────────────────┘
```

| Job | What it does |
|-----|-------------|
| `🔍 ESLint` | Lints all frontend JS/JSX with zero-warning tolerance |
| `🧪 Backend — Jest` | Unit + integration tests with coverage report |
| `🧪 Frontend — Vitest` | Component + hook + utility tests with coverage report |
| `🏗️ Frontend build` | `vite build` — verifies the production bundle compiles cleanly |
| `🎭 Playwright E2E` | Full browser tests (Chromium + Firefox) against real servers |
| `✅ All checks passed` | Summary gate — fails if any upstream job failed |

Build artifacts (frontend `dist/`, coverage reports, Playwright traces) are uploaded as GitHub Actions artifacts and retained for 7–14 days.

---

## Contributing

1. Fork the repository and create a feature branch off `main`.
2. Follow the existing code style — ESLint enforces it.
3. Add or update tests for any changed behaviour.
4. Ensure all CI jobs pass locally before opening a PR:
   ```bash
   cd backend && npm test
   cd frontend && npm run lint && npm test && npm run build
   ```
5. Open a pull request with a clear description of what changed and why.