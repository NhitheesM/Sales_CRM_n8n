CREATE TABLE IF NOT EXISTS callers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  languages JSONB NOT NULL DEFAULT '[]',
  assigned_states JSONB NOT NULL DEFAULT '[]',
  daily_limit INTEGER NOT NULL DEFAULT 50,
  today_count INTEGER NOT NULL DEFAULT 0,
  last_assigned_at TIMESTAMPTZ,
  last_reset_date DATE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_row_id TEXT UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  timestamp TIMESTAMPTZ,
  lead_source TEXT,
  city TEXT,
  state TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new',
  assigned_caller_id UUID REFERENCES callers(id),
  assigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assignment_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id),
  caller_id UUID NOT NULL REFERENCES callers(id),
  reason TEXT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT 'Tables created OK' AS status;
