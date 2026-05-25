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

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

const JWT_SECRET = process.env.JWT_SECRET || 'igclub-dev-secret-change-in-prod';

app.use(express.json());
// TODO: перед деплоєм на постійний сервер — прибрати no-store і повернути etag/lastModified
app.use(express.static(path.join(__dirname, 'public'), {
    etag: false,
    lastModified: false,
    setHeaders(res) {
        res.setHeader('Cache-Control', 'no-store');
    },
}));

// ── Бункер React SPA ─────────────────────────
const bunkerBuild = path.join(__dirname, 'public/bunker');
if (fs.existsSync(bunkerBuild)) {
    app.use('/bunker', express.static(bunkerBuild, { etag: false, setHeaders: res => res.setHeader('Cache-Control','no-store') }));
    // SPA fallback — будь-який /bunker/* повертає index.html
    app.get('/bunker/*', (req, res) => res.sendFile(path.join(bunkerBuild, 'index.html')));
} else {
    // У dev-режимі — редірект на Vite dev server
    app.get('/bunker*', (req, res) => res.redirect('http://localhost:5173' + req.path.replace('/bunker', '') + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '')));
}

// ── REST Auth API ─────────────────────────────
app.post('/api/register', async (req, res) => {
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

app.post('/api/login', async (req, res) => {
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
    Object.values(rooms).forEach(r => {
        const t = r.gameType || 'monopoly';
        counts[t] = (counts[t] || 0) + 1;
    });
    res.json(counts);
});

app.get('/api/me', async (req, res) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer '))
        return res.status(401).json({ error: 'Не авторизовано' });
    try {
        const payload = jwt.verify(auth.slice(7), JWT_SECRET);
        const stats   = await db.getStats(payload.username);
        res.json({ username: payload.username, stats });
    } catch {
        res.status(401).json({ error: 'Токен недійсний або прострочений' });
    }
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

// ── Дані дошки (дублюємо тут, бо Node не бачить browser-globals) ──
const BOARD = [
    { pos: 0,  type: 'corner',   name: 'СТАРТ',                   icon: '➡️', desc: 'Отримайте ₴200' },
    { pos: 1,  type: 'property', name: 'Сумська',      city: 'Полтава',    color: '#8B4513', price: 60,  rent: [2,10,30,90,160,250],          housePrice: 50  },
    { pos: 2,  type: 'card',     name: 'Шанс',                    icon: '❓', cardType: 'chance' },
    { pos: 3,  type: 'property', name: 'Полтавська',   city: 'Полтава',    color: '#8B4513', price: 60,  rent: [4,20,60,180,320,450],          housePrice: 50  },
    { pos: 4,  type: 'tax',      name: 'Податкова',               icon: '💰', amount: 200 },
    { pos: 5,  type: 'railway',  name: 'Львівська залізниця',      icon: '🚂', price: 200 },
    { pos: 6,  type: 'property', name: 'Хортиця',      city: 'Запоріжжя', color: '#FFD700', price: 100, rent: [6,30,90,270,400,550],          housePrice: 50  },
    { pos: 7,  type: 'card',     name: 'Екскурсія',               icon: '🗺️', cardType: 'excursion' },
    { pos: 8,  type: 'property', name: 'Дніпрогес',    city: 'Запоріжжя', color: '#FFD700', price: 100, rent: [6,30,90,270,400,550],          housePrice: 50  },
    { pos: 9,  type: 'property', name: 'Соборний пр.', city: 'Запоріжжя', color: '#FFD700', price: 120, rent: [8,40,100,300,450,600],         housePrice: 50  },
    { pos: 10, type: 'corner',   name: "В'ЯЗНИЦЯ",                icon: '🔒', desc: 'У гостях' },
    { pos: 11, type: 'property', name: 'Дерибасівська',city: 'Одеса',     color: '#FF69B4', price: 140, rent: [10,50,150,450,625,750],        housePrice: 100 },
    { pos: 12, type: 'utility',  name: 'Одеський порт',            icon: '⚓', price: 150 },
    { pos: 13, type: 'property', name: 'Молдованка',   city: 'Одеса',     color: '#FF69B4', price: 140, rent: [10,50,150,450,625,750],        housePrice: 100 },
    { pos: 14, type: 'property', name: 'Аркадія',      city: 'Одеса',     color: '#FF69B4', price: 160, rent: [12,60,180,500,700,900],        housePrice: 100 },
    { pos: 15, type: 'railway',  name: 'Південно-Західна залізниця', icon: '🚂', price: 200 },
    { pos: 16, type: 'property', name: 'Сумська',      city: 'Харків',    color: '#FFA500', price: 180, rent: [14,70,200,550,750,950],        housePrice: 100 },
    { pos: 17, type: 'card',     name: 'Шанс',                    icon: '❓', cardType: 'chance' },
    { pos: 18, type: 'property', name: 'Університетська',   city: 'Харків',    color: '#FFA500', price: 180, rent: [14,70,200,550,750,950],        housePrice: 100 },
    { pos: 19, type: 'property', name: 'Дзеркальний струмінь', city: 'Харків', color: '#FFA500', price: 200, rent: [16,80,220,600,800,1000],  housePrice: 100 },
    { pos: 20, type: 'casino',   name: 'КАЗИНО',                      icon: '🎰', desc: 'Спробуй удачу!' },
    { pos: 21, type: 'property', name: 'Соборна площа',city: 'Дніпро',    color: '#FF0000', price: 220, rent: [18,90,250,700,875,1050],       housePrice: 150 },
    { pos: 22, type: 'card',     name: 'Екскурсія',               icon: '🗺️', cardType: 'excursion' },
    { pos: 23, type: 'property', name: 'Вул. Січеславська', city: 'Дніпро', color: '#FF0000', price: 220, rent: [18,90,250,700,875,1050],     housePrice: 150 },
    { pos: 24, type: 'property', name: 'Набережна',    city: 'Дніпро',    color: '#FF0000', price: 240, rent: [20,100,300,750,925,1100],      housePrice: 150 },
    { pos: 25, type: 'railway',  name: 'Дніпровська залізниця',    icon: '🚂', price: 200 },
    { pos: 26, type: 'property', name: 'Площа Ринок',  city: 'Львів',     color: '#87CEEB', price: 260, rent: [22,110,330,800,975,1150],      housePrice: 150 },
    { pos: 27, type: 'property', name: 'Личаківська',  city: 'Львів',     color: '#87CEEB', price: 260, rent: [22,110,330,800,975,1150],      housePrice: 150 },
    { pos: 28, type: 'utility',  name: 'Маріупольський порт',      icon: '⚓', price: 150 },
    { pos: 29, type: 'property', name: 'Сихівська',    city: 'Львів',     color: '#87CEEB', price: 280, rent: [24,120,360,850,1025,1200],     housePrice: 150 },
    { pos: 30, type: 'corner',   name: "ІТИ ДО В'ЯЗНИЦІ",         icon: '👮', desc: 'У тюрму!' },
    { pos: 31, type: 'property', name: 'Андріївський узвіз', city: 'Київ', color: '#008000', price: 300, rent: [26,130,390,900,1100,1275],    housePrice: 200 },
    { pos: 32, type: 'property', name: 'Поділ',        city: 'Київ',      color: '#008000', price: 300, rent: [26,130,390,900,1100,1275],     housePrice: 200 },
    { pos: 33, type: 'card',     name: 'Шанс',                    icon: '❓', cardType: 'chance' },
    { pos: 34, type: 'property', name: 'Печерськ',     city: 'Київ',      color: '#008000', price: 320, rent: [28,150,450,1000,1200,1400],    housePrice: 200 },
    { pos: 35, type: 'railway',  name: 'Аеропорт Бориспіль',       icon: '✈️', price: 200 },
    { pos: 36, type: 'card',     name: 'Шанс',                    icon: '❓', cardType: 'chance' },
    { pos: 37, type: 'property', name: 'Хрещатик',    city: 'Київ',      color: '#00008B', price: 350, rent: [35,175,500,1100,1300,1500],    housePrice: 200 },
    { pos: 38, type: 'tax',      name: 'Розкішний податок',        icon: '💎', amount: 100 },
    { pos: 39, type: 'property', name: 'Майдан Незалежності', city: 'Київ', color: '#00008B', price: 400, rent: [50,200,600,1400,1700,2000], housePrice: 200 },
];

const TOKEN_COLORS = ['#FF4136','#0074D9','#2ECC40','#FFDC00','#B10DC9','#FF851B','#39CFFF','#85144b'];
const TOKEN_ICONS  = ['🎩','🚗','🐕','🚀','🐎','👑','⚓','🎯'];

// Картки шансу і екскурсій — всі тексти в public/games/monopoly/messages.js
// Податкові (pos 4, 38) і тюремні (pos 30) тексти — inline нижче (використовують ${player.name})
const { CHANCE_CARDS, EXCURSION_CARDS } = require('./public/games/monopoly/messages.js');
const {
    BUNKER_PROFESSIONS, BUNKER_HEALTH, BUNKER_HOBBIES,
    BUNKER_TRAITS, BUNKER_BAGGAGE, BUNKER_FACTS, BUNKER_ACTION_CARDS, ACTION_CARD_PHASES,
} = require('./public/games/bunker/attributes.js');
const { BUNKER_SCENARIOS } = require('./public/games/bunker/scenarios.js');

// ── Утиліти ──────────────────────────────────
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function generateCode() {
    const cities = ['KYIV', 'LVIV', 'ODESA', 'KHARKIV', 'DNIPRO', 'ZAPORIZHZHIA'];
    let code;
    do {
        code = cities[Math.floor(Math.random() * cities.length)] + '-' + (Math.floor(Math.random() * 9000) + 1000);
    } while (rooms[code]);
    return code;
}

// ── Ініціалізація стану гри ───────────────────
function createGameState(roomPlayers) {
    const players = roomPlayers.map((rp, i) => ({
        id: i,
        socketId: rp.socketId,
        name: rp.name,
        color: TOKEN_COLORS[i],
        icon: TOKEN_ICONS[i],
        money: 1500,
        position: 0,
        properties: [],
        inJail: false,
        jailTurns: 0,
        hasJailCard: false,
        bankrupt: false,
        loan: 0,
        loanInterest: 0,
        loanTurnsLeft: 0,
        stats: { rentPaid: 0, rentReceived: 0, housesBuilt: 0, hotelsBuilt: 0, taxesPaid: 0, cardsTotal: 0 },
    }));

    const cellState = {};
    BOARD.forEach(c => {
        if (c.type === 'property' || c.type === 'railway' || c.type === 'utility') {
            cellState[c.pos] = { owner: null, houses: 0, mortgaged: false };
        }
    });

    return {
        players,
        cellState,
        currentPlayerIndex: 0,
        lastDiceRoll: [0, 0],
        doublesCount: 0,
        hasRolled: false,
        chanceDeck: shuffle(CHANCE_CARDS.map((_, i) => i)),
        excursionDeck: shuffle(EXCURSION_CARDS.map((_, i) => i)),
        auctionState: null,
        pendingTrade: null,
        log: [],
        pendingAction: null,
        pendingData: null,
        turnDeadline: null,
        tradeDeadline: null,
    };
}

// ── Логування ─────────────────────────────────
function addLog(state, text, type = '') {
    state.log.unshift({ text, type, ts: Date.now() });
    if (state.log.length > 40) state.log.pop();
}

// ── Ігрова логіка ─────────────────────────────

// Викликається після будь-якого вимушеного списання (податок, картка, в'язниця).
// Якщо гравець у мінусі і немає активів — оголошує банкрутство банку.
// Повертає true якщо настало банкрутство.
function checkDebtCleared(state, player) {
    if (state.pendingAction === 'coverDebt' && player.money >= 0) {
        state.pendingAction = null;
        state.pendingData   = null;
        addLog(state, `✅ ${player.name} покрив(ла) борг — можна продовжувати`, 'success');
    }
}

function checkForcedDebt(state, player) {
    if (player.money >= 0) return false;
    const netWorth = calcNetWorth(state, player);
    if (netWorth <= 0) {
        // Нічого продати — одразу банкрут
        addLog(state, `💀 ${player.name} не може покрити борг і оголошує банкрутство!`, 'error');
        player.properties.forEach(pos => {
            state.cellState[pos].owner = null;
            state.cellState[pos].houses = 0;
            state.cellState[pos].mortgaged = false;
        });
        player.money = 0;
        player.bankrupt = true;
        player.properties = [];
        state.pendingAction = null;
        state.pendingData = null;
        return true;
    }
    // Є активи — вимагаємо покрити борг (можна продати будинки / заставити)
    const shortfall = -player.money;
    addLog(state, `⚠️ ${player.name} у мінусі ₴${shortfall} — продайте майно або оголосіть банкрутство`, 'error');
    state.pendingAction = 'coverDebt';
    state.pendingData = { shortfall };
    return false;
}

function calcNetWorth(state, player) {
    let total = player.money;
    player.properties.forEach(pos => {
        const c = BOARD[pos];
        const s = state.cellState[pos];
        total += s.mortgaged ? Math.floor(c.price / 2) : c.price;
        total += s.houses === 5 ? c.housePrice * 5 : s.houses * c.housePrice;
    });
    total -= (player.loan || 0) + (player.loanInterest || 0);
    return total;
}

function calculateRent(state, cell) {
    const s = state.cellState[cell.pos];
    const owner = state.players[s.owner];
    if (cell.type === 'property') {
        const group = BOARD.filter(b => b.type === 'property' && b.color === cell.color);
        const allSame = group.every(b => state.cellState[b.pos]?.owner === s.owner);
        let rent = cell.rent[s.houses];
        if (s.houses === 0 && allSame) rent *= 2;
        return rent;
    }
    if (cell.type === 'railway') {
        const owned = BOARD.filter(b => b.type === 'railway' && state.cellState[b.pos]?.owner === s.owner).length;
        return [0, 25, 50, 100, 200][owned];
    }
    if (cell.type === 'utility') {
        const owned = BOARD.filter(b => b.type === 'utility' && state.cellState[b.pos]?.owner === s.owner).length;
        const total = state.lastDiceRoll[0] + state.lastDiceRoll[1];
        return owned === 1 ? total * 4 : total * 10;
    }
    return 0;
}

function goToJail(state, player) {
    player.position = 10;
    player.inJail = true;
    player.jailTurns = 0;
    state.hasRolled = true;
    state.doublesCount = 0;
}

function moveTo(state, player, pos) {
    if (pos < player.position) {
        player.money += 200;
        addLog(state, `💰 ${player.name} пройшов(ла) через СТАРТ. +₴200`, 'success');
    }
    player.position = pos;
}

function drawCard(state, player, type) {
    let deck = type === 'chance' ? state.chanceDeck : state.excursionDeck;
    const cards = type === 'chance' ? CHANCE_CARDS : EXCURSION_CARDS;
    if (deck.length === 0) {
        deck = shuffle(cards.map((_, i) => i));
        if (type === 'chance') state.chanceDeck = deck;
        else state.excursionDeck = deck;
    }
    const idx = deck.shift();
    const card = cards[idx];
    player.stats.cardsTotal++;
    addLog(state, `🃏 ${player.name}: ${card.text}`, 'success');

    let nextEffect = null;

    switch (card.action) {
        case 'addMoney':    player.money += card.amount; break;
        case 'takeMoney':
            player.money -= card.amount;
            checkForcedDebt(state, player);
            break;
        case 'goToStart':   moveTo(state, player, 0); break; // +200 вже в moveTo (прохід через СТАРТ)
        case 'goToJail':    goToJail(state, player); break;
        case 'jailCard':    player.hasJailCard = true; break;
        case 'moveTo':
            moveTo(state, player, card.pos);
            nextEffect = handleLanding(state, player);
            break;
        case 'moveBack':
            player.position = (player.position - card.amount + 40) % 40;
            nextEffect = handleLanding(state, player);
            break;
        case 'payAll': {
            const alive = state.players.filter(p => !p.bankrupt && p.id !== player.id);
            alive.forEach(p => {
                const pay = Math.min(card.amount, Math.max(0, player.money));
                player.money -= pay;
                p.money += pay;
            });
            break;
        }
        case 'collectAll': {
            const alive = state.players.filter(p => !p.bankrupt && p.id !== player.id);
            alive.forEach(p => {
                const pay = Math.min(card.amount, Math.max(0, p.money));
                p.money -= pay;
                player.money += pay;
            });
            break;
        }
        case 'nearestRailway': {
            const railways = BOARD.filter(b => b.type === 'railway').map(b => b.pos);
            const next = railways.find(p => p > player.position) || railways[0];
            moveTo(state, player, next);
            nextEffect = handleLanding(state, player);
            break;
        }
    }

    return { event: 'cardDrawn', cardType: type, text: card.text, nextEffect };
}

function handleLanding(state, player) {
    const cell = BOARD[player.position];
    if (!cell) return null;

    if (cell.type === 'property' || cell.type === 'railway' || cell.type === 'utility') {
        const s = state.cellState[cell.pos];
        if (s.owner === null || s.owner === undefined) {
            state.pendingAction = 'offerPurchase';
            state.pendingData = { pos: cell.pos };
            return { event: 'offerPurchase', cell };
        } else if (s.owner !== player.id && !s.mortgaged) {
            const rent = calculateRent(state, cell);
            if (rent > 0) {
                state.pendingAction = 'payRent';
                state.pendingData = { pos: cell.pos, rent, ownerId: s.owner };
                return { event: 'payRent', rent, owner: state.players[s.owner], cell };
            }
        }
    } else if (cell.type === 'tax') {
        player.money -= cell.amount;
        player.stats.taxesPaid += cell.amount;
        checkForcedDebt(state, player);
        const taxReasons = cell.pos === 4 ? [
            `🍺 ${player.name} сплачує податок за розпиття пива «Опілля» на вулицях Львова без письмового погодження з міською радою. ₴${cell.amount}`,
            `🌿 Сусід поскаржився, що трава на подвір'ї у ${player.name} зеленіша, ніж у нього. Введено екстрений податок на надмірний оптимізм лужка. ₴${cell.amount}`,
            `🐈 У ${player.name} живе аж троє котів. Держава все порахувала. Це податок на надлишок пухнастого щастя. ₴${cell.amount}`,
            `☀️ Податкова помітила, що у ${player.name} надто гарний настрій як для ранку понеділка. Це підозріло. Сплатіть збір за приховування стресу. ₴${cell.amount}`,
            `🥣 ${player.name} їв(ла) вівсянку на сніданок замість патріотичної гречки. ДПС кваліфікує це як несанкціонований імпорт західної культури. ₴${cell.amount}`,
            `📸 ${player.name} зробив(ла) фото своєї кави в інстаграм перед тим, як випити. Податок на мікроінфлюенсерство. ₴${cell.amount}`,
            `🧦 ${player.name} носить різні шкарпетки. Митниця оцінила це як незаконне ввезення елементів авангардної моди. ₴${cell.amount}`,
            `🌧️ ${player.name} поскаржив(ла)ся на погоду в соцмережах. Нараховано екологічний збір за незадоволення кліматичною зоною. ₴${cell.amount}`,
            `🏋️ ${player.name} записав(ла)ся до спортзалу в січні й кинув(ла) у лютому. Штраф від ДПС за нереалізовані спортивні амбіції. ₴${cell.amount}`,
            `🐕 Собака ${player.name} гавкав на перехожих о 6 ранку. Сусіди об'єднались у кооператив і виставили колективний позов. ₴${cell.amount}`,
            `📝 ${player.name} надіслав(ла) листівку Азарову на день народження «суто заради іронії». ДПС ретельно вивчила ваші зв'язки. ₴${cell.amount}`,
            `🍯 ${player.name} відмовив(ла)ся від фірмового меду і замовив(ла) штучний сироп. Спілка пасічників зафіксувала бджолину зраду. ₴${cell.amount}`,
            `🪅 ${player.name} купив(ла) на барахолці матрьошку «для приколу». Митники не зрозуміли тонкого постмодернізму. Штраф. ₴${cell.amount}`,
            `🗣️ ${player.name} спробував(ла) відтворити «азарівку» для сміху на камеру. Відео потрапило в інтернет, тепер це офіційний доказ філологічного злочину. ₴${cell.amount}`,
            `🏚️ ${player.name} назвав(ла) Межигір'я «звичайною дачею». Гільдія оцінювачів нерухомості вимагає компенсацію за образу елітного майна. ₴${cell.amount}`,
        ] : [
            `👟 ${player.name} придбав(ла) п'яту пару кросівок за цей місяць. Розкішне життя саме себе не оподаткує. ₴${cell.amount}`,
            `✈️ ${player.name} летів(ла) лоукостером і посмів(ла) попросити у бортпровідника склянку води без газу. Розкіш зафіксовано. Сплатіть ₴${cell.amount}`,
            `🧴 ${player.name} купив(ла) крем для обличчя, який коштує дорожче, ніж середня пенсія. Миттєвий податок на гламур. ₴${cell.amount}`,
            `🍾 На вечірці у ${player.name} відкоркували шампанське у неділю ще до 18:00. Пряме порушення кодексу скромності. ₴${cell.amount}`,
            `🚗 ${player.name} помив(ла) машину на дорогій мийці, а за годину пішов злива. Карма і податкова інспекція діють спільно. ₴${cell.amount}`,
            `🛴 ${player.name} орендував(ла) електросамокат на цілу годину і весь день розповідав(ла) про це друзям. Збір за хвастощі. ₴${cell.amount}`,
            `🥩 ${player.name} замовив(ла) стейк прожарки medium rare і прочитав(ла) офіціанту лекцію про мармуровість яловичини. Штраф за гастрономічний снобізм. ₴${cell.amount}`,
            `🎲 ${player.name} грав(ла) у настільні ігри з преміальними дерев'яними фішками. Розкішний збір від заздрісних суперників. ₴${cell.amount}`,
            `👜 ${player.name} купив(ла) брендову паперову сумочку і носить у ній судочки з обідом на роботу. Податок на недоречний шик. ₴${cell.amount}`,
            `🍜 ${player.name} їв(ла) мівіну елітними китайськими паличками, хоча виделка лежала поруч. Претензії від лобі виробників столових приборів. ₴${cell.amount}`,
            `🍯 ${player.name} замовив(ла) цілу бочку крафтового меду і підписав(ла) платіж як «інвестиція в розвиток бджіл». Податкова не погодилась. ₴${cell.amount}`,
            `💇 ${player.name} найняв(ла) стиліста, щоб зробити зачіску «як у Юлі». Майстер взяв потрійний тариф, але коса розплелася ще в таксі. ₴${cell.amount}`,
            `🎵 ${player.name} заборонив(ла) на святі вмикати треки російських виконавців. Ді-джей узяв націнку за роботу в умовах суворої цензури. ₴${cell.amount}`,
            `🖼️ ${player.name} купив(ла) картину сучасного художника, а той через тиждень виявився затятим колаборантом. Репутаційні втрати. ₴${cell.amount}`,
            `🎤 ${player.name} пішов(ла) на концерт зірки 90-х, яка, як виявилося, досі таємно сумує за СРСР. Штраф за погану перевірку бекграунду. ₴${cell.amount}`,
        ];
        const taxReason = taxReasons[Math.floor(Math.random() * taxReasons.length)];
        addLog(state, `💸 ${taxReason}`, 'warn');
        return { event: 'tax', amount: cell.amount, cellPos: cell.pos, reason: taxReason };
    } else if (cell.type === 'card') {
        return drawCard(state, player, cell.cardType);
    } else if (cell.pos === 30) {
        const jailReasons = [
            `🎵 ${player.name} спіймали на публічному прослуховуванні російського репу без навушників. До В'ЯЗНИЦІ!`,
            `🗣️ У центрі Львова хтось почув, як ${player.name} ностальгує за «стабільністю» часів Януковича. Пакуйте речі, В'ЯЗНИЦЯ чекає!`,
            `🪆 На митниці у ${player.name} в чемодані знайшли три розписні матрьошки. Пояснення «це на подарунок тещі» не спрацювало. В'ЯЗНИЦЯ!`,
            `📺 ${player.name} дивив(ла)ся нишком заборонені серіали через VPN замість вітчизняного контенту. Порушення кібербезпеки. До В'ЯЗНИЦІ!`,
            `🥟 ${player.name} назвав(ла) справжні українські вареники пельменями. Ображені кухарі написали заяву. В'ЯЗНИЦЯ!`,
            `🌊 ${player.name} публічно запевнив(ла), що Крим — «це просто шматок землі». Порушення географічної та державної логіки. Вирушайте до В'ЯЗНИЦІ!`,
            `🚗 ${player.name} припаркував(ла) свій елітний кросовер на місці для людей з інвалідністю біля супермаркету «на одну секундочку». Справедливість є — В'ЯЗНИЦЯ!`,
            `📱 ${player.name} надіслав(ла) в месенджері голосове повідомлення тривалістю 12 хвилин замість тексту. Суспільство не пробачає таких злочинів. В'ЯЗНИЦЯ!`,
            `🐱 ${player.name} пройшов(ла) повз дворового кота і навіть не спробував(ла) його погладити. Кіт звернувся до органів. В'ЯЗНИЦЯ!`,
            `🧂 ${player.name} густо посолив(ла) та поперчив(ла) борщ ще до того, як спробував(ла) першу ложку. Мама чи господиня таке не пробачає. До В'ЯЗНИЦІ!`,
            `🫖 ${player.name} заварив(ла) пакетик чаю в мікрохвильовці. Британське посольство висловило офіційний протест. В'ЯЗНИЦЯ!`,
            `🤳 ${player.name} намагався(лась) залізти на пам'ятник архітектури заради невдалого відео в ТікТок. Культурна поліція на місці. До В'ЯЗНИЦІ!`,
            `🌭 ${player.name} назвав(ла) розігріту сосиску в тісті з найближчого кіоску «романтичною вечерею». Родичі вимагають ізоляції. В'ЯЗНИЦЯ!`,
            `🦟 ${player.name} увімкнув(ла) фумігатор, але так і не вбив(ла) того єдиного комара, який дзижчав над вухом усім гостям. Колегіальне рішення — до В'ЯЗНИЦІ!`,
            `🎸 ${player.name} стверджував(ла), що Скрябін — це псевдонім одного співака, і нічого не знав про рок-гурт. Справжні фанати викликали конвой. В'ЯЗНИЦЯ!`,
            `🗣️ ${player.name} спробував(ла) процитувати Азарова під час захисту диплому з філології. Комісія знепритомніла. До В'ЯЗНИЦІ!`,
            `🏆 ${player.name} заявив(ла), що втеклий президент був «непоганим міцним господарником». Активісти Майдану почули це здалека. До В'ЯЗНИЦІ!`,
            `🍯 ${player.name} відмовився(лась) купувати фірмовий мед, бо «і так занадто солодко живе». Пасічники сприйняли це як особисту образу бренду. В'ЯЗНИЦЯ!`,
            `💇 ${player.name} назвав(ла) класичну косу навколо голови «застарілим елементом іміджу». Коса подала позов за дискредитацію стилю. До В'ЯЗНИЦІ!`,
            `📝 ${player.name} написав(ла) прізвище «Азаров» у кросворді в графі «видатний український мовознавець». Гумор не оцінено. В'ЯЗНИЦЯ!`,
            `📺 ${player.name} сказав(ла) «та не всі вони там погані» під час чергового увімкнення повітряної тривоги. Неймовірно невдалий таймінг. В'ЯЗНИЦЯ!`,
            `🎵 ${player.name} увімкнув(ла) трек виконавця, який підтримав війну, виправдовуючи це тим, що «музика поза політикою». Гості викликали поліцію. До В'ЯЗНИЦІ!`,
            `🦅 ${player.name} намалював(ла) на паркані дивні символи, які випадково нагадали ворожі знаки. Слідство триває, а поки що — В'ЯЗНИЦЯ!`,
            `🌻 ${player.name} взявся(лась) захищати експрем'єра: «Ну він хоча б щиро намагався вивчити мову!». Ні, не намагався. До В'ЯЗНИЦІ!`,
            `🥊 ${player.name} сказав(ла), що у Януковича був «багатий смак», маючи на увазі інтер'єри з позолотою. Суд розцінив це як пропаганду несмаку. До В'ЯЗНИЦІ!`,
        ];
        const jailReason = jailReasons[Math.floor(Math.random() * jailReasons.length)];
        goToJail(state, player);
        addLog(state, `👮 ${jailReason}`, 'warn');
        return { event: 'goToJail', reason: jailReason };
    } else if (cell.type === 'casino') {
        addLog(state, `🎰 ${player.name} зайшов(ла) до КАЗИНО — зроби ставку!`);
        state.pendingAction = 'casino';
        state.pendingData = { pos: 20 };
        return { event: 'casino', playerMoney: player.money };
    }
    return null;
}

function nextPlayer(state) {
    // Очищаємо будь-яку незавершену дію попереднього гравця
    // (наприклад, казино яке обійшли через прямий endTurn до фіксу)
    state.pendingAction = null;
    state.pendingData   = null;

    // зменшуємо лічильник кредиту поточного гравця
    const cur = state.players[state.currentPlayerIndex];
    if (cur.loan > 0 && cur.loanTurnsLeft > 0) cur.loanTurnsLeft--;

    state.doublesCount = 0;
    state.hasRolled = false;
    const totalPlayers = state.players.length;
    let steps = 0;
    do {
        state.currentPlayerIndex = (state.currentPlayerIndex + 1) % totalPlayers;
        if (++steps > totalPlayers) return null; // всі банкрути — гра вже завершена
    } while (state.players[state.currentPlayerIndex].bankrupt);

    // перевіряємо кредит нового гравця
    const next = state.players[state.currentPlayerIndex];

    // Jail перевіряємо першим — гравець у в'язниці може мати кредит, але основна дія — вийти
    if (next.inJail) return { event: 'inJail', player: next };

    if (next.loan > 0) {
        if (next.loanTurnsLeft === 1) return { event: 'loanWarning', player: next };
        if (next.loanTurnsLeft <= 0) {
            const total = next.loan + next.loanInterest;
            if (next.money >= total) {
                // Є готівка — списуємо автоматично
                next.money -= total;
                next.loan = 0; next.loanInterest = 0; next.loanTurnsLeft = 0;
                addLog(state, `🏦 Банк автоматично списав борг ₴${total} з ${next.name}`, 'warn');
            } else {
                // Готівки немає — примусово списуємо (гравець іде в мінус)
                next.money -= total;
                next.loan = 0; next.loanInterest = 0; next.loanTurnsLeft = 0;
                addLog(state, `🏦 Банк примусово списав кредит ₴${total} — ${next.name} у мінусі!`, 'error');
                const netWorth = calcNetWorth(state, next);
                if (netWorth <= 0) {
                    // Навіть активів не вистачає → авто-банкрутство
                    addLog(state, `💀 ${next.name} нічим покрити борг — банкрутство!`, 'error');
                    next.properties.forEach(pos => {
                        state.cellState[pos].owner = null;
                        state.cellState[pos].houses = 0;
                        state.cellState[pos].mortgaged = false;
                    });
                    next.money = 0; next.bankrupt = true; next.properties = [];
                    return nextPlayer(state); // пропускаємо банкрута
                }
                // Є активи — вимагаємо продати
                state.pendingAction = 'coverDebt';
                state.pendingData   = { shortfall: -next.money };
                return { event: 'loanDeadline', player: next };
            }
        }
    }
    return null;
}

function awardAuction(state, a) {
    const winner = state.players[a.currentBidder];
    if (winner.money < a.currentBid) {
        // Переможець не може сплатити — аукціон анулюється
        addLog(state, `💀 ${winner.name} не може сплатити аукціон ₴${a.currentBid} — скасовано`, 'error');
        state.auctionState = null;
        return;
    }
    winner.money -= a.currentBid;
    state.cellState[a.cell.pos].owner = a.currentBidder;
    winner.properties.push(a.cell.pos);
    addLog(state, `🔨 ${winner.name} виграв(ла) аукціон "${a.cell.name}" за ₴${a.currentBid}`, 'success');
    state.auctionState = null;
}

// ── Обробка дій від клієнта ───────────────────
function processAction(state, type, data, room) {
    const player = state.players[state.currentPlayerIndex];
    let sideEffect = null;

    switch (type) {

        case 'rollDice': {
            if (state.hasRolled) break;
            const d1 = Math.floor(Math.random() * 6) + 1;
            const d2 = Math.floor(Math.random() * 6) + 1;
            state.lastDiceRoll = [d1, d2];
            const isDouble = d1 === d2;
            if (isDouble) state.doublesCount++;
            else state.doublesCount = 0;

            addLog(state, `🎲 ${player.name} кинув(ла) ${d1}+${d2}=${d1+d2}${isDouble ? ' (дубль!)' : ''}`, '');

            if (player.inJail) {
                if (isDouble) {
                    player.inJail = false;
                    player.jailTurns = 0;
                    // Дубль з в'язниці не дає повторного ходу — це хід виходу
                    state.doublesCount = 0;
                    state.hasRolled = true;
                    addLog(state, `🔓 ${player.name} вийшов(ла) з В'язниці дублем!`, 'success');
                } else {
                    player.jailTurns++;
                    if (player.jailTurns >= 3) {
                        player.money -= 50;
                        player.inJail = false;
                        addLog(state, `💸 ${player.name} сплатив(ла) ₴50 і вийшов(ла) з В'язниці`, 'warn');
                        checkForcedDebt(state, player);
                    } else {
                        state.hasRolled = true;
                        addLog(state, `🔒 ${player.name} залишається у В'язниці (хід ${player.jailTurns}/3)`, 'warn');
                        break;
                    }
                }
            }

            if (state.doublesCount >= 3) {
                addLog(state, `👮 Три дублі поспіль — ${player.name} до В'ЯЗНИЦІ!`, 'warn');
                goToJail(state, player);
                break;
            }

            if (!isDouble) state.hasRolled = true;

            player.position = (player.position + d1 + d2) % 40;
            if (player.position < (player.position - d1 - d2 + 40) % 40 || (player.position === 0)) {
                // passed start — handled in moveTo; simpler check:
            }
            // check passing start
            const prevPos = ((player.position - d1 - d2) % 40 + 40) % 40;
            if (prevPos + d1 + d2 >= 40) {
                player.money += 200;
                addLog(state, `💰 ${player.name} пройшов(ла) через СТАРТ. +₴200`, 'success');
            }

            const landingPos = player.position; // позиція до обробки ефектів (В'язниця змінює на 10)
            addLog(state, `📍 ${player.name} зупинив(ла)ся на: ${BOARD[landingPos].name}`);
            sideEffect = handleLanding(state, player);
            if (sideEffect) sideEffect.landingPos = landingPos; // куди фізично потрапив токен
            break;
        }

        case 'buyProperty': {
            const { pos } = state.pendingData || {};
            const cell = BOARD[pos];
            if (!cell || state.cellState[pos].owner !== null) break;
            if (player.money < cell.price) break; // недостатньо коштів
            player.money -= cell.price;
            state.cellState[pos].owner = player.id;
            player.properties.push(pos);
            addLog(state, `🏆 ${player.name} придбав(ла) "${cell.name}" за ₴${cell.price}`, 'success');
            state._toast = { text: `🏠 ${player.name} купив ${cell.name} за ₴${cell.price}`, color: '#2e7d32' };
            state.pendingAction = null;
            state.pendingData = null;
            break;
        }

        case 'startAuction': {
            const { pos } = state.pendingData || {};
            const cell = BOARD[pos];
            // Учасники в порядку ходів — починаємо від НАСТУПНОГО після того хто відмовився
            const n = state.players.length;
            const eligible = [];
            for (let i = 1; i < n; i++) {
                const p = state.players[(state.currentPlayerIndex + i) % n];
                if (!p.bankrupt) eligible.push(p.id);
            }
            if (eligible.length < 1) { addLog(state, 'Немає учасників для аукціону', 'warn'); break; }
            state.auctionState = {
                cell,
                currentBid: Math.floor(cell.price / 2),
                currentBidder: null,
                active: eligible,
                turnIdx: 0,
                declinerId: player.id,
            };
            state.pendingAction = null;
            state.pendingData = null;
            addLog(state, `🔨 Аукціон на "${cell.name}" (старт ₴${state.auctionState.currentBid})`, 'warn');
            sideEffect = { event: 'auctionStarted' };
            break;
        }

        case 'auctionBid': {
            const a = state.auctionState;
            if (!a) break;
            const bidderId = a.active[a.turnIdx % a.active.length];
            const bidder = state.players[bidderId];
            const { bid } = data;
            if (bid < a.currentBid + 1 || bid > bidder.money) break;
            a.currentBid = bid;
            a.currentBidder = bidderId;
            a.turnIdx++;
            addLog(state, `💰 ${bidder.name} ставить ₴${bid}`);
            // Якщо ставник єдиний в active (решта вже пасували) — він виграє
            if (a.active.length === 1) {
                awardAuction(state, a);
            } else {
                sideEffect = { event: 'auctionUpdated' };
            }
            break;
        }

        case 'auctionPass': {
            const a = state.auctionState;
            if (!a) break;
            const bidderId = a.active[a.turnIdx % a.active.length];
            const bidder = state.players[bidderId];
            addLog(state, `⏭️ ${bidder.name} пасує`, 'warn');
            a.active = a.active.filter(id => id !== bidderId);

            if (a.active.length === 0) {
                addLog(state, 'Аукціон завершився без покупця', 'warn');
                state.auctionState = null;
            } else if (a.active.length === 1) {
                // Єдиний учасник — виграє навіть якщо не робив ставку (стартова ціна)
                if (a.currentBidder === null) a.currentBidder = a.active[0];
                awardAuction(state, a);
            } else {
                if (a.turnIdx >= a.active.length) a.turnIdx %= a.active.length;
                sideEffect = { event: 'auctionUpdated' };
            }
            break;
        }

        case 'payRent': {
            const { rent, ownerId } = state.pendingData || {};
            const owner = state.players[ownerId];
            if (player.money < rent) break;
            player.money -= rent;
            owner.money += rent;
            player.stats.rentPaid += rent;
            owner.stats.rentReceived += rent;
            addLog(state, `💰 ${player.name} сплатив(ла) оренду ₴${rent} → ${owner.name}`, 'warn');
            state._toast = { text: `💸 ${player.name} сплатив(ла) ₴${rent} → ${owner.name}`, color: '#1565c0' };
            state.pendingAction = null;
            state.pendingData = null;
            break;
        }

        case 'declareBankrupt': {
            const creditorId = state.pendingData?.ownerId ?? null;
            const creditor = creditorId !== null ? state.players[creditorId] : null;
            addLog(state, `💀 ${player.name} оголосив(ла) банкрутство!`, 'error');
            if (creditor) {
                creditor.money += player.money;
                player.properties.forEach(pos => {
                    state.cellState[pos].owner = creditor.id;
                    state.cellState[pos].houses = 0; // скидаємо будинки при передачі
                    creditor.properties.push(pos);
                });
            } else {
                player.properties.forEach(pos => {
                    state.cellState[pos].owner = null;
                    state.cellState[pos].houses = 0;
                    state.cellState[pos].mortgaged = false;
                });
            }
            player.money = 0;
            player.bankrupt = true;
            player.properties = [];
            state.pendingAction = null;
            state.pendingData = null;
            // Одразу передаємо хід — інакше currentPlayerIndex лишається на банкруті
            sideEffect = nextPlayer(state);
            break;
        }

        case 'buildHouse': {
            const { pos } = data;
            const cell = BOARD[pos];
            const s = state.cellState[pos];
            if (!s || s.owner !== player.id) break;
            if (s.houses >= 5 || player.money < cell.housePrice) break;
            const group = BOARD.filter(b => b.type === 'property' && b.color === cell.color);
            const allOwned = group.every(b => state.cellState[b.pos].owner === player.id && !state.cellState[b.pos].mortgaged);
            const minH = Math.min(...group.map(b => state.cellState[b.pos].houses));
            if (!allOwned || s.houses !== minH) break;
            player.money -= cell.housePrice;
            s.houses++;
            if (s.houses === 5) player.stats.hotelsBuilt++;
            else player.stats.housesBuilt++;
            addLog(state, `🏠 ${player.name} збудував(ла) ${s.houses === 5 ? 'готель' : 'будинок'} на "${cell.name}"`, 'success');
            break;
        }

        case 'sellHouse': {
            const { pos } = data;
            const cell = BOARD[pos];
            const s = state.cellState[pos];
            if (!s || s.owner !== player.id) break;
            if (s.houses === 0) break;
            const group = BOARD.filter(b => b.type === 'property' && b.color === cell.color);
            const maxH = Math.max(...group.map(b => state.cellState[b.pos].houses));
            if (s.houses !== maxH) break;
            s.houses--;
            player.money += Math.floor(cell.housePrice * 0.9);
            addLog(state, `🔻 ${player.name} продав(ла) будинок на "${cell.name}"`, 'success');
            checkDebtCleared(state, player);
            break;
        }

        case 'mortgage': {
            const { pos } = data;
            const cell = BOARD[pos];
            const s = state.cellState[pos];
            if (!s || s.owner !== player.id) break;
            if (s.mortgaged || s.houses > 0) break;
            s.mortgaged = true;
            player.money += Math.floor(cell.price / 2);
            addLog(state, `🏷️ ${player.name} заставив(ла) "${cell.name}"`, 'warn');
            checkDebtCleared(state, player);
            break;
        }

        case 'redeem': {
            const { pos } = data;
            const cell = BOARD[pos];
            const s = state.cellState[pos];
            if (!s || s.owner !== player.id) break;
            const cost = Math.ceil(Math.floor(cell.price / 2) * 1.1);
            if (!s.mortgaged || player.money < cost) break;
            s.mortgaged = false;
            player.money -= cost;
            addLog(state, `💸 ${player.name} викупив(ла) "${cell.name}" за ₴${cost}`, 'success');
            break;
        }

        case 'takeLoan': {
            const { amount } = data;
            if (player.loan > 0) break; // спочатку погаси діючий кредит
            const maxLoan = player.properties.reduce((acc, pos) => {
                return acc + (!state.cellState[pos].mortgaged ? Math.floor(BOARD[pos].price / 2) : 0);
            }, 0);
            if (maxLoan < 50) break; // без майна — кредит недоступний
            if (amount < 50 || amount > maxLoan) break;
            player.money += amount;
            player.loan += amount;
            player.loanInterest += Math.ceil(amount * 0.1);
            if (!player.loanTurnsLeft || player.loanTurnsLeft <= 0) player.loanTurnsLeft = 10;
            addLog(state, `🏦 ${player.name} взяв ₴${amount} кредиту (повернути за 10 ходів)`, 'success');
            break;
        }

        case 'repayLoan': {
            const total = player.loan + player.loanInterest;
            if (player.money < total) break;
            player.money -= total;
            player.loan = 0;
            player.loanInterest = 0;
            player.loanTurnsLeft = 0;
            addLog(state, `✅ ${player.name} повернув(ла) кредит ₴${total}`, 'success');
            break;
        }

        case 'jailPay': {
            if (player.money < 50) break;
            player.money -= 50;
            player.inJail = false;
            addLog(state, `💸 ${player.name} сплатив(ла) ₴50 і вийшов(ла) з В'язниці`, 'success');
            break;
        }

        case 'jailCard': {
            if (!player.hasJailCard || !player.inJail) break;
            player.hasJailCard = false;
            player.inJail = false;
            player.jailTurns = 0;
            addLog(state, `🔓 ${player.name} використав картку виходу з В'язниці`, 'success');
            break;
        }

        case 'casinoBet': {
            if (state.pendingAction !== 'casino') break;
            const bet = parseInt(data.amount) || 0;
            if (bet < 50 || bet > player.money) break;

            const d1 = Math.floor(Math.random() * 6) + 1;
            const d2 = Math.floor(Math.random() * 6) + 1;
            const sum = d1 + d2;
            const isDouble = d1 === d2;

            let result, delta;
            if (isDouble) {
                // Дубль → виграш 3x ставки
                delta  = bet * 3;
                result = `🎉 ДУБЛЬ ${d1}+${d2}! Виграш ×3 → +₴${delta}`;
                player.money += delta;
            } else if (sum >= 8) {
                // Сума ≥ 8 → виграш 2x ставки
                delta  = bet * 2;
                result = `✅ ${d1}+${d2}=${sum} — виграш ×2 → +₴${delta}`;
                player.money += delta;
            } else {
                // Сума ≤ 7 → програш
                delta  = -bet;
                result = `❌ ${d1}+${d2}=${sum} — програш → -₴${bet}`;
                player.money -= bet;
            }

            addLog(state, `🎰 ${player.name}: ставка ₴${bet}. ${result}`, isDouble ? 'success' : sum >= 8 ? 'success' : 'warn');
            state._toast = { text: `🎰 ${result}`, color: isDouble ? '#2e7d32' : sum >= 8 ? '#1565c0' : '#c62828' };
            state.pendingAction = null;
            state.pendingData = null;
            sideEffect = { event: 'casinoResult', d1, d2, sum, isDouble, bet, delta, result };
            break;
        }

        case 'casinoSkip': {
            if (state.pendingAction !== 'casino') break;
            addLog(state, `🎰 ${player.name} пройшов(ла) мимо казино`);
            state.pendingAction = null;
            state.pendingData = null;
            break;
        }

        case 'endTurn': {
            if (!state.hasRolled) break;
            if (state.pendingAction) break; // не можна завершити хід з невирішеною дією (оренда, казино, купівля)
            sideEffect = nextPlayer(state);
            break;
        }

        case 'offerTrade': {
            const { toIdx, offerMoney = 0, offerProps = [], requestMoney = 0, requestProps = [] } = data;
            if (toIdx < 0 || toIdx >= state.players.length) break;
            const to = state.players[toIdx];
            if (!to || to.bankrupt || toIdx === state.currentPlayerIndex) break;
            if (offerMoney > player.money || requestMoney > to.money) break;
            if (offerProps.some(pos => !player.properties.includes(pos))) break;
            if (requestProps.some(pos => !to.properties.includes(pos))) break;
            state.pendingTrade = { fromIdx: state.currentPlayerIndex, toIdx, offerMoney, offerProps, requestMoney, requestProps };
            addLog(state, `🤝 ${player.name} пропонує угоду до ${to.name}`);
            sideEffect = { event: 'tradeOffer', trade: state.pendingTrade };
            break;
        }

        case 'acceptTrade': {
            const trade = state.pendingTrade;
            if (!trade || data.callerIdx !== trade.toIdx) break;
            const from = state.players[trade.fromIdx];
            const to   = state.players[trade.toIdx];
            // Повторна перевірка: баланс міг змінитись між offerTrade і acceptTrade
            if (from.money < trade.offerMoney || to.money < trade.requestMoney) {
                addLog(state, `❌ Угоду скасовано — умови більше не діють (недостатньо коштів)`, 'error');
                state.pendingTrade = null;
                break;
            }
            from.money -= trade.offerMoney;  to.money   += trade.offerMoney;
            from.money += trade.requestMoney; to.money  -= trade.requestMoney;
            for (const pos of trade.offerProps) {
                from.properties = from.properties.filter(p => p !== pos);
                to.properties.push(pos);
                state.cellState[pos].owner = trade.toIdx;
            }
            for (const pos of trade.requestProps) {
                to.properties = to.properties.filter(p => p !== pos);
                from.properties.push(pos);
                state.cellState[pos].owner = trade.fromIdx;
            }
            addLog(state, `✅ ${from.name} і ${to.name} уклали угоду!`, 'success');
            state._toast = { text: `🤝 ${from.name} і ${to.name} обмінялись!`, color: '#1565c0' };
            state.pendingTrade = null;
            break;
        }

        case 'rejectTrade': {
            const trade = state.pendingTrade;
            if (!trade || data.callerIdx !== trade.toIdx) break;
            const from = state.players[trade.fromIdx];
            const to   = state.players[trade.toIdx];
            addLog(state, `❌ ${to.name} відхилив угоду від ${from.name}`, 'warn');
            state._toast = { text: `❌ ${to.name} відхилив угоду від ${from.name}`, color: '#c62828' };
            state.pendingTrade = null;
            break;
        }
    }

    return sideEffect;
}

// ════════════════════════════════════════════
// ТИСЯЧА — карткова гра
// ════════════════════════════════════════════
const T_SUITS   = ['♠','♣','♦','♥'];
const T_RANKS   = ['9','J','Q','K','10','A'];
const T_POINTS  = {'9':0,'J':2,'Q':3,'K':4,'10':10,'A':11};
const T_MARRIAGE= {'♠':40,'♣':60,'♦':80,'♥':100};
const T_RANK_ORD= ['9','J','Q','K','10','A'];

function tSuit(c) { return c.slice(-1); }
function tRank(c) { return c.slice(0,-1); }
function tPts(c)  { return T_POINTS[tRank(c)] || 0; }
function tRankN(c){ return T_RANK_ORD.indexOf(tRank(c)); }

function createTDeck() {
    return shuffle(T_SUITS.flatMap(s => T_RANKS.map(r => `${r}${s}`)));
}

function createTysyachaState(roomPlayers) {
    const n = roomPlayers.length;
    const cpp = n === 2 ? 10 : 7; // cards per player
    const deck = createTDeck();
    return {
        gameType: 'tysyacha',
        players: roomPlayers.map((rp, i) => ({
            id: i, name: rp.name,
            score: 0, hand: deck.slice(i*cpp, (i+1)*cpp), trickPts: 0,
            onBarrel: false, barrelAttempts: 0,
        })),
        talon: deck.slice(cpp*n),
        dealer: 0, round: 1,
        phase: 'auction',
        currentPlayer: 1 % n,
        auction: { current: 100, passed: Array(n).fill(false), winner: null },
        trick: { cards: [], leader: 1 % n },
        trump: null, declaredBid: null,
        marriages: {}, givenCards: [],
        talonPiles: null,      // 2-player: [[c,c],[c,c]] до вибору
        leftoverPile: null,    // 2-player: нерозкрита стопка
        lastTrickWinner: null, // хто взяв останню взятку
        log: [], winner: null,
    };
}

function tAssignTalon(state, w) {
    if (state.players.length === 2) {
        // 2 гравці: розбиваємо на 2 стопки по 2 карти для вибору
        state.talonPiles = [state.talon.slice(0, 2), state.talon.slice(2, 4)];
    } else {
        // 3 гравці: переможець одразу бере всі 3 карти
        state.players[w].hand.push(...state.talon);
    }
    state.talon = [];
    state.phase = 'talon';
    state.currentPlayer = w;
}

function processTysyachaAction(state, type, data, pidx) {
    const player = state.players[pidx];
    const n = state.players.length;

    switch (type) {
        case 'tBid': {
            if (state.phase !== 'auction' || pidx !== state.currentPlayer) break;
            if (data.pass) {
                if (player.onBarrel) break; // на бочці — не можна пасувати
                state.auction.passed[pidx] = true;
                state.log.unshift(`${player.name}: пас`);
            } else {
                const amt = parseInt(data.amount) || 0;
                if (amt <= state.auction.current || amt % 10 !== 0 || amt > 840) break;
                state.auction.current = amt;
                state.log.unshift(`${player.name}: ${amt}`);
            }
            const active = state.players.map((_,i)=>i).filter(i => !state.auction.passed[i]);
            if (active.length === 0) {
                // Всі спасували — примусово перший гравець бере тялон
                const w = (state.dealer + 1) % n;
                state.auction.passed = Array(n).fill(false);
                state.auction.winner = w;
                state.log.unshift(`⚠️ Всі спасували — ${state.players[w].name} бере за ${state.auction.current}`);
                tAssignTalon(state, w);
            } else if (active.length === 1) {
                const w = active[0];
                state.auction.winner = w;
                state.log.unshift(`🏆 ${state.players[w].name} виграє торги (${state.auction.current})`);
                tAssignTalon(state, w);
            } else {
                let next = (pidx + 1) % n;
                while (state.auction.passed[next]) next = (next + 1) % n;
                state.currentPlayer = next;
            }
            break;
        }

        case 'tChoosePile': {
            if (state.phase !== 'talon' || !state.talonPiles || pidx !== state.auction.winner) break;
            const { pileIdx } = data;
            if (pileIdx !== 0 && pileIdx !== 1) break;
            player.hand.push(...state.talonPiles[pileIdx]);
            state.leftoverPile = state.talonPiles[1 - pileIdx];
            state.talonPiles = null;
            addLog(state, `${player.name} обирає прикуп`);
            break;
        }

        case 'tGiveCard': {
            if (state.phase !== 'talon' || pidx !== state.auction.winner) break;
            if (state.talonPiles) break; // 2-player: спочатку треба вибрати стопку
            const { card, toPlayer } = data;
            if (toPlayer === pidx || toPlayer < 0 || toPlayer >= n) break;
            // Не можна дати двічі одному гравцю
            if (state.givenCards.filter(g => g === toPlayer).length >= 1) break;
            const idx = player.hand.indexOf(card);
            if (idx === -1) break;
            player.hand.splice(idx, 1);
            state.players[toPlayer].hand.push(card);
            state.givenCards.push(toPlayer);
            // Перевіряємо чи всі отримали по 1 картці
            const opponents = state.players.map((_,i)=>i).filter(i=>i!==pidx);
            const allReceived = opponents.every(i => state.givenCards.filter(g=>g===i).length >= 1);
            if (allReceived) {
                if (!state.declaredBid) state.declaredBid = state.auction.current;
                state.phase = 'playing';
                state.currentPlayer = state.auction.winner;
                state.trick.leader = state.auction.winner;
                state.log.unshift(`📢 ${state.players[state.auction.winner].name} грає на ${state.declaredBid}`);
            }
            break;
        }

        case 'tPlayCard': {
            if (state.phase !== 'playing' || pidx !== state.currentPlayer) break;
            const { card, marriage } = data;
            const hidx = player.hand.indexOf(card);
            if (hidx === -1) break;
            const trick = state.trick;

            // Валідація: масть (козир необов'язковий)
            if (trick.cards.length > 0) {
                const leadSuit = tSuit(trick.cards[0].card);
                const cardSuit = tSuit(card);
                const hasSuit  = player.hand.some(c => tSuit(c) === leadSuit);
                // Є масть — грай масть
                if (cardSuit !== leadSuit && hasSuit) break;
                // Якщо масті немає — будь-яка карта дозволена (козир необов'язковий)
            }

            // Шлюб — авто при грі Q або K першою картою взятки
            if (trick.cards.length === 0) {
                const rank = tRank(card);
                const suit = tSuit(card);
                if (rank === 'Q' || rank === 'K') {
                    const partner = rank === 'Q' ? `K${suit}` : `Q${suit}`;
                    const alreadyDeclared = state.marriages[pidx]?.includes(suit);
                    const trumpBlocks = state.trump && state.trump !== suit;
                    if (player.hand.includes(partner) && !alreadyDeclared && !trumpBlocks) {
                        if (!state.marriages[pidx]) state.marriages[pidx] = [];
                        state.marriages[pidx].push(suit);
                        if (!state.trump) state.trump = suit;
                        state.log.unshift(`💍 ${player.name} оголошує ${suit} (+${T_MARRIAGE[suit]})`);
                    }
                }
            }

            player.hand.splice(hidx, 1);
            trick.cards.push({ playerId: pidx, card });

            if (trick.cards.length === n) {
                // Взятка завершена
                const winnerId = tDetermineWinner(trick.cards, state.trump);
                const pts = trick.cards.reduce((s,c) => s + tPts(c.card), 0);
                state.players[winnerId].trickPts += pts;
                state.log.unshift(`🃏 ${state.players[winnerId].name} бере (+${pts})`);
                state.lastTrickWinner = winnerId; // завжди оновлюємо — буде останній хто взяв
                const completedCards = [...trick.cards]; // зберігаємо ПЕРЕД очисткою

                if (state.players[0].hand.length === 0) {
                    return tFinishRound(state);
                }
                state.trick = { cards: [], leader: winnerId };
                state.currentPlayer = winnerId;
                // повертаємо завершену взятку як sideEffect — клієнт покаже її 1.3с
                return { event: 'trickComplete', cards: completedCards, winnerId, pts };
            } else {
                state.currentPlayer = (pidx + 1) % n;
            }
            break;
        }

        case 'tSetBid': {
            if (state.phase !== 'talon' || pidx !== state.auction.winner) break;
            if (state.talonPiles) break; // 2-player: спочатку треба вибрати стопку
            const amt = parseInt(data.amount) || 0;
            const minBid = Math.max(state.auction.current, state.declaredBid || 0);
            if (amt < minBid || amt % 10 !== 0) break;
            state.declaredBid = amt;
            state.log.unshift(`📢 ${player.name} підвищує до ${amt}`);
            break;
        }
    }
    return null;
}

function tDetermineWinner(cards, trump) {
    const leadSuit = tSuit(cards[0].card);
    let best = cards[0];
    for (let i = 1; i < cards.length; i++) {
        const c = cards[i];
        const cs = tSuit(c.card), bs = tSuit(best.card);
        if (trump && cs === trump && bs !== trump) { best = c; continue; }
        if (cs === bs && tRankN(c.card) > tRankN(best.card)) best = c;
    }
    return best.playerId;
}

function tFinishRound(state) {
    const n = state.players.length;
    const bidder = state.auction.winner;

    // Нерозкритий прикуп (2-player) → очки йдуть тому хто взяв останню взятку
    if (state.leftoverPile?.length && state.lastTrickWinner !== null) {
        const pts = state.leftoverPile.reduce((s, c) => s + tPts(c), 0);
        state.players[state.lastTrickWinner].trickPts += pts;
        if (pts > 0) {
            addLog(state, `🃏 ${state.players[state.lastTrickWinner].name} отримує нерозкритий прикуп зі столу (+${pts})`);
        }
    }

    // Додаємо очки шлюбів (бочка: козир встановлюється, але очки не рахуються)
    Object.entries(state.marriages).forEach(([pid, suits]) => {
        const p = state.players[+pid];
        if (p.onBarrel) {
            state.log.unshift(`🛢️ ${p.name} на бочці — шлюб не рахується`);
        } else {
            suits.forEach(s => { p.trickPts += T_MARRIAGE[s]; });
        }
    });
    const bid = state.declaredBid || state.auction.current;
    const roundResults = [];
    state.players.forEach((p, i) => {
        const rnd = Math.floor(p.trickPts / 10) * 10;
        let delta;
        if (i === bidder) {
            if (p.trickPts >= bid) {
                delta = bid;
                state.log.unshift(`✅ ${p.name}: набрав ${p.trickPts} ≥ ${bid}, +${bid}`);
            } else {
                delta = -bid;
                state.log.unshift(`❌ ${p.name}: набрав ${p.trickPts} < ${bid}, −${bid}`);
            }
        } else {
            delta = rnd;
            state.log.unshift(`${p.name}: +${rnd}`);
        }
        p.score += delta;
        roundResults.push({
            id: p.id, name: p.name, trickPts: p.trickPts,
            delta, score: p.score,
            isBidder: i === bidder, bid: i === bidder ? bid : null,
            success: i === bidder ? p.trickPts >= bid : null,
        });
    });
    // ── Бочка: оновлюємо статус ──────────────────
    state.players.forEach((p, i) => {
        if (p.onBarrel) {
            const succeeded = (p.score >= 1000); // перевірка ДО reset
            if (!succeeded) {
                p.barrelAttempts++;
                if (p.barrelAttempts >= 3) {
                    addLog(state, `💣 ${p.name}: 3 спроби на бочці — рахунок скидається до 800`, 'error');
                    p.score = 800;
                    p.onBarrel = false;
                    p.barrelAttempts = 0;
                } else {
                    addLog(state, `🛢️ ${p.name}: спроба ${p.barrelAttempts}/3 не вдалась`, 'warn');
                }
            }
        }
    });
    // Нові гравці, що досягли 900+
    state.players.forEach(p => {
        if (!p.onBarrel && p.score >= 900 && p.score < 1000) {
            p.onBarrel = true;
            p.barrelAttempts = 0;
            addLog(state, `🛢️ ${p.name} на бочці! Потрібно набрати 100+ за 3 спроби`, 'warn');
        }
    });

    const winner = state.players.find(p => p.score >= 1000);
    if (winner) {
        state.phase = 'gameover';
        state.winner = winner.id;
        state.log.unshift(`🏆 ${winner.name} набрав(ла) 1000! Перемога!`);
        return { event: 'tGameOver', winner };
    }
    // Новий раунд
    state.round++;
    state.dealer = (state.dealer + 1) % n;
    const cpp = n === 2 ? 10 : 7;
    const deck = createTDeck();
    state.players.forEach((p, i) => {
        p.hand = deck.slice(i * cpp, (i + 1) * cpp);
        p.trickPts = 0;
    });
    state.talon = deck.slice(cpp * n);
    state.phase = 'auction';
    state.currentPlayer = (state.dealer + 1) % n;
    state.auction = { current: 100, passed: Array(n).fill(false), winner: null };
    state.trick = { cards: [], leader: (state.dealer + 1) % n };
    state.trump = null; state.declaredBid = null;
    state.marriages = {}; state.givenCards = [];
    state.talonPiles = null; state.leftoverPile = null; state.lastTrickWinner = null;
    return { event: 'roundResult', results: roundResults };
}

function sanitizeTysyacha(state, forIdx) {
    return {
        gameType: 'tysyacha',
        players: state.players.map((p, i) => ({
            id: p.id, name: p.name, score: p.score, trickPts: p.trickPts,
            handCount: p.hand.length,
            hand: i === forIdx ? p.hand : null,
            onBarrel: p.onBarrel || false,
            barrelAttempts: p.barrelAttempts || 0,
        })),
        talonCount: state.talonPiles
            ? state.talonPiles.reduce((s, p) => s + p.length, 0)
            : state.talon.length,
        talonPiles: state.talonPiles ? state.talonPiles.map(p => p.length) : null,
        leftoverPileCount: state.leftoverPile?.length || 0,
        talon: null,
        myId: forIdx,
        dealer: state.dealer, round: state.round,
        phase: state.phase, currentPlayer: state.currentPlayer,
        auction: state.auction,
        trick: state.trick,
        trump: state.trump, declaredBid: state.declaredBid,
        marriages: state.marriages,
        givenCards: state.givenCards,
        log: state.log.slice(0, 30),
        winner: state.winner,
    };
}

function clearTysyachaTimer(room) {
    if (room.tysyachaTimer) { clearTimeout(room.tysyachaTimer); room.tysyachaTimer = null; }
}

function startTysyachaTimer(room) {
    clearTysyachaTimer(room);
    const state = room.state;
    if (!room.started || !state || state.phase === 'gameover') return;
    room.tysyachaTimer = setTimeout(() => {
        if (!room.started || !room.state) return;
        const st = room.state;
        if (st.phase === 'gameover') return;
        const pidx = st.currentPlayer;
        const player = st.players[pidx];
        if (!player) return;

        let result = null;
        if (st.phase === 'auction') {
            if (player.onBarrel) result = processTysyachaAction(st, 'tBid', { amount: st.auction.current }, pidx);
            else                 result = processTysyachaAction(st, 'tBid', { pass: true }, pidx);
        } else if (st.phase === 'talon') {
            if (st.talonPiles) {
                result = processTysyachaAction(st, 'tChoosePile', { pileIdx: 0 }, pidx);
            } else {
                const ungiven = st.players.map((_,i)=>i).filter(i=>i!==pidx && st.givenCards.filter(g=>g===i).length===0)[0];
                if (ungiven !== undefined && player.hand.length)
                    result = processTysyachaAction(st, 'tGiveCard', { card: player.hand[0], toPlayer: ungiven }, pidx);
                else if (!st.declaredBid)
                    result = processTysyachaAction(st, 'tSetBid', { amount: st.auction.current }, pidx);
            }
        } else if (st.phase === 'playing') {
            const leadSuit = st.trick?.cards?.length ? st.trick.cards[0].card.slice(-1) : null;
            const card = leadSuit ? (player.hand.find(c=>c.endsWith(leadSuit)) || player.hand[0]) : player.hand[0];
            if (card) result = processTysyachaAction(st, 'tPlayCard', { card, marriage: false }, pidx);
        }

        if (result?.event === 'tGameOver') {
            clearTysyachaTimer(room);
            room.players.forEach(rp => io.to(rp.socketId).emit('gameOver', {
                winner: st.players[st.winner], state: sanitizeTysyacha(st, rp.index), gameType: 'tysyacha',
            }));
            return;
        }
        let toastText = `⏱️ Авто-хід: ${player.name}`;
        if (st.phase === 'auction') {
            toastText = player.onBarrel
                ? `⏱️ ${player.name} ставить ${st.auction.current}`
                : `⏱️ ${player.name} пасує (AFK)`;
        } else if (st.phase === 'talon') {
            toastText = st.talonPiles
                ? `⏱️ ${player.name} бере стопку 1 (AFK)`
                : `⏱️ ${player.name} роздає карту (AFK)`;
        }
        emitTysyachaUpdate(room, result, { text: toastText, color: '#e65100' });
        startTysyachaTimer(room);
    }, 60 * 1000);
}

function emitTysyachaUpdate(room, sideEffect, toast) {
    room.players.forEach(rp => {
        io.to(rp.socketId).emit('stateUpdate', {
            state: sanitizeTysyacha(room.state, rp.index),
            sideEffect, toast: toast || null,
        });
    });
}

// ════════════════════════════════════════════
// ДУРАК
// ════════════════════════════════════════════

const D_RANKS = ['6','7','8','9','10','J','Q','K','A'];
const D_SUITS = ['♠','♣','♦','♥'];
const D_RANK_IDX = Object.fromEntries(D_RANKS.map((r,i)=>[r,i]));

function dRank(c){ return c.slice(0,-1); }
function dSuit(c){ return c.slice(-1); }
function dCanBeat(atk, def, trump){
    const as=dSuit(atk), ds=dSuit(def);
    if(ds===trump && as!==trump) return true;
    if(ds===as) return D_RANK_IDX[dRank(def)] > D_RANK_IDX[dRank(atk)];
    return false;
}
function dNextActive(state, from){
    const n=state.players.length;
    for(let i=1;i<=n;i++){
        const idx=(from+i)%n;
        if(!state.finished.includes(idx)) return idx;
    }
    return from;
}

function dFindFirstAttacker(players, trump){
    // Найнижчий козир → першим ходить власник
    let best = -1, bestRank = 999, hasTrump = false;
    players.forEach((p, i) => {
        const trumps = p.hand.filter(c => dSuit(c) === trump);
        if(trumps.length){
            const min = Math.min(...trumps.map(c => D_RANK_IDX[dRank(c)]));
            if(!hasTrump || min < bestRank){ hasTrump = true; bestRank = min; best = i; }
        }
    });
    if(hasTrump) return best;
    // Козирів немає → найнижча карта серед усіх
    bestRank = 999;
    players.forEach((p, i) => {
        const min = Math.min(...p.hand.map(c => D_RANK_IDX[dRank(c)]));
        if(min < bestRank){ bestRank = min; best = i; }
    });
    return best >= 0 ? best : 0;
}

const DURAK_TURN_MS = 45_000;

function dStartTurnTimer(room) {
    if (room.durakTimer) clearTimeout(room.durakTimer);
    const state = room.state;
    if (!state || state.phase === 'gameover') return;
    state.turnDeadline = Date.now() + DURAK_TURN_MS;
    room.durakTimer = setTimeout(() => {
        if (!room.state || room.state.phase === 'gameover') return;
        const s = room.state;
        let result = null;
        if (s.phase === 'attack') {
            const atk = s.players[s.attacker];
            if (s.table.length === 0 && atk?.hand?.length > 0) {
                result = processDurakAction(s, 'dPlay', { cards: [atk.hand[0]] }, s.attacker);
            } else if (s.table.every(t => t.defense)) {
                result = processDurakAction(s, 'dPass', {}, s.attacker);
            }
        } else if (s.phase === 'defend') {
            result = processDurakAction(s, 'dTake', {}, s.defender);
        } else if (s.phase === 'throw') {
            s.players.forEach((p, i) => {
                if (i !== s.defender && !s.passedThrow.includes(i))
                    processDurakAction(s, 'dPass', {}, i);
            });
        }
        if (result?.event === 'dGameOver') {
            room.players.forEach(rp => io.to(rp.socketId).emit('gameOver', { state: sanitizeDurak(s, rp.index) }));
        } else {
            emitDurakUpdate(room, null);
        }
    }, DURAK_TURN_MS);
}

function createDurakState(roomPlayers, settings={}){
    const deck = shuffle(D_SUITS.flatMap(s=>D_RANKS.map(r=>r+s)));
    const players = roomPlayers.map((rp,i)=>({ id:i, name:rp.name, hand:deck.splice(0,6) }));
    // Козир — остання карта в колоді (видима, забирається останньою).
    // Переміщуємо на початок масиву: deck.pop() бере з кінця,
    // тому козир на позиції [0] буде взятий останнім.
    const trumpCard = deck[deck.length-1];
    deck.splice(deck.length-1, 1);
    deck.unshift(trumpCard);
    const trump = dSuit(trumpCard);
    const attacker = dFindFirstAttacker(players, trump);
    return {
        gameType:'durak', mode: settings.mode||'podkidnoy',
        players, deck,
        trump, trumpCard,
        attacker, defender:(attacker+1)%roomPlayers.length,
        phase:'attack',
        table:[], passedThrow:[], finished:[],
        log:[], loser:null, turnDeadline: null,
        isSecretVoting: false, kumData: null, quarantined: [],
    };
}

function processDurakAction(state, type, data, pidx){
    const player = state.players[pidx];
    if(!player || state.phase==='gameover') return null;

    switch(type){
        case 'dPlay': {
            const ph = state.phase;
            if(ph==='attack' && pidx!==state.attacker) break;
            if(ph==='throw' && (pidx===state.defender || state.passedThrow.includes(pidx))) break;
            if(ph!=='attack' && ph!=='throw') break;
            const { cards } = data||{};
            if(!cards?.length) break;
            const tableRanks = new Set(state.table.flatMap(t=>[dRank(t.attack), t.defense?dRank(t.defense):null].filter(Boolean)));
            if(ph==='attack' && state.table.length===0){
                const r=dRank(cards[0]);
                if(!cards.every(c=>dRank(c)===r)) break;
            } else {
                if(!cards.every(c=>tableRanks.has(dRank(c)))) break;
            }
            const defHand = state.players[state.defender].hand.length;
            const unbeaten = state.table.filter(t=>!t.defense).length;
            if(unbeaten+cards.length > defHand) break;
            if(state.table.length+cards.length > 6) break;
            // validate all cards in hand
            const tmp=[...player.hand];
            for(const c of cards){ const i=tmp.indexOf(c); if(i===-1) return null; tmp.splice(i,1); }
            for(const c of cards){ player.hand.splice(player.hand.indexOf(c),1); state.table.push({attack:c,defense:null}); }
            state.phase='defend'; state.passedThrow=[];
            addLog(state, ph==='attack'?`⚔️ ${player.name} ходить`:`➕ ${player.name} підкидає`);
            break;
        }
        case 'dBeat': {
            if(state.phase!=='defend'||pidx!==state.defender) break;
            const { attackCard, defenseCard } = data||{};
            const slot=state.table.find(t=>t.attack===attackCard&&!t.defense);
            if(!slot) break;
            const di=player.hand.indexOf(defenseCard);
            if(di===-1) break;
            if(!dCanBeat(attackCard, defenseCard, state.trump)) break;
            player.hand.splice(di,1); slot.defense=defenseCard;
            addLog(state,`🛡️ ${player.name} відбиває`);
            if(state.table.every(t=>t.defense)){
                state.phase='throw'; state.passedThrow=[state.defender];
            }
            break;
        }
        case 'dTake': {
            if(state.phase!=='defend'||pidx!==state.defender) break;
            player.hand.push(...state.table.flatMap(t=>[t.attack,t.defense].filter(Boolean)));
            state.table=[];
            addLog(state,`😵 ${player.name} забирає карти`);
            return dAdvance(state, true);
        }
        case 'dTransfer': {
            if(state.mode!=='perevodnoj'||state.phase!=='defend'||pidx!==state.defender) break;
            if(state.table.some(t=>t.defense)) break; // already defended some
            const { card } = data||{};
            if(!state.table.map(t=>dRank(t.attack)).includes(dRank(card))) break;
            const nextDef=dNextActive(state,state.defender);
            if(nextDef===state.attacker) break;
            if(state.players[nextDef].hand.length < state.table.length+1) break;
            const i=player.hand.indexOf(card); if(i===-1) break;
            player.hand.splice(i,1); state.table.push({attack:card,defense:null});
            state.attacker=state.defender; state.defender=nextDef;
            addLog(state,`🔄 ${player.name} переводить → ${state.players[nextDef].name}`);
            break;
        }
        case 'dPass': {
            // Атакуючий завершує хід якщо всі карти відбиті
            const isEndTurn = state.phase==='attack' && pidx===state.attacker
                && state.table.length>0 && state.table.every(t=>t.defense);
            if(isEndTurn) return dAdvance(state, false);
            if(state.phase!=='throw'||pidx===state.defender) break;
            if(!state.passedThrow.includes(pidx)) state.passedThrow.push(pidx);
            // Гравці з 0 карт авто-пасують (вони не можуть підкидати)
            state.players.forEach(p => {
                if(p.id!==state.defender && p.hand.length===0 && !state.passedThrow.includes(p.id))
                    state.passedThrow.push(p.id);
            });
            const nonDef=state.players.filter(p=>!state.finished.includes(p.id)&&p.id!==state.defender);
            if(nonDef.every(p=>state.passedThrow.includes(p.id)))
                return dAdvance(state, false);
            break;
        }
    }
    return null;
}

function dAdvance(state, defenderTook){
    if(!defenderTook){
        state.table=[]; // discard (we don't show discard pile separately)
    }
    // refill: attacker first, defender last
    const n=state.players.length;
    const order=[];
    for(let i=0;i<n;i++){
        const idx=(state.attacker+i)%n;
        if(idx!==state.defender) order.push(idx);
    }
    order.push(state.defender);
    for(const idx of order){
        const p=state.players[idx];
        while(p.hand.length<6 && state.deck.length>0) p.hand.push(state.deck.pop());
        // Коли колода вичерпана — козирна карта більше не показується біля колоди
        if(state.deck.length===0) state.trumpCard = null;
        if(p.hand.length===0 && !state.finished.includes(idx)){
            state.finished.push(idx);
            addLog(state,`🏅 ${p.name} вийшов(ла) з гри`);
        }
    }
    // check gameover
    const active=state.players.filter(p=>!state.finished.includes(p.id));
    if(active.length<=1){
        state.phase='gameover';
        state.loser=active.length===1?active[0].id:null;
        addLog(state, state.loser!==null?`🤡 ${state.players[state.loser].name} — ДУРЕНЬ!`:`🏁 Нічия!`);
        return { event:'dGameOver' };
    }
    // next attacker — якщо захисник вийшов з гри, шукаємо наступного активного
    const prevDefender = state.defender;
    if(defenderTook){
        state.attacker = dNextActive(state, prevDefender);
    } else {
        // захисник відбив — стає атакуючим, але тільки якщо ще в грі
        state.attacker = state.finished.includes(prevDefender)
            ? dNextActive(state, prevDefender)
            : prevDefender;
    }
    state.defender = dNextActive(state, state.attacker);
    state.phase='attack'; state.passedThrow=[]; state.table=[];
    addLog(state,`🃏 Хід ${state.players[state.attacker].name}`);
    return null;
}

function sanitizeDurak(state, forIdx){
    return {
        gameType:'durak', mode:state.mode, myId:forIdx,
        players: state.players.map((p,i)=>({
            id:p.id, name:p.name, handCount:p.hand.length,
            hand: i===forIdx ? p.hand : null,
            finished: state.finished.includes(p.id),
        })),
        deckCount: state.deck.length,
        trump: state.trump, trumpCard: state.trumpCard,
        attacker: state.attacker, defender: state.defender,
        phase: state.phase,
        table: state.table,
        passedThrow: state.passedThrow,
        finished: state.finished,
        log: state.log.slice(0,25),
        loser: state.loser,
        turnDeadline: state.turnDeadline || null,
    };
}

function emitDurakUpdate(room, sideEffect){
    dStartTurnTimer(room);
    room.players.forEach(rp=>{
        io.to(rp.socketId).emit('stateUpdate',{
            state: sanitizeDurak(room.state, rp.index),
            sideEffect: sideEffect||null,
        });
    });
}

// ════════════════════════════════════════════
// БУНКЕР
// ════════════════════════════════════════════

function createBunkerState(roomPlayers, settings = {}) {
    const bunkerCapacity = Math.floor(roomPlayers.length / 2);

    let profs   = shuffle(BUNKER_PROFESSIONS);
    let healths = shuffle(BUNKER_HEALTH);
    let hobbies = shuffle(BUNKER_HOBBIES);
    let traits  = shuffle(BUNKER_TRAITS);
    let bags    = shuffle(BUNKER_BAGGAGE);
    let facts   = shuffle(BUNKER_FACTS);
    let actions = shuffle(BUNKER_ACTION_CARDS);

    const players = roomPlayers.map((rp, i) => {
        const isMale = Math.random() > 0.5;
        const gender = isMale ? 'Чоловік' : 'Жінка';
        const age    = Math.floor(Math.random() * (77 - 18 + 1)) + 18;
        const repro  = Math.random() > 0.2
            ? (isMale ? 'плідний' : 'плідна')
            : (isMale ? 'безплідний' : 'безплідна');
        return {
            id:       i,
            name:     rp.name,
            isBot:    rp.isBot || false,
            isAlive:  true,
            isSilenced:     false,
            immunityRounds: 0,
            hasRevealed:    false, // чи вже розкрив атрибут у поточному раунді
            attributes: {
                profession: { value: profs.pop(),   isRevealed: false },
                biology:    { value: `${gender}, ${age} років, ${repro}`, isRevealed: false },
                health:     { value: healths.pop(), isRevealed: false },
                hobby:      { value: hobbies.pop(), isRevealed: false },
                trait:      { value: traits.pop(),  isRevealed: false },
                baggage:    { value: bags.pop(),    isRevealed: false },
                fact:       { value: facts.pop(),   isRevealed: false },
            },
            actionCards: [{ ...actions.pop(), used: false }],
            localMarkers: {}, // клієнтська функція, не в стейті
        };
    });

    const scenarioId   = settings.scenarioId != null ? settings.scenarioId : Math.floor(Math.random() * BUNKER_SCENARIOS.length);
    const scenario     = BUNKER_SCENARIOS[scenarioId] || BUNKER_SCENARIOS[0];
    const timerEnabled = settings.timerEnabled !== false;

    return {
        gameType:       'bunker',
        phase:          'game_start',
        round:          0,
        bunkerCapacity,
        scenario,
        timerEnabled,
        players,
        votes:          {},
        timeDeadline:   null,
        log:            [],
        winner:         null,
        epilogue:       null,   // AI-генерований текст після кінця гри
        isSecretVoting: false,
        kumData:        null,
        quarantined:    [],
        tiebreaker:     null,   // [id, id, ...] — гравці в повторному голосуванні
    };
}

function sanitizeBunker(state, forIdx) {
    return {
        gameType:       'bunker',
        phase:          state.phase,
        round:          state.round,
        bunkerCapacity: state.bunkerCapacity,
        scenario:       state.scenario,
        timerEnabled:   state.timerEnabled,
        timeDeadline:   state.timeDeadline,
        myId:           forIdx,
        players: state.players.map((p, i) => ({
            id:         p.id,
            name:       p.name,
            isBot:      p.isBot || false,
            isAlive:    p.isAlive,
            isSilenced: p.isSilenced,
            immunityRounds: p.immunityRounds,
            hasRevealed:    p.hasRevealed,
            // Свої атрибути — всі, чужі — тільки isRevealed:true
            attributes: i === forIdx
                ? p.attributes
                : Object.fromEntries(
                    Object.entries(p.attributes).map(([k, v]) => [
                        k, v.isRevealed ? v : { value: '???', isRevealed: false }
                    ])
                ),
            // Свої карти дій — повні, чужі — тільки назва і чи використана
            actionCards: i === forIdx
                ? p.actionCards
                : p.actionCards.map(c => ({ id: c.id, name: c.name, used: c.used })),
        })),
        // Голоси: показуємо якщо відкрите голосування
        votes: (state.phase === 'voting' || state.phase === 'voting_result') && !state.isSecretVoting
            ? state.votes
            : state.phase === 'voting_result' && state.isSecretVoting
            ? state.votes   // після підрахунку результати все одно показуємо
            : {},
        isSecretVoting: state.isSecretVoting || false,
        tiebreaker:     state.tiebreaker || null,
        log:      state.log.slice(0, 40),
        winner:   state.winner,
        epilogue: state.epilogue || null,
    };
}

function emitBunkerUpdate(room) {
    room.players.forEach(rp => {
        if (!rp.socketId || rp.isBot) return;
        io.to(rp.socketId).emit('stateUpdate', {
            state: sanitizeBunker(room.state, rp.index),
        });
    });
}

// ── Gemini AI — генерація епілогу ────────────
async function generateBunkerEpilogue(state) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === 'YOUR_KEY_HERE') return null;

    const survivors = state.players
        .filter(p => p.isAlive)
        .map(p => `${p.name} (${p.attributes.profession.value.split('(')[0].trim()}, ${p.attributes.health.value}, ${p.attributes.hobby.value.split('(')[0].trim()})`)
        .join('; ');

    const eliminated = state.players
        .filter(p => !p.isAlive)
        .map(p => p.attributes.profession.value.split('(')[0].trim())
        .join(', ');

    const prompt = `Ти — саркастичний ведучий постапокаліптичного шоу «Бункер».
Катастрофа: ${state.scenario.title} (${state.scenario.subtitle}).
Бункер: ${state.scenario.bunker.slice(0, 120)}.
Хто вижив: ${survivors}.
Вигнані: ${eliminated || 'ніхто'}.

Напиши смішний та іронічний епілог 2-3 речення — що буде з цими людьми через рік у бункері. Згадай конкретні характеристики вижилих. Відповідь тільки текст епілогу, без зайвих слів. Українською мовою.`;

    try {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
                signal: AbortSignal.timeout(10_000),
            }
        );
        if (!res.ok) return null;
        const data = await res.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    } catch {
        return null;
    }
}

