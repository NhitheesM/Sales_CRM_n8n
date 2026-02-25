# Sales CRM — Real-Time Lead Management System

> Ingests leads from Google Sheets → assigns them to sales callers → shows everything live on a dashboard.

---

## Screenshots
![n8n workflow: Webhook → Transform & Validate → POST to CRM Backend → Respond](image.png)
### Automation Workflow (n8n)

```
┌────────────┐    ┌──────────────────────┐    ┌─────────────────────┐    ┌─────────┐
│  Webhook   │───▶│ Transform & Validate │───▶│ POST to CRM Backend │───▶│ Respond │
│  (Trigger) │POST│  normalize fields,   │    │ /api/leads/ingest   │    │  to n8n │
│            │    │  dedupe check        │    │ host.docker.inte... │    │         │
└────────────┘    └──────────────────────┘    └─────────────────────┘    └─────────┘
```

### System Architecture

```
Google Sheet
│
├─ Apps Script (onEdit trigger)
│     └─▶ POST to n8n webhook URL
│
└─ n8n Workflow
      ├─ Webhook node (receives data)
      ├─ Format node (normalize fields)
      └─▶ HTTP Request → POST /api/leads/ingest
                │
                ▼
         Express Backend :3001
                │
                ├─ Deduplicates by sheet_row_id
                ├─ Stores lead in PostgreSQL
                ├─ assignCallerToLead()
                │     ├─ 1. State-based pool (JSONB @>)
                │     ├─ 2. Round-robin (ORDER BY last_assigned_at)
                │     ├─ 3. Global fallback
                │     └─ 4. Logs to assignment_log
                └─ WebSocket broadcast → React Frontend :5173
```

---

## Development Logic

### Lead Assignment Algorithm

