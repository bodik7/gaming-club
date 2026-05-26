// ============================================
// ІГРОВИЙ КЛУБ — server.js
// Node.js + Express + Socket.io + SQLite
// ============================================
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');
const fs      = require('fs');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('./db');

// Завантажуємо .env якщо є
try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
            const [k, ...v] = line.trim().split('=');
            if (k && !k.startsWith('#') && !process.env[k]) process.env[k] = v.join('=');
        });
    }
} catch {}

const SW_VERSION = Date.now().toString(36);

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

const JWT_SECRET = process.env.JWT_SECRET || 'igclub-dev-secret-change-in-prod';
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    console.error('❌  JWT_SECRET не задано в production! Встановіть змінну середовища JWT_SECRET.');
    process.exit(1);
}

// ── Rate limiting ─────────────────────────────
const _rl = new Map(); // key → { count, resetAt }
function rateLimit(key, max, windowMs) {
    const now = Date.now();
    const entry = _rl.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + windowMs; }
    entry.count++;
    _rl.set(key, entry);
    return entry.count <= max;
}
// Чистимо старі записи раз на 5 хвилин
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of _rl) if (now > v.resetAt) _rl.delete(k);
}, 5 * 60_000);

function apiLimiter(max, windowMs) {
    return (req, res, next) => {
        const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
        if (!rateLimit(`api:${ip}`, max, windowMs))
            return res.status(429).json({ error: 'Занадто багато запитів. Спробуйте пізніше.' });
        next();
    };
}

app.use(express.json());

// Динамічно підставляємо версію кешу — браузери отримають нову SW при кожному деплої
app.get('/sw.js', (req, res) => {
    const content = fs.readFileSync(path.join(__dirname, 'public/sw.js'), 'utf8')
        .replace("'igclub-v1'", `'igclub-${SW_VERSION}'`);
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-store');
    res.send(content);
});

app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders(res, filePath) {
        // HTML-файли ніколи не кешуємо — браузер завжди отримає актуальну версію
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-store');
        } else {
            // JS/CSS/зображення — кеш на 1 день (можна збільшити після додавання hash у назви)
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
    },
}));

// ── Бункер React SPA ─────────────────────────
const bunkerBuild = path.join(__dirname, 'public/bunker');
if (fs.existsSync(bunkerBuild)) {
    app.use('/bunker', express.static(bunkerBuild, {
        setHeaders(res, filePath) {
            res.setHeader('Cache-Control', filePath.endsWith('.html') ? 'no-store' : 'public, max-age=86400');
        },
    }));
    app.get('/bunker/*', (req, res) => res.sendFile(path.join(bunkerBuild, 'index.html')));
} else {
    // У dev-режимі — редірект на Vite dev server
    app.get('/bunker*', (req, res) => res.redirect('http://localhost:5173' + req.path.replace('/bunker', '') + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '')));
}

// ── REST Auth API ─────────────────────────────
app.post('/api/register', apiLimiter(5, 10 * 60_000), async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password)
        return res.status(400).json({ error: 'Заповніть усі поля' });
    if (!/^[a-zA-Zа-яА-ЯіІїЇєЄ0-9_]{3,20}$/.test(username))
        return res.status(400).json({ error: 'Логін: 3–20 символів (літери, цифри, _)' });
    if (password.length < 6)
        return res.status(400).json({ error: 'Пароль: мінімум 6 символів' });

    if (await db.getUser(username))
        return res.status(409).json({ error: 'Цей логін вже зайнятий' });

    const hash = await bcrypt.hash(password, 10);
    try {
        await db.createUser(username, hash);
    } catch {
        return res.status(409).json({ error: 'Цей логін вже зайнятий' });
    }

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, username });
});

app.post('/api/login', apiLimiter(10, 10 * 60_000), async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password)
        return res.status(400).json({ error: 'Заповніть усі поля' });

    const user = await db.getUser(username);
    if (!user) return res.status(401).json({ error: 'Невірний логін або пароль' });

    const ok = await bcrypt.compare(password, user.hash);
    if (!ok) return res.status(401).json({ error: 'Невірний логін або пароль' });

    const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, username: user.username });
});

app.get('/api/rooms/count', (req, res) => {
    const counts = {};
    roomStore.all().forEach(r => {
        const t = r.gameType || 'monopoly';
        counts[t] = (counts[t] || 0) + 1;
    });
    res.json(counts);
});