// ── Допоміжні ────────────────────────────────
const BUNKER_ATTR_LABELS = {
    profession: 'Професію', biology: 'Біологію', health: 'Здоров\'я',
    hobby: 'Хобі', trait: 'Рису характеру', baggage: 'Багаж', fact: 'Факт',
};
const BUNKER_PHASE_MS = {
    game_start:   60_000,
    round_reveal: 30_000,
    discussion:  120_000,
    voting:       60_000,
};

function addBunkerLog(state, text) {
    state.log.unshift(text);
    if (state.log.length > 40) state.log.length = 40;
}

function clearBunkerTimer(room) {
    if (room.bunkerTimer) { clearTimeout(room.bunkerTimer); room.bunkerTimer = null; }
}

// ── Старт фази з таймером ─────────────────────
// ── AI-боти для Бункера ───────────────────────
const BOT_NAMES = ['Мирослав-АІ', 'Оксана-АІ', 'Тарас-АІ', 'Ганна-АІ', 'Богдан-АІ', 'Лариса-АІ'];

async function getBotDecisions(room, phase) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === 'YOUR_KEY_HERE') return null;
    const s = room.state;
    const bots = s.players.filter(p => p.isBot && p.isAlive);
    if (!bots.length) return null;

    const playersDesc = s.players
        .filter(p => p.isAlive)
        .map(p => {
            const attrs = Object.entries(p.attributes)
                .map(([k, v]) => `${BUNKER_ATTR_LABELS[k]||k}: ${v.isRevealed ? v.value : '?'}`)
                .join(', ');
            return `${p.name}${p.isBot?' 🤖':''} (id=${p.id}): ${attrs}`;
        }).join('\n');

    let prompt = '';

    if (phase === 'round_reveal') {
        const botsNeedingReveal = bots.filter(p => !p.hasRevealed);
        if (!botsNeedingReveal.length) return null;
        const botsDesc = botsNeedingReveal.map(p => {
            const unrevealed = Object.keys(p.attributes).filter(k => !p.attributes[k].isRevealed);
            return `id=${p.id}, name="${p.name}", нерозкриті: [${unrevealed.join(', ')}]`;
        }).join('\n');

        prompt = `Ти керуєш ботами у грі "Бункер" (українська). Відповідай тільки українською.

Сценарій: "${s.scenario.title}" — ${s.scenario.disaster}
Бункер: ${s.scenario.bunker}. Мета: ${s.scenario.goal}
Місць у бункері: ${s.bunkerCapacity} з ${s.players.filter(p=>p.isAlive).length}. Раунд ${s.round}.

Атрибути гравців (? = приховано):
${playersDesc}

Боти що ходять зараз:
${botsDesc}

Для кожного бота вкажи:
- attr: що розкрити (один з нерозкритих — обери той що найкраще підкреслює корисність бота)
- message: 1-2 речення від першої особи — чому ти потрібен у бункері

Відповідь ТІЛЬКИ JSON (без markdown, без пояснень):
{"decisions":[{"index":ID,"attr":"ATTR","message":"TEXT"}]}`;

    } else if (phase === 'voting') {
        const botsToVote = bots.filter(p => s.votes[p.id] === undefined);
        if (!botsToVote.length) return null;
        const aliveList = s.players.filter(p => p.isAlive)
            .map(p => `id=${p.id} "${p.name}"${p.isBot?' (бот)':''}`).join(', ');

        prompt = `Ти керуєш ботами у грі "Бункер" (українська).

Сценарій: "${s.scenario.title}" — ${s.scenario.disaster}
Місць у бункері: ${s.bunkerCapacity} з ${s.players.filter(p=>p.isAlive).length}

Атрибути гравців:
${playersDesc}

Живі гравці: ${aliveList}
Боти що голосують: ${botsToVote.map(p=>`id=${p.id} "${p.name}"`).join(', ')}

Кожен бот голосує ПРОТИ одного гравця (найменш корисний для виживання в цьому сценарії). Не голосуй проти себе. Використовуй числовий id.

Відповідь ТІЛЬКИ JSON:
{"votes":[{"index":BOT_ID,"target":TARGET_ID}]}`;
    }

    if (!prompt) return null;
    try {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${key}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.85, maxOutputTokens: 600 },
                }),
            }
        );
        const json = await res.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) return null;
        return JSON.parse(match[0]);
    } catch (e) {
        console.error('[Bot] getBotDecisions error:', e.message);
        return null;
    }
}

