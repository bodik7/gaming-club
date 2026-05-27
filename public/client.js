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
let _displayName   = '';   // ім'я в іграх (з профілю)
let _avatarColor   = '#1a56db';
let _avatarId      = null;
let _isAdmin       = false;
let _isSpectator   = false;
let _emojiBarOpen  = false;

// ── Push-сповіщення ──────────────────────────
function _requestNotifPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
        Notification.requestPermission();
    }
}
function _sendNotif(title, body) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (document.visibilityState === 'visible') return;
    new Notification(title, { body, icon: '/favicon.svg' });
}

async function loadProfile(token) {
    try {
        const res = await fetch('/api/me', {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            _displayName = data.displayName || '';
            _avatarColor = data.avatarColor  || '#1a56db';
            _avatarId    = data.avatarId     || null;
            _isAdmin     = !!data.isAdmin;
            return data.username;
        }
    } catch {}
    return null;
}

async function checkAuth() {
    const joinCode = new URLSearchParams(window.location.search).get('join');

    const auth = loadAuth();
    if (auth?.token) {
        const username = await loadProfile(auth.token);
        if (username) {
            _authUsername = username;
            _isGuest = false;
            _enterLobby(username, joinCode);
            return;
        }
        clearAuth();
    }
    document.getElementById('auth-screen').classList.remove('hidden');
    if (joinCode) _pendingJoinCode = joinCode.toUpperCase();
    // Якщо є збережена сесія — приховуємо лобі поки tryRejoin не завершиться
    if (localStorage.getItem(SESSION_KEY)) {
        document.getElementById('lobby-screen').classList.add('hidden');
    }
}

function _enterLobby(username, joinCode) {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('lobby-screen').classList.remove('hidden');

    const nameInput = document.getElementById('lobby-name');
    if (username) {
        // Авторизований — підставляємо display_name або логін
        const nameInGame = _displayName || username;
        if (nameInput) {
            nameInput.value    = nameInGame;
            nameInput.readOnly = true;
            nameInput.style.opacity = '0.65';
            nameInput.title = 'Ім\'я прив\'язане до акаунту · змінити в кабінеті';
        }
        // Показуємо рядок акаунту
        const bar = document.getElementById('account-bar');
        const nameEl = document.getElementById('account-name');
        const avatarEl = document.getElementById('account-avatar');
        const logoutBtn = document.getElementById('account-logout-btn');
        if (bar) bar.classList.remove('hidden');
        if (nameEl) nameEl.textContent = nameInGame;
        if (avatarEl) {
            if (_avatarId && window.AVATARS?.[_avatarId]) {
                avatarEl.innerHTML = window.AVATARS[_avatarId];
                avatarEl.style.background = 'transparent';
                avatarEl.textContent = '';
                avatarEl.querySelector('svg')?.setAttribute('width', '36');
                avatarEl.querySelector('svg')?.setAttribute('height', '36');
            } else {
                avatarEl.textContent = nameInGame[0].toUpperCase();
                avatarEl.style.background = _avatarColor;
            }
        }
        if (logoutBtn) logoutBtn.style.display = '';
        document.getElementById('lobby-login-btn')?.classList.add('hidden');
    } else {
        // Гість — поле вільне, кнопка виходу прихована
        if (nameInput) {
            nameInput.value    = loadName();
            nameInput.readOnly = false;
            nameInput.style.opacity = '1';
            nameInput.removeAttribute('title');
        }
        document.getElementById('account-logout-btn')?.style.setProperty('display', 'none');
        document.getElementById('lobby-login-btn')?.classList.remove('hidden');
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
            const gNames = { tysyacha: 'Тисяча', mafia: 'Мафія', monopoly: 'Монополія', durak: 'Дурак', bunker: 'Бункер' };
            const specBtn = document.getElementById('spectate-btn');
            if (started) {
                peekEl.textContent = '⚠️ Гра вже почалась';
                if (specBtn && gameType !== 'mafia' && gameType !== 'bunker') specBtn.style.display = '';
            } else {
                peekEl.textContent = `${gNames[gameType] || gameType} · ${players}/${max} гравців`;
                if (specBtn) specBtn.style.display = 'none';
            }
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
    _requestNotifPermission();
}

// ── Кнопки авторизації ────────────────────────
function switchAuthTab(tab) {
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register').classList.toggle('active', tab === 'register');
    const btn = document.getElementById('auth-submit-btn');
    if (btn) btn.textContent = tab === 'login' ? 'Увійти' : 'Зареєструватись';
    const confirmWrap = document.getElementById('auth-confirm-wrap');
    if (confirmWrap) confirmWrap.style.display = tab === 'register' ? 'block' : 'none';
    const err = document.getElementById('auth-error');
    if (err) err.textContent = '';
}

async function doAuth() {
    const username = (document.getElementById('auth-username')?.value || '').trim();
    const password =  document.getElementById('auth-password')?.value || '';
    const isLogin  = document.getElementById('tab-login')?.classList.contains('active');
    const errEl    = document.getElementById('auth-error');
    const btn      = document.getElementById('auth-submit-btn');

    if (errEl) errEl.textContent = '';
    if (!username || !password) {
        if (errEl) errEl.textContent = 'Заповніть усі поля';
        return;
    }
    if (!isLogin) {
        const confirm = document.getElementById('auth-confirm')?.value || '';
        if (!confirm) {
            if (errEl) errEl.textContent = 'Підтвердіть пароль';
            return;
        }
        if (confirm !== password) {
            if (errEl) errEl.textContent = 'Паролі не збігаються';
            return;
        }
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
        await loadProfile(data.token);
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
    _displayName  = '';
    _avatarColor  = '#1a56db';
    _avatarId     = null;
    _isAdmin      = false;
    closeCabinet();
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('account-bar')?.classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
    const u = document.getElementById('auth-username');
    const p = document.getElementById('auth-password');
    if (u) u.value = '';
    if (p) p.value = '';
}

const GAME_LABELS = {
    monopoly: '🏦 Монополія',
    tysyacha: '🃏 Тисяча',
    mafia:    '🔫 Мафія',
    durak:    '🂡 Дурак',
    bunker:   '🏚️ Бункер',
};

// ── Стан кабінету ──────────────────────────────
let _cabColor    = _avatarColor;
let _cabAvatarId = null;
let _cabAllUsers = [];

function openCabinet() {
    const screen = document.getElementById('cabinet-screen');
    if (!screen) return;
    screen.classList.remove('hidden');

    // Заповнюємо sidebar
    const nameInGame = _displayName || _authUsername;
    const avatarEl = document.getElementById('cab-avatar-circle');
    if (avatarEl) {
        avatarEl.textContent = nameInGame[0]?.toUpperCase() || '?';
        avatarEl.style.background = _avatarColor;
    }
    document.getElementById('cab-sidebar-name').textContent     = nameInGame;
    document.getElementById('cab-sidebar-username').textContent = '@' + _authUsername;

    const adminBadge = document.getElementById('cab-admin-badge');
    if (adminBadge) adminBadge.classList.toggle('hidden', !_isAdmin);

    // Профіль inputs
    const dnInput = document.getElementById('cab-display-name');
    if (dnInput) dnInput.value = _displayName || '';
    const loginEl = document.getElementById('cab-login-display');
    if (loginEl) loginEl.value = _authUsername;

    // Позначити активний колір
    _cabColor    = _avatarColor;
    _cabAvatarId = _avatarId;
    document.querySelectorAll('.cab-color-dot').forEach(d => {
        d.classList.toggle('active', d.dataset.color === _cabColor);
    });

    // Заповнити picker аватарів
    cabAvatarTab(_cabAvatarId ? (_cabAvatarId.startsWith('zodiac') ? 'zodiac' : 'char') : 'char');

    // Адмін-вкладка
    document.querySelectorAll('.cab-tab-admin').forEach(t => t.classList.toggle('hidden', !_isAdmin));

    // Загружаємо статистику
    cabSwitchTab('profile');
    cabLoadStats();
}

function closeCabinet() {
    document.getElementById('cabinet-screen')?.classList.add('hidden');
}

function cabSwitchTab(tab) {
    document.querySelectorAll('.cab-tab').forEach(t =>
        t.classList.toggle('active', t.dataset.tab === tab));
    ['profile', 'stats', 'history', 'admin'].forEach(p => {
        const el = document.getElementById(`cab-panel-${p}`);
        if (el) el.classList.toggle('hidden', p !== tab);
    });
    if (tab === 'admin')   cabLoadAdmin();
    if (tab === 'history') cabLoadHistory();
}

function cabPickColor(btn) {
    _cabColor = btn.dataset.color;
    document.querySelectorAll('.cab-color-dot').forEach(d =>
        d.classList.toggle('active', d.dataset.color === _cabColor));
    const av = document.getElementById('cab-avatar-circle');
    if (av && !_cabAvatarId) av.style.background = _cabColor;
}

function cabAvatarTab(group) {
    ['char','zodiac','none'].forEach(g => {
        const btn = document.getElementById(`ap-tab-${g}`);
        if (btn) btn.classList.toggle('active', g === group);
    });
    const grid = document.getElementById('avatar-picker-grid');
    if (!grid || !window.AVATARS) return;
    if (group === 'none') {
        grid.innerHTML = '<div style="color:rgba(255,255,255,0.35);font-size:12px;padding:8px 2px">Аватар не вибрано — буде відображатись кольоровий кружок з літерою</div>';
        if (_cabAvatarId) { _cabAvatarId = null; _cabUpdateAvatarPreview(); }
        return;
    }
    const ids = Object.keys(window.AVATARS).filter(id => id.startsWith(group));
    grid.innerHTML = ids.map(id => {
        const meta = window.AVATAR_META[id] || {};
        const sel  = id === _cabAvatarId ? ' selected' : '';
        return `<div class="ap-item${sel}" onclick="cabSelectAvatar('${id}')" title="${meta.label||''}\n${meta.note||''}">
            ${window.AVATARS[id].replace('<svg ', '<svg width="52" height="52" ')}
            <div class="ap-item-name">${meta.label||''}</div>
        </div>`;
    }).join('');
}

function cabSelectAvatar(id) {
    _cabAvatarId = (_cabAvatarId === id) ? null : id;
    document.querySelectorAll('.ap-item').forEach(el => {
        el.classList.toggle('selected', el.onclick?.toString().includes(`'${id}'`) && _cabAvatarId === id);
    });
    // Re-render to update selection properly
    const current = document.querySelector('.ap-item.selected');
    document.querySelectorAll('.ap-item').forEach(el =>
        el.classList.remove('selected'));
    if (_cabAvatarId) {
        const idx = Object.keys(window.AVATARS).filter(k => k.startsWith(_cabAvatarId.split('_')[0])).indexOf(_cabAvatarId);
        const items = document.querySelectorAll('.ap-item');
        if (items[idx]) items[idx].classList.add('selected');
    }
    _cabUpdateAvatarPreview();
}

function _cabUpdateAvatarPreview() {
    const av = document.getElementById('cab-avatar-circle');
    const nameInGame = _displayName || _authUsername;
    if (!av) return;
    if (_cabAvatarId && window.AVATARS?.[_cabAvatarId]) {
        av.innerHTML = window.AVATARS[_cabAvatarId];
        av.style.background = 'transparent';
        av.querySelector('svg')?.setAttribute('width', '72');
        av.querySelector('svg')?.setAttribute('height', '72');
    } else {
        av.innerHTML = nameInGame[0]?.toUpperCase() || '?';
        av.style.background = _cabColor;
    }
}

async function cabSaveProfile() {
    const displayName = document.getElementById('cab-display-name')?.value.trim() || '';
    const msg = document.getElementById('cab-save-msg');
    if (msg) { msg.textContent = ''; msg.className = 'cab-save-msg'; }

    const auth = loadAuth();
    try {
        const res = await fetch('/api/profile', {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth?.token}` },
            body:    JSON.stringify({ displayName, avatarColor: _cabColor, avatarId: _cabAvatarId }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Помилка');
        // Зберігаємо локально
        _displayName  = displayName;
        _avatarColor  = _cabColor;
        _avatarId     = _cabAvatarId;
        // Оновлюємо sidebar і account-bar
        const nameInGame = _displayName || _authUsername;
        document.getElementById('cab-sidebar-name').textContent = nameInGame;
        _cabUpdateAvatarPreview();
        const accAv = document.getElementById('account-avatar');
        if (accAv) {
            if (_avatarId && window.AVATARS?.[_avatarId]) {
                accAv.innerHTML = window.AVATARS[_avatarId];
                accAv.style.background = 'transparent';
                accAv.querySelector('svg')?.setAttribute('width', '36');
                accAv.querySelector('svg')?.setAttribute('height', '36');
            } else {
                accAv.innerHTML = nameInGame[0]?.toUpperCase() || '?';
                accAv.style.background = _avatarColor;
            }
        }
        const accName = document.getElementById('account-name');
        if (accName) accName.textContent = nameInGame;
        const nameInput = document.getElementById('lobby-name');
        if (nameInput && nameInput.readOnly) nameInput.value = nameInGame;
        if (msg) { msg.textContent = '✅ Збережено!'; msg.className = 'cab-save-msg ok'; }
        setTimeout(() => { if (msg) msg.textContent = ''; }, 3000);
    } catch (e) {
        if (msg) { msg.textContent = '❌ ' + e.message; msg.className = 'cab-save-msg err'; }
    }
}

async function cabLoadStats() {
    const auth = loadAuth();
    const listEl  = document.getElementById('cab-stats-list');
    const totalEl = document.getElementById('cab-stats-total');
    if (listEl) listEl.innerHTML = '<div class="cab-loading">Завантаження…</div>';

    try {
        const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${auth?.token}` } });
        if (!res.ok) throw new Error();
        const { stats = {} } = await res.json();

        let totalGames = 0, totalWins = 0;
        const rows = Object.entries(GAME_LABELS).map(([key, label]) => {
            const s = stats[key] || { g: 0, w: 0 };
            totalGames += s.g; totalWins += s.w;
            const pct = s.g > 0 ? Math.round(s.w / s.g * 100) : 0;
            return `<div class="cab-stat-row">
                <div class="cab-stat-header">
                    <span class="cab-stat-label">${label}</span>
                    <span class="cab-stat-nums">${s.w}/${s.g} · ${pct}%</span>
                </div>
                <div class="cab-stat-bar-wrap"><div class="cab-stat-bar" style="width:${pct}%"></div></div>
            </div>`;
        });
        if (listEl) listEl.innerHTML = rows.join('');

        // Sidebar stats
        const sideStats = document.getElementById('cab-sidebar-stats');
        if (sideStats) sideStats.innerHTML = `Ігор: ${totalGames}<br>Перемог: ${totalWins}`;

        const tpct = totalGames > 0 ? Math.round(totalWins / totalGames * 100) : 0;
        if (totalEl) totalEl.textContent = totalGames > 0
            ? `Загалом: ${totalWins} з ${totalGames} ігор · ${tpct}%`
            : 'Ще не зіграно жодної гри';
    } catch {
        if (listEl) listEl.innerHTML = '<div class="cab-loading">Помилка завантаження</div>';
    }
}

async function cabLoadHistory() {
    const el = document.getElementById('cab-panel-history');
    if (!el) return;
    const auth = loadAuth();
    const TITLE = '<div class="cab-section-title">Останні матчі</div>';
    el.innerHTML = TITLE + '<div class="cab-loading">Завантаження…</div>';
    try {
        const res = await fetch('/api/history', { headers: { Authorization: `Bearer ${auth?.token}` } });
        if (!res.ok) throw new Error();
        const history = await res.json();
        if (!history.length) {
            el.innerHTML = TITLE + '<div class="cab-loading" style="opacity:.5">Ще немає зіграних ігор</div>';
            return;
        }
        const ROLE_UA = { citizen:'Мирний', sheriff:'Комісар', deputy:'Помічник', doctor:'Лікар',
            roleblocker:'Повія', mafia:'Мафія', don:'Дон', maniac:'Маньяк' };
        const WINNER_UA = { town:'Місто', mafia:'Мафія', maniac:'Маньяк' };
        el.innerHTML = TITLE + history.map(h => {
            const me = (h.players || []).find(p => p.username === _authUsername);
            const won = me?.won;
            const role = me?.role ? (ROLE_UA[me.role] || me.role) : null;
            const winnerLabel = WINNER_UA[h.winner] || h.winner || '—';
            const date = h.playedAt ? new Date(h.playedAt + 'Z').toLocaleDateString('uk-UA', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '';
            const badge = won === true
                ? `<span style="background:#1b5e20;color:#a5d6a7;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700">✅ Перемога</span>`
                : won === false
                ? `<span style="background:#4a1616;color:#ef9a9a;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700">❌ Поразка</span>`
                : `<span style="background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.4);padding:2px 8px;border-radius:6px;font-size:11px">—</span>`;
            const players = (h.players || []).map(p => _esc(p.name)).join(', ');
            return `<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:10px;padding:10px 14px;margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                    <span style="font-weight:700;color:rgba(255,255,255,0.9)">${GAME_LABELS[h.gameType]||h.gameType}</span>
                    ${badge}
                </div>
                <div style="font-size:11px;color:rgba(255,255,255,0.45);display:flex;gap:12px;flex-wrap:wrap">
                    ${role ? `<span>👤 ${role}</span>` : ''}
                    ${h.winner ? `<span>🏆 ${winnerLabel}</span>` : ''}
                    ${h.rounds ? `<span>🔄 ${h.rounds} раундів</span>` : ''}
                    <span>📅 ${date}</span>
                </div>
                <div style="font-size:10px;color:rgba(255,255,255,0.25);margin-top:4px">${players}</div>
            </div>`;
        }).join('');
    } catch {
        el.innerHTML = TITLE + '<div class="cab-loading">Помилка завантаження</div>';
    }
}

async function cabLoadAdmin() {
    const auth = loadAuth();
    const roomsEl = document.getElementById('cab-admin-rooms');
    const usersEl = document.getElementById('cab-admin-users');

    // Кімнати
    try {
        const res = await fetch('/api/admin/rooms', { headers: { Authorization: `Bearer ${auth?.token}` } });
        const rooms = await res.json();
        if (!rooms.length) {
            roomsEl.innerHTML = '<div class="cab-loading">Немає активних кімнат</div>';
        } else {
            const now = Date.now();
            roomsEl.innerHTML = `<table class="cab-admin-table">
                <tr><th>Код</th><th>Гра</th><th>Гравці</th><th>Статус</th><th>Час</th><th></th></tr>
                ${rooms.map(r => {
                    const ageMin = r.createdAt ? Math.floor((now - r.createdAt) / 60000) : '?';
                    const idleMin = r.lastActivity ? Math.floor((now - r.lastActivity) / 60000) : '?';
                    const stale = idleMin > 30 || (!r.started && ageMin > 15);
                    return `<tr style="${stale ? 'background:rgba(204,50,50,0.1)' : ''}">
                        <td><b>${r.code}</b></td>
                        <td>${GAME_LABELS[r.gameType] || r.gameType}</td>
                        <td title="${r.playerNames?.join(', ')}">${r.players} 👤</td>
                        <td>${r.started ? '▶ Гра' : '⏳ Чекає'}</td>
                        <td style="font-size:11px;color:rgba(255,255,255,0.45)">${stale ? '⚠️ ' : ''}${ageMin}хв${idleMin !== ageMin ? ` / idle ${idleMin}хв` : ''}</td>
                        <td><button class="cab-admin-del-btn" onclick="cabKillRoom('${r.code}')">Закрити</button></td>
                    </tr>`;
                }).join('')}
            </table>`;
        }
    } catch { roomsEl.innerHTML = '<div class="cab-loading">Помилка</div>'; }

    // Користувачі
    try {
        const res = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${auth?.token}` } });
        _cabAllUsers = await res.json();
        cabRenderUsers(_cabAllUsers);
    } catch { usersEl.innerHTML = '<div class="cab-loading">Помилка</div>'; }
}

function cabRenderUsers(list) {
    const usersEl = document.getElementById('cab-admin-users');
    if (!list.length) { usersEl.innerHTML = '<div class="cab-loading">Немає користувачів</div>'; return; }
    usersEl.innerHTML = `<table class="cab-admin-table">
        <tr><th>Логін</th><th>Ім'я в іграх</th><th>Ігор</th><th>Перемог</th><th>Роль</th><th></th></tr>
        ${list.map(u => `<tr>
            <td><b>${u.username}</b></td>
            <td>${u.displayName || '—'}</td>
            <td>${u.games}</td>
            <td>${u.wins}</td>
            <td><span class="${u.isAdmin ? 'cab-badge-admin' : 'cab-badge-user'}">${u.isAdmin ? '⚡ Адмін' : 'Гравець'}</span></td>
            <td>${u.username.toLowerCase() !== 'bodik'
                ? `<button class="cab-admin-del-btn" onclick="cabDeleteUser('${u.username}')">Видалити</button>`
                : ''}</td>
        </tr>`).join('')}
    </table>`;
}

function cabAdminFilterUsers() {
    const q = document.getElementById('cab-admin-search')?.value.toLowerCase() || '';
    cabRenderUsers(_cabAllUsers.filter(u =>
        u.username.toLowerCase().includes(q) || (u.displayName || '').toLowerCase().includes(q)
    ));
}

async function cabDeleteUser(username) {
    if (!confirm(`Видалити користувача "${username}"? Це видалить і всю його статистику.`)) return;
    const auth = loadAuth();
    try {
        const res = await fetch(`/api/admin/users/${encodeURIComponent(username)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${auth?.token}` },
        });
        if (!res.ok) throw new Error((await res.json()).error);
        _cabAllUsers = _cabAllUsers.filter(u => u.username !== username);
        cabRenderUsers(_cabAllUsers);
        showToast(`✅ Користувача ${username} видалено`, { color: '#1b5e20', duration: 3000 });
    } catch (e) {
        showToast('❌ ' + e.message, { color: '#b71c1c', duration: 3000 });
    }
}

async function cabKillRoom(code) {
    if (!confirm(`Закрити кімнату ${code}? Усі гравці будуть відключені.`)) return;
    const auth = loadAuth();
    try {
        const res = await fetch(`/api/admin/rooms/${encodeURIComponent(code)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${auth?.token}` },
        });
        if (!res.ok) throw new Error((await res.json()).error);
        showToast(`✅ Кімнату ${code} закрито`, { color: '#1b5e20', duration: 3000 });
        cabLoadAdmin(); // оновлюємо список
    } catch (e) {
        showToast('❌ ' + e.message, { color: '#b71c1c', duration: 3000 });
    }
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
    _isReady = false;
    _isSpectator = false;
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
            document.getElementById('lobby-screen').classList.remove('hidden');
            showRejoinError(error);
            return;
        }
        myPlayerIndex = playerIndex;
        if (started && state) {
            document.getElementById('lobby-screen').classList.add('hidden');
            _showEmojiBar(true);
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
        // Бейдж непрочитаних для мобільного чату Монополії
        if (id === 'chat-messages' && typeof mnMarkChatUnread === 'function') mnMarkChatUnread();
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

// ── Лобі ─────────────────────────────────────
let _inviteCode = '';
let _selectedGame = 'monopoly';
let _pendingJoinCode = '';

function selectGame(type) {
    _selectedGame = type;
    document.querySelectorAll('.game-card').forEach(btn => {
        const game = btn.dataset.game || btn.id?.replace('game-btn-', '');
        btn.classList.toggle('active', game === type);
    });
    const sel = document.getElementById('game-select-mobile');
    if (sel && sel.value !== type) sel.value = type;
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
    document.getElementById('lobby-login-btn')?.classList.add('hidden');
    document.getElementById('waiting-screen').classList.remove('hidden');
    const linkEl = document.getElementById('room-link-display');
    if (linkEl) linkEl.textContent = `${location.origin}${location.pathname}?join=${code}`;
    document.getElementById('start-btn').classList.toggle('hidden', myPlayerIndex !== 0);
    fetchRoomCounts();
    const shareBtn = document.getElementById('copy-link-btn');
    if (shareBtn && navigator.share) shareBtn.textContent = '📤 Поділитись запрошенням';
    const chatBox = document.getElementById('lobby-chat-messages');
    if (chatBox) chatBox.innerHTML = '';
}

function copyRoomCode() {
    copyInviteLink();
}

function leaveRoom() {
    socket.emit('leaveRoom');
    clearSession();
    myPlayerIndex = null;
    _inviteCode = '';
    _showEmojiBar(false);
    _showSpectatorBar(false);
    document.getElementById('waiting-screen').classList.add('hidden');
    document.getElementById('lobby-screen').classList.remove('hidden');
    if (_isGuest) document.getElementById('lobby-login-btn')?.classList.remove('hidden');
}

socket.on('roomClosed', ({ reason }) => {
    clearSession();
    myPlayerIndex = null;
    _inviteCode = '';
    _showEmojiBar(false);
    _showSpectatorBar(false);
    ['waiting-screen','game-screen','durak-screen','tysyacha-screen','mafia-screen'].forEach(id => {
        document.getElementById(id)?.classList.add('hidden');
    });
    setQuitBtn(false);
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
    _showEmojiBar(false);
    _showSpectatorBar(false);
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
    _showEmojiBar(false);
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

function watchRoom() {
    socket.emit('getActiveRooms', ({ rooms: list }) => {
        const gameIcons = { monopoly:'🏦', tysyacha:'🃏', durak:'🂡', bunker:'🏚️', mafia:'🕵️' };
        const gameNames = { monopoly:'Монополія', tysyacha:'Тисяча', durak:'Дурак', bunker:'Бункер', mafia:'Мафія' };
        let body;
        if (!list.length) {
            body = `<p style="text-align:center;color:#888;padding:20px 0 8px;font-size:14px">
                        🎮 Зараз немає активних ігор
                    </p>`;
        } else {
            body = list.map(r => {
                const avatarRow = r.playerNames.map((name, i) => {
                    const av = r.avatars?.[i];
                    const chip = av ? window.renderAvatarEl(av.avatarId, av.avatarColor, name[0] || '?', 24) : '';
                    return `<div style="display:flex;align-items:center;gap:5px;font-size:12px;color:#444">${chip}<span>${_esc(name)}</span></div>`;
                }).join('');
                const adminKill = _isAdmin
                    ? `<button onclick="_adminKillRoomFromModal('${r.code}')"
                           style="background:#fff0f0;border:1px solid #f5c6cb;color:#c0392b;
                                  border-radius:7px;padding:4px 10px;font-size:11px;font-weight:700;
                                  cursor:pointer;white-space:nowrap"
                           onmouseover="this.style.background='#fce8e8'"
                           onmouseout="this.style.background='#fff0f0'">
                           🗑 Закрити
                       </button>`
                    : '';
                return `
                <div style="padding:12px 14px;border-radius:10px;border:1.5px solid #e0e8f5;
                            margin-bottom:8px;background:#f8faff">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px">
                        <div>
                            <span style="font-weight:700;color:#004494;font-size:15px">
                                ${gameIcons[r.gameType]||'🎮'} ${gameNames[r.gameType]||r.gameType}
                            </span>
                            <span style="font-size:11px;color:#999;margin-left:6px">${r.code}</span>
                        </div>
                        <div style="display:flex;gap:6px;flex-shrink:0">
                            ${r.canSpectate ? `<button onclick="closeModal();_spectateCode('${r.code}')"
                                style="background:#0057b7;border:none;color:#fff;
                                       border-radius:7px;padding:5px 14px;
                                       font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap"
                                onmouseover="this.style.background='#003f8a'"
                                onmouseout="this.style.background='#0057b7'">
                                👁 Дивитись
                            </button>` : ''}
                            ${adminKill}
                        </div>
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:7px">
                        ${avatarRow || '<span style="font-size:12px;color:#aaa">Немає гравців</span>'}
                    </div>
                </div>`;
            }).join('');
        }
        showModal({
            title: '👁 Активні ігри',
            body,
            buttons: [
                { text: '🔄 Оновити', class: 'btn-secondary', action: () => { closeModal(); setTimeout(watchRoom, 100); } },
                { text: 'Закрити',    class: 'btn-secondary', action: closeModal },
            ]
        });
    });
}

async function _adminKillRoomFromModal(code) {
    if (!confirm(`Закрити кімнату ${code}? Усі гравці будуть відключені.`)) return;
    const auth = loadAuth();
    try {
        const res = await fetch(`/api/admin/rooms/${encodeURIComponent(code)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${auth?.token}` },
        });
        if (!res.ok) throw new Error((await res.json()).error);
        showToast(`✅ Кімнату ${code} закрито`, { color: '#1b5e20', duration: 3000 });
        closeModal();
        setTimeout(watchRoom, 200);
    } catch (e) {
        showToast('❌ ' + e.message, { color: '#b71c1c', duration: 3000 });
    }
}

function _spectateCode(code) {
    _pendingJoinCode = code.toUpperCase();
    socket.emit('spectatorJoin', { code }, ({ success, error, state, gameType }) => {
        if (error) { showModal({ title: '❌ Помилка', body: `<p style="text-align:center;padding:12px;color:#f88">${_esc(error)}</p>`, buttons: [{ text: 'OK', class: 'btn-secondary', action: closeModal }] }); return; }
        _isSpectator = true;
        myPlayerIndex = null;
        document.getElementById('lobby-screen').classList.add('hidden');
        _showSpectatorBar();
        _showEmojiBar(true);
        if (gameType === 'mafia')   { initMafia(state, null); return; }
        if (gameType === 'durak')   { initDurak(state, -1); return; }
        if (gameType === 'tysyacha') { initTysyacha(state, -1); return; }
        showGameScreen();
        applyState(state, false, null, null);
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

function sendLobbyMsg() {
    const input = document.getElementById('lobby-chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    socket.emit('lobbyMsg', { text });
    input.value = '';
}

socket.on('lobbyMsg', ({ name, text }) => {
    const box = document.getElementById('lobby-chat-messages');
    if (!box) return;
    const div = document.createElement('div');
    div.className = 'lobby-chat-msg';
    div.innerHTML = `<span class="lobby-chat-msg-name">${name}:</span>${text}`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
});

// ── Отримання оновлень від сервера ───────────
socket.on('lobbyUpdate', ({ players, bots, gameType, avatars, ready }) => {
    if (gameType) _selectedGame = gameType; // синхронізуємо з типом кімнати
    const list = document.getElementById('lobby-players-list');
    if (!list) return;
    if (!players || players.length === 0) {
        list.innerHTML = `<div style="text-align:center;color:rgba(255,255,255,0.25);font-size:13px;padding:12px 0;font-style:italic">
            🎮 Поки що нікого немає — запроси друзів!
        </div>`;
        return;
    }
    const prevCount = list.querySelectorAll(':scope > div').length;
    const readySet = new Set(ready || []);
    list.innerHTML = players.map((name, i) => {
        const isHost    = i === 0;
        const isBot     = bots && bots[i];
        const isMe      = i === myPlayerIndex;
        const isReady   = isHost || isBot || readySet.has(i);
        const canKick   = myPlayerIndex === 0 && !isHost && !isBot;
        const av        = avatars && avatars[i];
        const avatarHtml = av ? window.renderAvatarEl(av.avatarId, av.avatarColor, name[0] || '?', 28) : '';
        const isNew = i >= prevCount;
        return `
        <div class="${isNew ? 'lobby-player-row-new' : ''}" style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;gap:6px;animation-delay:${isNew ? (i - prevCount) * 0.06 + 's' : '0s'}">
            <div style="display:flex;align-items:center;gap:7px;flex:1;min-width:0">
                ${avatarHtml || `<span style="font-size:16px">${isHost ? '👑' : isBot ? '🤖' : '🎮'}</span>`}
                <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</span>
                <span style="font-size:11px;flex-shrink:0;${isReady ? 'color:#4caf80' : 'color:rgba(255,255,255,0.28)'}">${isReady ? '✓ Готов' : '...'}</span>
            </div>
            <div style="display:flex;gap:4px;align-items:center;flex-shrink:0">
                ${isMe && !isHost && !isBot ? `<button onclick="_toggleReady()"
                    id="ready-btn-${i}"
                    style="background:${isReady ? 'rgba(40,140,80,0.25)' : 'rgba(255,255,255,0.06)'};
                           border:1px solid ${isReady ? 'rgba(76,175,128,0.6)' : 'rgba(255,255,255,0.15)'};
                           color:${isReady ? '#4caf80' : 'rgba(255,255,255,0.5)'};
                           border-radius:6px;padding:2px 8px;font-size:11px;cursor:pointer;white-space:nowrap;
                           transition:all 0.15s">
                    ${isReady ? '✓ Готовий' : 'Готовий?'}
                </button>` : ''}
                ${canKick ? `<button onclick="kickPlayer(${i})"
                    style="background:none;border:1px solid #cc1f1f;color:#cc1f1f;
                           border-radius:6px;padding:2px 8px;font-size:11px;cursor:pointer;
                           transition:all 0.15s"
                    onmouseover="this.style.background='#cc1f1f';this.style.color='white'"
                    onmouseout="this.style.background='none';this.style.color='#cc1f1f'">
                    ✕ Видалити
                </button>` : ''}
            </div>
        </div>`;
    }).join('');
    const maxMap = { tysyacha: 3, mafia: 15, monopoly: 6, durak: 6, bunker: 15 };
    const minMap = { tysyacha: 2, mafia: 5, monopoly: 2, durak: 2, bunker: 4 };
    const min = minMap[_selectedGame] || 2;
    const counter = document.getElementById('lobby-player-count');
    if (counter) counter.textContent = `${players.length}/${maxMap[_selectedGame] || 6}`;
    const notReadyCount = players.filter((_, i) => i !== 0 && !(bots && bots[i]) && !readySet.has(i)).length;
    const canStart = players.length >= min && notReadyCount === 0;
    const hint = document.getElementById('waiting-hint');
    if (hint) {
        if (players.length < min) hint.textContent = `Потрібно ще ${min - players.length} гравців для старту`;
        else if (notReadyCount > 0) hint.textContent = `Очікуємо готовності ${notReadyCount} гравців`;
        else hint.textContent = 'Хост бачить кнопку старту';
    }
    const startBtn = document.getElementById('start-btn');
    const isHost = myPlayerIndex === 0;
    if (startBtn) {
        startBtn.classList.toggle('hidden', !isHost);
        startBtn.disabled = !canStart;
        startBtn.style.opacity = canStart ? '1' : '0.4';
    }

    // Велика кнопка "Готовий" — для не-хоста
    // Синхронізуємо локальний стан з сервером
    if (myPlayerIndex !== null && myPlayerIndex !== undefined && myPlayerIndex !== 0) {
        _isReady = readySet.has(myPlayerIndex);
    }
    const readyBigBtn = document.getElementById('ready-big-btn');
    const iAmBot = bots && bots[myPlayerIndex];
    const showReadyBtn = !isHost && !iAmBot && myPlayerIndex !== null && myPlayerIndex !== undefined;
    if (readyBigBtn) {
        readyBigBtn.style.display = showReadyBtn ? '' : 'none';
        if (showReadyBtn) {
            if (_isReady) {
                readyBigBtn.textContent = '✅ Ви готові — натисніть щоб скасувати';
                readyBigBtn.style.background = 'rgba(40,140,80,0.2)';
                readyBigBtn.style.borderColor = 'rgba(76,175,128,0.7)';
                readyBigBtn.style.color = '#4caf80';
            } else {
                readyBigBtn.textContent = '🙋 Я готовий!';
                readyBigBtn.style.background = 'rgba(0,87,183,0.18)';
                readyBigBtn.style.borderColor = 'rgba(0,150,255,0.5)';
                readyBigBtn.style.color = '#64b5f6';
            }
        }
    }
    // Кнопки ботів (Мафія)
    let botPanel = document.getElementById('bot-controls');
    const showBots = isHost && _selectedGame === 'mafia';
    if (showBots) {
        const botCount = bots ? bots.filter(Boolean).length : 0;
        const atMax = players.length >= (maxMap[_selectedGame] || 15);
        if (!botPanel) {
            botPanel = document.createElement('div');
            botPanel.id = 'bot-controls';
            botPanel.style.cssText = 'display:flex;gap:8px;align-items:center;margin-top:4px';
            const startBtnEl = document.getElementById('start-btn');
            if (startBtnEl) startBtnEl.parentNode.insertBefore(botPanel, startBtnEl);
        }
        botPanel.innerHTML = `
            <button onclick="socket.emit('addBot')" ${atMax ? 'disabled' : ''}
                style="flex:1;padding:10px;border-radius:10px;border:1px solid rgba(100,180,100,0.5);
                       background:rgba(60,140,60,0.15);color:#6dc86d;font-size:13px;font-weight:700;
                       cursor:${atMax ? 'not-allowed' : 'pointer'};opacity:${atMax ? 0.4 : 1};transition:all 0.15s"
                onmouseover="if(!this.disabled)this.style.background='rgba(60,140,60,0.3)'"
                onmouseout="this.style.background='rgba(60,140,60,0.15)'">
                🤖 + Бот
            </button>
            ${botCount > 0 ? `<button onclick="socket.emit('removeBot')"
                style="flex:1;padding:10px;border-radius:10px;border:1px solid rgba(180,80,80,0.5);
                       background:rgba(140,40,40,0.15);color:#e07070;font-size:13px;font-weight:700;
                       cursor:pointer;transition:all 0.15s"
                onmouseover="this.style.background='rgba(140,40,40,0.3)'"
                onmouseout="this.style.background='rgba(140,40,40,0.15)'">
                🤖 − Бот
            </button>` : ''}
            <span style="font-size:12px;color:rgba(255,255,255,0.4);white-space:nowrap">Ботів: ${botCount}</span>
        `;
    } else if (botPanel) {
        botPanel.remove();
    }
    // Показуємо панель налаштувань якщо хост і Мафія
    updateGameSettings(_selectedGame);
});

function kickPlayer(index) {
    socket.emit('kickPlayer', { kickIndex: index });
}

let _isReady = false;
function _toggleReady() {
    _isReady = !_isReady;
    socket.emit('setReady', { ready: _isReady });
}

socket.on('kicked', ({ reason }) => {
    clearSession();
    myPlayerIndex = null;
    document.getElementById('waiting-screen').classList.add('hidden');
    document.getElementById('lobby-screen').classList.remove('hidden');
    showRejoinError(`❌ ${reason}`);
});

socket.on('duplicateSession', () => {
    clearSession();
    myPlayerIndex = null;
    ['waiting-screen','game-screen','durak-screen'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    document.getElementById('lobby-screen').classList.remove('hidden');
    showRejoinError('⚠️ Ваш акаунт відкрито в іншій вкладці. Підключення розірвано.');
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
    _showEmojiBar(true);
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
    // Monopoly turn notification
    if (state.currentPlayerIndex === myPlayerIndex) {
        _sendNotif('Монополія', 'Твій хід! Кидай кубики.');
    }
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

let _offlinePlayers = new Set();

socket.on('playerDisconnected', ({ playerIndex }) => {
    _offlinePlayers.add(playerIndex);
    const name = _getPlayerName(playerIndex);
    const msg = name ? `📴 ${name} відключився` : `📴 Гравець ${playerIndex + 1} відключився`;
    log(msg, 'warn');
    showToast(msg, { color: '#616161', duration: 3500 });
    _rerenderCurrentGame();
});

socket.on('playerReconnected', ({ playerIndex }) => {
    _offlinePlayers.delete(playerIndex);
    const name = _getPlayerName(playerIndex);
    const msg = name ? `✅ ${name} повернувся` : `✅ Гравець ${playerIndex + 1} повернувся`;
    showToast(msg, { color: '#2e7d32', duration: 2500 });
    _rerenderCurrentGame();
});

function _getPlayerName(idx) {
    if (dState?.players?.[idx]) return dState.players[idx].name;
    if (tState?.players?.[idx]) return tState.players[idx].name;
    if (mState?.players?.[idx]) return mState.players[idx].name;
    if (players?.[idx]) return players[idx].name;
    return null;
}

function _rerenderCurrentGame() {
    if (dState && !document.getElementById('durak-screen')?.classList.contains('hidden')) renderDurak();
    else if (tState && !document.getElementById('tysyacha-screen')?.classList.contains('hidden')) renderTysyacha();
    else if (mState && !document.getElementById('mafia-screen')?.classList.contains('hidden')) renderMafia();
    else if (players?.length) renderPlayers();
}

socket.on('error', (msg) => {
    log(`❌ ${msg}`, 'error');
    showToast('⚠️ ' + msg, { color: '#b71c1c', duration: 4000 });
});

// Такелоджування для debug
socket.onAny((event, ...args) => {
    if (event !== 'stateUpdate') console.log('[socket]', event, args[0]);
});

// ── Режим глядача ─────────────────────────────
function spectateRoom() {
    const code = _pendingJoinCode;
    if (!code) return;
    document.getElementById('join-invite-banner')?.classList.add('hidden');
    socket.emit('spectatorJoin', { code }, ({ success, error, state, gameType }) => {
        if (error) { _lobbyError(error); return; }
        _isSpectator = true;
        myPlayerIndex = null;
        document.getElementById('lobby-screen').classList.add('hidden');
        _showSpectatorBar();
        _showEmojiBar(true);
        if (gameType === 'mafia')   { initMafia(state, null); return; }
        if (gameType === 'durak')   { initDurak(state, -1); return; }
        if (gameType === 'tysyacha') { initTysyacha(state, -1); return; }
        showGameScreen();
        applyState(state, false, null, null);
    });
}

function leaveSpectate() {
    socket.emit('leaveRoom');
    _isSpectator = false;
    myPlayerIndex = null;
    _showSpectatorBar(false);
    _showEmojiBar(false);
    ['game-screen','durak-screen','tysyacha-screen','mafia-screen'].forEach(id => {
        document.getElementById(id)?.classList.add('hidden');
    });
    document.getElementById('lobby-screen').classList.remove('hidden');
}

function _showSpectatorBar(show = true) {
    const bar = document.getElementById('spectator-bar');
    if (bar) bar.style.display = show ? 'flex' : 'none';
}

socket.on('spectatorJoined', ({ name }) => {
    const c = document.getElementById('spectator-count');
    if (c) c.textContent = `+${name} дивиться`;
});

// ── Emoji-реакції ─────────────────────────────
function _showEmojiBar(show = true) {
    const bar = document.getElementById('emoji-btn-bar');
    if (bar) bar.style.display = show ? 'flex' : 'none';
}

function _toggleEmojiBar() {
    _emojiBarOpen = !_emojiBarOpen;
    const picker = document.getElementById('emoji-picker');
    if (picker) picker.style.display = _emojiBarOpen ? 'flex' : 'none';
    const btn = document.getElementById('emoji-toggle-btn');
    if (btn) btn.style.background = _emojiBarOpen ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)';
}

function sendEmoji(emoji) {
    socket.emit('emojiReaction', { emoji });
    _emojiBarOpen = false;
    const picker = document.getElementById('emoji-picker');
    if (picker) picker.style.display = 'none';
}

socket.on('emojiReaction', ({ emoji, name }) => {
    const overlay = document.getElementById('emoji-overlay');
    if (!overlay) return;
    const el = document.createElement('div');
    const driftAnims = ['emoji-rise', 'emoji-rise-left', 'emoji-rise-right', 'emoji-rise-wide-left', 'emoji-rise-wide-right'];
    const anim = driftAnims[Math.floor(Math.random() * driftAnims.length)];
    el.className = 'emoji-fly';
    el.style.animationName = anim;
    const x = 10 + Math.random() * 80;
    const y = 20 + Math.random() * 60;
    el.style.left = `${x}%`;
    el.style.top  = `${y}%`;
    el.innerHTML = `<span>${emoji}</span><span class="emoji-fly-label">${_esc(name)}</span>`;
    overlay.appendChild(el);
    setTimeout(() => el.remove(), 2400);
});
