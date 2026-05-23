// ============================================
// МОНОПОЛІЯ УКРАЇНИ — client.js
// Socket.io клієнт: лобі, отримання стану, відправка дій
// ============================================

const socket = io();

// Передаємо токен серверу одразу після підключення (для статистики)
socket.on('connect', () => {
    const auth = (() => { try { return JSON.parse(localStorage.getItem('monopolia_auth')); } catch { return null; } })();
    if (auth?.token) socket.emit('authenticate', { token: auth.token });
});

// Мій індекс гравця у цій сесії
let myPlayerIndex = null;

// ── Звуковий движок (Web Audio API) ──────────
const _sfx = { ctx: null, get() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); return this.ctx; } };
let _soundMuted = localStorage.getItem('igclub_muted') === '1';
function toggleMute() {
    _soundMuted = !_soundMuted;
    localStorage.setItem('igclub_muted', _soundMuted ? '1' : '0');
    const btn = document.getElementById('mute-btn');
    if (btn) btn.textContent = _soundMuted ? '🔇' : '🔊';
}
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('mute-btn');
    if (btn && _soundMuted) btn.textContent = '🔇';
});
function playSound(type) {
    if (_soundMuted) return;
    try {
        const ctx = _sfx.get();
        const t   = ctx.currentTime;
        const note = (freq, wt='sine', vol=0.08, dur=0.15, delay=0, freqEnd=null) => {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.type = wt; o.connect(g); g.connect(ctx.destination);
            o.frequency.setValueAtTime(freq, t + delay);
            if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + delay + dur);
            g.gain.setValueAtTime(vol, t + delay);
            g.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
            o.start(t + delay); o.stop(t + delay + dur);
        };
        switch (type) {
            // ── Тисяча ──
            case 'cardSelect':  note(1100,'sine',0.04,0.06); break;
            case 'cardPlay':    note(600,'triangle',0.1,0.16,0,280); break;
            case 'trickTaken':  note(380,'sine',0.12,0.24,0,180); break;
            case 'myTurn':      note(660,'sine',0.08,0.2); note(880,'sine',0.08,0.2,0.13); break;
            case 'marriage':    [523,659,784].forEach((f,i)=>note(f,'sine',0.1,0.3,i*0.1)); break;
            case 'roundEnd':    note(440,'sine',0.08,0.45,0,220); break;
            // ── Мафія ──
            case 'night':       note(140,'sine',0.14,1.3,0,80); note(110,'sine',0.09,1.6,0.25); break;
            case 'day':         note(550,'sine',0.08,0.28,0,720); note(700,'sine',0.06,0.22,0.16); break;
            case 'vote':        note(820,'sine',0.06,0.1); break;
            case 'death':       note(220,'sawtooth',0.07,0.5,0,110); note(165,'sine',0.05,0.6,0.12); break;
            // ── Монополія ──
            case 'step':        note(900,'sine',0.04,0.07,0,700); break;
            case 'buy':         note(523,'sine',0.09,0.2); note(659,'sine',0.09,0.2,0.12); break;
            case 'rent':        note(280,'sawtooth',0.07,0.3,0,180); break;
            case 'card':        note(700,'triangle',0.07,0.13,0,420); break;
            case 'tick':        note(1200,'sine',0.03,0.05); break;
            case 'tick-last':   note(1500,'sine',0.07,0.07); break;
            case 'jail':        note(250,'square',0.06,0.35,0,180); note(200,'sine',0.05,0.4,0.2); break;
            case 'roll':        [1,2,3].forEach(i=>note(400+i*80,'triangle',0.04,0.07,i*0.04)); break;
            case 'double':      note(880,'sine',0.1,0.15); note(1100,'sine',0.1,0.15,0.1); note(1320,'sine',0.1,0.2,0.2); break;
            // ── Загальні ──
            case 'win':         [523,659,784,1047].forEach((f,i)=>note(f,'sine',0.11,0.35,i*0.13)); break;
            case 'lose':        note(330,'sine',0.09,0.45,0,220); note(277,'sine',0.07,0.55,0.22); break;
        }
    } catch(e) {}
}

// ── Статистика (localStorage) ─────────────────
function updateStats(game, won) {
    const k = 'stats_' + game;
    const s = JSON.parse(localStorage.getItem(k) || '{"g":0,"w":0}');
    s.g++; if (won) s.w++;
    localStorage.setItem(k, JSON.stringify(s));
}
function getStats(game) {
    return JSON.parse(localStorage.getItem('stats_' + game) || '{"g":0,"w":0}');
}

// ── Збереження імені гравця (гість) ──────────
const NAME_KEY = 'monopolia_name';
function saveName(name) { localStorage.setItem(NAME_KEY, name); }
function loadName()     { return localStorage.getItem(NAME_KEY) || ''; }

// ── Авторизація ───────────────────────────────
const AUTH_KEY = 'monopolia_auth'; // { token, username }

function saveAuth(token, username) {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ token, username }));
}
function loadAuth() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY)); } catch { return null; }
}
function clearAuth() { localStorage.removeItem(AUTH_KEY); }

let _isGuest       = false;
let _authUsername  = '';

async function checkAuth() {
    const joinCode = new URLSearchParams(window.location.search).get('join');

    const auth = loadAuth();
    if (auth?.token) {
        try {
            const res = await fetch('/api/me', {
                headers: { Authorization: `Bearer ${auth.token}` }
            });
            if (res.ok) {
                const { username } = await res.json();
                _authUsername = username;
                _isGuest = false;
                _enterLobby(username, joinCode);
                return;
            }
        } catch {}
        clearAuth();
    }
    // AUTH вимкнено — вмикається коли потрібно (замінити рядок нижче)
    // document.getElementById('auth-screen').classList.remove('hidden');
    playAsGuest();
    if (joinCode) _pendingJoinCode = joinCode.toUpperCase();
}

function _enterLobby(username, joinCode) {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('lobby-screen').classList.remove('hidden');

    const nameInput = document.getElementById('lobby-name');
    if (username) {
        // Авторизований — ім'я заблоковано
        if (nameInput) {
            nameInput.value    = username;
            nameInput.readOnly = true;
            nameInput.style.opacity = '0.65';
            nameInput.title = 'Ім\'я прив\'язане до акаунту';
        }
        // Показуємо рядок акаунту
        const bar = document.getElementById('account-bar');
        const nameEl = document.getElementById('account-name');
        if (bar) bar.classList.remove('hidden');
        if (nameEl) nameEl.textContent = username;
    } else {
        // Гість — поле вільне
        if (nameInput) {
            nameInput.value    = loadName();
            nameInput.readOnly = false;
            nameInput.style.opacity = '1';
            nameInput.removeAttribute('title');
        }
    }

    // Показуємо банер запрошення якщо є код у URL або sessionStorage
    const code = joinCode || sessionStorage.getItem('pendingJoin') || '';
    const banner  = document.getElementById('join-invite-banner');
    if (code) {
        _pendingJoinCode = code.toUpperCase();
        if (banner)  banner.classList.remove('hidden');
        sessionStorage.removeItem('pendingJoin');
        // Peek: показуємо скільки гравців вже в кімнаті
        socket.emit('peekRoom', { code: code.toUpperCase() }, ({ players, max, gameType, started, error } = {}) => {
            const peekEl = document.getElementById('join-room-peek');
            if (!peekEl) return;
            if (error || !players) { peekEl.textContent = ''; return; }
            const gNames = { tysyacha: 'Тисяча', mafia: 'Мафія', monopoly: 'Монополія', durak: 'Дурак' };
            peekEl.textContent = started
                ? '⚠️ Гра вже почалась'
                : `${gNames[gameType] || gameType} · ${players}/${max} гравців`;
        });
    } else {
        if (banner) banner.classList.add('hidden');
    }

    // Показуємо статистику на картках ігор
    ['monopoly', 'tysyacha', 'durak', 'mafia'].forEach(game => {
        const st = getStats(game);
        const el = document.getElementById('stat-' + game);
        if (!el) return;
        if (st.g > 0) {
            el.textContent = `🏆 ${st.w}/${st.g}`;
            el.classList.remove('hidden');
            el.classList.add('has-stats');
        }
    });
}

// ── Кнопки авторизації ────────────────────────
function switchAuthTab(tab) {
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register').classList.toggle('active', tab === 'register');
    const btn = document.getElementById('auth-submit-btn');
    if (btn) btn.textContent = tab === 'login' ? 'Увійти' : 'Зареєструватись';
    const err = document.getElementById('auth-error');
    if (err) err.style.display = 'none';
}

async function doAuth() {
    const username = (document.getElementById('auth-username')?.value || '').trim();
    const password =  document.getElementById('auth-password')?.value || '';
    const isLogin  = document.getElementById('tab-login')?.classList.contains('active');
    const errEl    = document.getElementById('auth-error');
    const btn      = document.getElementById('auth-submit-btn');

    if (errEl) errEl.style.display = 'none';
    if (!username || !password) {
        if (errEl) { errEl.textContent = 'Заповніть усі поля'; errEl.style.display = 'block'; }
        return;
    }
    if (btn) { btn.disabled = true; btn.textContent = '…'; }

    try {
        const res  = await fetch(isLogin ? '/api/login' : '/api/register', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok) {
            if (errEl) { errEl.textContent = data.error || 'Помилка'; errEl.style.display = 'block'; }
            return;
        }
        saveAuth(data.token, data.username);
        _authUsername = data.username;
        _isGuest = false;
        _enterLobby(data.username, null);
    } catch {
        if (errEl) { errEl.textContent = 'Помилка з\'єднання з сервером'; errEl.style.display = 'block'; }
    } finally {
        if (btn) { btn.disabled = false; switchAuthTab(isLogin ? 'login' : 'register'); }
    }
}