function scheduleBotActions(room, phase) {
    const bots = room.players.filter(p => p.isBot);
    if (!bots.length) return;

    if (phase === 'game_start') {
        setTimeout(() => {
            if (room.state?.phase !== 'game_start') return;
            bots.forEach(bp => {
                const p = room.state.players[bp.index];
                if (p && !p.hasRevealed) processBunkerAction(room, 'b_ready', {}, bp.index);
            });
        }, 1500);
        return;
    }

    if (phase === 'round_reveal') {
        setTimeout(async () => {
            if (room.state?.phase !== 'round_reveal') return;
            const data = await getBotDecisions(room, 'round_reveal');
            const botsToAct = bots.filter(bp => {
                const p = room.state?.players[bp.index];
                return p?.isAlive && !p.hasRevealed;
            });

            if (!data?.decisions?.length) {
                const FALLBACK_BOT_MSGS = [
                    'Я буду корисним для виживання в бункері!',
                    'Мої навички незамінні в кризовій ситуації.',
                    'Без мене команда не виживе.',
                    'Я готовий до будь-яких умов.',
                    'Мій досвід стане у нагоді всім.',
                    'Розраховуйте на мене в найскладніші моменти.',
                    'Я зроблю все можливе для виживання команди.',
                ];
                botsToAct.forEach((bp, i) => {
                    setTimeout(() => {
                        if (room.state?.phase !== 'round_reveal') return;
                        const p = room.state.players[bp.index];
                        if (!p?.isAlive || p.hasRevealed) return;
                        const attr = Object.keys(p.attributes).find(k => !p.attributes[k].isRevealed);
                        if (attr) {
                            processBunkerAction(room, 'b_revealAttr', { attr }, bp.index);
                            const msg = FALLBACK_BOT_MSGS[Math.floor(Math.random() * FALLBACK_BOT_MSGS.length)];
                            io.to(room.code).emit('chatMessage', {
                                playerIndex: bp.index,
                                name: p.name,
                                color: '#88aaff',
                                icon: '🤖',
                                text: msg,
                            });
                        }
                    }, (i + 1) * 2500);
                });
                return;
            }

            data.decisions.forEach((d, i) => {
                setTimeout(() => {
                    if (room.state?.phase !== 'round_reveal') return;
                    const p = room.state.players[d.index];
                    if (!p?.isAlive || p.hasRevealed) return;
                    const attr = (p.attributes[d.attr] && !p.attributes[d.attr].isRevealed ? d.attr
                        : Object.keys(p.attributes).find(k => !p.attributes[k].isRevealed));
                    if (!attr) return;
                    processBunkerAction(room, 'b_revealAttr', { attr }, d.index);
                    if (d.message) {
                        io.to(room.code).emit('chatMessage', {
                            playerIndex: d.index,
                            name: p.name,
                            color: '#88aaff',
                            icon: '🤖',
                            text: d.message,
                        });
                    }
                }, (i + 1) * 3000);
            });
        }, 5000); // Боти ходять після 5с — спочатку хід людей
        return;
    }

    if (phase === 'voting') {
        setTimeout(async () => {
            if (room.state?.phase !== 'voting') return;
            const data = await getBotDecisions(room, 'voting');
            const botsToVote = bots.filter(bp => {
                const p = room.state?.players[bp.index];
                return p?.isAlive && room.state?.votes[bp.index] === undefined;
            });

            if (!data?.votes?.length) {
                botsToVote.forEach((bp, i) => {
                    setTimeout(() => {
                        if (room.state?.phase !== 'voting') return;
                        const tb = room.state.tiebreaker;
                        const candidates = room.state.players.filter(p =>
                            p.isAlive && p.id !== bp.index && (!tb || tb.includes(p.id))
                        );
                        const target = candidates[Math.floor(Math.random() * candidates.length)]?.id;
                        if (target !== undefined) processBunkerAction(room, 'b_vote', { target }, bp.index);
                    }, (i + 1) * 2000);
                });
                return;
            }

            data.votes.forEach((v, i) => {
                setTimeout(() => {
                    if (room.state?.phase !== 'voting') return;
                    const p = room.state.players[v.index];
                    if (!p?.isAlive || room.state.votes[v.index] !== undefined) return;
                    processBunkerAction(room, 'b_vote', { target: v.target }, v.index);
                }, (i + 1) * 2500);
            });
        }, 4000);
        return;
    }
}

