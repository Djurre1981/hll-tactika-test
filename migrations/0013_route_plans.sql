-- Route planner saved plans

CREATE TABLE IF NOT EXISTS route_plans (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  plan_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL,
  created_by_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_route_plans_updated_at ON route_plans(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_route_plans_created_by ON route_plans(created_by);
