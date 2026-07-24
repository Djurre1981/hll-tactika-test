-- Prep task auto-detection: which event prep slot a strat satisfies.
ALTER TABLE strats ADD COLUMN prep_category TEXT;