function playAsGuest() {
    _isGuest = true;
    _authUsername = '';
    _enterLobby('', null);
}

function logOut() {
    clearAuth();
    _isGuest = false;
    _authUsername = '';
    // Ховаємо лобі, показуємо auth
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('account-bar')?.classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
    // Очищаємо поля auth
    const u = document.getElementById('auth-username');
    const p = document.getElementById('auth-password');
    if (u) u.value = '';
    if (p) p.value = '';
}

// ── Лічильник кімнат ─────────────────────────
async function fetchRoomCounts() {
    try {
        const res = await fetch('/api/rooms/count');
        if (!res.ok) return;
        const counts = await res.json();
        ['monopoly', 'tysyacha', 'mafia', 'durak'].forEach(type => {
            const el = document.getElementById(`rooms-${type}`);
            if (!el) return;
            const n = counts[type] || 0;
            if (n > 0) {
                el.textContent = `🏠 ${n} ${n === 1 ? 'кімната' : n < 5 ? 'кімнати' : 'кімнат'}`;
                el.classList.add('has-rooms');
            } else {
                el.textContent = '';
                el.classList.remove('has-rooms');
            }
        });
    } catch {}
}

// ── Ініціалізація при завантаженні ───────────
window.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    fetchRoomCounts();
    setInterval(fetchRoomCounts, 15000);
    // Відновлюємо ім'я з localStorage
    const saved = loadName();
    if (saved) {
        const el = document.getElementById('lobby-name');
        if (el && !el.value) el.value = saved;
    }
});

// ── Збереження сесії ─────────────────────────
const SESSION_KEY = 'monopolia_session';

function saveSession(code, playerIndex, playerName) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ code, playerIndex, playerName }));
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

function setQuitBtn(visible) {
    ['quit-btn-monopoly', 'quit-btn-tysyacha', 'quit-btn-mafia', 'quit-btn-durak'].forEach(id => {
        document.getElementById(id)?.classList.toggle('hidden', !visible);
    });
}

function tryRejoin() {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    let session;
    try { session = JSON.parse(raw); } catch { clearSession(); return; }

    const { code, playerIndex, playerName } = session;
    socket.emit('rejoin', { code, playerIndex, playerName }, ({ success, error, started, state, players }) => {
        if (error) {
            clearSession();
            showRejoinError(error);
            return;
        }
        myPlayerIndex = playerIndex;
        if (started && state) {
            document.getElementById('lobby-screen').classList.add('hidden');
            setQuitBtn(true);
            if (state.gameType === 'durak') {
                initDurak(state, myPlayerIndex);
                return;
            }
            if (state.gameType === 'tysyacha') {
                initTysyacha(state, myPlayerIndex);
                return;
            }
            if (state.gameType === 'mafia') {
                initMafia(state, myPlayerIndex);
                return;
            }
            showGameScreen();
            // Ініціалізуємо _prevPos щоб токени не анімувались з позиції 0
            if (state.players) state.players.forEach(p => { _prevPos[p.id] = p.position; });
            applyState(state, false, null, null);
            log(`🔄 Підключення відновлено як ${playerName}`, 'success');
            // Відновлюємо модали які були відкриті до відключення
            setTimeout(() => {
                const me = state.players[myPlayerIndex];
                if (!me) return;
                const isMyTurn = myPlayerIndex === state.currentPlayerIndex;
                if (state.pendingAction === 'coverDebt' && isMyTurn) {
                    showCoverDebtModal(state.pendingData?.shortfall || 0);
                } else if (state.pendingAction === 'casino' && isMyTurn) {
                    showCasinoModal(me.money);
                } else if (state.pendingAction === 'payRent' && isMyTurn) {
                    const { rent, ownerId, pos } = state.pendingData || {};
                    showRentModalOnline(me, BOARD[pos], rent, state.players[ownerId]);
                } else if (state.auctionState) {
                    showAuctionUIOnline(state);
                } else if (me.inJail && isMyTurn) {
                    offerJailOptions(me);
                } else if (state.pendingAction === 'offerPurchase' && isMyTurn) {
                    offerPurchaseOnline(me, BOARD[state.pendingData?.pos]);
                }
            }, 500);

        } else {
            // Очікування гравців — показуємо залу
            showLobbyWaiting(code);
            const list = document.getElementById('lobby-players-list');
            if (list && players) {
                list.innerHTML = players.map((n, i) =>
                    `<div>${i === 0 ? '👑 ' : ''}${n}</div>`
                ).join('');
            }
        }
    });
}

function showRejoinError(msg) {
    const el = document.getElementById('rejoin-error');
    if (el) { el.innerText = msg; el.style.display = 'block'; }
}

// ── Статус з'єднання ─────────────────────────
function setConnectionStatus(online) {
    const el = document.getElementById('connection-status');
    if (!el) return;
    el.textContent    = online ? '🟢 Online' : '🔴 Offline';
    el.style.background = online ? '#e8f5e9' : '#ffebee';
    el.style.color      = online ? '#2e7d32' : '#c62828';
    el.style.display    = 'inline-block';
}

// ── Toast-сповіщення ─────────────────────────
function showToast(text, { color = '#333', duration = 3500 } = {}) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.style.cssText = `background:${color};color:white;padding:10px 16px;border-radius:10px;
        margin-bottom:8px;font-size:14px;opacity:0;transform:translateX(60px);
        transition:all 0.3s ease;box-shadow:0 4px 12px rgba(0,0,0,0.25);
        max-width:280px;word-wrap:break-word;pointer-events:none`;
    el.textContent = text;
    container.appendChild(el);
    el.style.pointerEvents = duration === 0 ? 'auto' : 'none';
    if (duration === 0) el.style.cursor = 'pointer';
    requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateX(0)'; });
    if (duration > 0) setTimeout(() => {
        el.style.opacity = '0'; el.style.transform = 'translateX(60px)';
        setTimeout(() => el.remove(), 320);
    }, duration);
}

// ── Таймер ходу ──────────────────────────────
let _timerInterval = null;
let _lastTickSec   = -1;
function updateTurnTimer(deadline) {
    if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
    _lastTickSec = -1;
    const el = document.getElementById('turn-timer');
    if (!el) return;
    if (!deadline) { el.textContent = ''; el.style.cssText = ''; return; }
    const tick = () => {
        const sec    = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        const urgent = sec <= 15;
        const warn   = sec <= 30;
        el.textContent = `⏱ ${sec}с`;
        el.style.cssText = `
            display:inline-block;padding:4px 14px;border-radius:20px;font-size:15px;font-weight:800;
            letter-spacing:0.5px;min-height:28px;margin:2px 0;
            background:${urgent ? 'rgba(198,40,40,0.92)' : warn ? 'rgba(230,81,0,0.88)' : 'rgba(0,0,0,0.45)'};
            color:white;box-shadow:0 2px 8px rgba(0,0,0,0.4);
            ${urgent ? 'animation:timer-pulse 0.6s ease-in-out infinite alternate' : ''}
        `;
        // Тік раз на секунду (інтервал 500ms — перевіряємо що секунда змінилась)
        if (urgent && sec > 0 && sec !== _lastTickSec) {
            _lastTickSec = sec;
            playSound(sec <= 5 ? 'tick-last' : 'tick');
        }
        if (sec === 0) { clearInterval(_timerInterval); _timerInterval = null; }
    };
    tick();
    _timerInterval = setInterval(tick, 500);
}

// При підключенні — перевіряємо збережену сесію
socket.on('connect', () => {
    setConnectionStatus(true);
    tryRejoin();
});
socket.on('disconnect', (reason) => {
    setConnectionStatus(false);
    // Якщо сервер рестартував — показуємо зрозуміле повідомлення
    if (reason === 'transport close' || reason === 'transport error') {
        showToast('🔄 Сервер оновився. Оновіть сторінку щоб продовжити.', { color: '#c62828', duration: 0 });
    }
});

// ── Чат ──────────────────────────────────────
const _esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

socket.on('chatMessage', ({ playerIndex, icon, name, color, text }) => {
    // Монополія і Тисяча — різні контейнери, оновлюємо той що є
    const targets = [
        { id: 'chat-messages',   msgClass: 'chat-message',  authorClass: 'chat-author' },
        { id: 't-chat-messages', msgClass: 't-chat-msg',    authorClass: 't-chat-author' },
        { id: 'd-chat-messages', msgClass: 'd-chat-msg',    authorClass: 'd-chat-author' },
    ];
    targets.forEach(({ id, msgClass, authorClass }) => {
        const container = document.getElementById(id);
        if (!container) return;
        const msg = document.createElement('div');
        msg.className = msgClass;
        msg.style.borderLeftColor = _esc(color);
        msg.innerHTML = `<span class="${authorClass}" style="color:${_esc(color)}">${_esc(icon)} ${_esc(name)}:</span> ${_esc(text)}`;
        container.appendChild(msg);
        container.scrollTop = container.scrollHeight;
        while (container.children.length > 60) container.removeChild(container.firstChild);
    });
});