function startBunkerPhase(room, phase) {
    clearBunkerTimer(room);
    const s = room.state;
    s.phase = phase;
    if (s.timerEnabled) {
        const ms = BUNKER_PHASE_MS[phase] || 30_000;
        s.timeDeadline   = Date.now() + ms;
        room.bunkerTimer = setTimeout(() => onBunkerTimeout(room, phase), ms);
    } else {
        s.timeDeadline = null;
    }
    emitBunkerUpdate(room);
    scheduleBotActions(room, phase);
}

function onBunkerTimeout(room, phase) {
    if (!room.state || room.state.phase !== phase) return;
    const s = room.state;
    switch (phase) {
        case 'game_start':
            startBunkerRound(room);
            break;
        case 'round_reveal': {
            // Авто-розкриття для тих хто не встиг
            s.players.filter(p => p.isAlive && !p.hasRevealed).forEach(p => {
                const attr = Object.keys(p.attributes).find(k => !p.attributes[k].isRevealed);
                if (attr && p.attributes[attr]) {
                    p.attributes[attr].isRevealed = true;
                    p.hasRevealed = true;
                    addBunkerLog(s, `⏰ ${p.name} — авто-розкриття`);
                }
            });
            startBunkerPhase(room, 'discussion');
            break;
        }
        case 'discussion':
            startBunkerPhase(room, 'voting');
            break;
        case 'voting':
            resolveBunkerVoting(room);
            break;
    }
}

