-- Manual lock for route plans and whiteboards (strats already have locked columns)

ALTER TABLE route_plans ADD COLUMN locked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE route_plans ADD COLUMN locked_by TEXT;

ALTER TABLE whiteboards ADD COLUMN locked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE whiteboards ADD COLUMN locked_by TEXT;
