# Patient Check-In System

A real-time patient intake form with live staff monitoring, built with Next.js 16, TailwindCSS 4, and Server-Sent Events.

## Live Demo

- **Live URL:** _coming soon_
- **Repository:** _coming soon_

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To test real-time sync, open two browser windows side by side:
- Window 1: `http://localhost:3000/patient` — fill in the patient form
- Window 2: click **Open** on the staff monitoring link, or go to `http://localhost:3000/staff`

---

## Project Overview

### Features

- **Patient Form** — responsive form with 13 fields, inline validation, live progress indicator, and a staff-monitoring link with Copy and Open buttons
- **Staff Dashboard** — lists all active patient sessions with auto-refresh every 3 s
- **Staff Patient View** — live field-by-field view of a specific patient's form with field-level "typing…" indicator
- **Status tracking** — five computed states: `Not Started`, `Active` (typing now), `Idle` (30 s since last keystroke), `Inactive` (5 min), `Submitted`
- **Real-time sync** — Server-Sent Events push every change from patient → staff within milliseconds

---

## Project Structure

```
app/
  page.tsx                      Landing page (role selector)
  layout.tsx                    Root layout
  globals.css                   Tailwind v4 base styles
  patient/
    page.tsx                    Patient intake form (Client Component)
  staff/
    page.tsx                    Staff session list (polling + Client Component)
    [sessionId]/
      page.tsx                  Live patient view — SSE subscriber
  api/
    session/
      route.ts                  GET all sessions · POST create session
    patient/[sessionId]/
      route.ts                  GET session state · POST update from patient
    stream/[sessionId]/
      route.ts                  GET SSE endpoint (text/event-stream)
lib/
  types.ts                      Shared types, field labels, computeStatus()
  store.ts                      In-memory session store with pub/sub
  utils.ts                      Shared utilities (timeAgo)
```

---

## Design Decisions

### UI / UX

| Screen | Mobile | Desktop |
|--------|--------|---------|
| Patient form | Single-column, stacked sections, sticky progress bar | Two-column field pairs inside section cards |
| Staff list | Single-column session cards | Two-column grid |
| Staff detail | Full-width field rows with section headers | Centered max-w-2xl, readable on wide monitors |

- **Card-within-card layout** — fields are grouped into borderless sections inside rounded white cards; labels sit above values rather than beside them for easier scanning on small screens
- **Inline error messages** — validation fires on blur, not on every keystroke, to avoid noisy red text while the user is still typing
- **Progress bar** — counts required fields completed; visible in the sticky header so the patient always knows how far they are
- **Color palette** — blue for patient actions (neutral/clinical), teal for staff actions, amber for idle, green for submitted
- **Staff monitoring link** — shows both a Copy button (to share with staff) and an Open button (to jump directly to the live view in a new tab)

### Session Lifecycle

Sessions are created **lazily** — only when the patient first types into the form, not on page load. This avoids spurious sessions from browser prefetch and ensures every session in the store represents real patient activity.

### Validation

- Required fields: First Name, Last Name, DOB, Gender, Phone, Address, Preferred Language, Nationality
- Phone: accepts `+CC NNN NNN NNNN` and local formats (7–20 digit/space/dash characters)
- Email: standard regex, only validated when non-empty
- Emergency Relationship required only when Contact Name is provided

---

## Component Architecture

| Component | Purpose |
|-----------|---------|
| `PatientPage` | Owns form state, debounces API calls, manages lazy session creation |
| `FormField` | Renders label + input slot + error message |
| `StaffPage` | Polls `/api/session` every 3 s, renders session cards |
| `SessionCard` | Single patient row with computed status badge and time-ago |
| `StaffSessionPage` | Connects to SSE stream, re-renders on every server push, auto-reconnects on disconnect |
| `StatusBanner` | Large status indicator with context message at top of staff detail |
| `FieldRow` | One field display row; highlights the active field being typed |

---

## Real-Time Synchronization Flow

```
Patient browser                 Next.js API                 Staff browser
     |                               |                            |
     |                       [SSE stream open]                    |
     |                               |<-- GET /api/stream/:id --- |
     |                               |--- SSE: data {...} ------> |
     |                               |                            |
     |-- POST /api/patient/:id  ---->|                            |
     |   { data, activeField }       |-- notify subscribers() --> |
     |                               |--- SSE: data {...} ------> |
     |                               |                            |
     |-- POST (next keystroke) ----->|--- SSE: data {...} ------> |
     |                               |                            |
     |-- POST (submit) ------------>|                            |
     |   { data, submit: true }      |--- SSE: data {...} ------> |
     |                               |   status: "submitted"      |
```

1. Patient types → session is **lazily created** on first keystroke via `POST /api/session`
2. Patient form **debounces** field changes (300 ms) then POSTs `{ data, activeField }` to `/api/patient/[sessionId]`
3. The API handler calls `store.updateSession()` which fans out to all registered **listeners**
4. Each listener is a closure inside the SSE `ReadableStream` — it encodes the updated session as an `EventSource` message and enqueues it to the response stream
5. The staff client receives the message via the browser `EventSource` API and calls `setSession(parsed)` — React re-renders immediately
6. A **heartbeat** ping is sent every 20 s to keep the SSE connection alive through proxies
7. On `activeField` focus/blur events, the patient form sends a lightweight update so the staff view shows the "typing…" indicator
8. If the SSE connection drops, the staff client **auto-reconnects** after 2 s with full retry loop

### SSE vs WebSocket tradeoff

SSE was chosen over WebSockets because:
- Updates flow in one direction (patient → server → staff) — SSE is the correct semantic
- No extra library needed; works natively in all modern browsers
- Compatible with Vercel Fluid Compute (long-lived streaming responses, up to 300 s)

### Production note

The current store is in-memory and scoped to a single Node.js process. In a multi-instance deployment (e.g. Vercel with multiple function instances), POST and SSE GET may hit different instances, breaking the pub/sub.

**Production fix:** Replace the in-memory store with Redis pub/sub (e.g. Upstash Redis):
- `store.updateSession()` publishes to a Redis channel
- The SSE route subscribes to the channel for the duration of the connection

---

## Deployment

### Vercel (recommended)

```bash
npm i -g vercel
vercel deploy --prod
```

No environment variables required for the basic in-memory version.

### Local production build

```bash
npm run build
npm start
```

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | TailwindCSS 4 |
| Real-time | Server-Sent Events (native Web API) |
| Fonts | Geist Sans (next/font/google) |
| Hosting | Vercel |