// ── Початок нового раунду ─────────────────────
function startBunkerRound(room) {
    const s = room.state;
    s.round++;
    s.votes          = {};
    s.isSecretVoting = false;
    s.kumData        = null;
    s.quarantined    = [];
    s.tiebreaker     = null;
    s.players.forEach(p => {
        p.hasRevealed = false;
        if (p.isSilenced) p.isSilenced = false;
    });
    addBunkerLog(s, `📋 Раунд ${s.round} — розкриття карток`);
    startBunkerPhase(room, 'round_reveal');
}

// ── Вигнання одного або кількох гравців ──────
function eliminatePlayers(room, toEliminate) {
    const s = room.state;
    toEliminate.forEach(p => {
        p.isAlive = false;
        Object.keys(p.attributes).forEach(k => { p.attributes[k].isRevealed = true; });
    });
    if (toEliminate.length === 1) {
        addBunkerLog(s, `🚫 ${toEliminate[0].name} покидає бункер`);
    } else {
        addBunkerLog(s, `🚫 Вигнані обидва: ${toEliminate.map(p => p.name).join(', ')}`);
    }

    const remaining = s.players.filter(p => p.isAlive);
    if (remaining.length <= s.bunkerCapacity) {
        s.phase        = 'end_game';
        s.winner       = remaining.map(p => p.id);
        s.timeDeadline = null;
        s.tiebreaker   = null;
        remaining.forEach(p => {
            Object.keys(p.attributes).forEach(k => { p.attributes[k].isRevealed = true; });
        });
        addBunkerLog(s, `🏆 Бункер зачиняється! Виживають: ${remaining.map(p => p.name).join(', ')}`);
        saveGameStats(room, rp => s.winner.includes(rp.index));
        db.deleteRoom(room.code);
        emitBunkerUpdate(room);
        generateBunkerEpilogue(s).then(text => {
            if (!text || !room.state) return;
            room.state.epilogue = text;
            emitBunkerUpdate(room);
        }).catch(() => {});
    } else {
        s.tiebreaker = null;
        startBunkerRound(room);
    }
}

