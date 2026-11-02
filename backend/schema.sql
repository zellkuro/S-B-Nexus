-- One row per player. `data` is the profile as JSON (see shared/rules.js, newProfile).
-- `version` goes up by one on every save, so two saves at once can't overwrite each other.
CREATE TABLE IF NOT EXISTS players (
    uid TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    version INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
