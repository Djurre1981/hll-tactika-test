-- Staff can close RSVP independently of event lock; lineup lock also closes RSVP.
ALTER TABLE events ADD COLUMN rsvp_closed INTEGER NOT NULL DEFAULT 0;