// ── Підрахунок голосів і вигнання ────────────
function resolveBunkerVoting(room) {
    clearBunkerTimer(room);
    const s = room.state;
    s.phase = 'voting_result';
    s.timeDeadline = null;

    // Рахуємо голоси
    const counts = {};
    Object.values(s.votes).forEach(t => { counts[t] = (counts[t] || 0) + 1; });

    // Кумівство: голос від voter проти against рахується втричі
    if (s.kumData) {
        const { voter, against } = s.kumData;
        if (s.votes[voter] === against) {
            counts[against] = (counts[against] || 0) + 2;
            addBunkerLog(s, `🤝 Кумівство спрацювало: +2 голоси проти ${s.players[against]?.name}`);
        }
        s.kumData = null;
    }

    const alive = s.players.filter(p => p.isAlive);
    const maxVotes = alive.reduce((m, p) => Math.max(m, counts[p.id] || 0), 0);
    const tied     = alive.filter(p => (counts[p.id] || 0) === maxVotes && maxVotes > 0);

    addBunkerLog(s, `🗳️ Голосування завершено`);
    emitBunkerUpdate(room);

    setTimeout(() => {
        if (!room.state || room.state.phase !== 'voting_result') return;

        if (tied.length === 0) {
            addBunkerLog(s, '🤷 Ніхто не проголосував — раунд пропущено');
            s.tiebreaker = null;
            startBunkerRound(room);
            return;
        }

        if (tied.length === 1) {
            let toEliminate = tied[0];
            // Перевірка імунітету
            if (toEliminate.immunityRounds > 0) {
                toEliminate.immunityRounds--;
                addBunkerLog(s, `🛡️ ${toEliminate.name} має імунітет — захищений!`);
                const next = alive
                    .filter(p => p.id !== toEliminate.id)
                    .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0))[0];
                if (next) {
                    toEliminate = next;
                    addBunkerLog(s, `👉 Замість нього вигнано ${toEliminate.name}`);
                }
            }
            eliminatePlayers(room, [toEliminate]);
            return;
        }

        // Нічия між кількома гравцями
        if (s.tiebreaker) {
            // Це вже повторне голосування — виганяємо всіх
            addBunkerLog(s, `⚖️ Повторна нічия — виганяються всі: ${tied.map(p => p.name).join(', ')}`);
            eliminatePlayers(room, tied);
        } else {
            // Перша нічия — запускаємо повторне голосування між рівними
            addBunkerLog(s, `⚖️ Нічия між ${tied.map(p => p.name).join(', ')} — повторне голосування!`);
            s.tiebreaker = tied.map(p => p.id);
            s.votes      = {};
            startBunkerPhase(room, 'voting');
        }
    }, 4000);
}

// ── Обробка дій гравця ────────────────────────
function processBunkerAction(room, type, data, pidx) {
    const s   = room.state;
    const p   = s.players[pidx];
    if (!p?.isAlive) return;

    switch (type) {
        // Гравець підтвердив ознайомлення зі сценарієм
        case 'b_ready': {
            if (s.phase !== 'game_start') break;
            p.hasRevealed = true;
            addBunkerLog(s, `✅ ${p.name} готовий`);
            const allReady = s.players.every(pl => pl.hasRevealed);
            if (allReady) {
                s.players.forEach(pl => { pl.hasRevealed = false; });
                clearBunkerTimer(room);
                startBunkerRound(room);
                return; // emitBunkerUpdate вже викликано в startBunkerRound
            }
            emitBunkerUpdate(room);
            break;
        }

        // Гравець розкриває атрибут
        case 'b_revealAttr': {
            if (s.phase !== 'round_reveal') break;
            if (p.hasRevealed) break;
            const { attr } = data;
            if (!attr || !p.attributes[attr]) break;
            if (p.attributes[attr].isRevealed) break;

            p.attributes[attr].isRevealed = true;
            p.hasRevealed = true;
            addBunkerLog(s, `🔓 ${p.name} розкрив(ла) ${BUNKER_ATTR_LABELS[attr]}`);

            const allRevealed = s.players.filter(pl => pl.isAlive).every(pl => pl.hasRevealed);
            if (allRevealed) {
                clearBunkerTimer(room);
                startBunkerPhase(room, 'discussion');
                return;
            }
            emitBunkerUpdate(room);
            break;
        }

        // Гравець голосує
        case 'b_endDiscussion': {
            if (s.phase !== 'discussion') break;
            if (pidx !== 0) break; // тільки хост
            addBunkerLog(s, `⚡ ${p.name} завершив обговорення`);
            startBunkerPhase(room, 'voting');
            return;
        }

        case 'b_endVoting': {
            if (s.phase !== 'voting') break;
            if (pidx !== 0) break; // тільки хост
            addBunkerLog(s, `⚡ ${p.name} завершив голосування`);
            resolveBunkerVoting(room);
            return;
        }

        case 'b_vote': {
            if (s.phase !== 'voting') break;
            if (s.votes[pidx] !== undefined) break;
            if (s.quarantined?.includes(pidx)) break; // карантин — без права голосу
            const { target } = data;
            if (typeof target !== 'number') break;
            const targetP = s.players[target];
            if (!targetP?.isAlive || target === pidx) break;
            // При перепроголосуванні — голосувати можна тільки проти учасників нічиї
            if (s.tiebreaker && !s.tiebreaker.includes(target)) break;

            s.votes[pidx] = target;
            addBunkerLog(s, `🗳️ ${p.name} проголосував(ла)`);

            // Якщо всі хто може голосувати — проголосували, завершуємо достроково
            const aliveIds  = s.players.filter(pl => pl.isAlive && !s.quarantined?.includes(pl.id)).map(pl => pl.id);
            const allVoted  = aliveIds.every(id => s.votes[id] !== undefined);
            if (allVoted) {
                clearBunkerTimer(room);
                resolveBunkerVoting(room);
                return;
            }
            emitBunkerUpdate(room);
            break;
        }

        // MVP-карти дій (решта реалізується пізніше)
        case 'b_useCard': {
            const { cardId, target } = data;
            const card = p.actionCards.find(c => c.id === cardId && !c.used);
            if (!card) break;
            card.used = true;
            applyBunkerCard(room, card, pidx, target);
            break;
        }
    }
}

// ── Застосування карт дій (MVP-набір) ─────────
function applyBunkerCard(room, card, pidx, target) {
    const s = room.state;
    const p = s.players[pidx];

    switch (card.id) {
        case 'act_luz': // Імунітет від голосів цього раунду
            p.immunityRounds = Math.max(p.immunityRounds, 1);
            addBunkerLog(s, `🎵 ${p.name} зіграв «Ой, у лузі...» — імунітет!`);
            break;
        case 'act_lustr': { // Розкрити Здоров'я або Рису іншого гравця
            const t = s.players[target];
            if (!t) break;
            const hidden = ['health', 'trait'].find(k => !t.attributes[k].isRevealed);
            if (hidden) {
                t.attributes[hidden].isRevealed = true;
                addBunkerLog(s, `🔍 ${p.name} — Люстрація: розкрито ${BUNKER_ATTR_LABELS[hidden]} гравця ${t.name}`);
            }
            break;
        }
        case 'act_bribe': { // Обмін багажем
            const t = s.players[target];
            if (!t) break;
            const myBag = p.attributes.baggage.value;
            p.attributes.baggage.value = t.attributes.baggage.value;
            t.attributes.baggage.value = myBag;
            addBunkerLog(s, `💰 ${p.name} — Хабар: обмін багажем з ${t.name}`);
            break;
        }
        case 'act_ban': { // Заглушити гравця на наступне обговорення
            const t = s.players[target];
            if (!t) break;
            t.isSilenced = true;
            addBunkerLog(s, `🔇 ${p.name} — Тіньовий бан: ${t.name} не може писати в наступному раунді`);
            break;
        }
        case 'act_martial': // Скасувати голосування
            if (s.phase === 'voting') {
                s.votes = {};
                addBunkerLog(s, `⚔️ ${p.name} — Воєнний стан: голосування скасовано!`);
                clearBunkerTimer(room);
                startBunkerRound(room);
                return;
            }
            break;
        case 'act_donat': // Імунітет на 2 раунди, втрата багажу
            p.immunityRounds = 2;
            p.attributes.baggage.value = 'Порожні руки (донат на ЗСУ)';
            addBunkerLog(s, `🫡 ${p.name} — Донат на ЗСУ: імунітет 2 раунди`);
            break;
        case 'act_breath': { // Нове здоров'я
            const newHealth = BUNKER_HEALTH[Math.floor(Math.random() * BUNKER_HEALTH.length)];
            p.attributes.health.value = newHealth;
            addBunkerLog(s, `💨 ${p.name} — Друге дихання: нове здоров'я!`);
            break;
        }
        case 'act_prof': { // Нова професія
            const newProf = BUNKER_PROFESSIONS[Math.floor(Math.random() * BUNKER_PROFESSIONS.length)];
            p.attributes.profession.value = newProf;
            addBunkerLog(s, `📋 ${p.name} — Перекваліфікація: нова професія!`);
            break;
        }
        case 'act_bavovna': { // Знищити багаж іншого гравця
            const t = s.players[target];
            if (!t?.isAlive) break;
            t.attributes.baggage.value = '💥 Спалений брухт — нічого немає';
            t.attributes.baggage.isRevealed = true;
            addBunkerLog(s, `💥 ${p.name} — Бавовна: багаж ${t.name} знищено!`);
            break;
        }
        case 'act_human': { // Додатковий предмет багажу собі або іншому
            const t = s.players[target] || p;
            const extra = BUNKER_BAGGAGE[Math.floor(Math.random() * BUNKER_BAGGAGE.length)];
            const extraName = extra.split('(')[0].trim();
            t.attributes.baggage.value += ` + ${extraName}`;
            addBunkerLog(s, `📦 ${p.name} — Гуманітарка: ${t.name} отримав додатковий предмет!`);
            break;
        }
        case 'act_kum': { // Голос + голос союзника = 3 голоси проти цілі
            const t = s.players[target];
            if (!t?.isAlive) break;
            s.kumData = { voter: pidx, against: target };
            addBunkerLog(s, `🤝 ${p.name} — Кумівство: голос проти ${t.name} рахуватиметься втричі!`);
            break;
        }
        case 'act_quar': { // Гравець без права голосу цього раунду
            const t = s.players[target];
            if (!t?.isAlive) break;
            if (!s.quarantined.includes(target)) s.quarantined.push(target);
            addBunkerLog(s, `🏥 ${p.name} — Карантин: ${t.name} не зможе голосувати!`);
            break;
        }
        case 'act_reform': { // Всі живі отримують нове здоров'я
            s.players.filter(pl => pl.isAlive).forEach(pl => {
                pl.attributes.health.value = BUNKER_HEALTH[Math.floor(Math.random() * BUNKER_HEALTH.length)];
                pl.attributes.health.isRevealed = true;
            });
            addBunkerLog(s, `💊 ${p.name} — Медична реформа: всі отримали нове здоров'я!`);
            break;
        }
        case 'act_blackout': // Таємне голосування цього раунду
            s.isSecretVoting = true;
            addBunkerLog(s, `🌑 ${p.name} — Блекаут: голосування буде таємним!`);
            break;
        case 'act_deport': { // Обмін рисою характеру з іншим гравцем
            const t = s.players[target];
            if (!t?.isAlive) break;
            const myTrait = p.attributes.trait.value;
            const myRev   = p.attributes.trait.isRevealed;
            p.attributes.trait.value      = t.attributes.trait.value;
            p.attributes.trait.isRevealed = t.attributes.trait.isRevealed;
            t.attributes.trait.value      = myTrait;
            t.attributes.trait.isRevealed = myRev;
            addBunkerLog(s, `🔄 ${p.name} — Депортація: обмін рисами з ${t.name}!`);
            break;
        }
        case 'act_nat': { // Перерозподіл багажу між живими
            const alive  = s.players.filter(pl => pl.isAlive);
            const bags   = shuffle(alive.map(pl => pl.attributes.baggage.value));
            alive.forEach((pl, i) => {
                pl.attributes.baggage.value = bags[i];
                pl.attributes.baggage.isRevealed = true;
            });
            addBunkerLog(s, `🏛️ ${p.name} — Націоналізація: весь багаж перерозподілено!`);
            break;
        }
        case 'act_refut': // Спростування — скасувати власне вигнання
            addBunkerLog(s, `🛡️ ${p.name} грає «Спростування»`);
            p.immunityRounds = Math.max(p.immunityRounds, 1);
            p.isAlive = true;
            break;
        default:
            addBunkerLog(s, `🃏 ${p.name} зіграв «${card.name}»`);
    }
    emitBunkerUpdate(room);
}