function sendDurakChat() {
    const input = document.getElementById('d-chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    const me = dState?.players[dMyIdx];
    const colors = ['#e53935','#1565c0','#2e7d32','#e65100','#6a1b9a','#00838f'];
    socket.emit('chatMessage', { text, icon: '🂡', name: me?.name || 'Гравець', color: colors[dMyIdx % colors.length] });
    input.value = '';
    input.focus();
}

function _showDndHint(game) {
    const key = 'igclub_dnd_' + game;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    setTimeout(() => showToast('💡 Перетягніть карту або двічі клікніть щоб зіграти', { color: '#1565c0', duration: 5000 }), 2500);
}

// ── Заглушки функцій engine.js (сервер все обробляє) ─
function saveGame()        {}
function loadGame()        { return false; }
function clearSavedGame()  {}
function hasSavedGame()    { return false; }
function takeMoney(p, amt) {}
function addMoney(p, amt)  {}
function payAllPlayers()   {}
function collectFromAll()  {}
function moveTo()          {}
function goToJail()        {}
function handleLanding()   {}
function moveToNearest()   {}
function startAuction()    { sendAction('startAuction'); }

function refreshAllCells() {
    Object.keys(cellState).forEach(pos => updateBoardCell(parseInt(pos)));
}

function calcNetWorth(player) {
    let total = player.money;
    (player.properties || []).forEach(pos => {
        const c = BOARD[pos];
        const s = cellState[pos];
        if (!c || !s) return;
        total += s.mortgaged ? Math.floor(c.price / 2) : c.price;
        total += s.houses === 5 ? c.housePrice * 5 : s.houses * c.housePrice;
    });
    total -= (player.loan || 0) + (player.loanInterest || 0);
    return total;
}

function declareBankrupt() {
    sendAction('declareBankrupt');
    closeModal();
}

// ── Лобі ─────────────────────────────────────
let _inviteCode = '';
let _selectedGame = 'monopoly';
let _pendingJoinCode = '';

function selectGame(type) {
    _selectedGame = type;
    // Знімаємо active з усіх карток і ставимо на обрану
    document.querySelectorAll('.game-card').forEach(btn => {
        const game = btn.dataset.game || btn.id?.replace('game-btn-', '');
        btn.classList.toggle('active', game === type);
    });
}

function _lobbyError(msg, focusId) {
    showToast('⚠️ ' + msg, { color: '#b71c1c', duration: 3000 });
    if (focusId) document.getElementById(focusId)?.focus();
}

function createRoom() {
    const name = document.getElementById('lobby-name').value.trim();
    if (!name) return _lobbyError('Введіть своє ім\'я', 'lobby-name');
    saveName(name);
    socket.emit('createRoom', { playerName: name, gameType: _selectedGame }, ({ code, playerIndex, gameType, error }) => {
        if (error) return _lobbyError(error);
        myPlayerIndex = playerIndex;
        saveSession(code, playerIndex, name);
        if (gameType === 'bunker') { location.replace('/bunker'); return; }
        showLobbyWaiting(code);
    });
}

function joinRoom() {
    const name = document.getElementById('lobby-name').value.trim();
    const code = _pendingJoinCode;
    if (!name) return _lobbyError('Введіть своє ім\'я', 'lobby-name');
    if (!code) return _lobbyError('Немає коду кімнати — скористайтесь посиланням-запрошенням', 'lobby-name');
    saveName(name);
    socket.emit('joinRoom', { code, playerName: name }, ({ code: c, playerIndex, gameType, error }) => {
        if (error) return _lobbyError(error);
        myPlayerIndex = playerIndex;
        saveSession(c, playerIndex, name);
        if (gameType === 'bunker') { location.replace('/bunker'); return; }
        showLobbyWaiting(c);
    });
}

const HOW_TO_PLAY = {
    tysyacha: `<b>🃏 Тисяча</b> — карткова гра на очки.<br><br>
<b>Мета:</b> першим набрати 1000 очок.<br><br>
<b>Торги:</b> гравці по колу підвищують ставку (мінімум 100). Хто виграв — бере прикуп (3 зайві карти), роздає по 1 суперникам і оголошує свою ставку.<br><br>
<b>Гра:</b> переможець торгів ходить першим. Потрібно йти в масть ведучого. Хто більший — бере взятку і ходить наступним.<br><br>
<b>Шлюб:</b> якщо є Дама + Король однієї масті — оголошується автоматично при грі першою картою. ♠=40, ♣=60, ♦=80, ♥=100. Перший шлюб стає козирем.<br><br>
<b>Козир</b> б'є будь-яку масть.<br><br>
<b>Підрахунок:</b> 9=0, J=2, Q=3, K=4, 10=10, A=11. Якщо набрав ≥ ставки — отримуєш ставку. Ні — мінус ставка.<br><br>
<b>🛢️ Бочка:</b> при 900 очках — 3 спроби виграти торги і зробити ставку. Не вдалось — рахунок падає на 800.`,

    mafia: `<b>🔫 Мафія</b> — гра на дедукцію і переконання.<br><br>
<b>Ролі:</b><br>
👤 Мирний — голосує вдень, шукає мафію<br>
🔍 Комісар — вночі перевіряє гравця (мафія чи ні)<br>
🛡️ Помічник — успадковує роль Комісара якщо він гине<br>
💊 Лікар — вночі захищає одного гравця від вбивства<br>
🔫 Мафія — вночі вбиває мирного<br>
👑 Дон — вночі перевіряє чи є хтось Комісаром<br>
🔪 Маньяк — вбиває всіх, виграє один<br><br>
<b>Ніч:</b> всі закривають очі, кожна роль виконує дію.<br>
<b>Ранок:</b> оголошують хто загинув.<br>
<b>День:</b> обговорення і голосування — виганяєте підозрюваного.<br><br>
<b>Перемога:</b> Мирні — якщо мафіозних не більше мирних. Мафія — якщо їх стільки ж або більше. Маньяк — якщо всі загинули.`,

    durak: `<b>🂡 Дурак</b> — карткова гра. Хто залишився з картами — дурень.<br><br>
<b>Колода:</b> 36 карт (6–Туз). Кожному роздають по 6. Остання карта колоди — козирна масть.<br><br>
<b>Старшинство:</b> 6 &lt; 7 &lt; 8 &lt; 9 &lt; 10 &lt; J &lt; Q &lt; K &lt; A. Козир б'є будь-яку масть, козир б'ється старшим козирем.<br><br>
<b>Атака:</b> гравець ходить однією або кількома картами одного рангу (напр. двома дев'ятками).<br><br>
<b>Захист:</b> треба побити кожну карту — старшою того ж масті або будь-яким козирем.<br><br>
<b>Підкидання:</b> атакуючий та інші (не захисник) можуть підкидати карти рангу вже на столі. Не більше 6 карт за хід і не більше ніж карт у захисника.<br><br>
<b>Якщо відбив</b> — карти в скид, захисник ходить наступним.<br>
<b>Якщо не відбив</b> — забирає всі карти зі столу.<br><br>
<b>Добір:</b> після ходу гравці добирають до 6 карт: спочатку атакуючий, потім інші, захисник — останній.<br><br>
<b>Перевідний режим:</b> якщо є карта того ж рангу що й атака — можна перевести хід наступному гравцю (але тільки якщо ще не почав відбиватись).<br><br>
<b>Перемога:</b> позбувся карт — вийшов з гри. Останній з картами — дурень.`,

    monopoly: `<b>🎲 Монополія України</b> — класична гра на нерухомість.<br><br>
<b>Хід:</b> кидаєш кубики, пересуваєш фішку.<br><br>
<b>Купівля:</b> якщо клітинка вільна — можна купити. Якщо зайнята — платиш ренту власнику.<br><br>
<b>Будинки:</b> маючи всі міста одного кольору — будуй будинки та готелі. Рента зростає.<br><br>
<b>Тюрма:</b> потрапляєш якщо перейшов клітинку тюрми або випав дубль тричі. Виходиш сплативши 50 або дублем.<br><br>
<b>Банкрутство:</b> якщо не можеш сплатити — продаєш майно. Якщо нічого немає — вибуваєш.<br><br>
<b>Перемога:</b> останній гравець що не збанкрутував.`,

    bunker: `<b>🏚️ Бункер</b> — дискусійна гра на виживання.<br><br>
<b>Мета:</b> переконати інших що ти корисний і потрапити до бункера. Місць менше ніж гравців.<br><br>
<b>Персонаж:</b> кожен отримує 5 прихованих атрибутів — Професія, Здоров'я, Хобі, Риса характеру, Багаж.<br><br>
<b>Розкриття:</b> кожен раунд гравці по черзі відкривають один свій атрибут на вибір. Стратегічно обирай що показати.<br><br>
<b>Дискусія:</b> після розкриття — вільне обговорення. Переконуй, аргументуй, блефуй.<br><br>
<b>Голосування:</b> всі голосують за одного гравця якого виключити. Хто набрав найбільше — вибуває. При нічиї — повторне голосування між лідерами.<br><br>
<b>Карти дій:</b> у кожного є спеціальні карти. Їх можна зіграти у відповідну фазу: підглянути чужий атрибут, обмінятись, заблокувати голос тощо.<br><br>
<b>Перемога:</b> коли кількість гравців = місткості бункера — залишені входять до бункера і виграють.`
};

function showHowToPlay() {
    const gameType = typeof _selectedGame !== 'undefined' ? _selectedGame : 'monopoly';
    const modal = document.getElementById('howtoplay-modal');
    const titles = { tysyacha: '📖 Як грати — Тисяча', mafia: '📖 Як грати — Мафія', monopoly: '📖 Як грати — Монополія', durak: '📖 Як грати — Дурак', bunker: '📖 Як грати — Бункер' };
    document.getElementById('htp-title').textContent = titles[gameType] || '📖 Як грати';
    document.getElementById('htp-content').innerHTML = HOW_TO_PLAY[gameType] || 'Правила для цієї гри ще не додані.';
    modal.style.display = 'flex';
}

function showLobbyWaiting(code) {
    _inviteCode = code;
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('waiting-screen').classList.remove('hidden');
    const linkEl = document.getElementById('room-link-display');
    if (linkEl) linkEl.textContent = `${location.origin}${location.pathname}?join=${code}`;
    document.getElementById('start-btn').classList.toggle('hidden', myPlayerIndex !== 0);
    fetchRoomCounts();
    const shareBtn = document.getElementById('copy-link-btn');
    if (shareBtn && navigator.share) shareBtn.textContent = '📤 Поділитись запрошенням';
}

function copyRoomCode() {
    copyInviteLink();
}

function leaveRoom() {
    socket.emit('leaveRoom');
    clearSession();
    myPlayerIndex = null;
    _inviteCode = '';
    document.getElementById('waiting-screen').classList.add('hidden');
    document.getElementById('lobby-screen').classList.remove('hidden');
}

socket.on('roomClosed', ({ reason }) => {
    clearSession();
    myPlayerIndex = null;
    _inviteCode = '';
    document.getElementById('waiting-screen').classList.add('hidden');
    document.getElementById('lobby-screen').classList.remove('hidden');
    showRejoinError(`🚪 ${reason}`);
});

function confirmAbandonGame() {
    const isMonopoly = !document.getElementById('game-screen').classList.contains('hidden');

    if (isMonopoly) {
        showModal({
            title: '🏳️ Здатись?',
            body: `<p style="text-align:center;padding:12px 0;color:#555">
                Ви вибуваєте з гри як банкрут.<br>
                Вся ваша власність повертається банку.<br>
                <span style="font-size:13px;color:#999">Інші гравці продовжать гру.</span>
            </p>`,
            buttons: [
                { text: '🏳️ Здатись', class: 'btn-danger', action: () => {
                    closeModal();
                    socket.emit('surrenderMonopoly');
                }},
                { text: 'Продовжити гру', class: 'btn-secondary', action: closeModal }
            ]
        });
    } else {
        _showQuitOverlay();
    }
}

function _showQuitOverlay() {
    if (document.getElementById('quit-overlay')) return;
    const ov = document.createElement('div');
    ov.id = 'quit-overlay';
    ov.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.82);
        display:flex;align-items:center;justify-content:center;z-index:9999;
        backdrop-filter:blur(6px);font-family:'Segoe UI',sans-serif`;
    ov.innerHTML = `
        <div style="background:#1a1a2e;border:1px solid rgba(255,255,255,0.15);border-radius:16px;
                    padding:28px 32px;max-width:340px;width:90%;text-align:center">
            <div style="font-size:32px;margin-bottom:12px">🚪</div>
            <div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:8px">Завершити гру?</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:24px">
                Гра буде скасована для всіх гравців.
            </div>
            <div style="display:flex;gap:10px;justify-content:center">
                <button onclick="_doAbandon()" style="
                    background:#b71c1c;color:#fff;border:none;border-radius:8px;
                    padding:11px 22px;font-size:14px;font-weight:700;cursor:pointer">
                    Завершити
                </button>
                <button onclick="_closeQuitOverlay()" style="
                    background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);
                    border-radius:8px;padding:11px 22px;font-size:14px;font-weight:700;cursor:pointer">
                    Залишитись
                </button>
            </div>
        </div>`;
    document.body.appendChild(ov);
}

function _closeQuitOverlay() {
    document.getElementById('quit-overlay')?.remove();
}

function _doAbandon() {
    _closeQuitOverlay();
    socket.emit('abandonGame');
}

socket.on('gameAbandoned', ({ reason }) => {
    clearSession();
    myPlayerIndex = null;
    closeModal();
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('tysyacha-screen').classList.add('hidden');
    document.getElementById('mafia-screen')?.classList.add('hidden');
    document.getElementById('durak-screen')?.classList.add('hidden');
    setQuitBtn(false);
    document.getElementById('lobby-screen').classList.remove('hidden');
    showRejoinError(`🚪 ${reason}`);
});

socket.on('surrendered', () => {
    clearSession();
    myPlayerIndex = null;
    closeModal();
    document.getElementById('game-screen').classList.add('hidden');
    setQuitBtn(false);
    document.getElementById('lobby-screen').classList.remove('hidden');
    showRejoinError('🏳️ Ви здались. Ваша власність повернута банку. Інші гравці продовжують.');
});

function copyInviteLink() {
    const url = `${location.origin}${location.pathname}?join=${_inviteCode}`;
    if (navigator.share) {
        navigator.share({ title: 'Ігровий Клуб — запрошення', text: 'Приєднуйся до гри!', url }).catch(() => {});
        return;
    }
    navigator.clipboard.writeText(url).then(() => {
        showToast('✅ Посилання скопійовано!', { color: '#1b5e20', duration: 2000 });
        const btn = document.getElementById('copy-link-btn');
        if (!btn) return;
        const orig = btn.textContent;
        btn.textContent = '✅ Скопійовано!';
        setTimeout(() => { btn.textContent = orig; }, 2500);
    }).catch(() => prompt('Скопіюйте посилання:', url));
}

// ── Казино ────────────────────────────────────
function showCasinoModal(playerMoney) {
    playSound('card');
    const bets = [50, 100, 200, 500].filter(b => b <= playerMoney);
    const btnsBet = bets.map(b => ({
        text: `₴${b}`,
        class: 'btn-primary',
        action: () => { sendAction('casinoBet', { amount: b }); closeModal(); showCasinoSpinModal(); }
    }));

    showModal({
        title: '',
        body: `
            <div style="margin:-30px -30px 20px;padding:24px;
                        background:linear-gradient(135deg,#1a1a2e,#16213e);
                        border-radius:18px 18px 0 0;text-align:center;color:white">
                <div style="font-size:52px;margin-bottom:8px">🎰</div>
                <div style="font-size:22px;font-weight:900;letter-spacing:1px">КАЗИНО</div>
                <div style="font-size:13px;opacity:0.7;margin-top:4px">Спробуй свою удачу!</div>
            </div>
            <div style="background:#f8f9fa;border-radius:12px;padding:14px;margin-bottom:14px;font-size:13px">
                <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                    <span>🎲 Дубль (1+1, 2+2...)</span><b style="color:#2e7d32">Виграш ×3</b>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                    <span>✅ Сума ≥ 8</span><b style="color:#1565c0">Виграш ×2</b>
                </div>
                <div style="display:flex;justify-content:space-between">
                    <span>❌ Сума ≤ 7</span><b style="color:#c62828">Програш ставки</b>
                </div>
            </div>
            <div style="text-align:center;font-size:13px;color:#666;margin-bottom:8px">
                Ваша готівка: <b>₴${playerMoney}</b> — Оберіть ставку:
            </div>
            ${bets.length === 0 ? '<p style="color:#c62828;text-align:center">Недостатньо коштів (мінімум ₴50)</p>' : ''}`,
        buttons: bets.length > 0
            ? [...btnsBet, { text: 'Пройти мимо', class: 'btn-secondary', action: () => { sendAction('casinoSkip'); closeModal(); } }]
            : [{ text: 'Пройти мимо', class: 'btn-secondary', action: () => { sendAction('casinoSkip'); closeModal(); } }]
    });
}

function showCasinoSpinModal() {
    showModal({
        title: '',
        body: `<div style="text-align:center;padding:30px">
            <div style="font-size:60px;animation:roll 1s ease-in-out infinite">🎰</div>
            <div style="font-size:16px;margin-top:16px;color:#666">Кубики летять...</div>
        </div>`,
        buttons: []
    });
}

function showCasinoResult(effect) {
    playSound(effect.delta > 0 ? 'buy' : 'rent');
    const win = effect.delta > 0;
    const color = effect.isDouble ? '#2e7d32' : win ? '#1565c0' : '#c62828';
    const icon  = effect.isDouble ? '🎉' : win ? '✅' : '❌';
    showModal({
        title: '',
        body: `
            <div style="text-align:center;padding:16px 0">
                <div style="font-size:56px;margin-bottom:12px">${icon}</div>
                <div style="font-size:32px;font-weight:900;margin-bottom:8px">
                    ${effect.d1} + ${effect.d2} = ${effect.sum}
                    ${effect.isDouble ? '<br><span style="font-size:16px;color:#2e7d32">ДУБЛЬ!</span>' : ''}
                </div>
                <div style="font-size:20px;font-weight:700;color:${color};margin-bottom:8px">${effect.result}</div>
                <div style="font-size:14px;color:#888">Ставка: ₴${effect.bet}</div>
            </div>`,
        buttons: [{ text: 'OK', class: 'btn-primary', action: closeModal }]
    });
}

// ── Торгівля між гравцями ─────────────────────
function showTradeMenuOnline() {
    if (!players || !players.length) return;
    const me = players[myPlayerIndex];
    const opponents = players.filter((p, i) => i !== myPlayerIndex && !p.bankrupt);
    if (opponents.length === 0) {
        showModal({ title: '🤝 Торгівля', body: '<p style="text-align:center;padding:20px;color:#888">Немає доступних гравців для торгівлі.</p>',
                    buttons: [{ text: 'Закрити', class: 'btn-secondary', action: closeModal }] });
        return;
    }
    _renderTradeModal(me, opponents[0]);
}

function _tradePropRow(pos, cls) {
    const cell       = BOARD[pos];
    const mortgaged  = cellState[pos]?.mortgaged;
    const tag        = mortgaged ? ' <span style="font-size:10px;background:#ff9800;color:white;border-radius:4px;padding:1px 5px">🏷️ застава</span>' : '';
    const nameStyle  = mortgaged ? 'text-decoration:line-through;color:#aaa' : '';
    return `<label style="display:flex;align-items:center;gap:6px;padding:3px 0;cursor:pointer;font-size:13px">
        <input type="checkbox" class="${cls}" value="${pos}" style="width:15px;height:15px">
        <span style="background:${cell.color||'#ccc'};width:10px;height:10px;display:inline-block;border-radius:2px;flex-shrink:0;${mortgaged?'opacity:0.5':''}"></span>
        <span style="${nameStyle}">${cell.name}</span><span style="color:#888;font-size:11px;margin-left:2px">(₴${cell.price})</span>${tag}
    </label>`;
}

function _renderTradeModal(me, opponent) {
    const myProps = (me.properties || []).map(pos => _tradePropRow(pos, 'offer-prop')).join('')
        || '<p style="color:#aaa;font-size:12px;margin:4px 0">Немає ділянок</p>';

    const theirProps = (opponent.properties || []).map(pos => _tradePropRow(pos, 'request-prop')).join('')
        || '<p style="color:#aaa;font-size:12px;margin:4px 0">Немає ділянок</p>';

    const oppSelect = players
        .filter((p, i) => i !== myPlayerIndex && !p.bankrupt)
        .map(p => `<option value="${p.id}" ${p.id === opponent.id ? 'selected' : ''}>${p.icon} ${p.name} (₴${p.money})</option>`)
        .join('');

    showModal({
        title: '🤝 Торгівля',
        wide: true,
        body: `
            <div style="margin-bottom:12px">
                <label style="font-size:13px;font-weight:700;color:#004494">Партнер:</label>
                <select id="trade-opponent" onchange="updateTradeOpponent()"
                        style="width:100%;padding:8px;border-radius:8px;border:2px solid #0057b7;font-size:14px;margin-top:4px">
                    ${oppSelect}
                </select>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:14px">
                <div style="flex:1;min-width:220px;background:#e8f5e9;border-radius:10px;padding:12px">
                    <div style="font-weight:700;color:#2e7d32;margin-bottom:8px">📤 Ви пропонуєте:</div>
                    <div style="max-height:140px;overflow-y:auto">${myProps}</div>
                    <div style="margin-top:10px">
                        <label style="font-size:12px;color:#555">+ готівка (₴):</label>
                        <input type="number" id="offer-money" min="0" max="${me.money}" value="0"
                               style="width:100%;padding:6px;border:2px solid #a5d6a7;border-radius:6px;font-size:14px;margin-top:4px;box-sizing:border-box">
                    </div>
                </div>
                <div style="flex:1;min-width:220px;background:#ffebee;border-radius:10px;padding:12px">
                    <div style="font-weight:700;color:#c62828;margin-bottom:8px">📥 Ви запитуєте:</div>
                    <div id="trade-request-props" style="max-height:140px;overflow-y:auto">${theirProps}</div>
                    <div style="margin-top:10px">
                        <label style="font-size:12px;color:#555">+ готівка (₴):</label>
                        <input type="number" id="request-money" min="0" max="${opponent.money}" value="0"
                               style="width:100%;padding:6px;border:2px solid #ef9a9a;border-radius:6px;font-size:14px;margin-top:4px;box-sizing:border-box">
                    </div>
                </div>
            </div>`,
        buttons: [
            { text: '✅ Запропонувати', class: 'btn-success',    action: submitTradeOffer },
            { text: 'Скасувати',        class: 'btn-secondary',  action: closeModal },
        ]
    });
}

function updateTradeOpponent() {
    const sel = document.getElementById('trade-opponent');
    if (!sel || !players) return;
    const oppId  = parseInt(sel.value);
    const opp    = players.find(p => p.id === oppId);
    if (!opp) return;
    const reqMax = document.getElementById('request-money');
    if (reqMax) reqMax.max = opp.money;
    const propsDiv = document.getElementById('trade-request-props');
    if (!propsDiv) return;
    propsDiv.innerHTML = (opp.properties || []).map(pos => _tradePropRow(pos, 'request-prop')).join('')
        || '<p style="color:#aaa;font-size:12px;margin:4px 0">Немає ділянок</p>';
}

function submitTradeOffer() {
    const sel         = document.getElementById('trade-opponent');
    const oppId       = parseInt(sel?.value);
    const toIdx       = players.findIndex(p => p.id === oppId);
    const offerMoney  = parseInt(document.getElementById('offer-money')?.value)   || 0;
    const requestMoney= parseInt(document.getElementById('request-money')?.value) || 0;
    const offerProps  = [...document.querySelectorAll('.offer-prop:checked')].map(cb => parseInt(cb.value));
    const requestProps= [...document.querySelectorAll('.request-prop:checked')].map(cb => parseInt(cb.value));
    if (offerProps.length === 0 && offerMoney === 0 && requestProps.length === 0 && requestMoney === 0) {
        showToast('Угода порожня — додайте ділянки або готівку', { color: '#c62828' }); return;
    }
    sendAction('offerTrade', { toIdx, offerMoney, offerProps, requestMoney, requestProps });
    closeModal();
    showToast('Пропозицію відправлено!', { color: '#1565c0' });
}

function showTradeOfferModal(state, trade) {
    const from = state.players[trade.fromIdx];
    const propLine = pos => {
        const m = cellState[pos]?.mortgaged;
        return `• ${BOARD[pos].name}${m ? ' <span style="font-size:11px;background:#ff9800;color:white;border-radius:3px;padding:0 4px">застава</span>' : ''}`;
    };
    const offerLines = [
        ...trade.offerProps.map(propLine),
        trade.offerMoney > 0 ? `• ₴${trade.offerMoney} готівкою` : ''
    ].filter(Boolean).join('<br>') || '<span style="color:#aaa">Нічого</span>';
    const requestLines = [
        ...trade.requestProps.map(propLine),
        trade.requestMoney > 0 ? `• ₴${trade.requestMoney} готівкою` : ''
    ].filter(Boolean).join('<br>') || '<span style="color:#aaa">Нічого</span>';

    showModal({
        title: `🤝 Пропозиція від ${from.icon} ${from.name}`,
        wide: true,
        body: `
            <div style="text-align:center;margin-bottom:10px">
                <span style="font-size:13px;color:#e65100;font-weight:700">
                    ⏱ Час на відповідь: <span id="trade-offer-countdown">20</span>с
                </span>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:12px">
                <div style="flex:1;min-width:220px;background:#e8f5e9;border-radius:10px;padding:14px">
                    <div style="font-weight:700;color:#2e7d32;margin-bottom:8px">📤 Вам пропонують:</div>
                    <div style="font-size:13px;line-height:1.7">${offerLines}</div>
                </div>
                <div style="flex:1;min-width:220px;background:#ffebee;border-radius:10px;padding:14px">
                    <div style="font-weight:700;color:#c62828;margin-bottom:8px">📥 Просять взамін:</div>
                    <div style="font-size:13px;line-height:1.7">${requestLines}</div>
                </div>
            </div>`,
        buttons: [
            { text: '✅ Прийняти', class: 'btn-success',   action: () => {
                clearInterval(window._tradeCountdownInterval);
                sendAction('acceptTrade', {}); closeModal();
            }},
            { text: '❌ Відхилити', class: 'btn-secondary', action: () => {
                clearInterval(window._tradeCountdownInterval);
                sendAction('rejectTrade', {}); closeModal();
            }},
        ]
    });

    // Відлік у попапі (синхронізований із серверним таймером)
    clearInterval(window._tradeCountdownInterval);
    let sec = 20;
    window._tradeCountdownInterval = setInterval(() => {
        sec--;
        const el = document.getElementById('trade-offer-countdown');
        if (el) { el.textContent = sec; el.style.color = sec <= 5 ? '#c62828' : '#e65100'; }
        if (sec <= 0) clearInterval(window._tradeCountdownInterval);
    }, 1000);
}

function findRoom() {
    socket.emit('getRooms', ({ rooms: list }) => {
        const filtered = list.filter(r => r.gameType === _selectedGame);
        list = filtered.length > 0 ? filtered : list; // якщо нема — показуємо всі
        const gameNames = { monopoly:'Монополія', tysyacha:'Тисяча', durak:'Дурак', mafia:'Мафія' };
        let body;
        if (list.length === 0) {
            body = `<p style="text-align:center;color:#888;padding:16px 0 8px;font-size:15px">
                        😔 Зараз немає вільних кімнат.
                    </p>
                    <button onclick="closeModal();createRoom()" style="
                        display:block;width:100%;padding:12px;margin:8px 0 4px;
                        background:linear-gradient(135deg,#ffd700,#ffaa00);color:#002a70;
                        border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer">
                        🏠 Створити свою кімнату
                    </button>`;
        } else {
            body = list.map(r => `
                <div onclick="quickJoin('${r.code}')" style="
                    display:flex;justify-content:space-between;align-items:center;
                    padding:12px 14px;border-radius:10px;border:2px solid #e0e8f5;
                    margin-bottom:8px;cursor:pointer;transition:all 0.15s;background:#f8faff"
                    onmouseover="this.style.background='#e8f0fe';this.style.borderColor='#0057b7'"
                    onmouseout="this.style.background='#f8faff';this.style.borderColor='#e0e8f5'">
                    <div>
                        <div style="font-weight:700;color:#004494;font-size:15px">${{monopoly:'🏦',tysyacha:'🃏',durak:'🂡',mafia:'🔫'}[r.gameType]||'🎮'} ${r.hostName}</div>
                        <div style="font-size:12px;color:#999;margin-top:2px">${{monopoly:'Монополія',tysyacha:'Тисяча',durak:'Дурак',mafia:'Мафія'}[r.gameType]||r.gameType} · ${r.code}</div>
                    </div>
                    <div style="text-align:right">
                        <div style="font-size:14px;color:#0057b7;font-weight:700">${r.playerCount}/${{monopoly:6,tysyacha:3,durak:6,mafia:15}[r.gameType]||6}</div>
                        <div style="font-size:11px;color:#4caf50;margin-top:2px">● вільна</div>
                    </div>
                </div>
            `).join('');
        }

        showModal({
            title: `🔍 Вільні кімнати${filtered.length > 0 ? ' · ' + (gameNames[_selectedGame]||_selectedGame) : ''}`,
            body,
            buttons: [
                { text: '🔄 Оновити', class: 'btn-secondary', action: () => { closeModal(); setTimeout(findRoom, 100); } },
                { text: 'Закрити',    class: 'btn-secondary', action: closeModal },
            ]
        });
    });
}

function quickJoin(code) {
    const name = document.getElementById('lobby-name').value.trim();
    if (!name) {
        closeModal();
        _lobbyError('Спочатку введіть своє ім\'я', 'lobby-name');
        return;
    }
    saveName(name);
    socket.emit('joinRoom', { code, playerName: name }, ({ code: c, playerIndex, gameType, error }) => {
        if (error) { _lobbyError(error); return; }
        closeModal();
        myPlayerIndex = playerIndex;
        saveSession(c, playerIndex, name);
        if (gameType === 'bunker') { location.replace('/bunker'); return; }
        showLobbyWaiting(c);
    });
}

// ── Налаштування гри ─────────────────────────
const _gameSettings = { nightDuration: 90, dayDuration: 120, voteDuration: 60, mode: 'podkidnoy' };

function setSetting(key, value) {
    _gameSettings[key] = value;
    // Підсвічуємо активну кнопку
    document.querySelectorAll(`[data-setting="${key}"]`).forEach(btn => {
        btn.classList.toggle('active', String(btn.dataset.value) === String(value));
    });
    // Надсилаємо хосту на сервер одразу
    socket.emit('updateSettings', { [key]: value });
}

function updateGameSettings(gameType) {
    const panel      = document.getElementById('game-settings');
    const nightRow   = document.getElementById('settings-night-timer');
    const dayRow     = document.getElementById('settings-day-timer');
    const voteRow    = document.getElementById('settings-vote-timer');
    const durakMode  = document.getElementById('settings-durak-mode');
    const isHost     = myPlayerIndex === 0;
    if (!panel) return;
    const showPanel = isHost && (gameType === 'mafia' || gameType === 'durak');
    panel.classList.toggle('hidden', !showPanel);
    if (nightRow)  nightRow.classList.toggle('hidden',  gameType !== 'mafia');
    if (dayRow)    dayRow.classList.toggle('hidden',    gameType !== 'mafia');
    if (voteRow)   voteRow.classList.toggle('hidden',   gameType !== 'mafia');
    if (durakMode) durakMode.classList.toggle('hidden', gameType !== 'durak');
}

function startGame() {
    socket.emit('startGame', { settings: _gameSettings });
}

// ── Отримання оновлень від сервера ───────────
socket.on('lobbyUpdate', ({ players, gameType }) => {
    if (gameType) _selectedGame = gameType; // синхронізуємо з типом кімнати
    const list = document.getElementById('lobby-players-list');
    if (!list) return;
    list.innerHTML = players.map((name, i) => {
        const isHost  = i === 0;
        const canKick = myPlayerIndex === 0 && !isHost;
        return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0">
            <span>${isHost ? '👑 ' : '🎮 '}${name}</span>
            ${canKick ? `<button onclick="kickPlayer(${i})"
                style="background:none;border:1px solid #cc1f1f;color:#cc1f1f;
                       border-radius:6px;padding:2px 8px;font-size:11px;cursor:pointer;
                       transition:all 0.15s"
                onmouseover="this.style.background='#cc1f1f';this.style.color='white'"
                onmouseout="this.style.background='none';this.style.color='#cc1f1f'">
                ✕ Видалити
            </button>` : ''}
        </div>`;
    }).join('');
    const maxMap = { tysyacha: 3, mafia: 15, monopoly: 6, durak: 6, bunker: 15 };
    const minMap = { tysyacha: 2, mafia: 5, monopoly: 2, durak: 2, bunker: 4 };
    const min = minMap[_selectedGame] || 2;
    const counter = document.getElementById('lobby-player-count');
    if (counter) counter.textContent = `${players.length}/${maxMap[_selectedGame] || 6}`;
    const hint = document.getElementById('waiting-hint');
    if (hint) hint.textContent = players.length < min
        ? `Потрібно ще ${min - players.length} гравців для старту`
        : 'Хост бачить кнопку старту';
    // Хост може змінитись після kick — оновлюємо видимість кнопки старту
    const startBtn = document.getElementById('start-btn');
    const isHost = myPlayerIndex === 0;
    if (startBtn) {
        startBtn.classList.toggle('hidden', !isHost);
        startBtn.disabled = players.length < min;
        startBtn.style.opacity = players.length < min ? '0.4' : '1';
    }
    // Показуємо панель налаштувань якщо хост і Мафія
    updateGameSettings(_selectedGame);
});

