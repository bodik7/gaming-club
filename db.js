// ============================================
// db.js — Turso (libsql) хмарна БД
// ============================================
const { createClient } = require('@libsql/client');
const { INITIAL_ADMIN } = require('./config');

let _client = null;

function getClient() {
    if (!_client) {
        const url = (process.env.TURSO_DATABASE_URL || 'file:gameclub.db').trim();
        if (!process.env.TURSO_DATABASE_URL) {
            console.warn('[db] ⚠️  TURSO_DATABASE_URL не встановлено — використовується локальний файл (дані тимчасові!)');
        } else {
            console.log('[db] Підключення до Turso:', url.slice(0, 40));
        }
        _client = createClient({
            url,
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
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            username     TEXT    NOT NULL UNIQUE COLLATE NOCASE,
            hash         TEXT    NOT NULL,
            created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
            display_name TEXT,
            avatar_color TEXT    DEFAULT '#1a56db',
            avatar_id    TEXT,
            is_admin     INTEGER DEFAULT 0
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
        { sql: `CREATE TABLE IF NOT EXISTS game_history (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            game_type    TEXT NOT NULL,
            winner       TEXT,
            rounds       INTEGER DEFAULT 0,
            played_at    TEXT NOT NULL DEFAULT (datetime('now')),
            players_json TEXT NOT NULL DEFAULT '[]'
        )` },
        { sql: `CREATE TABLE IF NOT EXISTS game_history_players (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            history_id INTEGER NOT NULL REFERENCES game_history(id) ON DELETE CASCADE,
            username   TEXT    NOT NULL COLLATE NOCASE,
            won        INTEGER NOT NULL DEFAULT 0
        )` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_stats_username  ON game_stats(username)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_stats_game_type ON game_stats(game_type)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_rooms_updated   ON rooms_backup(updated_at)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_history_played  ON game_history(played_at)` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_histplayers_username ON game_history_players(username)` },
    ], 'deferred');

    // Міграції: нові колонки та таблиці (ігнор "duplicate column" / "already exists" — норма при повторному старті)
    const migrations = [
        `ALTER TABLE users ADD COLUMN display_name TEXT`,
        `ALTER TABLE users ADD COLUMN avatar_color TEXT DEFAULT '#1a56db'`,
        `ALTER TABLE users ADD COLUMN is_admin    INTEGER DEFAULT 0`,
        `ALTER TABLE users ADD COLUMN avatar_id   TEXT`,
        `CREATE TABLE IF NOT EXISTS game_history_players (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            history_id INTEGER NOT NULL REFERENCES game_history(id) ON DELETE CASCADE,
            username   TEXT    NOT NULL COLLATE NOCASE,
            won        INTEGER NOT NULL DEFAULT 0
        )`,
        `CREATE INDEX IF NOT EXISTS idx_histplayers_username ON game_history_players(username)`,
    ];
    for (const sql of migrations) {
        try {
            await c.execute(sql);
            console.log('[db] migration ok:', sql.slice(0, 60));
        } catch (e) {
            const msg = e.message || '';
            if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
                console.error('[db] migration error:', msg, '|', sql.slice(0, 60));
            }
        }
    }
    // Початковий адмін
    try {
        const r = await c.execute({
            sql:  `UPDATE users SET is_admin = 1 WHERE LOWER(username) = ?`,
            args: [INITIAL_ADMIN],
        });
        if (r.rowsAffected > 0) console.log(`[db] ${INITIAL_ADMIN} promoted to admin`);
    } catch (e) { console.error('[db] admin init:', e.message); }
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

async function updateProfile(username, { displayName, avatarColor, avatarId }) {
    // UPSERT: create row if JWT user has no DB record (e.g. after DB reset)
    await getClient().execute({
        sql: `INSERT INTO users (username, hash, display_name, avatar_color, avatar_id)
              VALUES (?, '', ?, ?, ?)
              ON CONFLICT(username) DO UPDATE SET
                  display_name = excluded.display_name,
                  avatar_color = excluded.avatar_color,
                  avatar_id    = excluded.avatar_id`,
        args: [username, displayName ?? null, avatarColor ?? '#1a56db', avatarId ?? null],
    });
}

async function getAllUsers() {
    const result = await getClient().execute({
        sql: `SELECT u.username, u.display_name, u.avatar_color, u.is_admin, u.created_at,
                     COUNT(s.id) AS games, SUM(s.won) AS wins
              FROM users u LEFT JOIN game_stats s ON s.username = u.username COLLATE NOCASE
              GROUP BY u.username ORDER BY u.created_at DESC`,
        args: [],
    });
    return result.rows.map(r => ({
        username:     r.username,
        displayName:  r.display_name,
        avatarColor:  r.avatar_color || '#1a56db',
        isAdmin:      Number(r.is_admin) === 1,
        createdAt:    r.created_at,
        games:        Number(r.games || 0),
        wins:         Number(r.wins  || 0),
    }));
}

async function deleteUser(username) {
    const c = getClient();
    await c.execute({ sql: `DELETE FROM game_stats WHERE username = ? COLLATE NOCASE`, args: [username] });
    await c.execute({ sql: `DELETE FROM users WHERE username = ? COLLATE NOCASE`,      args: [username] });
}

async function setAdmin(username, value) {
    await getClient().execute({
        sql:  `UPDATE users SET is_admin = ? WHERE username = ? COLLATE NOCASE`,
        args: [value ? 1 : 0, username],
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

function saveGameStats(room, winnerFn) {
    if (!room?.players) return;
    const gameType = room.state?.gameType || room.gameType || 'monopoly';
    room.players.forEach(rp => {
        if (!rp.username) return;
        addStat(rp.username, gameType, winnerFn(rp));
    });
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
        sql:  `SELECT gs.username, gs.game_type, COUNT(*) AS games, SUM(gs.won) AS wins,
                      ROUND(100.0 * SUM(gs.won) / COUNT(*), 1) AS winrate,
                      u.avatar_id, u.avatar_color
               FROM game_stats gs
               LEFT JOIN users u ON u.username = gs.username
               WHERE gs.game_type = ?
               GROUP BY gs.username ORDER BY wins DESC, games ASC LIMIT 20`,
        args: [gameType],
    });
    return result.rows.map(r => ({
        username:    r.username,
        game_type:   r.game_type,
        games:       Number(r.games),
        wins:        Number(r.wins),
        winrate:     Number(r.winrate),
        avatarId:    r.avatar_id   || null,
        avatarColor: r.avatar_color || '#1a56db',
    }));
}

async function saveGameHistory(gameType, winner, rounds, players) {
    // players: [{ username, name, role, won }]
    const withUsername = (players || []).filter(p => p.username);
    if (!withUsername.length) return;
    const c = getClient();
    try {
        const result = await c.execute({
            sql:  `INSERT INTO game_history (game_type, winner, rounds, players_json) VALUES (?, ?, ?, ?)`,
            args: [gameType, winner || null, rounds || 0, JSON.stringify(players || [])],
        });
        const historyId = Number(result.lastInsertRowid);
        if (historyId) {
            await c.batch(
                withUsername.map(p => ({
                    sql:  `INSERT INTO game_history_players (history_id, username, won) VALUES (?, ?, ?)`,
                    args: [historyId, p.username, p.won ? 1 : 0],
                })),
                'deferred'
            );
        }
    } catch (e) { console.error('[db] saveGameHistory:', e.message); }
}

async function getHistory(username, limit = 20) {
    const result = await getClient().execute({
        sql:  `SELECT h.id, h.game_type, h.winner, h.rounds, h.played_at, h.players_json
               FROM game_history h
               INNER JOIN game_history_players p ON p.history_id = h.id
               WHERE p.username = ? COLLATE NOCASE
               ORDER BY h.played_at DESC LIMIT ?`,
        args: [username, limit],
    });
    return result.rows.map(r => {
        let players = [];
        try { players = JSON.parse(r.players_json); } catch {}
        return {
            id:       r.id,
            gameType: r.game_type,
            winner:   r.winner,
            rounds:   r.rounds,
            playedAt: r.played_at,
            players,
        };
    });
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
    init, getClient,
    getUser, createUser, updateProfile, getAllUsers, deleteUser, setAdmin,
    addStat, getStats, getLeaderboard, saveGameStats,
    saveGameHistory, getHistory,
    saveRoom, getRoom, deleteRoom, getAllRooms, cleanOldRooms,
    cleanOldStats, cleanGhostUsers,
};
