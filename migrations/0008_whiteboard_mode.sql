-- Phase 7: whiteboard | slideshow mode on micro-prep boards

ALTER TABLE whiteboards ADD COLUMN mode TEXT NOT NULL DEFAULT 'whiteboard';

CREATE INDEX IF NOT EXISTS idx_whiteboards_mode ON whiteboards(mode);