function kickPlayer(index) {
    socket.emit('kickPlayer', { kickIndex: index });
}

socket.on('kicked', ({ reason }) => {
    clearSession();
    myPlayerIndex = null;
    document.getElementById('waiting-screen').classList.add('hidden');
    document.getElementById('lobby-screen').classList.remove('hidden');
    showRejoinError(`❌ ${reason}`);
});

socket.on('gameStarted', ({ state, gameType, myPlayerIndex: mpi }) => {
    if (mpi !== undefined) myPlayerIndex = mpi;
    // Бункер — React SPA на /bunker; редіректимо туди зі збереженою сесією
    if (gameType === 'bunker' || state?.gameType === 'bunker') {
        location.replace('/bunker');
        return;
    }
    document.getElementById('waiting-screen').classList.add('hidden');
    document.getElementById('lobby-screen').classList.add('hidden');
    setQuitBtn(true);
    if (gameType === 'durak' || state?.gameType === 'durak') {
        initDurak(state, myPlayerIndex);
        _showDndHint('durak');
        return;
    }
    if (gameType === 'mafia' || state?.gameType === 'mafia') {
        initMafia(state, myPlayerIndex);
        return;
    }
    if (gameType === 'tysyacha' || state?.gameType === 'tysyacha') {
        initTysyacha(state, myPlayerIndex);
        _showDndHint('tysyacha');
        return;
    }
    showGameScreen();
    applyState(state, false, null, null);
    log(`🎮 Гра почалась! Хід: ${state.players[0].name}`, 'success');
});