Every lead goes through a **4-step atomic transaction** (single DB transaction, so there's no race condition):

```
Step 1: Daily Reset
  UPDATE callers SET today_count = 0
  WHERE last_reset_date < TODAY
  (runs once per day, lazily inside the transaction)

Step 2: State-based pool
  SELECT caller WHERE
    active = TRUE
    AND today_count < daily_limit
    AND assigned_states @> ["Maharashtra"]   ← JSONB containment
  ORDER BY last_assigned_at ASC NULLS FIRST  ← oldest-assigned goes first
  LIMIT 1 FOR UPDATE SKIP LOCKED             ← concurrency-safe

Step 3: Global fallback (if no state match)
  Same query without state filter

Step 4: Assign + Log
  UPDATE callers SET today_count + 1, last_assigned_at = NOW()
  UPDATE leads SET assigned_caller_id = caller.id
  INSERT INTO assignment_log (reason = "State-based: Maharashtra")
```

**Priority order:** State match → daily cap check → round-robin → fallback → unassigned

### Key Design Decisions

| Decision | Reason |
|---|---|
| JSONB for `assigned_states` | Postgres `@>` operator queries it efficiently without a join table |
| `FOR UPDATE SKIP LOCKED` | Prevents two concurrent requests assigning the same caller simultaneously |
| Lazy daily reset inside transaction | No cron job needed; resets happen automatically on first assignment each day |
| `sheet_row_id` UNIQUE constraint | Prevents duplicate leads if the same row is edited multiple times |
| `assignment_log` as append-only | Full audit trail of every assignment decision with its reason |
| WebSocket over polling | 1–2 second real-time updates without any polling overhead |
| Raw SQL for assignment | ORMs abstract `FOR UPDATE SKIP LOCKED` and JSONB operators poorly |

---

## Database Structure

```sql
┌────────────────────────────────────────────────────┐
│                      callers                       │
├──────────────────┬─────────────┬───────────────────┤
│ id               │ UUID PK     │                   │
│ name             │ TEXT        │ "Rahul Sharma"    │
│ role             │ TEXT        │ "Senior Caller"   │
│ languages        │ JSONB       │ ["Hindi","Tamil"] │
│ assigned_states  │ JSONB       │ ["Maharashtra"]   │
│ daily_limit      │ INTEGER     │ 30                │
│ today_count      │ INTEGER     │ 12  ← resets daily│
│ last_assigned_at │ TIMESTAMPTZ │ used for round-robin│
│ last_reset_date  │ DATE        │ 2026-02-25        │
│ active           │ BOOLEAN     │ TRUE              │
└──────────────────┴─────────────┴───────────────────┘

┌────────────────────────────────────────────────────┐
│                       leads                        │
├──────────────────┬─────────────┬───────────────────┤
│ id               │ UUID PK     │                   │
│ sheet_row_id     │ TEXT UNIQUE │ deduplication key │
│ name             │ TEXT        │ "Priya Singh"     │
│ phone            │ TEXT        │                   │
│ lead_source      │ TEXT        │ "Meta Form"       │
│ city, state      │ TEXT        │ "Mumbai", "MH"    │
│ status           │ TEXT        │ new|contacted|converted│
│ assigned_caller_id│ UUID FK→callers│               │
│ assigned_at      │ TIMESTAMPTZ │                   │
│ metadata         │ JSONB       │ {} flexible extras│
│ created_at       │ TIMESTAMPTZ │                   │
└──────────────────┴─────────────┴───────────────────┘

┌────────────────────────────────────────────────────┐
│                  assignment_log                    │
├──────────────────┬─────────────┬───────────────────┤
│ id               │ UUID PK     │                   │
│ lead_id          │ UUID FK     │                   │
│ caller_id        │ UUID FK     │                   │
│ reason           │ TEXT        │ "State-based: MH" │
│ assigned_at      │ TIMESTAMPTZ │ immutable audit   │
└──────────────────┴─────────────┴───────────────────┘
```

**Relationships:**
```
callers ──< leads (one caller has many leads)
leads   ──< assignment_log (one lead has one log entry per assignment)
```

---

## How Automation is Triggered

### Full Trigger Chain

```
1. Sales rep fills a new row in Google Sheet
        ↓
2. Google Apps Script fires onEdit()
   - Reads the row data (name, phone, city, state, source)
   - Wraps it in JSON with sheet_row_id = "SHEET_ID_row_N"
   - POSTs to n8n's webhook URL
        ↓
3. n8n Webhook node receives the payload
   - Format node normalizes field names
   - HTTP Request node POSTs to http://host.docker.internal:3001/api/leads/ingest
        ↓
4. Backend /api/leads/ingest
   - Checks for duplicate (sheet_row_id already exists? → skip)
   - INSERTs lead into PostgreSQL
   - Calls assignCallerToLead(leadId, state)
   - Broadcasts NEW_LEAD via WebSocket
        ↓
5. React Dashboard (all open browser tabs)
   - Receives NEW_LEAD message
   - Prepends lead to the table with a blue highlight animation
   - Updates "Total Leads" and "Today" stat cards instantly
```

### Google Apps Script Setup

In your Google Sheet: **Extensions → Apps Script**, paste:

```javascript
const WEBHOOK_URL = 'http://host.docker.internal:5678/webhook/leads-ingest';
// If n8n is external: use its public URL
// If testing directly: 'http://host.docker.internal:3001/api/leads/ingest'

function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  const range = e.range;

  // Skip header row and non-data columns
  if (range.getRow() <= 1 || range.getColumn() > 6) return;

  const row = range.getRow();
  const [name, phone, lead_source, city, state, notes] = 
    sheet.getRange(row, 1, 1, 6).getValues()[0];

  // Need at least name + phone
  if (!name || !phone) return;

  const sheetId = sheet.getParent().getId();
  const payload = {
    sheet_row_id: `${sheetId}_row_${row}`,
    name:         String(name).trim(),
    phone:        String(phone).trim(),
    lead_source:  String(lead_source || 'Google Sheet').trim(),
    city:         String(city || '').trim(),
    state:        String(state || '').trim(),
    metadata:     { notes: String(notes || '') }
  };

  UrlFetchApp.fetch(WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}
```

**Set up the trigger:**
1. Click the **clock icon** (Triggers) in Apps Script
2. Add Trigger → Function: `onEdit` → Event type: `On edit`
3. Save → Grant permissions

### Google Sheet Column Structure

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| `name` | `phone` | `lead_source` | `city` | `state` | `notes` |

---

## Setup Instructions

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — for PostgreSQL
- Node.js 18+
- A Google account with access to Google Sheets

### 1. Clone & start database

```bash
git clone <repo-url>
cd "New folder"

# Start PostgreSQL on port 5433 (avoids conflict with local Postgres)
docker-compose up -d

# Apply database schema
docker exec newfolder-postgres-1 psql -U postgres -d sales_crm -f /dev/stdin < backend/schema.sql
```

> **Note:** If you have a local PostgreSQL running on port 5432, the Docker container is mapped to **port 5433** to avoid conflicts. This is already configured in `.env`.

### 2. Backend

```bash
cd backend
npm install
npm run dev
# → http://localhost:3001
# → ws://localhost:3001
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### 4. Import n8n Workflow

```bash
# n8n is already running via docker-compose at http://localhost:5678
```

1. Open **http://localhost:5678**
2. **Workflows → Import from file → `n8n/google-sheet-webhook-flow.json`**
3. Activate the workflow
4. Note the webhook URL (shown on the Webhook node)

### 5. Configure Google Sheet

1. Create a sheet with columns: `name | phone | lead_source | city | state | notes`
2. Open **Extensions → Apps Script**
3. Paste the Apps Script above (from the _How Automation is Triggered_ section)
4. Replace `WEBHOOK_URL` with your n8n webhook URL
5. Set up the `onEdit` trigger

### 6. Seed test data (optional)

```bash
cd backend
npx tsx seed.ts
# Creates 20 callers + 20 leads with assignment verification
```

### Environment Variables

`backend/.env` (already configured):
```env
PGUSER=postgres
PGPASSWORD=password
PGDATABASE=sales_crm
PGHOST=127.0.0.1
PGPORT=5433          # Docker Postgres on 5433, not 5432
PORT=3001
DATABASE_URL=postgresql://postgres:password@127.0.0.1:5433/sales_crm
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/leads?page=1&limit=20&status=new` | Paginated lead list with optional status filter |
| `POST` | `/api/leads/ingest` | Ingest lead from sheet/n8n (with deduplication) |
| `PATCH`| `/api/leads/:id/status` | Update status (new/contacted/converted) |
| `DELETE` | `/api/leads/:id` | Delete lead |
| `GET`  | `/api/callers` | List all callers |
| `POST` | `/api/callers` | Create caller |
| `PUT`  | `/api/callers/:id` | Update caller |
| `DELETE` | `/api/callers/:id` | Delete caller |

### Quick test (no Google Sheet needed)

```bash
# Ingest a test lead
Invoke-RestMethod -Uri "http://localhost:3001/api/leads/ingest" `
  -Method POST -ContentType "application/json" `
  -Body '{"sheet_row_id":"t1","name":"Priya Sharma","phone":"9876543210","lead_source":"Meta Form","city":"Mumbai","state":"Maharashtra"}'

# Update lead status
Invoke-RestMethod -Uri "http://localhost:3001/api/leads/ID_HERE/status" `
  -Method PATCH -ContentType "application/json" `
  -Body '{"status":"contacted"}'
```

---

## What I Would Improve With More Time

### Immediate (1–2 days)

| Improvement | Why |
|---|---|
| **Re-assignment on caller delete** | Currently leads become "unassigned" if their caller is deleted. Should trigger re-assignment automatically. |
| **Midnight cron reset** | Daily count resets lazily inside the assignment transaction. A 12:00 AM cron job would make it more predictable for reporting. |
| **Caller availability hours** | Callers shouldn't receive leads outside their working hours (e.g., 9am–6pm). Add `work_start` / `work_end` to callers table. |
| **Lead retry queue** | If all callers are capped, unassigned leads sit indefinitely. A queue that retries assignment at midnight would fix this. |

### Short-term (1 week)

| Improvement | Why |
|---|---|
| **Redis Pub/Sub for WebSocket** | Currently one server holds all WS connections. Adding Redis lets multiple backend instances share the message bus for horizontal scaling. |
| **Caller performance metrics** | Track conversion rate per caller (contacted → converted). Use this to weight the round-robin instead of pure time-based. |
| **Multi-tenant support** | Add `org_id` to all tables. One deployment serves multiple companies. |
| **Lead scoring** | Score leads 1–10 based on source, state, and time of submission. High-score leads go to senior callers first. |
| **Proper auth** | Add JWT authentication. Currently the API is open. At minimum, a static API key for the n8n integration. |

### Long-term (scaling)

| Improvement | Why |
|---|---|
| **Partition `assignment_log` by month** | Prevents the log table from becoming the slowest table in the DB after millions of rows. |
| **Read replicas for `GET /api/leads`** | The leads list query doesn't need the primary. Read replicas offload it. |
| **Index on `leads(state, created_at)`** | As lead volume grows, the state filter in assignment queries needs a composite index. |
| **Kafka/SQS for lead ingestion** | Replace the synchronous n8n → backend chain with an async queue. Handles burst traffic from large sheet imports. |
| **Mobile-friendly UI** | The current dashboard is desktop-first. Callers on the field need a mobile view. |
