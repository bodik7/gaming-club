// ============================================
// db.js — Turso (libsql) хмарна БД
// ============================================
const { createClient } = require('@libsql/client');

let _client = null;

function getClient() {
    if (!_client) {
        _client = createClient({
            url:       (process.env.TURSO_DATABASE_URL || 'file:gameclub.db').trim(),
            authToken: process.env.TURSO_AUTH_TOKEN?.trim(),
        });
    }
    return _client;
}

// ── Схема ────────────────────────────────────
async function init() {
    const c = getClient();
    await c.batch([
        { sql: `CREATE TABLE IF NOT EXISTS users (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            username   TEXT    NOT NULL UNIQUE COLLATE NOCASE,
            hash       TEXT    NOT NULL,
            created_at TEXT    NOT NULL DEFAULT (datetime('now'))
        )` },
        { sql: `CREATE TABLE IF NOT EXISTS game_stats (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            username   TEXT NOT NULL,
            game_type  TEXT NOT NULL,
            won        INTEGER NOT NULL DEFAULT 0,
            played_at  TEXT NOT NULL DEFAULT (datetime('now'))
        )` },
        { sql: `CREATE TABLE IF NOT EXISTS rooms_backup (
            code       TEXT PRIMARY KEY,
            game_type  TEXT NOT NULL,
            state_json TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_stats_username  ON game_stats(username)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_stats_game_type ON game_stats(game_type)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_rooms_updated   ON rooms_backup(updated_at)` },
    ], 'deferred');
}

// ── Users ─────────────────────────────────────
async function getUser(username) {
    const result = await getClient().execute({
        sql:  'SELECT * FROM users WHERE username = ? COLLATE NOCASE LIMIT 1',
        args: [username],
    });
    return result.rows[0] || null;
}

async function createUser(username, hash) {
    await getClient().execute({
        sql:  'INSERT INTO users (username, hash) VALUES (?, ?)',
        args: [username, hash],
    });
}

// ── Stats ──────────────────────────────────────
async function addStat(username, gameType, won) {
    try {
        await getClient().execute({
            sql:  'INSERT INTO game_stats (username, game_type, won) VALUES (?, ?, ?)',
            args: [username, gameType, won ? 1 : 0],
        });
    } catch (e) { console.error('[db] addStat:', e.message); }
}

async function getStats(username) {
    const result = await getClient().execute({
        sql:  `SELECT game_type, COUNT(*) AS games, SUM(won) AS wins
               FROM game_stats WHERE username = ? COLLATE NOCASE GROUP BY game_type`,
        args: [username],
    });
    const stats = {};
    result.rows.forEach(r => {
        stats[r.game_type] = { g: Number(r.games), w: Number(r.wins) };
    });
    return stats;
}

async function getLeaderboard(gameType) {
    const result = await getClient().execute({
        sql:  `SELECT username, game_type, COUNT(*) AS games, SUM(won) AS wins,
                      ROUND(100.0 * SUM(won) / COUNT(*), 1) AS winrate
               FROM game_stats WHERE game_type = ?
               GROUP BY username ORDER BY wins DESC, games ASC LIMIT 20`,
        args: [gameType],
    });
    return result.rows.map(r => ({
        username:  r.username,
        game_type: r.game_type,
        games:     Number(r.games),
        wins:      Number(r.wins),
        winrate:   Number(r.winrate),
    }));
}

// ── Rooms (crash recovery) ────────────────────
async function saveRoom(code, gameType, state) {
    try {
        await getClient().execute({
            sql: `INSERT INTO rooms_backup (code, game_type, state_json, updated_at)
                  VALUES (?, ?, ?, datetime('now'))
                  ON CONFLICT(code) DO UPDATE SET
                      state_json = excluded.state_json,
                      updated_at = excluded.updated_at`,
            args: [code, gameType, JSON.stringify(state)],
        });
    } catch (e) { console.error('[db] saveRoom:', e.message); }
}

async function getRoom(code) {
    const result = await getClient().execute({
        sql:  'SELECT * FROM rooms_backup WHERE code = ?',
        args: [code],
    });
    const row = result.rows[0];
    if (!row) return null;
    try { return { gameType: row.game_type, state: JSON.parse(row.state_json) }; }
    catch { return null; }
}

async function deleteRoom(code) {
    try {
        await getClient().execute({
            sql:  'DELETE FROM rooms_backup WHERE code = ?',
            args: [code],
        });
    } catch (e) { console.error('[db] deleteRoom:', e.message); }
}

async function getAllRooms() {
    const result = await getClient().execute('SELECT * FROM rooms_backup');
    return result.rows.map(row => {
        try { return { code: row.code, gameType: row.game_type, state: JSON.parse(row.state_json) }; }
        catch { return null; }
    }).filter(Boolean);
}

async function cleanOldRooms() {
    try {
        await getClient().execute(
            `DELETE FROM rooms_backup WHERE updated_at < datetime('now', '-6 hours')`
        );
    } catch (e) { console.error('[db] cleanOldRooms:', e.message); }
}

// Видаляє game_stats старші за 12 місяців
// Для кожного юзера залишає мінімум 20 останніх записів (не чіпаємо активних)
async function cleanOldStats() {
    try {
        await getClient().execute(
            `DELETE FROM game_stats WHERE played_at < datetime('now', '-12 months')`
        );
    } catch (e) { console.error('[db] cleanOldStats:', e.message); }
}

// Видаляє акаунти без жодної гри старші за 90 днів (сміттєві реєстрації)
async function cleanGhostUsers() {
    try {
        await getClient().execute(`
            DELETE FROM users
            WHERE id NOT IN (SELECT DISTINCT rowid FROM users LIMIT 0)
            AND username NOT IN (SELECT DISTINCT username FROM game_stats)
            AND created_at < datetime('now', '-90 days')
        `);
    } catch (e) { console.error('[db] cleanGhostUsers:', e.message); }
}

module.exports = {
    init,
    getUser, createUser,
    addStat, getStats, getLeaderboard,
    saveRoom, getRoom, deleteRoom, getAllRooms, cleanOldRooms,
    cleanOldStats, cleanGhostUsers,
};