socket.on('stateUpdate', ({ state, sideEffect, toast }) => {
    if (state?.gameType === 'durak') { updateDurak(state, sideEffect); return; }
    if (state?.gameType === 'mafia') { updateMafia(state, sideEffect); return; }
    if (state?.gameType === 'tysyacha') { updateTysyacha(state, sideEffect); return; }
    const [d1, d2] = state.lastDiceRoll;
    const diceRolled = (d1 !== _prevDice[0] || d2 !== _prevDice[1]) && d1 > 0;
    const landingPos = sideEffect?.landingPos ?? null;

    // Toast для інших гравців (поточний гравець бачить попапи)
    if (toast && myPlayerIndex !== state.currentPlayerIndex) {
        showToast(toast.text, { color: toast.color });
    }

    applyState(state, diceRolled, landingPos, (teleportFn) => {
        if (sideEffect) handleSideEffect(state, sideEffect, teleportFn);
    });
});

socket.on('gameOver', ({ winner, state }) => {
    clearSession();
    if (state?.gameType === 'durak') { updateDurak(state, null); return; }
    if (state?.gameType === 'mafia') { updateMafia(state, null); return; }
    if (state?.gameType === 'tysyacha') { updateTysyacha(state); return; }
    applyState(state, false, null, () => announceWinner(winner, state.players));
});