// ════════════════════════════════════════════
// МАФІЯ
// ════════════════════════════════════════════

// ── Таблиця балансу ролей ────────────────────
// citizen | sheriff | deputy | doctor | roleblocker | mafia | don | maniac
const MAFIA_BALANCE = {
    5:  { citizen:2, sheriff:1, deputy:1, doctor:0, roleblocker:0, mafia:0, don:1, maniac:0 },
    6:  { citizen:3, sheriff:1, deputy:1, doctor:0, roleblocker:0, mafia:0, don:1, maniac:0 },
    7:  { citizen:2, sheriff:1, deputy:1, doctor:1, roleblocker:0, mafia:1, don:1, maniac:0 },
    8:  { citizen:3, sheriff:1, deputy:1, doctor:1, roleblocker:0, mafia:1, don:1, maniac:0 },
    9:  { citizen:2, sheriff:1, deputy:1, doctor:1, roleblocker:1, mafia:2, don:1, maniac:0 },
    10: { citizen:2, sheriff:1, deputy:1, doctor:1, roleblocker:1, mafia:2, don:1, maniac:1 },
    11: { citizen:3, sheriff:1, deputy:1, doctor:1, roleblocker:1, mafia:2, don:1, maniac:1 },
    12: { citizen:3, sheriff:1, deputy:1, doctor:1, roleblocker:1, mafia:3, don:1, maniac:1 },
    13: { citizen:4, sheriff:1, deputy:1, doctor:1, roleblocker:1, mafia:3, don:1, maniac:1 },
    14: { citizen:4, sheriff:1, deputy:1, doctor:1, roleblocker:1, mafia:4, don:1, maniac:1 },
    15: { citizen:5, sheriff:1, deputy:1, doctor:1, roleblocker:1, mafia:4, don:1, maniac:1 },
};

const MAFIA_ROLE_LABELS = {
    citizen:    { ua: 'Мирний житель', icon: '👤', faction: 'town'   },
    sheriff:    { ua: 'Комісар',       icon: '🔍', faction: 'town'   },
    deputy:     { ua: 'Помічник',      icon: '🛡️', faction: 'town'   },
    doctor:     { ua: 'Лікар',         icon: '💊', faction: 'town'   },
    roleblocker:{ ua: 'Повія',         icon: '🚫', faction: 'town'   },
    mafia:      { ua: 'Мафія',         icon: '🔫', faction: 'mafia'  },
    don:        { ua: 'Дон',           icon: '👑', faction: 'mafia'  },
    maniac:     { ua: 'Маньяк',        icon: '🔪', faction: 'maniac' },
};

function createMafiaState(roomPlayers, settings = {}) {
    const n = roomPlayers.length;
    const balance = MAFIA_BALANCE[n] || MAFIA_BALANCE[5];

    // Генеруємо пул ролей
    const rolePool = [];
    Object.entries(balance).forEach(([role, count]) => {
        for (let i = 0; i < count; i++) rolePool.push(role);
    });
    // Перемішуємо і призначаємо
    const shuffled = shuffle([...rolePool]);

    const players = roomPlayers.map((rp, i) => ({
        id:         i,
        socketId:   rp.socketId,
        name:       rp.name,
        role:       shuffled[i],
        isAlive:    true,
        isSilenced: false,
        skippedVotes: 0, // лічильник AFK-голосувань
    }));

    const mafiaIds = players.filter(p => p.role === 'mafia' || p.role === 'don').map(p => p.id);

    return {
        gameType:   'mafia',
        phase:      'role_reveal', // role_reveal → night → morning → day_discussion → day_voting → gameover
        round:      1,
        players,
        mafiaIds,              // список id мафіозі (для приватного чату)
        nightActions: {},      // зібрані нічні дії { sheriff, doctor, roleblocker, mafia:[], don }
        votes:      {},        // { voterId: targetId } для денного голосування
        lastDeaths: [],        // хто помер останньої ночі/голосування
        winner:     null,
        log:        [],
        // Налаштування (передані хостом)
        nightDuration:  settings.nightDuration  || 90,
        dayDuration:    settings.dayDuration    || 120,
        voteDuration:   settings.voteDuration   || 60,
        revealDeadline: Date.now() + 25000,
    };
}

function sanitizeMafia(state, forIdx) {
    const me = state.players[forIdx];
    const myRole = me?.role;
    const myFaction = MAFIA_ROLE_LABELS[myRole]?.faction;

    return {
        gameType:   'mafia',
        phase:      state.phase,
        round:      state.round,
        winner:     state.winner,
        lastDeaths: state.lastDeaths,
        log:        state.log.slice(0, 30),
        players: state.players.map(p => ({
            id:         p.id,
            name:       p.name,
            isAlive:    p.isAlive,
            isSilenced: p.isSilenced,
            // Роль видна: собі завжди; мафія бачить мафію; gameover всі
            role: (p.id === forIdx || state.phase === 'gameover' ||
                   (myFaction === 'mafia' && MAFIA_ROLE_LABELS[p.role]?.faction === 'mafia'))
                ? p.role : null,
        })),
        myId:        forIdx,
        myRole,
        myFaction,
        myRoleLabel: MAFIA_ROLE_LABELS[myRole] || null,
        mafiaIds:    myFaction === 'mafia' ? state.mafiaIds : null,
        // Голосування — власний вибір видно, чужі — ні
        myVote:    state.votes?.[forIdx] ?? null,
        // Всі голоси відкриті під час голосування (як у реальній грі)
        allVotes:  state.phase === 'day_voting' ? { ...state.votes } : {},
        voteCount: state.phase === 'day_voting'
            ? state.players.filter(p => p.isAlive && !p.isSilenced && state.votes[p.id] !== undefined).length
            : 0,
        eligibleVoters: state.players.filter(p => p.isAlive && !p.isSilenced).length,
        // Лічильник "Готовий" в role_reveal
        readyCount: state._ready ? state._ready.size : 0,
        // Дедлайни для відображення таймерів
        revealDeadline: state.revealDeadline || null,
        nightDeadline:  state.nightDeadline  || null,
        dayDeadline:    state.dayDeadline    || null,
        voteDeadline:   state.voteDeadline   || null,
    };
}

function emitMafiaUpdate(room, sideEffect) {
    room.players.forEach(rp => {
        io.to(rp.socketId).emit('stateUpdate', {
            state: sanitizeMafia(room.state, rp.index),
            sideEffect: sideEffect || null,
        });
    });
}

// ── Перевірка умов перемоги ──────────────────
function checkMafiaWin(state) {
    const alive        = state.players.filter(p => p.isAlive);
    const aliveMafia   = alive.filter(p => MAFIA_ROLE_LABELS[p.role]?.faction === 'mafia').length;
    const aliveTown    = alive.filter(p => MAFIA_ROLE_LABELS[p.role]?.faction === 'town').length;
    const aliveManiac  = alive.filter(p => p.role === 'maniac').length;

    // Маньяк перемагає коли залишився єдиним
    if (aliveManiac > 0 && aliveMafia === 0 && aliveTown === 0) {
        state.winner = 'maniac';
        state.phase  = 'gameover';
        state.log.unshift('🔪 Маньяк переміг! Він єдиний хто вижив.');
        return true;
    }
    // Місто перемагає коли знешкоджені і мафія і маньяк
    if (aliveMafia === 0 && aliveManiac === 0) {
        state.winner = 'town';
        state.phase  = 'gameover';
        state.log.unshift('🏆 Місто перемогло! Всіх злочинців знешкоджено.');
        return true;
    }
    // Мафія перемагає коли маньяк мертвий і мафія >= мирних
    if (aliveManiac === 0 && aliveMafia >= aliveTown) {
        state.winner = 'mafia';
        state.phase  = 'gameover';
        state.log.unshift('🔫 Мафія перемогла! Мирних залишилось менше.');
        return true;
    }
    return false;
}

// ── Нічна фаза ───────────────────────────────
function startNightPhase(room) {
    const state = room.state;
    state.phase = 'night';
    state.nightActions = {
        mafiaVotes:       {},   // { [voterId]: targetId }
        donCheck:         null, // { actorId, targetId }
        sheriffCheck:     null, // { actorId, targetId }
        doctorHeal:       null, // { actorId, targetId }
        roleblockerBlock: null, // { actorId, targetId }
        maniacKill:       null, // { actorId, targetId }
    };
    // Скидаємо isSilenced з попереднього раунду
    state.players.forEach(p => { p.isSilenced = false; });
    state.nightDeadline = Date.now() + state.nightDuration * 1000;
    addLog(state, `🌙 Ніч ${state.round} — місто засинає...`);
    emitMafiaUpdate(room, { event: 'nightStart', deadline: state.nightDeadline });
    clearTimeout(room.nightTimer);
    room.nightTimer = setTimeout(() => resolveNight(room), state.nightDuration * 1000);
}

function resolveNight(room) {
    clearTimeout(room.nightTimer);
    const state = room.state;
    if (state.phase !== 'night') return;
    state.phase = 'resolving'; // блокуємо повторний виклик одразу
    const acts  = state.nightActions;
    const ps    = state.players;

    // 1. Roleblocker: блокуємо ціль (їх дія цієї ночі анулюється, вдень мовчать)
    const nightBlocked = new Set();
    if (acts.roleblockerBlock) {
        const tid = acts.roleblockerBlock.targetId;
        nightBlocked.add(tid);
        ps[tid].isSilenced = true;
    }

    // 2. Doctor: захищаємо ціль (якщо лікар не заблокований)
    const protected_ = new Set();
    if (acts.doctorHeal && !nightBlocked.has(acts.doctorHeal.actorId)) {
        protected_.add(acts.doctorHeal.targetId);
    }

    // 3. Sheriff/Deputy: результат перевірки
    let sheriffResult = null;
    if (acts.sheriffCheck && !nightBlocked.has(acts.sheriffCheck.actorId)) {
        const t = ps[acts.sheriffCheck.targetId];
        sheriffResult = {
            targetId:   acts.sheriffCheck.targetId,
            targetName: t.name,
            isBad: MAFIA_ROLE_LABELS[t.role]?.faction === 'mafia',
        };
    }

    // 4. Don: перевірка чи є ціль Комісаром
    let donResult = null;
    if (acts.donCheck && !nightBlocked.has(acts.donCheck.actorId)) {
        const t = ps[acts.donCheck.targetId];
        donResult = {
            targetId:   acts.donCheck.targetId,
            targetName: t.name,
            isSheriff: t.role === 'sheriff' || t.role === 'deputy',
        };
    }

    // 5. Mafia kill: голос Дона вирішальний якщо він не заблокований
    let mafiaTarget = null;
    const don = ps.find(p => p.role === 'don' && p.isAlive);
    if (don && acts.mafiaVotes[don.id] !== undefined && !nightBlocked.has(don.id)) {
        mafiaTarget = acts.mafiaVotes[don.id];
    } else {
        const voteCounts = {};
        Object.entries(acts.mafiaVotes).forEach(([vid, tid]) => {
            if (!nightBlocked.has(+vid)) voteCounts[tid] = (voteCounts[tid] || 0) + 1;
        });
        const maxV = Math.max(...Object.values(voteCounts), 0);
        if (maxV > 0) mafiaTarget = +Object.keys(voteCounts).find(k => voteCounts[k] === maxV);
    }

    // 6. Maniac kill (незалежно від мафії)
    let maniacTarget = null;
    if (acts.maniacKill && !nightBlocked.has(acts.maniacKill.actorId)) {
        maniacTarget = acts.maniacKill.targetId;
    }

    // Застосовуємо вбивства
    state.lastDeaths = [];
    if (mafiaTarget !== null && mafiaTarget !== undefined && !protected_.has(mafiaTarget)) {
        ps[mafiaTarget].isAlive = false;
        state.lastDeaths.push(mafiaTarget);
    }
    if (maniacTarget !== null && maniacTarget !== undefined &&
        !protected_.has(maniacTarget) && ps[maniacTarget].isAlive) {
        ps[maniacTarget].isAlive = false;
        state.lastDeaths.push(maniacTarget);
    }

    // Наступник Комісара
    let newSheriffIdx = null;
    if (state.lastDeaths.some(id => ps[id].role === 'sheriff')) {
        const dep = ps.find(p => p.role === 'deputy' && p.isAlive);
        if (dep) {
            dep.role = 'sheriff';
            newSheriffIdx = dep.id;
            addLog(state, `👮 Помічник займає місце Комісара`);
        }
    }

    startMorningPhase(room, sheriffResult, donResult, newSheriffIdx);
}

function startMorningPhase(room, sheriffResult, donResult, newSheriffIdx = null) {
    const state = room.state;
    state.phase = 'morning';

    if (state.lastDeaths.length === 0) {
        addLog(state, '🌅 Місто прокинулось — ніхто не загинув.');
    } else {
        state.lastDeaths.forEach(id => {
            const p = state.players[id];
            addLog(state, `💀 Вночі загинув(ла) ${p.name} (${MAFIA_ROLE_LABELS[p.role]?.ua || p.role})`);
        });
    }

    if (checkMafiaWin(state)) {
        room.players.forEach(rp => io.to(rp.socketId).emit('gameOver', {
            state: sanitizeMafia(state, rp.index), gameType: 'mafia',
        }));
        return;
    }

    // Персоналізовані результати нічних перевірок
    room.players.forEach(rp => {
        const p = state.players[rp.index];
        let sideEffect = null;
        if (sheriffResult && (p.role === 'sheriff' || p.role === 'deputy'))
            sideEffect = { event: 'sheriffResult', ...sheriffResult };
        if (donResult && p.role === 'don')
            sideEffect = { event: 'donResult', ...donResult };
        if (newSheriffIdx !== null && rp.index === newSheriffIdx)
            sideEffect = { ...(sideEffect || {}), event: sideEffect?.event || 'newSheriff', newSheriff: true };
        io.to(rp.socketId).emit('stateUpdate', {
            state: sanitizeMafia(state, rp.index),
            sideEffect,
        });
    });

    setTimeout(() => startDayPhase(room), 2000);
}

// ── Денна фаза ───────────────────────────────
function startDayPhase(room) {
    const state = room.state;
    state.phase = 'day_discussion';
    state.votes  = {};
    state.dayDeadline = Date.now() + state.dayDuration * 1000;
    addLog(state, `☀️ День ${state.round} — місто обговорює підозрюваних...`);
    emitMafiaUpdate(room, { event: 'dayStart', deadline: state.dayDeadline });
    clearTimeout(room.dayTimer);
    room.dayTimer = setTimeout(() => startVotingPhase(room), state.dayDuration * 1000);
}

function startVotingPhase(room) {
    clearTimeout(room.dayTimer);
    const state = room.state;
    state.phase = 'day_voting';
    state.votes  = {};
    const VOTE_MS = (state.voteDuration || 60) * 1000;
    state.voteDeadline = Date.now() + VOTE_MS;
    addLog(state, `🗳️ Час голосувати! Оберіть підозрюваного або пропустіть.`);
    emitMafiaUpdate(room, { event: 'votingStart', deadline: state.voteDeadline });
    clearTimeout(room.voteTimer);
    room.voteTimer = setTimeout(() => resolveVoting(room), VOTE_MS);
}