// Middleware: перевірка JWT → req.authUser
function requireAuth(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer '))
        return res.status(401).json({ error: 'Не авторизовано' });
    try {
        req.authUser = jwt.verify(auth.slice(7), JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Токен недійсний або прострочений' });
    }
}

function requireAdmin(req, res, next) {
    requireAuth(req, res, async () => {
        const user = await db.getUser(req.authUser.username);
        if (Number(user?.is_admin) !== 1) return res.status(403).json({ error: 'Немає доступу' });
        req.dbUser = user;
        next();
    });
}

app.get('/api/me', requireAuth, async (req, res) => {
    try {
        let user = await db.getUser(req.authUser.username);
        // JWT user exists but DB record is gone (e.g. after DB reset) — recreate it
        if (!user) {
            const isAdmin = req.authUser.username.toLowerCase() === 'bodik' ? 1 : 0;
            await db.getClient().execute({
                sql:  `INSERT OR IGNORE INTO users (username, hash, is_admin) VALUES (?, '', ?)`,
                args: [req.authUser.username, isAdmin],
            });
            user = await db.getUser(req.authUser.username);
        }
        // Always ensure bodik has admin flag
        if (req.authUser.username.toLowerCase() === 'bodik' && Number(user?.is_admin) !== 1) {
            await db.getClient().execute({
                sql: `UPDATE users SET is_admin = 1 WHERE LOWER(username) = 'bodik'`,
                args: [],
            });
            if (user) user.is_admin = 1;
        }
        const stats = await db.getStats(req.authUser.username);
        res.json({
            username:    req.authUser.username,
            displayName: user?.display_name || null,
            avatarColor: user?.avatar_color || '#1a56db',
            isAdmin:     Number(user?.is_admin) === 1,
            stats,
        });
    } catch (e) {
        console.error('[/api/me]', e.message);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

// Оновлення профілю
app.patch('/api/profile', requireAuth, async (req, res) => {
    const { displayName, avatarColor } = req.body;
    const dn = typeof displayName === 'string'
        ? displayName.trim().slice(0, 20).replace(/[<>"']/g, '') : null;
    const color = /^#[0-9a-fA-F]{6}$/.test(avatarColor) ? avatarColor : null;
    try {
        await db.updateProfile(req.authUser.username, { displayName: dn || null, avatarColor: color });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── Адмін-маршрути ───────────────────────────
app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try { res.json(await db.getAllUsers()); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/users/:username', requireAdmin, async (req, res) => {
    const target = req.params.username;
    if (target.toLowerCase() === 'bodik')
        return res.status(403).json({ error: 'Неможливо видалити адміна' });
    try {
        await db.deleteUser(target);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/admin/users/:username/admin', requireAdmin, async (req, res) => {
    try {
        await db.setAdmin(req.params.username, req.body.value);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/rooms', requireAdmin, (req, res) => {
    // rooms оголошується нижче, але до моменту виклику маршруту вже ініціалізований
    const list = Object.values(rooms).map(r => ({
        code:     r.code,
        gameType: r.gameType,
        players:  r.players?.length || 0,
        started:  !!r.gameStarted,
    }));
    res.json(list);
});

// Статистика конкретного гравця
app.get('/api/stats/:username', async (req, res) => {
    const stats = await db.getStats(req.params.username);
    res.json({ username: req.params.username, stats });
});

// Лідерборд по грі
app.get('/api/leaderboard/:gameType', async (req, res) => {
    const rows = await db.getLeaderboard(req.params.gameType);
    res.json(rows);
});

// ── Кімнати: { [code]: Room } ───────────────
const rooms = {};
const roomStore = {
    get:    code => rooms[code],
    set:    (code, room) => { rooms[code] = room; },
    delete: code => { delete rooms[code]; },
    all:    () => Object.values(rooms),
    has:    code => code in rooms,
    keys:   () => Object.keys(rooms),
};

// ── Дані дошки та фішок — єдине джерело правди ──
const { BOARD, TOKEN_COLORS, TOKEN_ICONS } = require('./public/games/monopoly/board.js');
const { CHANCE_CARDS, EXCURSION_CARDS } = require('./public/games/monopoly/messages.js');
const {
    BUNKER_PROFESSIONS, BUNKER_HEALTH, BUNKER_HOBBIES,
    BUNKER_TRAITS, BUNKER_BAGGAGE, BUNKER_FACTS, BUNKER_ACTION_CARDS, ACTION_CARD_PHASES,
} = require('./public/games/bunker/attributes.js');
const { BUNKER_SCENARIOS } = require('./public/games/bunker/scenarios.js');

// ── Ігрові модулі ─────────────────────────────
const monopolyMod  = require('./games/monopoly.js');
const tysyachaMod  = require('./games/tysyacha.js');
const durakMod     = require('./games/durak.js');
const bunkerMod    = require('./games/bunker.js');
const mafiaMod     = require('./games/mafia.js');

function generateCode() {
    const cities = ['KYIV', 'LVIV', 'ODESA', 'KHARKIV', 'DNIPRO', 'ZAPORIZHZHIA'];
    let code;
    do {
        code = cities[Math.floor(Math.random() * cities.length)] + '-' + (Math.floor(Math.random() * 9000) + 1000);
    } while (roomStore.has(code));
    return code;
}

// ── Очищення неактивних кімнат ────────────────
setInterval(() => {
    const now = Date.now();
    const IDLE_MS = 10 * 60 * 1000; // 10 хвилин без активності
    roomStore.keys().forEach(code => {
        const room = roomStore.get(code);
        if (now - (room.lastActivityAt || room.createdAt) > IDLE_MS) {
            clearTurnTimer(room);
            clearTradeTimer(room);
            cleanupRoom(code);
            console.log(`🗑️ Кімнату ${code} видалено (неактивна 10+ хв)`);
        }
    });
}, 2 * 60 * 1000); // перевіряємо кожні 2 хвилини

// Чистимо кімнату після завершення гри: від'єднуємо сокети і видаляємо з пам'яті
function cleanupRoom(code) {
    const r = roomStore.get(code);
    if (!r) return;
    r.players.forEach(rp => {
        if (!rp.socketId) return;
        const s = io.sockets.sockets.get(rp.socketId);
        if (s) { s.leave(code); s.roomCode = null; s.playerIndex = null; }
    });
    roomStore.delete(code);
}

// Ініціалізуємо ігрові модулі
monopolyMod.init(io);
tysyachaMod.init(io);
durakMod.init(io);
bunkerMod.init(io, db);
mafiaMod.init(io, db, roomStore, (room) => {
    db.saveGameStats(room, rp => {
        const p = room.state?.players[rp.index];
        return p ? MAFIA_ROLE_LABELS[p.role]?.faction === room.state.winner : false;
    });
    db.deleteRoom(room.code);
    cleanupRoom(room.code);
});

// Деструктуруємо модульні функції для зручності у socket-хендлері
const { createGameState, processAction, sanitize, addLog, nextPlayer, awardAuction,
        clearTurnTimer, clearTradeTimer, startTurnTimer, startTradeTimer } = monopolyMod;
const { createTysyachaState, processTysyachaAction, sanitizeTysyacha,
        clearTysyachaTimer, startTysyachaTimer, emitTysyachaUpdate } = tysyachaMod;
const { createDurakState, processDurakAction, sanitizeDurak,
        emitDurakUpdate, dStartTurnTimer } = durakMod;
const { createBunkerState, sanitizeBunker, emitBunkerUpdate, processBunkerAction,
        startBunkerPhase, startBunkerRound, clearBunkerTimer, resolveBunkerVoting,
        addBunkerLog, BUNKER_ATTR_LABELS, BOT_NAMES } = bunkerMod;
const { createMafiaState, sanitizeMafia, emitMafiaUpdate, processMafiaAction,
        startNightPhase, startVotingPhase, resolveVoting, MAFIA_ROLE_LABELS,
        MAFIA_BALANCE, getMafiaBotDecisions } = mafiaMod;

// Захист від дублювання сесій: username → socketId
const _activeSessions = new Map();

function isStr(v, max = 100) { return typeof v === 'string' && v.trim().length > 0 && v.length <= max; }

io.on('connection', (socket) => {
    console.log('+ підключення:', socket.id);

    // Автентифікація через токен при підключенні (опційно)
    socket.on('authenticate', ({ token }) => {
        try {
            const payload = jwt.verify(token, JWT_SECRET);
            socket.username = payload.username;
            // Якщо той самий юзер вже підключений — відключаємо старий сокет
            const prevId = _activeSessions.get(payload.username);
            if (prevId && prevId !== socket.id) {
                const prevSocket = io.sockets.sockets.get(prevId);
                if (prevSocket) {
                    prevSocket.emit('duplicateSession');
                    prevSocket.disconnect(true);
                }
            }
            _activeSessions.set(payload.username, socket.id);
        } catch {}
    });

    // Створити кімнату
    socket.on('createRoom', ({ playerName, gameType = 'monopoly' }, cb) => {
        if (!isStr(playerName, 30)) return;
        const code = generateCode();
        const gtype = gameType === 'tysyacha' ? 'tysyacha' : gameType === 'mafia' ? 'mafia' : gameType === 'durak' ? 'durak' : gameType === 'bunker' ? 'bunker' : 'monopoly';
        const room = {
            code,
            players: [{ socketId: socket.id, name: playerName, index: 0, username: socket.username || null }],
            started: false,
            state: null,
            gameType: gtype,
            createdAt: Date.now(),
            lastActivityAt: Date.now(),
        };
        roomStore.set(code, room);
        socket.join(code);
        socket.roomCode = code;
        socket.playerIndex = 0;
        console.log(`Кімната ${code} створена`);
        cb({ code, playerIndex: 0, gameType: gtype });
        io.to(code).emit('lobbyUpdate', { players: room.players.map(p => p.name), bots: room.players.map(p => !!p.isBot), gameType: gtype });
    });

    // Перегляд кімнати без входу
    socket.on('peekRoom', ({ code }, cb) => {
        if (!isStr(code, 20)) return cb({ error: 'not_found' });
        const room = roomStore.get(code.toUpperCase());
        if (!room) return cb({ error: 'not_found' });
        const maxPlayers = room.gameType === 'tysyacha' ? 3 : room.gameType === 'mafia' ? 15 : room.gameType === 'durak' ? 6 : room.gameType === 'bunker' ? 15 : 6;
        cb({ players: room.players.length, max: maxPlayers, gameType: room.gameType, started: room.started });
    });

    // Приєднатись до кімнати
    socket.on('joinRoom', ({ code, playerName }, cb) => {
        if (!isStr(code, 20) || !isStr(playerName, 30)) return cb({ error: 'Невірні дані' });
        const room = roomStore.get(code);
        if (!room)        return cb({ error: 'Кімнату не знайдено' });
        if (room.started) return cb({ error: 'Гра вже почалась' });
        const maxPlayers = room.gameType === 'tysyacha' ? 3 : room.gameType === 'mafia' ? 15 : room.gameType === 'durak' ? 6 : room.gameType === 'bunker' ? 15 : 6;
        if (room.players.length >= maxPlayers) return cb({ error: `Кімната повна (макс ${maxPlayers})` });

        const idx = room.players.length;
        room.players.push({ socketId: socket.id, name: playerName, index: idx, username: socket.username || null });
        socket.join(code);
        socket.roomCode = code;
        socket.playerIndex = idx;

        io.to(code).emit('lobbyUpdate', { players: room.players.map(p => p.name), bots: room.players.map(p => !!p.isBot), gameType: room.gameType });
        cb({ code, playerIndex: idx, gameType: room.gameType });
    });

    // Вийти з кімнати (до початку гри)
    socket.on('leaveRoom', () => {
        const room = roomStore.get(socket.roomCode);
        if (!room) return;

        // Bunker under active game: special logic
        if (room.started && room.state?.gameType === 'bunker') {
            const remainingHumans = room.players.filter(p => !p.isBot && p.index !== socket.playerIndex);
            if (remainingHumans.length === 0) {
                clearBunkerTimer(room);
                io.to(socket.roomCode).emit('roomClosed', { reason: 'Усі гравці покинули гру' });
                roomStore.delete(socket.roomCode);
            }
            socket.leave(socket.roomCode);
            socket.roomCode = null;
            socket.playerIndex = null;
            return;
        }

        if (room.started) return;

        if (socket.playerIndex === 0) {
            // Хост виходить — видаляємо кімнату, виганяємо всіх
            io.to(socket.roomCode).emit('roomClosed', { reason: 'Хост покинув кімнату' });
            room.players.forEach(p => {
                const s = io.sockets.sockets.get(p.socketId);
                if (s) { s.leave(socket.roomCode); s.roomCode = null; s.playerIndex = null; }
            });
            roomStore.delete(socket.roomCode);
        } else {
            // Звичайний гравець — прибираємо і переіндексуємо
            room.players = room.players.filter(p => p.index !== socket.playerIndex);
            room.players.forEach((p, i) => { p.index = i; });
            room.players.forEach(p => {
                const s = io.sockets.sockets.get(p.socketId);
                if (s) s.playerIndex = p.index;
            });
            socket.leave(socket.roomCode);
            socket.roomCode = null;
            socket.playerIndex = null;
            io.to(room.code).emit('lobbyUpdate', { players: room.players.map(p => p.name), bots: room.players.map(p => !!p.isBot), gameType: room.gameType });
        }
    });

    // Дострокове завершення гри
    socket.on('abandonGame', () => {
        const code = socket.roomCode;
        const room = roomStore.get(code);
        if (!room) return;
        const name = room.players[socket.playerIndex]?.name || 'Гравець';
        io.to(code).emit('gameAbandoned', { reason: `${name} достроково завершив(ла) гру` });
        room.players.forEach(p => {
            const s = io.sockets.sockets.get(p.socketId);
            if (s) { s.leave(code); s.roomCode = null; s.playerIndex = null; }
        });
        roomStore.delete(code);
    });

    // Здатись у Монополії: банкрутство гравця, решта продовжує
    socket.on('surrenderMonopoly', () => {
        const code = socket.roomCode;
        const room = roomStore.get(code);
        if (!room || !room.started) return;
        const state = room.state;
        if (!state || state.gameType === 'tysyacha') return;

        const pidx = socket.playerIndex;
        const player = state.players[pidx];
        if (!player || player.bankrupt) return;

        // Власність → банку
        player.properties.forEach(pos => {
            state.cellState[pos].owner = null;
            state.cellState[pos].houses = 0;
            state.cellState[pos].mortgaged = false;
        });
        player.properties = [];
        player.money = 0;
        player.bankrupt = true;
        state.pendingAction = null;
        state.pendingData = null;
        state.pendingRent = null;
        addLog(state, `🏳️ ${player.name} здав(ла)ся. Власність повернута банку.`, 'error');

        // Якщо зараз хід цього гравця — передаємо
        if (state.currentPlayerIndex === pidx) {
            state.hasRolled = false;
            state.doublesCount = 0;
            nextPlayer(state);
        }

        // Від'єднуємо гравця від кімнати
        socket.emit('surrendered');
        socket.leave(code);
        socket.roomCode = null;
        socket.playerIndex = null;
        clearTurnTimer(room);
        clearTradeTimer(room);

        // Перевіряємо переможця
        const alive = state.players.filter(p => !p.bankrupt);
        if (alive.length === 1) {
            addLog(state, `🏆 ${alive[0].name} — переможець!`, 'success');
            db.saveGameStats(room, rp => alive[0].name === state.players[rp.index]?.name);
            db.deleteRoom(room.code);
            io.to(code).emit('gameOver', { winner: alive[0], state: sanitize(state) });
            cleanupRoom(code);
            return;
        }

        startTurnTimer(room);
        io.to(code).emit('stateUpdate', {
            state: sanitize(state),
            sideEffect: null,
            toast: { text: `🏳️ ${player.name} здав(ла)ся`, color: '#c62828' },
        });
    });

    // Денний чат (day_discussion фаза)
    socket.on('dayChatMsg', ({ text }) => {
        const room = roomStore.get(socket.roomCode);
        if (!room?.state || room.state.gameType !== 'mafia') return;
        if (room.state.phase !== 'day_discussion') return;
        const player = room.state.players[socket.playerIndex];
        if (!player?.isAlive || player.isSilenced) return;
        const esc = s => String(s).replace(/[&<>"']/g, c =>
            ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
        io.to(socket.roomCode).emit('dayChatMsg', {
            playerId: socket.playerIndex,
            name: esc(player.name),
            text: esc(String(text || '').slice(0, 200)),
            round: room.state.round,
        });
    });

    // Чат мертвих (видно тільки мертвим)
    socket.on('deadChat', ({ text }) => {
        const room = roomStore.get(socket.roomCode);
        if (!room?.state || room.state.gameType !== 'mafia') return;
        const player = room.state.players[socket.playerIndex];
        if (!player || player.isAlive) return;
        const esc = s => String(s).replace(/[&<>"']/g, c =>
            ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
        const msg = { name: esc(player.name), text: esc(String(text || '').slice(0, 200)) };
        room.players
            .filter(rp => !room.state.players[rp.index]?.isAlive)
            .forEach(rp => io.to(rp.socketId).emit('deadChat', msg));
    });

    // Приватний чат мафії
    socket.on('mafiaChat', ({ text }) => {
        const room = roomStore.get(socket.roomCode);
        if (!room?.state || room.state.gameType !== 'mafia') return;
        const player = room.state.players[socket.playerIndex];
        if (!player || MAFIA_ROLE_LABELS[player.role]?.faction !== 'mafia') return;
        const esc = s => String(s).replace(/[&<>"']/g, c =>
            ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
        io.to(`${socket.roomCode}_mafia`).emit('mafiaChat', {
            playerId: socket.playerIndex,
            name: esc(player.name),
            text: esc(String(text || '').slice(0, 200)),
        });
    });

    // Отримати список вільних кімнат
    socket.on('getRooms', (cb) => {
        const _maxP = { tysyacha: 3, mafia: 15, durak: 6, bunker: 15, monopoly: 6 };
        const available = roomStore.all()
            .filter(r => !r.started && r.players.length > 0 && r.players.length < (_maxP[r.gameType] || 6))
            .map(r => ({
                code: r.code,
                playerCount: r.players.length,
                hostName: r.players[0].name,
                gameType: r.gameType || 'monopoly',
            }));
        cb({ rooms: available });
    });

    // Видалити гравця з кімнати (тільки хост, до початку гри)
    socket.on('kickPlayer', ({ kickIndex }) => {
        if (typeof kickIndex !== 'number') return;
        const room = roomStore.get(socket.roomCode);
        if (!room || room.started || socket.playerIndex !== 0) return;

        const kicked = room.players.find(p => p.index === kickIndex);
        if (!kicked) return;

        // Повідомляємо та від'єднуємо видаленого гравця
        io.to(kicked.socketId).emit('kicked', { reason: 'Вас видалив хост' });
        const kickedSocket = io.sockets.sockets.get(kicked.socketId);
        if (kickedSocket) {
            kickedSocket.leave(socket.roomCode);
            kickedSocket.roomCode = null;
            kickedSocket.playerIndex = null;
        }

        // Видаляємо та переіндексуємо
        room.players = room.players.filter(p => p.index !== kickIndex);
        room.players.forEach((p, i) => { p.index = i; });

        // Оновлюємо playerIndex на живих сокетах
        room.players.forEach(p => {
            const s = io.sockets.sockets.get(p.socketId);
            if (s) s.playerIndex = p.index;
        });

        io.to(socket.roomCode).emit('lobbyUpdate', { players: room.players.map(p => p.name), bots: room.players.map(p => !!p.isBot), gameType: room.gameType });
    });

    // Додати / прибрати бота (тільки хост, тільки в залі очікування)
    socket.on('addBot', () => {
        const room = roomStore.get(socket.roomCode);
        if (!room || socket.playerIndex !== 0 || room.started) return;
        if (room.gameType !== 'bunker' && room.gameType !== 'mafia') return;
        if (room.players.length >= 15) return;
        const usedNames = new Set(room.players.map(p => p.name));
        const botName = BOT_NAMES.find(n => !usedNames.has(n)) || `Бот-АІ-${room.players.length}`;
        const idx = room.players.length;
        room.players.push({ name: botName, index: idx, socketId: null, isBot: true });
        io.to(socket.roomCode).emit('lobbyUpdate', {
            players: room.players.map(p => p.name),
            bots:    room.players.map(p => !!p.isBot),
            gameType: room.gameType,
        });
    });

    socket.on('removeBot', () => {
        const room = roomStore.get(socket.roomCode);
        if (!room || socket.playerIndex !== 0 || room.started) return;
        const last = room.players[room.players.length - 1];
        if (!last?.isBot) return;
        room.players.pop();
        io.to(socket.roomCode).emit('lobbyUpdate', {
            players: room.players.map(p => p.name),
            bots:    room.players.map(p => !!p.isBot),
            gameType: room.gameType,
        });
    });

    // Почати гру (тільки хост — index 0)
    // Хост оновлює налаштування до старту
    socket.on('updateSettings', (newSettings) => {
        const room = roomStore.get(socket.roomCode);
        if (!room || socket.playerIndex !== 0) return;
        room.settings = { ...(room.settings || {}), ...newSettings };
    });

    socket.on('startGame', ({ settings } = {}) => {
        const room = roomStore.get(socket.roomCode);
        if (!room || socket.playerIndex !== 0) return;

        if (room.gameType === 'mafia') {
            const n = room.players.length;
            if (!MAFIA_BALANCE[n])
                return io.to(socket.id).emit('error', `Мафія: потрібно 5–15 гравців (зараз ${n})`);
            room.started = true;
            if (settings) room.settings = { ...(room.settings || {}), ...settings };
            room.state = createMafiaState(room.players, room.settings || {});
            // Мафіозі приєднуються до приватної sub-room
            const mafiaIds = room.state.mafiaIds;
            room.players.forEach(rp => {
                const s = io.sockets.sockets.get(rp.socketId);
                if (s && mafiaIds.includes(rp.index)) s.join(`${room.code}_mafia`);
                io.to(rp.socketId).emit('gameStarted', {
                    state: sanitizeMafia(room.state, rp.index),
                    gameType: 'mafia',
                });
            });
            // Боти авто-готуються на role_reveal
            getMafiaBotDecisions(room);
            // Автоматичний старт ночі через 25с якщо не всі натиснули "Готовий"
            setTimeout(() => {
                if (room.state?.phase === 'role_reveal') startNightPhase(room);
            }, 25000);
        } else if (room.gameType === 'durak') {
            const n = room.players.length;
            if (n < 2 || n > 6) return io.to(socket.id).emit('error', 'Дурак: потрібно 2–6 гравців');
            room.started = true;
            if (settings) room.settings = { ...(room.settings||{}), ...settings };
            room.state = createDurakState(room.players, room.settings||{});
            dStartTurnTimer(room);
            room.players.forEach(rp => {
                io.to(rp.socketId).emit('gameStarted', {
                    state: sanitizeDurak(room.state, rp.index),
                    gameType: 'durak',
                });
            });
        } else if (room.gameType === 'tysyacha') {
            if (room.players.length < 2 || room.players.length > 3)
                return io.to(socket.id).emit('error', 'Тисяча: потрібно 2 або 3 гравці');
            room.started = true;
            room.state = createTysyachaState(room.players);
            room.players.forEach(rp => {
                io.to(rp.socketId).emit('gameStarted', {
                    state: sanitizeTysyacha(room.state, rp.index),
                    gameType: 'tysyacha',
                });
            });
            startTysyachaTimer(room);
        } else if (room.gameType === 'bunker') {
            const n = room.players.length;
            if (n < 4 || n > 15) return io.to(socket.id).emit('error', 'Бункер: потрібно 4–15 гравців');
            room.started = true;
            if (settings) room.settings = { ...(room.settings||{}), ...settings };
            room.state = createBunkerState(room.players, room.settings||{});
            room.players.forEach(rp => {
                io.to(rp.socketId).emit('gameStarted', {
                    state: sanitizeBunker(room.state, rp.index),
                    myPlayerIndex: rp.index,
                    gameType: 'bunker',
                });
            });
            // Запускаємо таймер фази ознайомлення
            startBunkerPhase(room, 'game_start');
        } else {
            if (room.players.length < 2) return io.to(socket.id).emit('error', 'Потрібно мінімум 2 гравці');
            room.started = true;
            room.state = createGameState(room.players);
            addLog(room.state, `🎮 Гра почалась! Перший хід: ${room.state.players[0].name}`, 'success');
            startTurnTimer(room);
            io.to(socket.roomCode).emit('gameStarted', { state: sanitize(room.state), gameType: 'monopoly' });
        }
    });

    // Реванш — хост перезапускає гру з тими ж гравцями
    socket.on('restartGame', () => {
        const room = roomStore.get(socket.roomCode);
        if (!room || socket.playerIndex !== 0) return;
        const gameType = room.state?.gameType || room.gameType;
        if (gameType === 'durak') {
            room.state = createDurakState(room.players, room.settings||{});
            room.started = true;
            dStartTurnTimer(room);
            room.players.forEach(rp => {
                io.to(rp.socketId).emit('gameStarted', {
                    state: sanitizeDurak(room.state, rp.index),
                    myPlayerIndex: rp.index,
                    gameType: 'durak',
                });
            });
        } else if (gameType === 'tysyacha') {
            clearTysyachaTimer(room);
            room.state = createTysyachaState(room.players);
            room.started = true;
            room.players.forEach(rp => {
                io.to(rp.socketId).emit('gameStarted', {
                    state: sanitizeTysyacha(room.state, rp.index),
                    myPlayerIndex: rp.index,
                    gameType: 'tysyacha',
                });
            });
            startTysyachaTimer(room);
        } else if (gameType === 'mafia') {
            clearTimeout(room.nightTimer); clearTimeout(room.dayTimer);
            clearTimeout(room.voteTimer); clearTimeout(room.morningTimer);
            room.state = createMafiaState(room.players, room.settings || {});
            room.started = true;
            const mafiaIds = room.state.mafiaIds;
            room.players.forEach(rp => {
                const s = io.sockets.sockets.get(rp.socketId);
                if (s && mafiaIds.includes(rp.index)) s.join(`${room.code}_mafia`);
                io.to(rp.socketId).emit('gameStarted', {
                    state: sanitizeMafia(room.state, rp.index),
                    myPlayerIndex: rp.index,
                    gameType: 'mafia',
                });
            });
            setTimeout(() => {
                if (room.state?.phase === 'role_reveal') startNightPhase(room);
            }, 25000);
        } else if (gameType === 'bunker') {
            clearBunkerTimer(room);
            room.state = createBunkerState(room.players, room.settings || {});
            room.started = true;
            room.players.forEach(rp => {
                io.to(rp.socketId).emit('gameStarted', {
                    state: sanitizeBunker(room.state, rp.index),
                    myPlayerIndex: rp.index,
                    gameType: 'bunker',
                });
            });
            startBunkerPhase(room, 'game_start');
        } else {
            // Монополія
            room.state = createGameState(room.players);
            addLog(room.state, `🎮 Реванш! Перший хід: ${room.state.players[0].name}`, 'success');
            room.started = true;
            startTurnTimer(room);
            io.to(socket.roomCode).emit('gameStarted', { state: sanitize(room.state), gameType: 'monopoly' });
        }
    });

    // Дія від гравця
    socket.on('action', ({ type, data }) => {
        if (!isStr(type, 50)) return;
        const room = roomStore.get(socket.roomCode);
        if (!room?.state) return;
        const state = room.state;

        // ── Бункер ──
        if (state.gameType === 'bunker') {
            processBunkerAction(room, type, data || {}, socket.playerIndex);
            return;
        }

        // ── Дурак ──
        if (state.gameType === 'durak') {
            room.lastActivityAt = Date.now();
            const result = processDurakAction(state, type, data||{}, socket.playerIndex);
            if (result?.event === 'dGameOver') {
                db.saveGameStats(room, rp => state.loser !== rp.index);
                db.deleteRoom(room.code);
                room.players.forEach(rp => {
                    io.to(rp.socketId).emit('gameOver', {
                        state: sanitizeDurak(state, rp.index),
                        gameType: 'durak',
                    });
                });
                cleanupRoom(room.code);
            } else {
                emitDurakUpdate(room, result);
            }
            return;
        }

        // ── Мафія ──
        if (state.gameType === 'mafia') {
            room.lastActivityAt = Date.now();
            processMafiaAction(state, type, data || {}, socket.playerIndex);
            if (state._shouldStartNight) {
                delete state._shouldStartNight;
                startNightPhase(room);
                return;
            }
            if (state._resolveVoting) {
                delete state._resolveVoting;
                resolveVoting(room);
                return;
            }
            if (state.phase === 'gameover') {
                db.saveGameStats(room, rp => {
                    const p = state.players[rp.index];
                    return p ? MAFIA_ROLE_LABELS[p.role]?.faction === state.winner : false;
                });
                db.deleteRoom(room.code);
                room.players.forEach(rp => {
                    io.to(rp.socketId).emit('gameOver', {
                        state: sanitizeMafia(state, rp.index),
                        gameType: 'mafia',
                    });
                });
                cleanupRoom(room.code);
            } else {
                emitMafiaUpdate(room, null);
            }
            return;
        }

        // ── Тисяча ──
        if (state.gameType === 'tysyacha') {
            room.lastActivityAt = Date.now();
            clearTysyachaTimer(room);
            const result = processTysyachaAction(state, type, data || {}, socket.playerIndex);
            if (result?.event === 'tGameOver') {
                db.saveGameStats(room, rp => state.winner === rp.index);
                db.deleteRoom(room.code);
                room.players.forEach(rp => {
                    io.to(rp.socketId).emit('gameOver', {
                        winner: state.players[state.winner],
                        state: sanitizeTysyacha(state, rp.index),
                        gameType: 'tysyacha',
                    });
                });
                cleanupRoom(room.code);
            } else {
                emitTysyachaUpdate(room, result, null);
                startTysyachaTimer(room);
            }
            return;
        }

        // Перевірка прав на дію
        const isAuctionAction  = ['auctionBid', 'auctionPass'].includes(type);
        const isTradeResponse  = ['acceptTrade', 'rejectTrade'].includes(type);
        if (!isAuctionAction && !isTradeResponse && state.currentPlayerIndex !== socket.playerIndex) return;
        if (isAuctionAction && state.auctionState) {
            const a = state.auctionState;
            const bidderId = a.active[a.turnIdx % a.active.length];
            if (bidderId !== socket.playerIndex) return;
        }
        if (isTradeResponse) {
            (data = data || {}).callerIdx = socket.playerIndex;
        }

        room.lastActivityAt = Date.now();
        const prevIdx = state.currentPlayerIndex;
        const sideEffect = processAction(state, type, data || {}, room);
        const toast = state._toast || null;
        delete state._toast;

        // Управління таймерами
        if (type === 'offerTrade' && state.pendingTrade) {
            startTradeTimer(room);                         // запускаємо 20с таймер угоди
        } else if (isTradeResponse && !state.pendingTrade) {
            clearTradeTimer(room);                         // угода закрита — відновлюємо хід
            startTurnTimer(room);
        } else if (state.currentPlayerIndex !== prevIdx) {
            startTurnTimer(room);                          // хід змінився — перезапуск
        }

        // Перевірка переможця
        const alive = state.players.filter(p => !p.bankrupt);
        if (alive.length === 1) {
            clearTurnTimer(room);
            clearTradeTimer(room);
            addLog(state, `🏆 ${alive[0].name} — переможець!`, 'success');
            db.saveGameStats(room, rp => alive[0].name === state.players[rp.index]?.name);
            db.deleteRoom(room.code);
            io.to(socket.roomCode).emit('gameOver', { winner: alive[0], state: sanitize(state) });
            cleanupRoom(socket.roomCode);
            return;
        }

        io.to(socket.roomCode).emit('stateUpdate', {
            state: sanitize(state),
            sideEffect,
            toast,
        });
    });

    // Перепідключення після оновлення сторінки
    socket.on('rejoin', ({ code, playerIndex, playerName }, cb) => {
        if (!isStr(code, 20) || typeof playerIndex !== 'number' || !isStr(playerName, 30))
            return cb({ error: 'Невірні дані' });
        const room = roomStore.get(code);
        if (!room) return cb({ error: 'Кімнату не знайдено (можливо сервер перезапускався)' });

        const rp = room.players.find(p => p.index === playerIndex && p.name === playerName);
        if (!rp) return cb({ error: 'Гравця не знайдено в кімнаті' });

        // Оновлюємо socket ID
        rp.socketId = socket.id;
        socket.join(code);
        socket.roomCode    = code;
        socket.playerIndex = playerIndex;

        // Скидаємо AFK таймер і відновлюємо isOnline
        if (room.afkTimers?.[playerIndex] !== undefined) {
            clearTimeout(room.afkTimers[playerIndex]);
            delete room.afkTimers[playerIndex];
        }
        if (room.state?.gameType === 'bunker') {
            const sp = room.state.players[playerIndex];
            if (sp) sp.isOnline = true;
        }

        if (room.started && room.state) {
            // Для мафії — повертаємо в приватну sub-room якщо мафіозі
            if (room.state.gameType === 'mafia') {
                const mafiaIds = room.state.mafiaIds || [];
                if (mafiaIds.includes(playerIndex)) socket.join(`${code}_mafia`);
            }
            const st = room.state.gameType === 'tysyacha'
                ? sanitizeTysyacha(room.state, playerIndex)
                : room.state.gameType === 'mafia'
                ? sanitizeMafia(room.state, playerIndex)
                : room.state.gameType === 'durak'
                ? sanitizeDurak(room.state, playerIndex)
                : room.state.gameType === 'bunker'
                ? sanitizeBunker(room.state, playerIndex)
                : sanitize(room.state);
            cb({ success: true, started: true, state: st, gameType: room.gameType });
            // Для Бункера — сповіщаємо інших про повернення гравця
            if (room.state.gameType === 'bunker') emitBunkerUpdate(room);
        } else {
            cb({ success: true, started: false, players: room.players.map(p => p.name), bots: room.players.map(p => p.isBot || false) });
            io.to(code).emit('lobbyUpdate', { players: room.players.map(p => p.name), bots: room.players.map(p => p.isBot || false), gameType: room.gameType });
        }
    });

    // Чат
    socket.on('chatMessage', ({ text, icon, name, color }) => {
        if (!socket.roomCode) return;
        if (!rateLimit(`chat:${socket.id}`, 5, 8_000)) return; // max 5 повідомлень за 8с
        const esc = s => String(s).replace(/[&<>"']/g, c =>
            ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
        io.to(socket.roomCode).emit('chatMessage', {
            playerIndex: socket.playerIndex,
            icon:  esc(String(icon  || '').slice(0, 10)),
            name:  esc(String(name  || '').slice(0, 30)),
            color: /^#[0-9a-fA-F]{3,6}$/.test(color) ? color : '#888',
            text:  esc(String(text  || '').slice(0, 200)),
        });
    });

    // Чат у залі очікування
    socket.on('lobbyMsg', ({ text }) => {
        if (!socket.roomCode) return;
        if (!rateLimit(`lobbyChat:${socket.id}`, 5, 8_000)) return;
        const room = roomStore.get(socket.roomCode);
        if (!room || room.gameStarted) return;
        const esc = s => String(s).replace(/[&<>"']/g, c =>
            ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
        const player = room.players.find(p => p.socketId === socket.id);
        const name = esc(String(player?.name || socket.playerName || 'Гравець').slice(0, 30));
        io.to(socket.roomCode).emit('lobbyMsg', {
            name,
            text: esc(String(text || '').slice(0, 200)),
        });
    });

    // Відключення
    socket.on('disconnect', () => {
        console.log('- відключення:', socket.id);
        if (socket.username && _activeSessions.get(socket.username) === socket.id)
            _activeSessions.delete(socket.username);
        const room = roomStore.get(socket.roomCode);
        if (!room) return;
        // Прибираємо гравця з активного аукціону щоб не зависав
        if (room.state?.auctionState) {
            const a = room.state.auctionState;
            a.active = a.active.filter(id => id !== socket.playerIndex);
            if (a.active.length === 0) {
                addLog(room.state, '🔨 Аукціон скасовано — всі відключились', 'warn');
                room.state.auctionState = null;
            } else if (a.active.length === 1 && a.currentBidder !== null) {
                awardAuction(room.state, a);
            }
            io.to(socket.roomCode).emit('stateUpdate', { state: sanitize(room.state), sideEffect: null });
        }
        // Якщо відключився отримувач угоди — скасовуємо pendingTrade і trade timer
        if (room.state?.pendingTrade?.toIdx === socket.playerIndex) {
            clearTradeTimer(room);
            room.state.pendingTrade = null;
            room.state.tradeDeadline = null;
            startTurnTimer(room);
            io.to(socket.roomCode).emit('stateUpdate', {
                state: sanitize(room.state), sideEffect: null,
                toast: { text: '🚪 Отримувач угоди відключився — угоду скасовано', color: '#e65100' },
            });
        }
        io.to(socket.roomCode).emit('playerDisconnected', { playerIndex: socket.playerIndex });

        // Автоматичне видалення порожніх кімнат
        const _emptyCheckCode = socket.roomCode;
        const _emptyDelay = room.started ? 60_000 : 0;
        setTimeout(() => {
            const r = roomStore.get(_emptyCheckCode);
            if (!r) return;
            if (r.started && r.state?.gameType === 'bunker') return; // бункер має власну логіку
            const connectedHumans = r.players.filter(p => {
                if (p.isBot || !p.socketId) return false;
                const s = io.sockets.sockets.get(p.socketId);
                // сокет має бути активним І ще знаходитись у цій кімнаті
                return s && s.roomCode === r.code;
            });
            if (connectedHumans.length === 0) {
                if (r.started) {
                    clearTurnTimer(r); clearTradeTimer(r);
                    clearTimeout(r.nightTimer); clearTimeout(r.dayTimer);
                    clearTimeout(r.voteTimer);
                    db.deleteRoom(r.code);
                }
                roomStore.delete(_emptyCheckCode);
                console.log(`🗑️  Кімната ${_emptyCheckCode} видалена (порожня)`);
            }
        }, _emptyDelay);

        // Bunker: reconnect grace + AFK auto-action
        if (room.started && room.state?.gameType === 'bunker' && !rp?.isBot) {
            const pidx     = socket.playerIndex;
            const roomCode = socket.roomCode;
            const sp = room.state.players[pidx];
            if (sp) sp.isOnline = false;
            emitBunkerUpdate(room);

            room.afkTimers = room.afkTimers || {};
            clearTimeout(room.afkTimers[pidx]);
            room.afkTimers[pidx] = setTimeout(() => {
                const r = roomStore.get(roomCode);
                if (!r?.state) return;
                const st  = r.state;
                const rp2 = r.players.find(p => p.index === pidx);
                // Гравець повернувся — нічого не робимо
                if (rp2?.socketId && io.sockets.sockets.get(rp2.socketId)) return;

                const player = st.players[pidx];
                if (!player?.isAlive) return;

                if (st.phase === 'round_reveal' && !player.hasRevealed) {
                    const attr = Object.keys(player.attributes).find(k => !player.attributes[k].isRevealed);
                    if (attr) {
                        player.attributes[attr].isRevealed = true;
                        player.hasRevealed = true;
                        addBunkerLog(st, `⏱️ ${player.name} розкриває ${BUNKER_ATTR_LABELS[attr]} (AFK)`);
                        const allRevealed = st.players.filter(pl => pl.isAlive).every(pl => pl.hasRevealed);
                        if (allRevealed) { clearBunkerTimer(r); startBunkerPhase(r, 'discussion'); }
                        else emitBunkerUpdate(r);
                    }
                } else if (st.phase === 'game_start' && !player.hasRevealed) {
                    player.hasRevealed = true;
                    addBunkerLog(st, `✅ ${player.name} готовий (AFK)`);
                    const allReady = st.players.every(pl => pl.hasRevealed);
                    if (allReady) {
                        st.players.forEach(pl => { pl.hasRevealed = false; });
                        clearBunkerTimer(r);
                        startBunkerRound(r);
                    } else emitBunkerUpdate(r);
                } else if (st.phase === 'voting' && st.votes[pidx] === undefined && !st.quarantined?.includes(pidx)) {
                    const candidates = st.players.filter(pl =>
                        pl.isAlive && pl.id !== pidx && (!st.tiebreaker || st.tiebreaker.includes(pl.id))
                    );
                    if (candidates.length > 0) {
                        const target = candidates[Math.floor(Math.random() * candidates.length)];
                        st.votes[pidx] = target.id;
                        addBunkerLog(st, `⏱️ ${player.name} голосує (AFK)`);
                        const aliveIds = st.players.filter(pl => pl.isAlive && !st.quarantined?.includes(pl.id)).map(pl => pl.id);
                        const allVoted = aliveIds.every(id => st.votes[id] !== undefined);
                        if (allVoted) { clearBunkerTimer(r); resolveBunkerVoting(r); }
                        else emitBunkerUpdate(r);
                    }
                }
            }, 30_000);

            // Закриваємо кімнату якщо всі люди офлайн після 60с
            setTimeout(() => {
                const r = roomStore.get(roomCode);
                if (!r) return;
                const connectedHumans = r.players.filter(
                    p => !p.isBot && p.socketId && io.sockets.sockets.get(p.socketId)
                );
                if (connectedHumans.length === 0) {
                    clearBunkerTimer(r);
                    roomStore.delete(roomCode);
                }
            }, 60_000);
        }
    });
});


// ── Відновлення кімнат після перезапуску ─────
async function restoreRoomsFromDB() {
    await db.cleanOldRooms();
    const saved = await db.getAllRooms();
    let restored = 0;
    for (const { code, gameType, state } of saved) {
        if (roomStore.has(code)) continue;
        roomStore.set(code, {
            code,
            players: [],
            started: true,
            state,
            gameType,
            createdAt: Date.now(),
            lastActivityAt: Date.now(),
        });
        restored++;
    }
    if (restored > 0) console.log(`♻️  Відновлено ${restored} кімнат з БД`);
}

// Автозбереження активних кімнат кожні 30 секунд
async function autoSaveRooms() {
    for (const room of roomStore.all()) {
        if (room.started && room.state) {
            await db.saveRoom(room.code, room.gameType || room.state.gameType || 'monopoly', room.state);
        }
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    console.log(`🇺🇦 Ігровий Клуб запущено: http://localhost:${PORT}`);
    await db.init();
    await restoreRoomsFromDB();
    setInterval(autoSaveRooms, 30_000);
    // Щоденне очищення сміттєвих даних
    const dailyClean = async () => {
        await db.cleanOldStats();
        await db.cleanGhostUsers();
    };
    dailyClean();
    setInterval(dailyClean, 24 * 60 * 60_000);
    // Self-ping щоб Render не засипав (тільки на продакшені)
    if (process.env.RENDER_EXTERNAL_URL) {
        setInterval(() => {
            http.get(process.env.RENDER_EXTERNAL_URL).on('error', () => {});
        }, 14 * 60 * 1000);
    }
});