socket.on('playerDisconnected', ({ playerIndex }) => {
    log(`⚠️ Гравець ${playerIndex + 1} відключився`, 'warn');
});

socket.on('error', (msg) => {
    log(`❌ ${msg}`, 'error');
    showToast('⚠️ ' + msg, { color: '#b71c1c', duration: 4000 });
});

// Попередній стан кубиків, позицій і аукціону
let _prevDice     = [0, 0];
let _prevPos      = {}; // { playerId → position }
let _prevAuction          = null;
let _prevPendingTrade     = null;
let _prevCurrentPlayerIdx = null;
const STEP_MS     = 270; // мс між клітинками (як у локальній версії)

// ── Покрокова анімація одного токена ─────────
function _moveTokenTo(playerId, pos, animate) {
    const board = document.getElementById('board');
    if (!board) return;
    const boardRect = board.getBoundingClientRect();
    if (!boardRect.width) return;
    const token = board.querySelector(`.token[data-player="${playerId}"]`);
    if (!token) return;
    const cellDiv = board.querySelector(`.cell[data-pos="${pos}"]`);
    if (!cellDiv) return;
    const cellRect = cellDiv.getBoundingClientRect();

    if (!animate) { token.style.transition = 'none'; }
    token.style.left = `${cellRect.left - boardRect.left + cellRect.width  / 2 - 14}px`;
    token.style.top  = `${cellRect.top  - boardRect.top  + cellRect.height / 2 - 14}px`;
    if (!animate) { void token.offsetWidth; token.style.transition = ''; }
}

