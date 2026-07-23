-- 0001 created folders without sort_order; 0002 renamed to strat_folders.
-- 0005 used CREATE TABLE IF NOT EXISTS, so sort_order was never added.
-- folders-store.js ORDER BY / INSERT expects sort_order.

ALTER TABLE strat_folders ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS idx_strat_folders_parent;
CREATE INDEX IF NOT EXISTS idx_strat_folders_parent ON strat_folders(parent_id, sort_order);
