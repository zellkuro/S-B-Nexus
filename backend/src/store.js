// Where player profiles live.
//
// Every store has the same two methods:
//   get(uid)                    -> { profile, version } or null
//   put(uid, profile, version)  -> true if saved, false if someone else saved first
//
// `version` is the version you read (0 for a new player). A put only succeeds
// if the stored version still matches, so two requests for the same player
// can't overwrite each other's changes: the loser reads again and retries.

export class D1Store {
    constructor(db) {
        this.db = db;
    }

    async get(uid) {
        const row = await this.db
            .prepare("SELECT data, version FROM players WHERE uid = ?")
            .bind(uid)
            .first();
        return row ? { profile: JSON.parse(row.data), version: row.version } : null;
    }

    async put(uid, profile, version) {
        const data = JSON.stringify(profile);
        const now = Date.now();
        const result = version === 0
            ? await this.db
                .prepare("INSERT OR IGNORE INTO players (uid, data, version, updated_at) VALUES (?, ?, 1, ?)")
                .bind(uid, data, now)
                .run()
            : await this.db
                .prepare("UPDATE players SET data = ?, version = version + 1, updated_at = ? WHERE uid = ? AND version = ?")
                .bind(data, now, uid, version)
                .run();
        return result.meta.changes === 1;
    }
}

// For tests and local experiments.
export class MemoryStore {
    constructor() {
        this.rows = new Map();
    }

    async get(uid) {
        const row = this.rows.get(uid);
        return row ? { profile: JSON.parse(row.data), version: row.version } : null;
    }

    async put(uid, profile, version) {
        const row = this.rows.get(uid);
        if ((row ? row.version : 0) !== version) return false;
        this.rows.set(uid, { data: JSON.stringify(profile), version: version + 1 });
        return true;
    }
}