function animateStepByStep(playerId, fromPos, toPos, onDone) {
    const steps = (toPos - fromPos + 40) % 40;
    if (steps === 0) { setTimeout(onDone, 300); return; }

    let cur  = fromPos;
    let done = 0;

    const tick = () => {
        cur = (cur + 1) % 40;
        done++;
        playSound('step');
        _moveTokenTo(playerId, cur, true);
        if (done < steps) {
            setTimeout(tick, STEP_MS);
        } else {
            // Чекаємо CSS-перехід + 300мс пауза осмислення
            setTimeout(() => { placeTokens(); setTimeout(onDone, 300); }, 310);
        }
    };
    setTimeout(tick, STEP_MS);
}

// ── Застосування стану ────────────────────────
function applyState(state, diceRolled, landingPos, onDone) {
    const [d1, d2] = state.lastDiceRoll;

    // Синхронізуємо глобальні змінні
    const prevAuctionSnapshot  = _prevAuction;
    const prevPendingTrade     = _prevPendingTrade;
    const prevCurrentPlayer    = _prevCurrentPlayerIdx;
    players            = state.players;
    currentPlayerIndex = state.currentPlayerIndex;
    lastDiceRoll       = state.lastDiceRoll;
    hasRolled          = state.hasRolled;
    doublesCount       = state.doublesCount || 0;
    cellState          = state.cellState;
    auctionState       = state.auctionState;
    _prevAuction       = state.auctionState;
    _prevPendingTrade  = state.pendingTrade;
    _prevCurrentPlayerIdx = state.currentPlayerIndex;
    pendingRent        = state.pendingAction === 'payRent' ? (pendingRent || null) : null;

    // Після mortgage/redeem/buildHouse/sellHouse — перевідкриваємо картку з актуальним станом
    if (window._pendingCardPos != null && myPlayerIndex === state.currentPlayerIndex) {
        const pos = window._pendingCardPos;
        window._pendingCardPos = null;
        setTimeout(() => showPropertyCard(pos), 0);
    }

    // Після продажу будинку з меню кредиту — перевідкриваємо меню
    if (window._loanMenuOpen && myPlayerIndex === state.currentPlayerIndex) {
        window._loanMenuOpen = false;
        setTimeout(() => window.showLoanMenu?.(), 0);
    }

    // Після застави/продажу будинку — перемальовуємо модал оренди через showRentModalOnline
    if (pendingRent && state.pendingAction === 'payRent' && myPlayerIndex === state.currentPlayerIndex) {
        const { cell, rent, owner } = pendingRent;
        showRentModalOnline(players[currentPlayerIndex], cell, rent, owner);
    }

    // Борг після примусового списання (податок, картка, в'язниця)
    if (state.pendingAction === 'coverDebt' && myPlayerIndex === state.currentPlayerIndex) {
        showCoverDebtModal(state.pendingData?.shortfall || 0);
    }

    // Угода скасована сервером (таймаут) — закриваємо попап у отримувача
    const tradeJustCancelled = !state.pendingTrade && prevPendingTrade;
    if (tradeJustCancelled && myPlayerIndex === prevPendingTrade.toIdx) {
        clearInterval(window._tradeCountdownInterval);
        closeModal();
    }

    // Аукціон завершився — закриваємо модал
    const auctionJustEnded = !state.auctionState && prevAuctionSnapshot;
    if (auctionJustEnded) {
        setTimeout(() => { closeModal(); playSound('buy'); }, 0);
    }

    // Аукціон тільки-но стартував або оновився — показуємо попап одразу
    const auctionJustChanged = state.auctionState && (
        !prevAuctionSnapshot ||
        prevAuctionSnapshot.turnIdx     !== state.auctionState.turnIdx ||
        prevAuctionSnapshot.active?.length !== state.auctionState.active?.length ||
        prevAuctionSnapshot.currentBid  !== state.auctionState.currentBid ||
        prevAuctionSnapshot.currentBidder !== state.auctionState.currentBidder
    );
    if (auctionJustChanged) {
        setTimeout(() => showAuctionUIOnline(state), 0);
    }

    updateTurnTimer(state.tradeDeadline || state.turnDeadline || null);
    renderPlayers();

    // "Ваш хід!" — коли хід щойно перейшов до мене
    const justMyTurn = prevCurrentPlayer !== null
        && prevCurrentPlayer !== myPlayerIndex
        && state.currentPlayerIndex === myPlayerIndex;
    if (justMyTurn) {
        playSound('myturn');
        showToast('🎯 Ваш хід!', { color: '#004494', duration: 2500 });
        const activeCard = document.querySelector('.player-card.active');
        if (activeCard) {
            activeCard.classList.add('my-turn-flash');
            setTimeout(() => activeCard.classList.remove('my-turn-flash'), 1500);
        }
    }

    updateCurrentPlayerInfo();
    renderActionButtons(); // оновлюємо стан кнопок (чий хід, наявність картки)
    refreshAllCells();
    updateMonopolies();

    // Лог
    const logContent = document.getElementById('log-content');
    if (logContent && state.log?.length) {
        logContent.innerHTML = '';
        state.log.slice(0, 30).forEach(entry => {
            const div = document.createElement('div');
            div.className = `log-entry ${entry.type || ''}`;
            div.innerText = entry.text;
            logContent.appendChild(div);
        });
    }

    // Кнопки ходу — ховаємо "Завершити хід" поки йде аукціон
    const isMyTurn      = myPlayerIndex === state.currentPlayerIndex;
    const auctionActive = !!state.auctionState;
    document.getElementById('roll-btn').classList.toggle('hidden', state.hasRolled || !isMyTurn || auctionActive);
    document.getElementById('end-turn-btn').classList.toggle('hidden', !state.hasRolled || !isMyTurn || auctionActive);
    const actionBtns = document.getElementById('action-buttons');
    if (actionBtns) actionBtns.style.opacity = isMyTurn ? '1' : '0.5';
    actionBtns?.querySelectorAll('button').forEach(btn => btn.disabled = !isMyTurn);

    if (diceRolled && d1) {
        _prevDice = [d1, d2];

        const mover    = state.players[state.currentPlayerIndex];
        const fromPos  = _prevPos[mover?.id] ?? 0;
        // landingPos = де фізично впала фішка (до ефектів типу В'язниці)
        // finalPos   = де фішка після ефектів (може відрізнятись: pos 30→10)
        const animTo   = landingPos ?? (mover?.position ?? 0);
        const finalPos = mover?.position ?? 0;

        // Кубики: ? → значення через 300мс
        document.getElementById('die1').innerText = '?';
        document.getElementById('die2').innerText = '?';
        animateDice();
        playSound(d1 === d2 ? 'double' : 'roll');
        setTimeout(() => {
            document.getElementById('die1').innerText = d1;
            document.getElementById('die2').innerText = d2;
        }, 300);

        // Розміщуємо всі токени на OLD позиціях, мовер повертається на fromPos
        requestAnimationFrame(() => {
            placeTokens();
            if (mover && fromPos !== animTo) _moveTokenTo(mover.id, fromPos, false);
        });

        // Через 600мс — покрокова анімація до landingPos
        setTimeout(() => {
            if (mover && fromPos !== animTo) {
                animateStepByStep(mover.id, fromPos, animTo, () => {
                    _prevPos[mover.id] = finalPos;
                    // teleportFn — буде викликана після того як гравець закриє попап
                    const teleportFn = (finalPos !== animTo)
                        ? () => { setTimeout(() => placeTokens(), 150); }
                        : null;
                    onDone?.(teleportFn);
                });
            } else {
                _prevPos[mover?.id] = finalPos;
                requestAnimationFrame(() => placeTokens());
                setTimeout(() => onDone?.(null), 300);
            }
        }, 600);

    } else {
        // Без кидку — позиції одразу
        state.players.forEach(p => { _prevPos[p.id] = p.position; });
        if (d1) {
            document.getElementById('die1').innerText = d1;
            document.getElementById('die2').innerText = d2;
        }
        requestAnimationFrame(() => placeTokens());
        onDone?.();
    }
}

