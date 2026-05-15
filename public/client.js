// ============================================
// МОНОПОЛІЯ УКРАЇНИ — client.js
// Socket.io клієнт: лобі, отримання стану, відправка дій
// ============================================

const socket = io();

// Мій індекс гравця у цій сесії
let myPlayerIndex = null;

// ── Збереження імені гравця ──────────────────
const NAME_KEY = 'monopolia_name';
function saveName(name) { localStorage.setItem(NAME_KEY, name); }
function loadName()     { return localStorage.getItem(NAME_KEY) || ''; }

// ── Авто-заповнення лобі при завантаженні ────
window.addEventListener('DOMContentLoaded', () => {
    const nameInput = document.getElementById('lobby-name');
    if (nameInput && loadName()) nameInput.value = loadName();

    const joinCode = new URLSearchParams(window.location.search).get('join');
    if (joinCode) {
        const codeInput = document.getElementById('lobby-code');
        if (codeInput) { codeInput.value = joinCode.toUpperCase(); nameInput?.focus(); }
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
    ['quit-btn-monopoly', 'quit-btn-tysyacha'].forEach(id => {
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
            // Гра вже йде — відновлюємо ігровий екран
            document.getElementById('lobby-screen').classList.add('hidden');
            setQuitBtn(true);
            if (state.gameType === 'tysyacha') {
                initTysyacha(state, myPlayerIndex);
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
                if (state.pendingAction === 'payRent' && myPlayerIndex === state.currentPlayerIndex) {
                    const { rent, ownerId, pos } = state.pendingData || {};
                    showRentModalOnline(me, BOARD[pos], rent, state.players[ownerId]);
                } else if (state.auctionState) {
                    showAuctionUIOnline(state);
                } else if (me.inJail && myPlayerIndex === state.currentPlayerIndex) {
                    offerJailOptions(me);
                } else if (state.pendingAction === 'offerPurchase' && myPlayerIndex === state.currentPlayerIndex) {
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
    requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateX(0)'; });
    setTimeout(() => {
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
socket.on('disconnect', () => setConnectionStatus(false));

// ── Чат ──────────────────────────────────────
const _esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

socket.on('chatMessage', ({ playerIndex, icon, name, color, text }) => {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const msg = document.createElement('div');
    msg.className = 'chat-message';
    msg.style.borderLeftColor = _esc(color);
    msg.innerHTML = `<span class="chat-author" style="color:${_esc(color)}">${_esc(icon)} ${_esc(name)}:</span>${_esc(text)}`;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    while (container.children.length > 60) container.removeChild(container.firstChild);
});

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

function selectGame(type) {
    _selectedGame = type;
    document.getElementById('game-btn-monopoly')?.classList.toggle('active', type === 'monopoly');
    document.getElementById('game-btn-tysyacha')?.classList.toggle('active', type === 'tysyacha');
}

function createRoom() {
    const name = document.getElementById('lobby-name').value.trim();
    if (!name) return alert('Введіть своє ім\'я');
    saveName(name);
    socket.emit('createRoom', { playerName: name, gameType: _selectedGame }, ({ code, playerIndex, error }) => {
        if (error) return alert(error);
        myPlayerIndex = playerIndex;
        saveSession(code, playerIndex, name);
        showLobbyWaiting(code);
    });
}

function joinRoom() {
    const name = document.getElementById('lobby-name').value.trim();
    const code = document.getElementById('lobby-code').value.trim().toUpperCase();
    if (!name) return alert('Введіть своє ім\'я');
    if (!code) return alert('Введіть код кімнати');
    saveName(name);
    socket.emit('joinRoom', { code, playerName: name }, ({ code: c, playerIndex, error }) => {
        if (error) return alert(error);
        myPlayerIndex = playerIndex;
        saveSession(c, playerIndex, name);
        showLobbyWaiting(c);
    });
}

function showLobbyWaiting(code) {
    _inviteCode = code;
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('waiting-screen').classList.remove('hidden');
    document.getElementById('room-code-display').innerText = code;
    document.getElementById('start-btn').classList.toggle('hidden', myPlayerIndex !== 0);
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
    const isTysyacha = !document.getElementById('tysyacha-screen').classList.contains('hidden');

    if (isTysyacha) {
        showModal({
            title: '🚪 Завершити гру?',
            body: `<p style="text-align:center;padding:12px 0;color:#555">
                Гра буде скасована для всіх гравців.<br>
                <span style="font-size:13px;color:#999">Цю дію неможливо скасувати.</span>
            </p>`,
            buttons: [
                { text: '🚪 Завершити гру', class: 'btn-danger', action: () => {
                    closeModal();
                    socket.emit('abandonGame');
                }},
                { text: 'Залишитись', class: 'btn-secondary', action: closeModal }
            ]
        });
    } else {
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
    }
}

socket.on('gameAbandoned', ({ reason }) => {
    clearSession();
    myPlayerIndex = null;
    closeModal();
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('tysyacha-screen').classList.add('hidden');
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
    navigator.clipboard.writeText(url).then(() => {
        const btn = document.getElementById('copy-link-btn');
        if (!btn) return;
        const orig = btn.textContent;
        btn.textContent = '✅ Посилання скопійовано!';
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
        let body;
        if (list.length === 0) {
            body = `<p style="text-align:center;color:#888;padding:24px 0;font-size:15px">
                        😔 Зараз немає вільних кімнат.<br><br>Створіть свою і чекайте друзів!
                    </p>`;
        } else {
            body = list.map(r => `
                <div onclick="quickJoin('${r.code}')" style="
                    display:flex;justify-content:space-between;align-items:center;
                    padding:12px 14px;border-radius:10px;border:2px solid #e0e8f5;
                    margin-bottom:8px;cursor:pointer;transition:all 0.15s;background:#f8faff"
                    onmouseover="this.style.background='#e8f0fe';this.style.borderColor='#0057b7'"
                    onmouseout="this.style.background='#f8faff';this.style.borderColor='#e0e8f5'">
                    <div>
                        <div style="font-weight:700;color:#004494;font-size:15px">${r.gameType==='tysyacha'?'🃏':'🏦'} ${r.hostName}</div>
                        <div style="font-size:12px;color:#999;margin-top:2px">${r.gameType==='tysyacha'?'Тисяча':'Монополія'} · ${r.code}</div>
                    </div>
                    <div style="text-align:right">
                        <div style="font-size:14px;color:#0057b7;font-weight:700">${r.playerCount}/${r.gameType==='tysyacha'?3:6}</div>
                        <div style="font-size:11px;color:#4caf50;margin-top:2px">● вільна</div>
                    </div>
                </div>
            `).join('');
        }

        showModal({
            title: '🔍 Вільні кімнати',
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
        alert('Спочатку введіть своє ім\'я');
        document.getElementById('lobby-name')?.focus();
        return;
    }
    saveName(name);
    socket.emit('joinRoom', { code, playerName: name }, ({ code: c, playerIndex, error }) => {
        if (error) { alert(error); return; }
        closeModal();
        myPlayerIndex = playerIndex;
        saveSession(c, playerIndex, name);
        showLobbyWaiting(c);
    });
}

function startGame() {
    socket.emit('startGame');
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
    const counter = document.getElementById('lobby-player-count');
    if (counter) counter.textContent = `${players.length}/${_selectedGame === 'tysyacha' ? 3 : 6}`;
    // Хост може змінитись після kick — оновлюємо видимість кнопки старту
    const startBtn = document.getElementById('start-btn');
    if (startBtn) startBtn.classList.toggle('hidden', myPlayerIndex !== 0);
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

socket.on('gameStarted', ({ state, gameType }) => {
    document.getElementById('waiting-screen').classList.add('hidden');
    document.getElementById('lobby-screen').classList.add('hidden');
    setQuitBtn(true);
    if (gameType === 'tysyacha' || state?.gameType === 'tysyacha') {
        initTysyacha(state, myPlayerIndex);
        return;
    }
    showGameScreen();
    applyState(state, false, null, null);
    log(`🎮 Гра почалась! Хід: ${state.players[0].name}`, 'success');
});

socket.on('stateUpdate', ({ state, sideEffect, toast }) => {
    if (state?.gameType === 'tysyacha') {
        updateTysyacha(state, sideEffect);
        return;
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
    if (state?.gameType === 'tysyacha') {
        updateTysyacha(state);
        return;
    }
    applyState(state, false, null, () => announceWinner(winner, state.players));
});

socket.on('playerDisconnected', ({ playerIndex }) => {
    log(`⚠️ Гравець ${playerIndex + 1} відключився`, 'warn');
});

socket.on('error', (msg) => {
    log(`❌ ${msg}`, 'error');
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
    // (вона правильно патчить кнопку "Сплатити" — без ризику локального stub onclick)
    if (pendingRent && state.pendingAction === 'payRent' && myPlayerIndex === state.currentPlayerIndex) {
        const { cell, rent, owner } = pendingRent;
        showRentModalOnline(players[currentPlayerIndex], cell, rent, owner);
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
    showModal({
        title: `Ділянка: ${cell.name}`,
        body: `<p><b>${cell.name}</b></p>
               <p>Ціна: <b>₴${cell.price}</b></p>
               <p>У вас: ₴${player.money}</p>`,
        buttons: [
            { text: `Купити за ₴${cell.price}`, class: 'btn-success',
              disabled: player.money < cell.price,
              action: () => { playSound('buy'); sendAction('buyProperty'); closeModal(); }},
            { text: 'На аукціон', class: 'btn-secondary',
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
        <div style="background:#f4f7fc;border-radius:10px;padding:12px;margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                <span>Ділянка:</span><b>${a.cell.name}</b>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                <span>Стартова ціна:</span><b>₴${Math.floor(a.cell.price / 2)}</b>
            </div>
            <div style="display:flex;justify-content:space-between">
                <span>Поточна ставка:</span>
                <b style="color:#cc1f1f">₴${a.currentBid}${lastBidder ? ` (${lastBidder.icon} ${lastBidder.name})` : ' — стартова'}</b>
            </div>
        </div>
        <div style="background:${bidder.color};color:white;padding:10px;border-radius:8px;text-align:center;margin-bottom:12px">
            ${bidder.icon} <b>${bidder.name}</b> — ваш хід (готівка ₴${bidder.money})
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
