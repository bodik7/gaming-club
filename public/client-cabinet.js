// ============================================================
// client-cabinet.js — Особистий кабінет: профіль, статистика,
// матчі, адмін-панель.
// Залежності (глобалі з client.js): socket, GAME_LABELS,
// _authUsername, _displayName, _avatarColor, _avatarId, _isAdmin,
// loadAuth, showToast, _esc, fetchRoomCounts
// ============================================================

let _cabColor    = null; // ініціалізується в openCabinet з _avatarColor
let _cabAvatarId = null;
let _cabAllUsers = [];

function openCabinet() {
    const screen = document.getElementById('cabinet-screen');
    if (!screen) return;
    screen.classList.remove('hidden');

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

    const dnInput = document.getElementById('cab-display-name');
    if (dnInput) dnInput.value = _displayName || '';
    const loginEl = document.getElementById('cab-login-display');
    if (loginEl) loginEl.value = _authUsername;

    _cabColor    = _avatarColor;
    _cabAvatarId = _avatarId;
    document.querySelectorAll('.cab-color-dot').forEach(d => {
        d.classList.toggle('active', d.dataset.color === _cabColor);
    });

    cabAvatarTab(_cabAvatarId ? (_cabAvatarId.startsWith('zodiac') ? 'zodiac' : 'char') : 'char');
    document.querySelectorAll('.cab-tab-admin').forEach(t => t.classList.toggle('hidden', !_isAdmin));

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
    document.querySelectorAll('.ap-item').forEach(el => el.classList.remove('selected'));
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
        _displayName  = displayName;
        _avatarColor  = _cabColor;
        _avatarId     = _cabAvatarId;
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
                    const ageMin  = r.createdAt    ? Math.floor((now - r.createdAt)    / 60000) : '?';
                    const idleMin = r.lastActivity ? Math.floor((now - r.lastActivity) / 60000) : '?';
                    const stale   = idleMin > 30 || (!r.started && ageMin > 15);
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
            <td>${!u.isAdmin
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
        cabLoadAdmin();
    } catch (e) {
        showToast('❌ ' + e.message, { color: '#b71c1c', duration: 3000 });
    }
}