// ── Обробка подій від сервера ─────────────────
function handleSideEffect(state, effect, teleportFn) {
    if (!effect) return;
    const player = state.players[state.currentPlayerIndex];
    const isMe = myPlayerIndex === state.currentPlayerIndex;

    switch (effect.event) {
        case 'cardDrawn':
            playSound('card');
            if (isMe) {
                showCardModalOnline(state, effect, teleportFn);
            } else {
                teleportFn?.();
            }
            break;
        case 'offerPurchase':
            teleportFn?.();
            if (isMe) {
                const cell = BOARD[effect.cell?.pos ?? state.pendingData?.pos];
                offerPurchaseOnline(player, cell);
            }
            break;
        case 'payRent':
            teleportFn?.();
            if (isMe) showRentModalOnline(player, effect.cell, effect.rent, effect.owner);
            break;
        case 'tax':
            if (isMe) {
                playSound('coin');
                showTaxModal(BOARD[effect.cellPos ?? 4], effect.reason || `Сплатіть ₴${effect.amount}`, teleportFn);
            } else {
                teleportFn?.();
            }
            break;
        case 'goToJail':
            if (isMe) {
                playSound('jail');
                showJailArrestModal(effect.reason || `👮 ${player.name} вирушає до В'ЯЗНИЦІ!`, teleportFn);
            } else {
                teleportFn?.();
            }
            break;
        case 'casino':
            if (isMe) showCasinoModal(effect.playerMoney);
            break;

        case 'casinoResult':
            if (isMe) showCasinoResult(effect);
            break;

        case 'tradeOffer':
            if (myPlayerIndex === effect.trade.toIdx) {
                playSound('trade');
                showTradeOfferModal(state, effect.trade);
            }
            break;

        case 'auctionStarted':
        case 'auctionUpdated':
            // Обробляється автоматично в applyState через _prevAuction
            break;
        case 'loanWarning':
            if (isMe) showLoanWarningModal(player);
            break;
        case 'loanDeadline':
            if (isMe) showLoanDeadlineModal(player);
            break;
        case 'inJail':
            if (isMe) offerJailOptions(player);
            break;
    }
}

// ── Попап картки (Шанс / Екскурсія) ──────────
function showCardModalOnline(state, effect, teleportFn) {
    const isChance = effect.cardType === 'chance';
    const accent   = isChance ? '#e91e63' : '#43a047';
    const icon     = isChance ? '❓' : '🗺️';
    const title    = isChance ? 'КАРТКА ШАНСУ' : 'ЕКСКУРСІЯ';

    const dismiss = () => {
        teleportFn?.();
        if (effect.nextEffect) setTimeout(() => handleSideEffect(state, effect.nextEffect, null), 400);
    };
    showModal({
        title: '',
        body: `
            <div style="margin:-30px -30px 20px;padding:22px 24px 18px;
                        background:linear-gradient(135deg,${accent},${accent}99);
                        border-radius:18px 18px 0 0;text-align:center;color:white">
                <div style="font-size:48px;margin-bottom:8px">${icon}</div>
                <div style="font-size:20px;font-weight:900;letter-spacing:1px">${title}</div>
            </div>
            <div style="background:#fff8e1;border:2px solid ${accent}55;border-radius:12px;
                        padding:14px 16px;font-size:15px;line-height:1.6;
                        color:#333;text-align:center">
                ${effect.text}
            </div>`,
        onClose: dismiss, // ✕ теж виконує teleport
        buttons: [{
            text: '👍 Зрозуміло',
            class: 'btn-primary',
            action: () => {
                closeModal();
                dismiss();
            }
        }]
    });
}

// ── Відправка дій на сервер ───────────────────
function sendAction(type, data = {}) {
    socket.emit('action', { type, data });
}

// Перевизначаємо ключові функції engine.js → socket
function rollDice() {
    playSound('dice');
    sendAction('rollDice');
}
function endTurn()               { sendAction('endTurn'); }
function buyProperty(p, cell)    { sendAction('buyProperty'); closeModal(); }
function buildHouse(pos)         { sendAction('buildHouse', { pos }); }
function sellHouse(pos)          { sendAction('sellHouse',  { pos }); }
function mortgage(pos)           { sendAction('mortgage',   { pos }); }
function redeem(pos)             { sendAction('redeem',     { pos }); }

function animateDice() {
    ['die1','die2'].forEach(id => {
        const el = document.getElementById(id);
        el.classList.remove('rolling');
        void el.offsetWidth;
        el.classList.add('rolling');
    });
}

// ── Адаптовані UI-функції для онлайну ─────────
function offerPurchaseOnline(player, cell) {
    if (!cell) return;
    const canBuy = player.money >= cell.price;
    showModal({
        title: '',
        body: `
            <div class="modal-hdr info">
                <div class="modal-hdr-icon">🏠</div>
                <div class="modal-hdr-title">${cell.name}</div>
                ${cell.city ? `<div class="modal-hdr-sub">${cell.city}</div>` : ''}
            </div>
            <div class="modal-row neutral">
                <span class="mlabel">Ціна ділянки</span>
                <span class="mval gold">₴${cell.price}</span>
            </div>
            <div class="modal-row ${canBuy ? 'green' : 'red'}">
                <span class="mlabel">Ваша готівка</span>
                <span class="mval ${canBuy ? 'green' : 'red'}">₴${player.money}</span>
            </div>
            <p style="font-size:11px;color:#888;text-align:center;margin-top:8px">
                Якщо відмовитесь — буде аукціон серед усіх гравців.
            </p>`,
        buttons: [
            { text: `🏠 Купити за ₴${cell.price}`, class: 'btn-success',
              disabled: !canBuy,
              action: () => { playSound('buy'); sendAction('buyProperty'); closeModal(); }},
            { text: '🔨 На аукціон', class: 'btn-secondary',
              action: () => { sendAction('startAuction'); closeModal(); }},
        ]
    });
}

function showRentModalOnline(player, cell, rent, owner) {
    pendingRent = { player, cell, rent, owner };
    // Перевизначаємо кнопку "Сплатити" щоб вона йшла через сервер
    const origTake = window.takeMoney;
    const origAdd  = window.addMoney;
    // Підміняємо кнопку через showModal після render
    renderRentModal();
    // Замінюємо action кнопки "Сплатити" через DOM
    setTimeout(() => {
        const btns = document.querySelectorAll('#modal-buttons button');
        btns.forEach(btn => {
            if (btn.textContent.includes('Сплатити')) {
                const oldOnclick = btn.onclick;
                btn.onclick = () => {
                    playSound('rent');
                    sendAction('payRent');
                    pendingRent = null;
                    closeModal();
                };
            }
        });
    }, 50);
}

function showAuctionUIOnline(state) {
    const a = state.auctionState;
    if (!a || a.active.length === 0) { closeModal(); return; }

    const bidderId = a.active[a.turnIdx % a.active.length];
    const bidder   = state.players[bidderId];
    if (!bidder) return;

    const minBid   = a.currentBid + 1;
    const lastBidder = a.currentBidder !== null ? state.players[a.currentBidder] : null;
    const isMyBid  = myPlayerIndex === bidderId;

    const body = `
        <div class="modal-hdr gold">
            <div class="modal-hdr-icon">🔨</div>
            <div class="modal-hdr-title">${a.cell.name}</div>
            ${a.cell.city ? `<div class="modal-hdr-sub">${a.cell.city}</div>` : ''}
        </div>
        <div class="modal-row neutral">
            <span class="mlabel">Стартова ціна</span>
            <span class="mval gold">₴${Math.floor(a.cell.price / 2)}</span>
        </div>
        <div class="modal-row red">
            <span class="mlabel">Поточна ставка</span>
            <span class="mval red">₴${a.currentBid}${lastBidder ? ` (${lastBidder.name})` : ' — стартова'}</span>
        </div>
        <div style="background:${bidder.color};color:white;padding:10px;border-radius:8px;
                    text-align:center;margin-bottom:10px;font-weight:700">
            ${bidder.icon} ${bidder.name} — хід (₴${bidder.money})
        </div>
        ${isMyBid ? `
        <div>
            <label style="font-size:13px">Ваша ставка (мін. ₴${minBid}):</label>
            <input type="number" id="bid-input" min="${minBid}" max="${bidder.money}" value="${minBid}"
                   style="width:100%;padding:8px;font-size:16px;border:2px solid #0057b7;
                          border-radius:6px;margin-top:6px;box-sizing:border-box">
        </div>` : `
        <p style="text-align:center;color:#888;font-size:13px">
            Зачекайте — зараз хід ${bidder.icon} ${bidder.name}
        </p>`}
        <p style="font-size:11px;color:#aaa;margin-top:8px;text-align:center">
            Учасників: ${a.active.length}
        </p>`;

    showModal({
        title: `🔨 Аукціон`,
        body,
        buttons: isMyBid ? [
            { text: `✅ Зробити ставку`, class: 'btn-success', action: () => {
                const bid = parseInt(document.getElementById('bid-input')?.value) || 0;
                if (bid < minBid) { log(`Ставка має бути ≥ ₴${minBid}`, 'error'); return; }
                if (bid > bidder.money) { log(`Недостатньо коштів`, 'error'); return; }
                sendAction('auctionBid', { bid });
            }},
            { text: 'Пас', class: 'btn-secondary', action: () => sendAction('auctionPass') }
        ] : []
    });
}

// Перевизначаємо payRent для онлайн-версії
const _origExecuteRent = null;
// У renderRentModal кнопка "Сплатити" викликає takeMoney — перехоплюємо через pendingRent
// Патчимо sendAction у кнопці
function mortgageForRent(pos) {
    sendAction('mortgage', { pos });
    // Після відповіді сервера stateUpdate оновить modal
}

// Перевизначаємо showTradeMenu для онлайн-версії
window.showTradeMenu = showTradeMenuOnline;

// Такелоджування для debug
socket.onAny((event, ...args) => {
    if (event !== 'stateUpdate') console.log('[socket]', event, args[0]);
});