function resolveVoting(room) {
    clearTimeout(room.voteTimer);
    const state = room.state;
    if (state.phase !== 'day_voting') return;
    state.phase = 'resolving'; // блокуємо повторний виклик одразу

    // Підраховуємо голоси (заглушені не голосують)
    const voteCounts = {};
    let skipCount = 0;
    Object.entries(state.votes).forEach(([vid, tid]) => {
        const voter = state.players[+vid];
        if (!voter?.isAlive || voter.isSilenced) return;
        if (tid === 'skip') { skipCount++; return; }
        voteCounts[tid] = (voteCounts[tid] || 0) + 1;
    });

    const maxV       = Math.max(...Object.values(voteCounts), 0);
    const topTargets = Object.keys(voteCounts).filter(k => voteCounts[k] === maxV);

    state.lastDeaths = [];

    if (maxV === 0 || topTargets.length > 1) {
        // Нічия або всі пропустили
        addLog(state, `⚖️ Нічия — місто нікого не вигнало.`);
    } else {
        const eliminated = +topTargets[0];
        state.players[eliminated].isAlive = false;
        state.lastDeaths.push(eliminated);
        const p = state.players[eliminated];
        addLog(state, `🗳️ ${p.name} вигнаний(а) з міста (${MAFIA_ROLE_LABELS[p.role]?.ua || p.role})`);
    }

    if (checkMafiaWin(state)) {
        room.players.forEach(rp => io.to(rp.socketId).emit('gameOver', {
            state: sanitizeMafia(state, rp.index), gameType: 'mafia',
        }));
        return;
    }

    // Наступна ніч
    state.round++;
    emitMafiaUpdate(room, { event: 'votingResolved' });
    setTimeout(() => startNightPhase(room), 5000);
}

// ── Обробка дій від клієнта (Мафія) ─────────
function processMafiaAction(state, type, data, pidx) {
    const player = state.players[pidx];
    if (!player?.isAlive) return;

    switch (type) {

        // Гравець переглянув роль → готовий
        case 'mafiaReady': {
            if (state.phase !== 'role_reveal') break;
            if (!state._ready) state._ready = new Set();
            state._ready.add(pidx);
            if (state._ready.size >= state.players.length) state._shouldStartNight = true;
            break;
        }

        // Голос мафії за жертву
        case 'mafiaVote': {
            if (state.phase !== 'night') break;
            if (player.role !== 'mafia' && player.role !== 'don') break;
            const { targetId: mvt } = data;
            if (!state.players[mvt]?.isAlive || mvt === pidx) break;
            state.nightActions.mafiaVotes[pidx] = mvt;
            break;
        }

        // Перевірка Дона (чи ціль Комісар?)
        case 'donCheck': {
            if (state.phase !== 'night' || player.role !== 'don') break;
            const { targetId: dct } = data;
            if (!state.players[dct]?.isAlive) break;
            state.nightActions.donCheck = { actorId: pidx, targetId: dct };
            break;
        }

        // Перевірка Комісара / Помічника
        case 'sheriffCheck': {
            if (state.phase !== 'night') break;
            if (player.role !== 'sheriff' && player.role !== 'deputy') break;
            const { targetId: sct } = data;
            if (!state.players[sct]?.isAlive || sct === pidx) break;
            state.nightActions.sheriffCheck = { actorId: pidx, targetId: sct };
            break;
        }

        // Лікування Лікаря
        case 'doctorHeal': {
            if (state.phase !== 'night' || player.role !== 'doctor') break;
            const { targetId: dht } = data;
            if (!state.players[dht]?.isAlive) break;
            state.nightActions.doctorHeal = { actorId: pidx, targetId: dht };
            break;
        }

        // Блокування Повії
        case 'roleblockerBlock': {
            if (state.phase !== 'night' || player.role !== 'roleblocker') break;
            const { targetId: rbt } = data;
            if (!state.players[rbt]?.isAlive || rbt === pidx) break;
            state.nightActions.roleblockerBlock = { actorId: pidx, targetId: rbt };
            break;
        }

        // Вбивство Маньяка
        case 'maniacKill': {
            if (state.phase !== 'night' || player.role !== 'maniac') break;
            const { targetId: mkt } = data;
            if (!state.players[mkt]?.isAlive || mkt === pidx) break;
            state.nightActions.maniacKill = { actorId: pidx, targetId: mkt };
            break;
        }

        // Голосування вдень (targetId або 'skip')
        case 'dayVote': {
            if (state.phase !== 'day_voting') break;
            if (!player.isAlive || player.isSilenced) break;
            const { targetId: dvt } = data;
            // null = скасування голосу
            if (dvt === null) { delete state.votes[pidx]; break; }
            if (dvt !== 'skip' && (!state.players[dvt]?.isAlive || dvt === pidx)) break;
            state.votes[pidx] = dvt;
            const eligible = state.players.filter(p => p.isAlive && !p.isSilenced);
            const voted    = eligible.filter(p => state.votes[p.id] !== undefined);
            if (voted.length >= eligible.length) state._resolveVoting = true;
            break;
        }
    }
}

// ── Таймер ходу ──────────────────────────────
function clearTurnTimer(room) {
    if (room.turnTimer) { clearTimeout(room.turnTimer); room.turnTimer = null; }
    if (room.state) room.state.turnDeadline = null;
}

function clearTradeTimer(room) {
    if (room.tradeTimer) { clearTimeout(room.tradeTimer); room.tradeTimer = null; }
    if (room.state) room.state.tradeDeadline = null;
}

function startTradeTimer(room) {
    clearTradeTimer(room);
    clearTurnTimer(room); // пауза таймера ходу під час угоди
    room.state.tradeDeadline = Date.now() + 20000;
    room.tradeTimer = setTimeout(() => {
        if (!room.started || !room.state?.pendingTrade) return;
        const trade = room.state.pendingTrade;
        const to = room.state.players[trade.toIdx];
        addLog(room.state, `⏱️ ${to.name} не відповів на угоду — скасовано`, 'warn');
        room.state.pendingTrade = null;
        room.state.tradeDeadline = null;
        startTurnTimer(room); // відновлюємо таймер ходу
        io.to(room.code).emit('stateUpdate', {
            state: sanitize(room.state),
            sideEffect: null,
            toast: { text: `⏱️ Час на відповідь вийшов — угоду скасовано`, color: '#e65100' },
        });
    }, 20000);
}

function startTurnTimer(room) {
    if (room.state?.pendingTrade) return; // не запускаємо під час очікування угоди
    const next = room.state?.players[room.state?.currentPlayerIndex];
    if (next?.bankrupt) return; // банкрутний гравець — хід вже передано
    clearTurnTimer(room);
    const TURN_MS = 90 * 1000;
    room.state.turnDeadline = Date.now() + TURN_MS;
    room.turnTimer = setTimeout(() => {
        if (!room.started || !room.state) return;
        const state = room.state;
        try {
            if (state.auctionState) {
                processAction(state, 'auctionPass', {}, room);
            } else if (state.pendingAction === 'coverDebt') {
                // Гравець не покрив борг за час ходу → авто-банкрутство
                processAction(state, 'declareBankrupt', {}, room);
            } else if (!state.hasRolled) {
                processAction(state, 'rollDice', {}, room);
                if (state.pendingAction === 'payRent') {
                    const canPay = state.players[state.currentPlayerIndex].money >= (state.pendingData?.rent || 0);
                    processAction(state, canPay ? 'payRent' : 'declareBankrupt', {}, room);
                } else if (state.pendingAction === 'offerPurchase') {
                    processAction(state, 'startAuction', {}, room);
                }
                if (state.hasRolled && !state.auctionState) processAction(state, 'endTurn', {}, room);
            } else if (!state.auctionState) {
                processAction(state, 'endTurn', {}, room);
            }
        } catch(e) { console.error('Auto-turn error:', e.message); }

        // Перевірка переможця після авто-дій (включаючи авто-банкрутство)
        const alive = state.players.filter(p => !p.bankrupt);
        if (alive.length === 1) {
            clearTurnTimer(room);
            addLog(state, `🏆 ${alive[0].name} — переможець!`, 'success');
            io.to(room.code).emit('gameOver', { winner: alive[0], state: sanitize(state) });
            return;
        }

        io.to(room.code).emit('stateUpdate', {
            state: sanitize(room.state),
            sideEffect: null,
            toast: { text: '⏱️ Час вийшов! Хід передано автоматично.', color: '#e65100' },
        });
        startTurnTimer(room);
    }, TURN_MS);
}

// ── Очищення неактивних кімнат ────────────────
setInterval(() => {
    const now = Date.now();
    const IDLE_MS = 30 * 60 * 1000;
    Object.keys(rooms).forEach(code => {
        const room = rooms[code];
        if (now - (room.lastActivityAt || room.createdAt) > IDLE_MS) {
            clearTurnTimer(room);
            clearTradeTimer(room);
            delete rooms[code];
            console.log(`🗑️ Кімнату ${code} видалено (неактивна 30+ хв)`);
        }
    });
}, 5 * 60 * 1000);

// ── Socket.io ─────────────────────────────────
// ── Helper: зберегти результат гри для всіх гравців ──
function saveGameStats(room, winnerFn) {
    // winnerFn(rp) → true якщо цей гравець виграв
    if (!room?.players) return;
    room.players.forEach(rp => {
        if (!rp.username) return; // гість — не зберігаємо
        const gameType = room.state?.gameType || room.gameType || 'monopoly';
        db.addStat(rp.username, gameType, winnerFn(rp));
    });
}

io.on('connection', (socket) => {
    console.log('+ підключення:', socket.id);

    // Автентифікація через токен при підключенні (опційно)
    socket.on('authenticate', ({ token }) => {
        try {
            const payload = jwt.verify(token, JWT_SECRET);
            socket.username = payload.username;
        } catch {}
    });

    // Створити кімнату
    socket.on('createRoom', ({ playerName, gameType = 'monopoly' }, cb) => {
        const code = generateCode();
        rooms[code] = {
            code,
            players: [{ socketId: socket.id, name: playerName, index: 0, username: socket.username || null }],
            started: false,
            state: null,
            gameType: gameType === 'tysyacha' ? 'tysyacha' : gameType === 'mafia' ? 'mafia' : gameType === 'durak' ? 'durak' : gameType === 'bunker' ? 'bunker' : 'monopoly',
            createdAt: Date.now(),
            lastActivityAt: Date.now(),
        };
        socket.join(code);
        socket.roomCode = code;
        socket.playerIndex = 0;
        console.log(`Кімната ${code} створена`);
        cb({ code, playerIndex: 0, gameType: rooms[code].gameType });
    });

    // Перегляд кімнати без входу
    socket.on('peekRoom', ({ code }, cb) => {
        const room = rooms[code?.toUpperCase()];
        if (!room) return cb({ error: 'not_found' });
        const maxPlayers = room.gameType === 'tysyacha' ? 3 : room.gameType === 'mafia' ? 15 : room.gameType === 'durak' ? 6 : room.gameType === 'bunker' ? 15 : 6;
        cb({ players: room.players.length, max: maxPlayers, gameType: room.gameType, started: room.started });
    });

    // Приєднатись до кімнати
    socket.on('joinRoom', ({ code, playerName }, cb) => {
        const room = rooms[code];
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
        const room = rooms[socket.roomCode];
        if (!room) return;

        // Bunker under active game: special logic
        if (room.started && room.state?.gameType === 'bunker') {
            const remainingHumans = room.players.filter(p => !p.isBot && p.index !== socket.playerIndex);
            if (remainingHumans.length === 0) {
                clearBunkerTimer(room);
                io.to(socket.roomCode).emit('roomClosed', { reason: 'Усі гравці покинули гру' });
                delete rooms[socket.roomCode];
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
            delete rooms[socket.roomCode];
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
            io.to(room.code).emit('lobbyUpdate', { players: room.players.map(p => p.name), gameType: room.gameType });
        }
    });

    // Дострокове завершення гри
    socket.on('abandonGame', () => {
        const code = socket.roomCode;
        const room = rooms[code];
        if (!room) return;
        const name = room.players[socket.playerIndex]?.name || 'Гравець';
        io.to(code).emit('gameAbandoned', { reason: `${name} достроково завершив(ла) гру` });
        room.players.forEach(p => {
            const s = io.sockets.sockets.get(p.socketId);
            if (s) { s.leave(code); s.roomCode = null; s.playerIndex = null; }
        });
        delete rooms[code];
    });

    // Здатись у Монополії: банкрутство гравця, решта продовжує
    socket.on('surrenderMonopoly', () => {
        const code = socket.roomCode;
        const room = rooms[code];
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
            io.to(code).emit('gameOver', { winner: alive[0], state: sanitize(state) });
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
        const room = rooms[socket.roomCode];
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
        const room = rooms[socket.roomCode];
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
        const room = rooms[socket.roomCode];
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
        const available = Object.values(rooms)
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
        const room = rooms[socket.roomCode];
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

        io.to(socket.roomCode).emit('lobbyUpdate', { players: room.players.map(p => p.name), gameType: room.gameType });
    });

    // Додати / прибрати бота (тільки хост, тільки в залі очікування)
    socket.on('addBot', () => {
        const room = rooms[socket.roomCode];
        if (!room || socket.playerIndex !== 0 || room.started || room.gameType !== 'bunker') return;
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
        const room = rooms[socket.roomCode];
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
        const room = rooms[socket.roomCode];
        if (!room || socket.playerIndex !== 0) return;
        room.settings = { ...(room.settings || {}), ...newSettings };
    });

    socket.on('startGame', ({ settings } = {}) => {
        const room = rooms[socket.roomCode];
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
        const room = rooms[socket.roomCode];
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
        const room = rooms[socket.roomCode];
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
                saveGameStats(room, rp => state.loser !== rp.index);
                db.deleteRoom(room.code);
                room.players.forEach(rp => {
                    io.to(rp.socketId).emit('gameOver', {
                        state: sanitizeDurak(state, rp.index),
                        gameType: 'durak',
                    });
                });
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
                room.players.forEach(rp => {
                    io.to(rp.socketId).emit('gameOver', {
                        state: sanitizeMafia(state, rp.index),
                        gameType: 'mafia',
                    });
                });
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
                saveGameStats(room, rp => state.winner === rp.index);
                db.deleteRoom(room.code);
                room.players.forEach(rp => {
                    io.to(rp.socketId).emit('gameOver', {
                        winner: state.players[state.winner],
                        state: sanitizeTysyacha(state, rp.index),
                        gameType: 'tysyacha',
                    });
                });
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
            addLog(state, `🏆 ${alive[0].name} — переможець!`, 'success');
            io.to(socket.roomCode).emit('gameOver', { winner: alive[0], state: sanitize(state) });
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
        const room = rooms[code];
        if (!room) return cb({ error: 'Кімнату не знайдено (можливо сервер перезапускався)' });

        const rp = room.players.find(p => p.index === playerIndex && p.name === playerName);
        if (!rp) return cb({ error: 'Гравця не знайдено в кімнаті' });

        // Оновлюємо socket ID
        rp.socketId = socket.id;
        socket.join(code);
        socket.roomCode  = code;
        socket.playerIndex = playerIndex;

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
        } else {
            cb({ success: true, started: false, players: room.players.map(p => p.name), bots: room.players.map(p => p.isBot || false) });
            io.to(code).emit('lobbyUpdate', { players: room.players.map(p => p.name), bots: room.players.map(p => p.isBot || false), gameType: room.gameType });
        }
    });

    // Чат
    socket.on('chatMessage', ({ text, icon, name, color }) => {
        if (!socket.roomCode) return;
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

    // Відключення
    socket.on('disconnect', () => {
        console.log('- відключення:', socket.id);
        const room = rooms[socket.roomCode];
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

        // Bunker: close room if all humans disconnected (60s grace for reconnect)
        if (room.started && room.state?.gameType === 'bunker') {
            const roomCode = socket.roomCode;
            setTimeout(() => {
                const r = rooms[roomCode];
                if (!r) return;
                const connectedHumans = r.players.filter(
                    p => !p.isBot && p.socketId && io.sockets.sockets.get(p.socketId)
                );
                if (connectedHumans.length === 0) {
                    clearBunkerTimer(r);
                    delete rooms[roomCode];
                }
            }, 60_000);
        }
    });
});

// Прибираємо надмірні дані перед відправкою клієнту
function sanitize(state) {
    return {
        players: state.players,
        cellState: state.cellState,
        currentPlayerIndex: state.currentPlayerIndex,
        lastDiceRoll: state.lastDiceRoll,
        hasRolled: state.hasRolled,
        doublesCount: state.doublesCount,
        auctionState: state.auctionState,
        pendingTrade: state.pendingTrade,
        log: state.log,
        pendingAction: state.pendingAction,
        pendingData: state.pendingData,
        turnDeadline: state.turnDeadline,
        tradeDeadline: state.tradeDeadline,
    };
}

// ── Відновлення кімнат після перезапуску ─────
async function restoreRoomsFromDB() {
    await db.cleanOldRooms();
    const saved = await db.getAllRooms();
    let restored = 0;
    for (const { code, gameType, state } of saved) {
        if (rooms[code]) continue; // вже є
        // Відновлюємо кімнату без гравців (вони підключаться через rejoin)
        rooms[code] = {
            code,
            players: [],
            started: true,
            state,
            gameType,
            createdAt: Date.now(),
            lastActivityAt: Date.now(),
        };
        restored++;
    }
    if (restored > 0) console.log(`♻️  Відновлено ${restored} кімнат з БД`);
}

// Автозбереження активних кімнат кожні 30 секунд
async function autoSaveRooms() {
    for (const room of Object.values(rooms)) {
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
    // Self-ping щоб Render не засипав (тільки на продакшені)
    if (process.env.RENDER_EXTERNAL_URL) {
        setInterval(() => {
            http.get(process.env.RENDER_EXTERNAL_URL).on('error', () => {});
        }, 14 * 60 * 1000);
    }
});
