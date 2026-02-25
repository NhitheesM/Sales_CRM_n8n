# Sales CRM — Full Project

A production-grade Sales CRM with real-time lead ingestion, smart assignment, and caller management.

## Architecture

```
Google Sheets → Google Apps Script → n8n Webhook → Backend API → PostgreSQL
                                                         ↓
                                              WebSocket → React Frontend
```

## Quick Start

### 1. Start PostgreSQL + n8n with Docker
```bash
docker-compose up -d
```

### 2. Backend setup
```bash
cd backend
npm install
npx prisma db push        # Create tables in PostgreSQL
npm run dev               # Starts on http://localhost:3001
```

### 3. Frontend setup
```bash
cd frontend
npm install
npm run dev               # Starts on http://localhost:5173
```

### 4. Import n8n Workflow
1. Open http://localhost:5678
2. Go to **Workflows → Import from file**
3. Select `n8n/google-sheet-webhook-flow.json`
4. Activate the workflow
5. **Copy the webhook URL** (format: `http://localhost:5678/webhook/leads-ingest`)

### 5. Google Apps Script
In your Google Sheet: **Extensions → Apps Script**, paste:

```javascript
function onEdit(e) {
  const row = e.range.getRow();
  if (row === 1) return; // skip header

  const sheet = SpreadsheetApp.getActiveSheet();
  const data  = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

  const payload = {
    sheet_row_id: "row_" + row,
    name:         data[0],
    phone:        String(data[1]),
    timestamp:    data[2] ? new Date(data[2]).toISOString() : new Date().toISOString(),
    lead_source:  data[3],
    city:         data[4],
    state:        data[5],
    metadata:     {}
  };

  UrlFetchApp.fetch("YOUR_N8N_WEBHOOK_URL_HERE", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload)
  });
}
```

Replace `YOUR_N8N_WEBHOOK_URL_HERE` with the n8n webhook URL. Save & deploy.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/leads` | List all leads |
| `POST` | `/api/leads/ingest` | Ingest new lead (n8n) |
| `DELETE` | `/api/leads/:id` | Delete lead |
| `GET`  | `/api/callers` | List all callers |
| `POST` | `/api/callers` | Create caller |
| `PUT`  | `/api/callers/:id` | Update caller |
| `DELETE` | `/api/callers/:id` | Delete caller |

## Test Lead Ingestion (without Google Sheets)
```bash
curl -X POST http://localhost:3001/api/leads/ingest \
  -H "Content-Type: application/json" \
  -d '{"sheet_row_id":"test_1","name":"Priya Sharma","phone":"9876543210","lead_source":"Meta Forms","city":"Mumbai","state":"Maharashtra"}'
```

## Assignment Logic

1. **State filter** → callers with that state in `assigned_states` who are under daily cap
2. **Global fallback** → all active callers under cap if no state match
3. **Round Robin** → `ORDER BY last_assigned_at ASC NULLS FIRST` (PostgreSQL)
4. **Atomic** → `SELECT FOR UPDATE SKIP LOCKED` prevents duplicate assignment under load
5. **Daily reset** → `today_count` auto-resets at midnight per caller
