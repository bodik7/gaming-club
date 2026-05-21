// ============================================
// db.js — SQLite через better-sqlite3
// ============================================
const Database = require('better-sqlite3');
const path     = require('path');

const db = new Database(path.join(__dirname, 'gameclub.db'));

// Продуктивність: WAL-mode для конкурентних читань
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Схема ────────────────────────────────────
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        username   TEXT    NOT NULL UNIQUE COLLATE NOCASE,
        hash       TEXT    NOT NULL,
        created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS game_stats (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        username   TEXT NOT NULL,
        game_type  TEXT NOT NULL,
        won        INTEGER NOT NULL DEFAULT 0,
        played_at  TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rooms_backup (
        code       TEXT PRIMARY KEY,
        game_type  TEXT NOT NULL,
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_stats_username   ON game_stats(username);
    CREATE INDEX IF NOT EXISTS idx_stats_game_type  ON game_stats(game_type);
    CREATE INDEX IF NOT EXISTS idx_rooms_updated    ON rooms_backup(updated_at);
`);

// ── Users ─────────────────────────────────────
const stmts = {
    getUser:    db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE'),
    createUser: db.prepare('INSERT INTO users (username, hash) VALUES (?, ?)'),
    deleteUser: db.prepare('DELETE FROM users WHERE username = ? COLLATE NOCASE'),

    addStat:    db.prepare('INSERT INTO game_stats (username, game_type, won) VALUES (?, ?, ?)'),
    getStats:   db.prepare(`
        SELECT game_type,
               COUNT(*)        AS games,
               SUM(won)        AS wins
        FROM game_stats
        WHERE username = ? COLLATE NOCASE
        GROUP BY game_type
    `),
    getLeaderboard: db.prepare(`
        SELECT username,
               game_type,
               COUNT(*)   AS games,
               SUM(won)   AS wins,
               ROUND(100.0 * SUM(won) / COUNT(*), 1) AS winrate
        FROM game_stats
        WHERE game_type = ?
        GROUP BY username
        ORDER BY wins DESC, games ASC
        LIMIT 20
    `),

    saveRoom:   db.prepare(`
        INSERT INTO rooms_backup (code, game_type, state_json, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(code) DO UPDATE SET
            state_json = excluded.state_json,
            updated_at = excluded.updated_at
    `),
    getRoom:    db.prepare('SELECT * FROM rooms_backup WHERE code = ?'),
    deleteRoom: db.prepare('DELETE FROM rooms_backup WHERE code = ?'),
    // Видаляємо кімнати старші за 6 годин
    cleanRooms: db.prepare(`DELETE FROM rooms_backup WHERE updated_at < datetime('now', '-6 hours')`),
    getAllRooms: db.prepare('SELECT * FROM rooms_backup'),
};

// ── API ───────────────────────────────────────
module.exports = {
    // Users
    getUser:    (username)         => stmts.getUser.get(username),
    createUser: (username, hash)   => stmts.createUser.run(username, hash),

    // Stats
    addStat:    (username, gameType, won) => {
        try { stmts.addStat.run(username, gameType, won ? 1 : 0); }
        catch {} // гість не в БД — ігноруємо
    },
    getStats:   (username) => {
        const rows = stmts.getStats.all(username);
        const result = {};
        rows.forEach(r => { result[r.game_type] = { g: r.games, w: r.wins }; });
        return result;
    },
    getLeaderboard: (gameType) => stmts.getLeaderboard.all(gameType),

    // Rooms (crash recovery)
    saveRoom:   (code, gameType, state) => {
        try { stmts.saveRoom.run(code, gameType, JSON.stringify(state)); }
        catch {}
    },
    getRoom:    (code) => {
        const row = stmts.getRoom.get(code);
        if (!row) return null;
        try { return { gameType: row.game_type, state: JSON.parse(row.state_json) }; }
        catch { return null; }
    },
    deleteRoom: (code) => stmts.deleteRoom.run(code),
    getAllRooms: ()    => {
        return stmts.getAllRooms.all().map(row => {
            try { return { code: row.code, gameType: row.game_type, state: JSON.parse(row.state_json) }; }
            catch { return null; }
        }).filter(Boolean);
    },
    cleanOldRooms: () => stmts.cleanRooms.run(),

    // Raw db for transactions if needed
    db,
};
