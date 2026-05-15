// ============================================
// МОНОПОЛІЯ УКРАЇНИ — ui.js
// Рендеринг дошки, гравців, фішок; модалки; меню; звуки
// (потребує функції з engine.js — викликаються при подіях)
// ============================================

// ----- ЗВУКИ -----
let audioCtx = null;
let soundsEnabled = true;

// ============================================
// МОДАЛКИ ТА ЛОГ
// ============================================
function log(text, type = '') {
    const div = document.createElement('div');
    div.className = `log-entry ${type}`;
    div.innerText = text;
    const content = document.getElementById('log-content');
    content.insertBefore(div, content.firstChild);
    // обмежимо до 30 записів
    while (content.children.length > 30) content.removeChild(content.lastChild);
}

function showModal({ title, body, buttons, wide = false, onClose = null, dismissable = true }) {
    const titleEl = document.getElementById('modal-title');
    titleEl.innerText = title;
    titleEl.style.display = title ? '' : 'none';
    document.getElementById('modal-body').innerHTML = body;
    const btnContainer = document.getElementById('modal-buttons');
    btnContainer.innerHTML = '';
    buttons.forEach(b => {
        const btn = document.createElement('button');
        btn.className = b.class || 'btn-primary';
        btn.innerText = b.text;
        if (b.disabled) btn.disabled = true;
        btn.onclick = b.action;
        btnContainer.appendChild(btn);
    });
    const card = document.querySelector('.modal-card');
    card.style.maxWidth = wide ? '820px' : '';
    card.style.position = 'relative';

    // Кнопка ✕
    card.querySelectorAll('.modal-close-btn').forEach(el => el.remove());
    if (!dismissable) return document.getElementById('modal').classList.remove('hidden');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close-btn';
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = `position:absolute;top:10px;right:12px;background:none;border:none;
        font-size:18px;color:#aaa;cursor:pointer;line-height:1;padding:2px 6px;border-radius:4px;
        transition:color 0.15s,background 0.15s;z-index:1`;
    closeBtn.onmouseover = () => { closeBtn.style.color = '#333'; closeBtn.style.background = '#f0f0f0'; };
    closeBtn.onmouseout  = () => { closeBtn.style.color = '#aaa'; closeBtn.style.background = 'none'; };
    // onClose — виконує потрібні дії при закритті (teleport тощо)
    closeBtn.onclick = onClose ? () => { closeModal(); onClose(); } : closeModal;
    card.appendChild(closeBtn);

    document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
}

function modalOpen() {
    return !document.getElementById('modal').classList.contains('hidden');
}

// ============================================
// ФУНКЦІЇ ЗВУКУ
// ============================================
function getAudioCtx() {
    if (!audioCtx) {
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
        catch { return null; }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

function tone(freq, dur = 0.12, type = 'sine', vol = 0.18) {
    if (!soundsEnabled) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
}

function playSound(name) {
    switch (name) {
        case 'dice':   tone(180, 0.08, 'square', 0.15); setTimeout(() => tone(220, 0.08, 'square', 0.15), 80); break;
        case 'step':   tone(540, 0.05, 'sine', 0.08); break;
        case 'coin':   tone(880, 0.07); setTimeout(() => tone(1100, 0.1), 60); break;
        case 'buy':    tone(660, 0.1); setTimeout(() => tone(880, 0.12), 100); break;
        case 'rent':   tone(440, 0.08, 'triangle', 0.18); break;
        case 'jail':   tone(220, 0.18, 'sawtooth', 0.2); setTimeout(() => tone(160, 0.22, 'sawtooth', 0.2), 180); break;
        case 'card':   tone(700, 0.07); setTimeout(() => tone(900, 0.07), 80); break;
        case 'win':    [0,150,300,500].forEach((d,i) => setTimeout(() => tone([523, 659, 784, 1046][i], 0.18), d)); break;
        case 'error':  tone(200, 0.15, 'sawtooth', 0.15); break;
        case 'myturn': // твій хід — три висхідні ноти
            tone(523, 0.1, 'sine', 0.2);
            setTimeout(() => tone(659, 0.1, 'sine', 0.2), 120);
            setTimeout(() => tone(784, 0.15, 'sine', 0.25), 240);
            break;
        case 'trade':  // дзвінок-запрошення
            tone(880, 0.1, 'sine', 0.2);
            setTimeout(() => tone(1100, 0.1, 'sine', 0.18), 110);
            setTimeout(() => tone(1320, 0.18, 'sine', 0.22), 220);
            break;
        case 'tick':   tone(1400, 0.022, 'square', 0.09); break;
        case 'tick-last': // останній тік — гучніший і двотональний
            tone(1400, 0.04, 'square', 0.18);
            setTimeout(() => tone(1000, 0.08, 'square', 0.14), 35);
            break;
    }
}

function toggleSounds() {
    soundsEnabled = !soundsEnabled;
    const btn = document.getElementById('sound-toggle');
    if (btn) btn.innerText = soundsEnabled ? '🔊 Звук: увімк' : '🔇 Звук: вимк';
}

// ============================================
// ПОБУДОВА ДОШКИ ТА КЛІТИНОК
// ============================================
function buildBoard() {
    const board = document.getElementById('board');
    BOARD.forEach(cell => {
        const div = createCellDiv(cell);
        board.appendChild(div);
    });
}

// Перетворення позиції 0..39 у grid-area + орієнтація
function getCellPlacement(pos) {
    // bottom-right (0), going left along bottom to bottom-left (10), up to top-left (20), right to top-right (30), down back to 0
    if (pos === 0) return { row: 11, col: 11, side: 'corner' };
    if (pos >= 1 && pos <= 9) return { row: 11, col: 11 - pos, side: 'bottom' };
    if (pos === 10) return { row: 11, col: 1, side: 'corner' };
    if (pos >= 11 && pos <= 19) return { row: 11 - (pos - 10), col: 1, side: 'left' };
    if (pos === 20) return { row: 1, col: 1, side: 'corner' };
    if (pos >= 21 && pos <= 29) return { row: 1, col: 1 + (pos - 20), side: 'top' };
    if (pos === 30) return { row: 1, col: 11, side: 'corner' };
    if (pos >= 31 && pos <= 39) return { row: 1 + (pos - 30), col: 11, side: 'right' };
}

function createCellDiv(cell) {
    const place = getCellPlacement(cell.pos);
    const div = document.createElement('div');
    div.className = `cell ${place.side}`;
    if (cell.type === 'corner') div.classList.add('corner');
    if (cell.type === 'casino') div.classList.add('corner', 'casino');
    div.dataset.pos = cell.pos;
    div.style.gridRow = place.row;
    div.style.gridColumn = place.col;

    const isNarrow = (place.side === 'left' || place.side === 'right');
    const iconSize = isNarrow ? 17 : 22;

    if (cell.type === 'casino') {
        div.innerHTML = `
            <div class="cell-content casino-content">
                <div class="casino-suits">♠ ♥ ♦ ♣</div>
                <div class="casino-icon">🎰</div>
                <div class="casino-title">КАЗИНО</div>
                <div class="casino-sub">Зроби ставку!</div>
            </div>
        `;
    } else if (cell.type === 'corner') {
        div.innerHTML = `
            <div class="cell-content">
                <div class="cell-icon">${renderIcon(cell.icon, 38)}</div>
                <div class="cell-name">${cell.name}</div>
                <div style="font-size:9px;color:#555">${cell.desc}</div>
            </div>
        `;
    } else if (cell.type === 'property') {
        div.innerHTML = `
            <div class="cell-color-bar" style="background:${cell.color}"></div>
            <div class="cell-content">
                ${renderIcon(null, iconSize, cell.pos)}
                <div class="cell-name">${cell.name}</div>
                <div class="cell-city">${cell.city}</div>
                <div class="cell-price">₴${cell.price}</div>
            </div>
            <div class="buildings"></div>
        `;
    } else if (cell.type === 'railway' || cell.type === 'utility') {
        div.innerHTML = `
            <div class="cell-content">
                ${renderIcon(cell.icon, iconSize)}
                <div class="cell-name">${cell.name}</div>
                <div class="cell-price">₴${cell.price}</div>
            </div>
        `;
    } else if (cell.type === 'tax') {
        div.innerHTML = `
            <div class="cell-content">
                ${renderIcon(cell.icon, iconSize)}
                <div class="cell-name">${cell.name}</div>
                <div class="cell-price">Сплатіть ₴${cell.amount}</div>
            </div>
        `;
    } else if (cell.type === 'card') {
        if (cell.cardType === 'chance')    div.classList.add('card-chance');
        if (cell.cardType === 'excursion') div.classList.add('card-excursion');
        if (isNarrow) {
            div.innerHTML = `
                <div class="cell-content" style="flex-direction:row;align-items:center;
                            justify-content:center;gap:5px;padding:4px 6px">
                    ${renderIcon(cell.icon, 24)}
                    <div class="cell-name" style="text-align:left;hyphens:auto">${cell.name}</div>
                </div>`;
        } else {
            div.innerHTML = `
                <div class="cell-content">
                    ${renderIcon(cell.icon, 26)}
                    <div class="cell-name">${cell.name}</div>
                </div>`;
        }
    }

    div.addEventListener('click', () => showPropertyCard(cell.pos));
    return div;
}

// ============================================
// РЕНДЕРИНГ ГРАВЦІВ І ФІШОК
// ============================================
function renderPlayers() {
    const panel = document.getElementById('players-panel');
    panel.innerHTML = '';
    players.forEach((p, i) => {
        const card = document.createElement('div');
        card.className = `player-card ${i === currentPlayerIndex ? 'active' : ''} ${p.bankrupt ? 'bankrupt' : ''}`;
        // Групуємо ділянки в порядку дошки
        const propGroups = {};
        BOARD.forEach(cell => {
            if (!p.properties.includes(cell.pos)) return;
            const key = cell.type === 'property' ? cell.color
                      : cell.type === 'railway'  ? '__railway__'
                      : cell.type === 'utility'  ? '__utility__'
                      : null;
            if (!key) return;
            if (!propGroups[key]) propGroups[key] = {
                color: cell.type === 'property' ? cell.color
                     : cell.type === 'railway'  ? '#4a4a4a' : '#0277bd',
                items: []
            };
            propGroups[key].items.push(cell.pos);
        });

        const propsHTML = Object.values(propGroups).map(g => {
            const icons = g.items.map(pos => {
                const cell = BOARD[pos];
                const icon = cell.type === 'property'
                    ? renderIcon(null, 18, pos)
                    : renderIcon(cell.icon, 18);
                return `<span title="${cell.name}" style="display:inline-flex">${icon}</span>`;
            }).join('');
            return `<div style="display:inline-flex;flex-direction:column;align-items:center;gap:1px">
                <div style="display:flex;gap:1px">${icons}</div>
                <div style="height:3px;background:${g.color};width:100%;border-radius:2px"></div>
            </div>`;
        }).join('');
        card.innerHTML = `
            <div class="player-header">
                <div class="player-token" style="background:${p.color}">${p.icon}</div>
                <div>
                    <div class="player-name">${p.name}</div>
                    ${i === currentPlayerIndex ? '<div class="turn-indicator">🎲 Ваш хід</div>' : ''}
                </div>
            </div>
            <div class="player-money">${p.money}</div>
            <div style="font-size:11px;color:#666;margin-bottom:4px">
                ${p.inJail ? '🔒 У в\'язниці' : ''}
                ${p.bankrupt ? '💀 Банкрут' : ''}
            </div>
            <div class="player-properties">${propsHTML}</div>
        `;
        panel.appendChild(card);
    });
}

function placeTokens() {
    const board = document.getElementById('board');
    if (!board) return;
    const boardRect = board.getBoundingClientRect();
    players.forEach(p => {
        let token = board.querySelector(`.token[data-player="${p.id}"]`);
        if (!token) {
            token = document.createElement('div');
            token.className = 'token';
            token.style.background = p.color;
            token.innerText = p.icon;
            token.dataset.player = p.id;
            board.appendChild(token);
            // Початкове положення без анімації
            token.style.transition = 'none';
            void token.offsetWidth;
            setTimeout(() => { token.style.transition = ''; }, 30);
        }
        if (p.bankrupt) {
            token.style.display = 'none';
            return;
        }
        token.style.display = 'flex';
        const cellDiv = board.querySelector(`.cell[data-pos="${p.position}"]`);
        if (!cellDiv) return;
        const cellRect = cellDiv.getBoundingClientRect();
        const tokensInCell = players.filter(pl => !pl.bankrupt && pl.position === p.position);
        const myIdx = tokensInCell.findIndex(pl => pl.id === p.id);

        let x, y;
        if (cellDiv.classList.contains('corner')) {
            // Кутові клітинки: токени у 2×2 сітці у зовнішньому куті (подалі від тексту)
            const cornerBases = {
                0:  { xOff: (r) => r.width  - 52, yOff: (r) => r.height - 52 },
                10: { xOff: ()  => 4,              yOff: (r) => r.height - 52 },
                20: { xOff: ()  => 4,              yOff: ()  => 4             },
                30: { xOff: (r) => r.width  - 52, yOff: ()  => 4             },
            };
            const base = cornerBases[p.position] || { xOff: () => 0, yOff: () => 0 };
            const col = myIdx % 2;
            const row = Math.floor(myIdx / 2);
            x = cellRect.left - boardRect.left + base.xOff(cellRect) + col * 26;
            y = cellRect.top  - boardRect.top  + base.yOff(cellRect) + row * 26;
        } else {
            const offset = myIdx * 7;
            x = cellRect.left - boardRect.left + cellRect.width / 2 - 14 + (offset - (tokensInCell.length - 1) * 3.5);
            y = cellRect.top  - boardRect.top  + cellRect.height / 2 - 14 + (offset - (tokensInCell.length - 1) * 3.5);
        }
        token.style.left = `${x}px`;
        token.style.top = `${y}px`;
    });
}

// Перерахунок при зміні розміру вікна
window.addEventListener('resize', () => { if (players.length) placeTokens(); });

function flashCell(pos, type) {
    const cellDiv = document.querySelector(`.cell[data-pos="${pos}"]`);
    if (!cellDiv) return;
    cellDiv.classList.add(`cell-flash-${type}`);
    setTimeout(() => cellDiv.classList.remove(`cell-flash-${type}`), 700);
}

// Повертає індекс МОГо гравця (в online = myPlayerIndex, локально = currentPlayerIndex)
function _myIdx() {
    return typeof myPlayerIndex === 'number' ? myPlayerIndex : currentPlayerIndex;
}

// ============================================
// ПАНЕЛЬ КНОПОК + ІНДИКАТОР ХОДУ
// ============================================
function renderActionButtons() {
    const container = document.getElementById('action-buttons');
    const isOnline  = typeof sendAction !== 'undefined';
    const isMyTurn  = !isOnline || (typeof myPlayerIndex === 'number' && myPlayerIndex === currentPlayerIndex);
    const myPlayer  = players[_myIdx()];
    const hasCard   = myPlayer?.hasJailCard;

    container.innerHTML = `
        <button onclick="showAllProperties()">🏘️ Мої володіння</button>
        <button onclick="showLoanMenu()" ${isOnline && !isMyTurn ? 'style="opacity:0.45" title="Доступно лише у свій хід"' : ''}>🏦 Кредит</button>
        <button onclick="showTradeMenu()" ${isOnline && !isMyTurn ? 'style="opacity:0.45" title="Доступно лише у свій хід"' : ''}>🤝 Обмін / Торг</button>
        ${hasCard ? '<button onclick="showJailCardSale()">🔓 Продати картку</button>' : ''}

        <button onclick="showStatsMenu()">📊 Статистика</button>
        <button onclick="toggleSounds()" id="sound-toggle">🔊 Звук: увімк</button>
        <button onclick="showRules()">📖 Правила</button>
        <button onclick="confirmAbandonGame()" style="border-color:#e53935;color:#e53935">🏳️ Здатись</button>
    `;
}

function updateCurrentPlayerInfo() {
    const el = document.getElementById('current-player-info');
    if (!el) return;
    // На малих екранах (viewport width=1100, але фізично < 700px) ховаємо
    if (window.innerWidth < 700) { el.style.display = 'none'; return; }
    const p = players[currentPlayerIndex];
    el.style.display = '';
    el.innerHTML = `
        <div style="font-weight:700">Хід: ${p.name}</div>
        <div style="font-size:12px;opacity:0.9">${p.icon} ${p.money} ₴</div>
    `;
}

function showEndTurnBtn() {
    // Якщо випав дубль (і це не 3-й, і гравець не у в'язниці) — дозволяємо кидати знову
    const cur = players[currentPlayerIndex];
    const isDouble = lastDiceRoll[0] === lastDiceRoll[1] && lastDiceRoll[0] !== 0;
    if (isDouble && doublesCount > 0 && doublesCount < 3 && !cur.inJail && cur.position !== 10) {
        hasRolled = false; // дозволяємо повторний кидок
    }
    document.getElementById('roll-btn').classList.toggle('hidden', hasRolled);
    document.getElementById('end-turn-btn').classList.toggle('hidden', !hasRolled);
}

// ============================================
// ОНОВЛЕННЯ КЛІТИНОК ТА МОНОПОЛІЙ
// ============================================
// Перерахунок усіх монополій (групи, де всі ділянки однією рукою)
function updateMonopolies() {
    const groups = {};
    BOARD.forEach(c => {
        if (c.type === 'property') {
            if (!groups[c.color]) groups[c.color] = [];
            groups[c.color].push(c);
        }
    });
    Object.entries(groups).forEach(([color, group]) => {
        const owners = group.map(c => cellState[c.pos]?.owner);
        const allSameOwner = owners[0] !== null && owners[0] !== undefined && owners.every(o => o === owners[0]);
        group.forEach(c => {
            const cellDiv = document.querySelector(`.cell[data-pos="${c.pos}"]`);
            if (!cellDiv) return;
            if (allSameOwner) {
                cellDiv.classList.add('monopoly');
                cellDiv.style.setProperty('--monopoly-color', players[owners[0]]?.color || 'gold');
            } else {
                cellDiv.classList.remove('monopoly');
                cellDiv.style.removeProperty('--monopoly-color');
            }
        });
    });
}

function updateBoardCell(pos) {
    const cellDiv = document.querySelector(`.cell[data-pos="${pos}"]`);
    if (!cellDiv) return;
    const s = cellState[pos];

    // власник
    let marker = cellDiv.querySelector('.owner-marker');
    if (s.owner !== null) {
        if (!marker) {
            marker = document.createElement('div');
            marker.className = 'owner-marker';
            cellDiv.appendChild(marker);
        }
        marker.style.background = players[s.owner].color;
    } else if (marker) marker.remove();

    // будинки
    const buildings = cellDiv.querySelector('.buildings');
    if (buildings) {
        buildings.innerHTML = '';
        if (s.houses === 5) {
            buildings.innerHTML = '<div class="hotel"></div>';
        } else {
            for (let i = 0; i < s.houses; i++) {
                buildings.innerHTML += '<div class="house"></div>';
            }
        }
    }

    // застава
    cellDiv.classList.toggle('mortgaged', s.mortgaged);
}

// ============================================
// МОДАЛКИ ДІЇ
// ============================================
function offerPurchase(player, cell) {
    showModal({
        title: `Ділянка: ${cell.name}`,
        body: `
            <p><b>${cell.name}</b>${cell.city ? ' — ' + cell.city : ''}</p>
            <p>Ціна: <b>₴${cell.price}</b></p>
            <p>У вас: ₴${player.money}</p>
            <p style="margin-top:8px">Хочете придбати?</p>
            <p style="font-size:11px;color:#888;margin-top:4px">Якщо відмовитесь — буде оголошено аукціон серед усіх гравців.</p>
        `,
        buttons: [
            { text: `Купити за ₴${cell.price}`, class: 'btn-success',
              disabled: player.money < cell.price,
              action: () => { buyProperty(player, cell); closeModal(); showEndTurnBtn(); }},
            { text: 'На аукціон', class: 'btn-secondary',
              action: () => { closeModal(); log(`${player.name} відмовився — аукціон!`); startAuction(cell); }}
        ]
    });
}

function handleInsufficientFunds(player, amount, creditor) {
    showModal({
        title: '⚠️ Недостатньо коштів!',
        body: `<p>Ви маєте сплатити <b>₴${amount}</b>, але у вас лише <b>₴${player.money}</b>.</p>
               <p>Заставте власність через <b>Мої володіння</b> або оголосіть банкрутство.</p>`,
        buttons: [
            { text: 'Заставити власність', class: 'btn-primary',
              action: () => { closeModal(); showMortgageMenu(); }},
            { text: 'Оголосити банкрутство', class: 'btn-danger',
              action: () => { declareBankrupt(player, creditor, amount); closeModal(); }}
        ]
    });
}


function offerJailOptions(player) {
    showModal({
        title: '🔒 У В\'язниці',
        body: `<p>${player.name}, ви у В\'язниці (хід ${player.jailTurns}/3).</p>
               <p>Ви можете:</p>
               <ul style="margin:10px 0;padding-left:20px;font-size:14px">
                 <li>Сплатити ₴50 і вийти</li>
                 <li>Спробувати викинути дубль</li>
                 ${player.hasJailCard ? '<li>Використати картку "Безкоштовно вийти"</li>' : ''}
               </ul>`,
        buttons: [
            { text: 'Сплатити ₴50', class: 'btn-primary',
              disabled: player.money < 50,
              action: () => { takeMoney(player, 50); player.inJail = false; renderPlayers(); closeModal(); }},
            ...(player.hasJailCard ? [{ text: 'Використати картку', class: 'btn-success',
              action: () => { player.inJail = false; player.hasJailCard = false; renderPlayers(); closeModal(); }}] : []),
            { text: 'Кинути на дубль', class: 'btn-secondary', action: closeModal }
        ]
    });
}

// ============================================
// МЕНЮ ВЛАСНОСТІ ТА БУДІВЕЛЬ
// ============================================
function showBuildMenu() {
    const player = players[_myIdx()];
    const myProps = player.properties.map(pos => BOARD[pos]).filter(c => c.type === 'property');

    // знаходимо групи де є монополія
    const monopolies = {};
    myProps.forEach(c => {
        const group = BOARD.filter(b => b.type === 'property' && b.color === c.color);
        const allMine = group.every(b => cellState[b.pos]?.owner === player.id && !cellState[b.pos]?.mortgaged);
        if (allMine) monopolies[c.color] = group;
    });

    if (Object.keys(monopolies).length === 0) {
        showModal({ title: 'Немає монополій', body: '<p>Щоб будувати, потрібно володіти всією кольоровою групою (без застав).</p>',
                   buttons: [{ text: 'Зрозуміло', class: 'btn-primary', action: closeModal }]});
        return;
    }

    let html = '<p>Виберіть ділянку для будівництва. Будувати треба рівномірно.</p>';
    Object.values(monopolies).forEach(group => {
        group.forEach(c => {
            const s = cellState[c.pos];
            const minHouses = Math.min(...group.map(g => cellState[g.pos].houses));
            const canBuild = s.houses < 5 && s.houses === minHouses && player.money >= c.housePrice;
            html += `<div style="display:flex;justify-content:space-between;padding:8px;background:#f5f5f5;margin:4px 0;border-radius:6px;border-left:6px solid ${c.color}">
                <span><b>${c.name}</b> (${s.houses === 5 ? '🏨 Готель' : '🏠 ' + s.houses})</span>
                <button class="btn-primary" ${canBuild ? '' : 'disabled style="opacity:0.4"'}
                  onclick="buildHouse(${c.pos});closeModal();showBuildMenu();">+ за ₴${c.housePrice}</button>
            </div>`;
        });
    });

    showModal({ title: '🏠 Будівництво', body: html,
                buttons: [{ text: 'Закрити', class: 'btn-secondary', action: closeModal }]});
}

function showMortgageMenu() {
    const player = players[_myIdx()];
    const myProps = player.properties;
    if (myProps.length === 0) {
        showModal({ title: 'Немає власності', body: '<p>У вас поки немає чого заставляти.</p>',
                   buttons: [{ text: 'Ок', class: 'btn-primary', action: closeModal }]});
        return;
    }

    let html = '<p>Заставлена ділянка не приносить оренду. Викуп = застава + 10%.</p>';
    myProps.forEach(pos => {
        const c = BOARD[pos];
        const s = cellState[pos];
        const mortgageVal = Math.floor(c.price / 2);
        const redeemVal = Math.ceil(mortgageVal * 1.1);
        if (s.houses > 0) {
            html += `<div style="padding:8px;background:#f5f5f5;margin:4px 0;border-radius:6px">
              <b>${c.name}</b> — спочатку продайте будівлі (${s.houses === 5 ? 'готель' : s.houses + ' буд.'})
              <button class="btn-secondary" onclick="sellHouse(${pos});closeModal();showMortgageMenu();">Продати 1</button>
            </div>`;
        } else if (!s.mortgaged) {
            html += `<div style="display:flex;justify-content:space-between;padding:8px;background:#f5f5f5;margin:4px 0;border-radius:6px;border-left:6px solid ${c.color || '#888'}">
              <span><b>${c.name}</b></span>
              <button class="btn-primary" onclick="mortgage(${pos});closeModal();showMortgageMenu();">Заставити +₴${mortgageVal}</button>
            </div>`;
        } else {
            html += `<div style="display:flex;justify-content:space-between;padding:8px;background:#fff4e0;margin:4px 0;border-radius:6px;border-left:6px solid ${c.color || '#888'}">
              <span><b>${c.name}</b> 🏷️ заставлено</span>
              <button class="btn-success" ${player.money >= redeemVal ? '' : 'disabled'} onclick="redeem(${pos});closeModal();showMortgageMenu();">Викупити −₴${redeemVal}</button>
            </div>`;
        }
    });

    showModal({ title: '💵 Застава власності', body: html,
                buttons: [{ text: 'Закрити', class: 'btn-secondary', action: closeModal }]});
}

function showAllProperties() {
    const player = players[_myIdx()];
    if (player.properties.length === 0) {
        showModal({ title: 'Без власності', body: '<p>У вас немає нерухомості</p>',
                   buttons: [{ text: 'Ок', class: 'btn-primary', action: closeModal }]});
        return;
    }

    // --- Збираємо групи в порядку дошки ---
    const groups = {};
    BOARD.forEach(cell => {
        if (!player.properties.includes(cell.pos)) return;
        const key = cell.type === 'property' ? cell.color
                  : cell.type === 'railway'  ? '__railway__'
                  : cell.type === 'utility'  ? '__utility__'
                  : null;
        if (!key) return;
        if (!groups[key]) groups[key] = { type: cell.type, color: cell.color, items: [] };
        groups[key].items.push(cell.pos);
    });

    const totalRail = BOARD.filter(b => b.type === 'railway').length;
    const totalUtil = BOARD.filter(b => b.type === 'utility').length;

    let html = '';
    Object.entries(groups).forEach(([key, group]) => {
        const color = group.type === 'property' ? group.color
                    : group.type === 'railway'  ? '#4a4a4a'
                    : '#0277bd';

        // Заголовок групи
        let title = '';
        let badge = '';
        if (group.type === 'property') {
            const fullGroup = BOARD.filter(b => b.type === 'property' && b.color === group.color);
            const isMonopoly = fullGroup.every(b => cellState[b.pos]?.owner === player.id && !cellState[b.pos]?.mortgaged);
            const city = BOARD[group.items[0]]?.city || '';
            title = city;
            badge = isMonopoly
                ? `<span style="background:rgba(255,255,255,0.3);padding:2px 8px;border-radius:10px;font-size:11px">🏆 Монополія</span>`
                : `<span style="background:rgba(0,0,0,0.2);padding:2px 8px;border-radius:10px;font-size:11px">${group.items.length}/${fullGroup.length}</span>`;
        } else if (group.type === 'railway') {
            title = 'Залізниці';
            badge = `<span style="background:rgba(255,255,255,0.25);padding:2px 8px;border-radius:10px;font-size:11px">${group.items.length}/${totalRail}</span>`;
        } else {
            title = 'Порти';
            badge = `<span style="background:rgba(255,255,255,0.25);padding:2px 8px;border-radius:10px;font-size:11px">${group.items.length}/${totalUtil}</span>`;
        }

        html += `<div style="margin-bottom:12px;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.12)">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:${color}">
                <span style="font-weight:700;font-size:14px;color:white;text-shadow:0 1px 3px rgba(0,0,0,0.4)">${title}</span>
                ${badge}
            </div>`;

        group.items.forEach(pos => {
            const c = BOARD[pos];
            const s = cellState[pos];
            const houses = s.houses === 5 ? '🏨' : '🏠'.repeat(s.houses);
            const tags = [houses, s.mortgaged ? '🏷️ заставлено' : ''].filter(Boolean).join(' ');
            html += `
            <div onclick="closeModal();showPropertyCard(${pos})"
                 style="display:flex;justify-content:space-between;align-items:center;
                        padding:9px 12px;background:${s.mortgaged ? '#fff8f0' : '#fff'};
                        border-left:5px solid ${color};border-bottom:1px solid #eee;
                        cursor:pointer;transition:background 0.15s"
                 onmouseover="this.style.background='#f0f4ff'"
                 onmouseout="this.style.background='${s.mortgaged ? '#fff8f0' : '#fff'}'">
                <div>
                    <div style="font-weight:700;font-size:13px">${c.name}</div>
                    <div style="font-size:11px;color:#888">₴${c.price}${c.city ? ' · ' + c.city : ''}</div>
                </div>
                <div style="text-align:right;font-size:13px">${tags || '<span style="color:#bbb;font-size:11px">—</span>'}</div>
            </div>`;
        });

        html += `</div>`;
    });

    showModal({ title: '🏘️ Ваші володіння', body: html, wide: true,
                buttons: [{ text: 'Закрити', class: 'btn-secondary', action: closeModal }]});
}

function showPropertyCard(pos) {
    const c = BOARD[pos];
    if (c.type === 'corner' || c.type === 'card' || c.type === 'tax') return;
    const s = cellState[pos] || {};
    const owner = s.owner !== null && s.owner !== undefined ? players[s.owner] : null;
    const player = players[currentPlayerIndex];
    const modal = document.getElementById('property-modal');
    const content = document.getElementById('property-card-content');

    // --- Перевірка монополії та можливостей будівництва ---
    // В онлайн-режимі кнопки дій показуємо лише поточному гравцю під час його ходу
    const isOnlineTurn = typeof myPlayerIndex === 'undefined' || myPlayerIndex === currentPlayerIndex;
    const isMyProperty = s.owner === currentPlayerIndex && isOnlineTurn;
    let hasMonopoly = false, canBuild = false, canSell = false, group = [];

    if (c.type === 'property' && isMyProperty && !s.mortgaged) {
        group = BOARD.filter(b => b.type === 'property' && b.color === c.color);
        hasMonopoly = group.every(b => {
            const bs = cellState[b.pos];
            return bs?.owner === currentPlayerIndex && !bs?.mortgaged;
        });
        if (hasMonopoly) {
            const minHouses = Math.min(...group.map(g => cellState[g.pos].houses));
            const maxHouses = Math.max(...group.map(g => cellState[g.pos].houses));
            canBuild = s.houses < 5 && s.houses === minHouses && player.money >= c.housePrice;
            canSell  = s.houses > 0 && s.houses === maxHouses;
        }
    }

    // --- Відображення будинків ---
    let housesHTML = '';
    if (c.type === 'property') {
        if (s.houses === 5) {
            housesHTML = `<div style="text-align:center;margin:8px 0;font-size:18px">🏨 <b style="color:#e53935">Готель</b></div>`;
        } else if (s.houses > 0) {
            housesHTML = `<div style="text-align:center;margin:8px 0;font-size:16px">${'🏠'.repeat(s.houses)}</div>`;
        }
    }

    // --- Таблиця оренди з підсвіткою поточного рядка ---
    let body = '';
    if (c.type === 'property') {
        const activeMonopoly = hasMonopoly && s.houses === 0;
        const hi = (cond) => cond ? 'style="font-weight:700;background:#fffbe5"' : '';
        body = `
            ${housesHTML}
            <table>
                <tr ${hi(s.houses === 0 && !activeMonopoly)}><td>Оренда</td><td>₴${c.rent[0]}</td></tr>
                <tr ${hi(activeMonopoly)}><td>З монополією</td><td>₴${c.rent[0] * 2}</td></tr>
                <tr ${hi(s.houses === 1)}><td>З 1 будинком</td><td>₴${c.rent[1]}</td></tr>
                <tr ${hi(s.houses === 2)}><td>З 2 будинками</td><td>₴${c.rent[2]}</td></tr>
                <tr ${hi(s.houses === 3)}><td>З 3 будинками</td><td>₴${c.rent[3]}</td></tr>
                <tr ${hi(s.houses === 4)}><td>З 4 будинками</td><td>₴${c.rent[4]}</td></tr>
                <tr ${hi(s.houses === 5)}><td>З готелем</td><td>₴${c.rent[5]}</td></tr>
                <tr><td>Будинок коштує</td><td>₴${c.housePrice}</td></tr>
                <tr><td>Застава</td><td>₴${Math.floor(c.price / 2)}</td></tr>
            </table>`;
    } else if (c.type === 'railway') {
        const ownedRail = owner
            ? BOARD.filter(b => b.type === 'railway' && cellState[b.pos]?.owner === s.owner).length
            : 0;
        const hiR = (n) => ownedRail === n ? 'style="font-weight:700;background:#fffbe5"' : '';
        body = `<table>
            <tr><td>Ціна</td><td>₴${c.price}</td></tr>
            <tr ${hiR(1)}><td>Оренда (1 залізниця)</td><td>₴25</td></tr>
            <tr ${hiR(2)}><td>Оренда (2 залізниці)</td><td>₴50</td></tr>
            <tr ${hiR(3)}><td>Оренда (3 залізниці)</td><td>₴100</td></tr>
            <tr ${hiR(4)}><td>Оренда (4 залізниці)</td><td>₴200</td></tr>
            <tr><td>Застава</td><td>₴100</td></tr>
        </table>`;
    } else if (c.type === 'utility') {
        const ownedUtil = owner
            ? BOARD.filter(b => b.type === 'utility' && cellState[b.pos]?.owner === s.owner).length
            : 0;
        const hiU = (n) => ownedUtil === n ? 'style="font-weight:700;background:#fffbe5"' : '';
        body = `<table>
            <tr><td>Ціна</td><td>₴${c.price}</td></tr>
            <tr ${hiU(1)}><td>1 порт: оренда</td><td>4× кубики</td></tr>
            <tr ${hiU(2)}><td>2 порти: оренда</td><td>10× кубики</td></tr>
            <tr><td>Застава</td><td>₴75</td></tr>
        </table>`;
    }

    // --- Панель будівництва (тільки для монополії) ---
    let buildPanel = '';
    if (hasMonopoly) {
        const btnBuild = `<button class="big-btn green" style="flex:1;font-size:13px;padding:10px 6px"
            ${canBuild ? `onclick="buildHouseFromCard(${pos})"` : 'disabled'}>
            🏠 Збудувати<br><small>₴${c.housePrice}</small>
        </button>`;
        const btnSell = `<button class="big-btn orange" style="flex:1;font-size:13px;padding:10px 6px"
            ${canSell ? `onclick="sellHouseFromCard(${pos})"` : 'disabled'}>
            🔻 Продати<br><small>+₴${Math.floor(c.housePrice * 0.9)}</small>
        </button>`;
        const hint = !canBuild && !canSell && s.houses < 5
            ? `<div style="font-size:11px;color:#888;text-align:center;margin-top:4px">
                Будуйте рівномірно — спочатку побудуйте на інших ділянках групи
               </div>` : '';
        buildPanel = `
            <div style="border-top:1px solid #eee;margin-top:10px;padding-top:10px">
                <div style="font-size:11px;font-weight:700;color:#555;margin-bottom:6px;text-align:center">
                    🏆 Монополія · Баланс: ₴${player.money}
                </div>
                <div style="display:flex;gap:8px">${btnBuild}${btnSell}</div>
                ${hint}
            </div>`;
    }

    // --- Панель застави / викупу ---
    let mortgagePanel = '';
    if (isMyProperty && (c.type === 'property' || c.type === 'railway' || c.type === 'utility')) {
        const mortgageVal = Math.floor(c.price / 2);
        const redeemCost  = Math.ceil(mortgageVal * 1.1);
        if (!s.mortgaged) {
            const canMortgage = s.houses === 0;
            mortgagePanel = `
                <div style="border-top:1px solid #eee;margin-top:10px;padding-top:10px">
                    <button class="big-btn orange" style="width:100%;font-size:14px;padding:10px"
                        ${canMortgage ? `onclick="mortgageFromCard(${pos})"` : 'disabled'}>
                        🏷️ Заставити (+₴${mortgageVal})
                    </button>
                    ${!canMortgage ? `<div style="font-size:11px;color:#888;text-align:center;margin-top:4px">Спочатку продайте всі будинки</div>` : ''}
                </div>`;
        } else {
            const canRedeem = player.money >= redeemCost;
            mortgagePanel = `
                <div style="border-top:1px solid #eee;margin-top:10px;padding-top:10px">
                    <div style="font-size:11px;color:#888;text-align:center;margin-bottom:6px">🏷️ Ділянка заставлена · не приносить оренду</div>
                    <button class="big-btn green" style="width:100%;font-size:14px;padding:10px"
                        ${canRedeem ? `onclick="redeemFromCard(${pos})"` : 'disabled'}>
                        💸 Викупити (−₴${redeemCost})
                    </button>
                    ${!canRedeem ? `<div style="font-size:11px;color:#cc1f1f;text-align:center;margin-top:4px">Не вистачає ₴${redeemCost - player.money}</div>` : ''}
                </div>`;
        }
    }

    content.innerHTML = `
        <div class="property-card-color" style="background:${c.color || '#004494'}">
            ${c.icon || ''} ${c.city || ''}
        </div>
        <div class="property-card-body">
            <h3>${c.name}</h3>
            ${body}
            <p style="margin-top:10px;text-align:center;font-size:13px;color:#666">
                ${owner ? `Власник: ${owner.icon} ${owner.name}` : 'Не куплено'}
                ${s.mortgaged ? ' · 🏷️ заставлено' : ''}
            </p>
            ${buildPanel}
            ${mortgagePanel}
        </div>
        <div class="property-actions">
            <button class="big-btn gray"
                onclick="document.getElementById('property-modal').classList.add('hidden')">Закрити</button>
        </div>
    `;
    modal.classList.remove('hidden');
}

function buildHouseFromCard(pos) {
    buildHouse(pos);
    showPropertyCard(pos);
}

function sellHouseFromCard(pos) {
    sellHouse(pos);
    showPropertyCard(pos);
}

function mortgageFromCard(pos) {
    mortgage(pos);
    showPropertyCard(pos);
}

function redeemFromCard(pos) {
    redeem(pos);
    showPropertyCard(pos);
}

// ============================================
// АУКЦІОН (UI)
// ============================================
function showAuctionUI() {
    const a = auctionState;
    if (!a) return;
    if (a.active.length <= 1) {
        // переможець визначений (або не залишилось учасників)
        if (a.currentBidder !== null) {
            const winner = players[a.currentBidder];
            takeMoney(winner, a.currentBid);
            cellState[a.cell.pos].owner = winner.id;
            winner.properties.push(a.cell.pos);
            log(`🔨 ${winner.name} виграв аукціон на "${a.cell.name}" за ₴${a.currentBid}`, 'success');
            playSound('buy');
            updateBoardCell(a.cell.pos);
            updateMonopolies();
            renderPlayers();
        } else {
            log('Аукціон завершився без покупця', 'warn');
        }
        auctionState = null;
        closeModal();
        saveGame();
        showEndTurnBtn();
        return;
    }
    const bidder = players[a.active[a.turnIdx % a.active.length]];
    const minBid = a.currentBid + 1;
    const lastBidderName = a.currentBidder !== null
        ? `${players[a.currentBidder].icon} ${players[a.currentBidder].name}` : '—';
    showModal({
        title: `🔨 Аукціон: ${a.cell.name}`,
        body: `
            <p style="margin-bottom:6px"><b>Повна ціна:</b> ₴${a.cell.price} · <b>Старт аукціону:</b> ₴${Math.floor(a.cell.price / 2)}</p>
            <p><b>Поточна ставка:</b> ₴${a.currentBid}${a.currentBidder !== null ? ` (${lastBidderName})` : ' — стартова'}</p>
            <p style="margin-top:10px;background:${bidder.color};color:white;padding:8px;border-radius:6px;text-align:center">
                ${bidder.icon} <b>${bidder.name}</b>, ваш хід (у вас ₴${bidder.money})
            </p>
            <div style="margin-top:10px">
                <label>Ваша ставка (мін. ₴${minBid}):</label>
                <input type="number" id="bid-input" min="${minBid}" max="${bidder.money}" value="${minBid}"
                       style="width:100%;padding:8px;font-size:16px;border:2px solid #0057b7;border-radius:6px;margin-top:6px">
            </div>
            <p style="font-size:12px;color:#888;margin-top:6px">Учасників: ${a.active.length}</p>
        `,
        buttons: [
            { text: 'Зробити ставку', class: 'btn-success', action: () => {
                const bid = parseInt(document.getElementById('bid-input').value) || 0;
                if (bid < minBid) { log(`Ставка має бути ≥ ₴${minBid}`, 'error'); return; }
                if (bid > bidder.money) { log(`У ${bidder.name} лише ₴${bidder.money}`, 'error'); return; }
                a.currentBid = bid;
                a.currentBidder = bidder.id;
                a.turnIdx++;
                log(`💰 ${bidder.name} ставить ₴${bid}`);
                closeModal();
                setTimeout(showAuctionUI, 250);
            }},
            { text: 'Пас', class: 'btn-secondary', action: () => {
                log(`⏭️ ${bidder.name} пасує`, 'warn');
                a.active = a.active.filter(id => id !== bidder.id);
                if (a.turnIdx >= a.active.length && a.active.length) a.turnIdx %= a.active.length;
                closeModal();
                setTimeout(showAuctionUI, 250);
            }}
        ]
    });
}

// ============================================
// ============================================
// КРЕДИТ (UI)
// ============================================
function showLoanMenu() {
    const player = players[currentPlayerIndex];
    const totalDebt = player.loan + player.loanInterest;
    // Максимальний кредит = сума цін незаставлених ділянок
    let maxLoan = 0;
    player.properties.forEach(pos => {
        const c = BOARD[pos];
        if (!cellState[pos].mortgaged) maxLoan += Math.floor(c.price / 2);
    });
    maxLoan = Math.max(50, maxLoan);

    let html, buttons;

    if (totalDebt > 0) {
        // Секція продажу будинків для збору суми
        const loanSellable = player.properties.filter(pos => (cellState[pos]?.houses || 0) > 0);
        const loanSellHTML = loanSellable.length > 0 ? `
            <div style="margin-top:14px">
                <div style="font-size:10px;font-weight:700;color:#2e7d32;text-transform:uppercase;
                            letter-spacing:0.8px;margin-bottom:6px">🏠 Продати будинки / готелі</div>
                <div style="max-height:130px;overflow-y:auto;background:#f5f5f5;border-radius:8px;padding:6px">
                    ${loanSellable.map(pos => {
                        const c = BOARD[pos]; const s = cellState[pos];
                        const val = Math.floor(c.housePrice * 0.9);
                        const label = s.houses === 5 ? '🏨 готель' : `🏠×${s.houses}`;
                        return `<div style="display:flex;justify-content:space-between;align-items:center;
                                            padding:5px 8px;background:white;margin:2px 0;
                                            border-radius:0 5px 5px 0;border-left:4px solid ${c.color||'#888'}">
                            <span style="font-size:12px;font-weight:600">${c.name}
                                <span style="color:#888;font-weight:400">${label}</span></span>
                            <button class="big-btn green" style="font-size:11px;padding:2px 9px;flex-shrink:0"
                                onclick="sellHouseForLoan(${pos})">+₴${val}</button>
                        </div>`;
                    }).join('')}
                </div>
            </div>` : '';
        html = `
            <div style="background:#fff4e0;border:2px solid #ff9800;padding:14px;border-radius:10px;margin-bottom:14px">
                <div style="font-size:12px;color:#e65100;text-transform:uppercase;font-weight:700;margin-bottom:6px">⚠️ Діючий кредит</div>
                <div style="font-size:22px;font-weight:900;color:#e65100">₴${totalDebt}</div>
                <div style="font-size:11px;color:#888;margin-top:4px">тіло ₴${player.loan} + відсотки ₴${player.loanInterest} · залишилось ходів: ${player.loanTurnsLeft}</div>
            </div>
            ${loanSellHTML}
            ${loanSellable.length === 0 ? `<div style="font-size:13px;color:#666;text-align:center;padding:8px;background:#f4f7fc;border-radius:8px">Спочатку погасіть діючий кредит, щоб взяти новий.</div>` : ''}`;
        buttons = [
            { text: `✅ Погасити ₴${totalDebt}`, class: 'btn-success',
              disabled: player.money < totalDebt,
              action: () => {
                takeMoney(player, totalDebt);
                log(`✅ ${player.name} повернув кредит ₴${totalDebt}`, 'success');
                player.loan = 0; player.loanInterest = 0; player.loanTurnsLeft = 0;
                playSound('coin'); renderPlayers(); saveGame(); closeModal();
              }},
            { text: 'Скасувати', class: 'btn-secondary', action: closeModal }
        ];
    } else {
        html = `
            <p style="font-size:13px;color:#666;margin-bottom:14px">Кредит повертається з 10% протягом 10 ходів.</p>
            <div>
                <label style="font-size:13px;font-weight:700">Сума кредиту (макс ₴${maxLoan}):</label>
                <input type="number" id="loan-amount" value="${Math.min(500, maxLoan)}" min="50" max="${maxLoan}"
                       style="width:100%;padding:8px;font-size:16px;border:2px solid #0057b7;border-radius:6px;margin-top:6px;box-sizing:border-box">
            </div>`;
        buttons = [
            { text: 'Взяти кредит', class: 'btn-primary', action: () => {
                const amt = parseInt(document.getElementById('loan-amount').value) || 0;
                if (amt < 50 || amt > maxLoan) { log(`Сума має бути 50…${maxLoan}`, 'error'); return; }
                addMoney(player, amt);
                player.loan += amt;
                player.loanInterest += Math.ceil(amt * 0.1);
                if (!player.loanTurnsLeft || player.loanTurnsLeft <= 0) player.loanTurnsLeft = 10;
                log(`🏦 ${player.name} взяв ₴${amt} кредиту (повернути за 10 ходів)`, 'success');
                playSound('coin'); renderPlayers(); saveGame(); closeModal();
            }},
            { text: 'Скасувати', class: 'btn-secondary', action: closeModal }
        ];
    }

    showModal({ title: '🏦 Кредит у банку', body: html, buttons });
}

// ============================================
// ПРОДАЖ КАРТКИ (UI)
// ============================================
function showJailCardSale() {
    const seller = players[_myIdx()];
    if (!seller.hasJailCard) {
        showModal({ title: 'Немає картки',
                    body: '<p>У вас немає картки "Безкоштовно вийти з В\'язниці".</p>',
                    buttons: [{ text: 'Ок', class: 'btn-primary', action: closeModal }]});
        return;
    }
    // В онлайн-режимі ця угода не синхронізується з сервером — доступно тільки локально
    if (typeof sendAction !== 'undefined') {
        showModal({ title: '🔓 Продаж картки',
            body: '<p style="text-align:center;padding:12px 0;color:#555">Продаж картки доступний лише в локальному режимі (гра на одному пристрої).<br><span style="font-size:12px;color:#999">В онлайн-режимі передача картки не підтримується.</span></p>',
            buttons: [{ text: 'Зрозуміло', class: 'btn-secondary', action: closeModal }] });
        return;
    }
    const buyers = players.filter(p => !p.bankrupt && p.id !== seller.id);
    let html = '<p>Виберіть покупця і вкажіть ціну (договірна). Передайте пристрій покупцю для підтвердження.</p>';
    buyers.forEach(p => {
        html += `<div style="display:flex;align-items:center;gap:8px;padding:8px;background:#f5f5f5;margin:4px 0;border-radius:6px;border-left:5px solid ${p.color};font-size:13px">
            <span style="font-size:22px">${p.icon}</span>
            <span style="flex:1"><b>${p.name}</b><br><span style="font-size:11px;color:#666">₴${p.money}</span></span>
            <input type="number" id="card-price-${p.id}" value="50" min="1" max="${p.money}"
                   style="width:70px;padding:4px;border:1px solid #ccc;border-radius:4px"> ₴
            <button class="btn-primary" onclick="proposeJailCardSale(${p.id})">Продати</button>
        </div>`;
    });
    showModal({ title: "🔓 Продаж картки виходу з В'язниці", body: html,
                buttons: [{ text: 'Скасувати', class: 'btn-secondary', action: closeModal }]});
}

function proposeJailCardSale(buyerId) {
    const seller = players[currentPlayerIndex];
    const buyer = players[buyerId];
    const price = parseInt(document.getElementById(`card-price-${buyerId}`).value) || 0;
    if (price <= 0 || price > buyer.money) {
        log(`Невалідна ціна або у ${buyer.name} недостатньо ₴${price}`, 'error');
        return;
    }
    closeModal();
    showModal({
        title: `🔓 Пропозиція для ${buyer.name}`,
        body: `<p style="text-align:center;font-size:14px"><b>${seller.icon} ${seller.name}</b> пропонує вам картку<br>"Безкоштовно вийти з В'язниці" за <b>₴${price}</b>.</p>
               <p style="font-size:11px;color:#888;text-align:center;margin-top:10px">Передайте пристрій ${buyer.icon} ${buyer.name}</p>`,
        buttons: [
            { text: '✅ Купити', class: 'btn-success', action: () => {
                takeMoney(buyer, price);
                addMoney(seller, price);
                buyer.hasJailCard = true;
                seller.hasJailCard = false;
                log(`🔓 ${buyer.name} купив картку у ${seller.name} за ₴${price}`, 'success');
                playSound('coin');
                renderPlayers();
                saveGame();
                closeModal();
            }},
            { text: '❌ Відмовитись', class: 'btn-danger', action: () => {
                log(`${buyer.name} відмовився купувати картку`, 'warn');
                closeModal();
            }}
        ]
    });
}

// ============================================
// СТАТИСТИКА
// ============================================
function showStatsMenu() {
    let html = `<table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr style="background:#0057b7;color:white">
            <th style="padding:6px 4px;text-align:left">Гравець</th>
            <th style="padding:6px 4px">Капітал</th>
            <th style="padding:6px 4px">Готівка</th>
            <th style="padding:6px 4px">Ділянок</th>
            <th style="padding:6px 4px">🏠/🏨</th>
            <th style="padding:6px 4px">Оренда +</th>
            <th style="padding:6px 4px">Оренда −</th>
            <th style="padding:6px 4px">Податки</th>
            <th style="padding:6px 4px">Кредит</th>
        </tr>`;
    players.forEach((p, i) => {
        const net = calcNetWorth(p);
        const isActive = i === currentPlayerIndex && !p.bankrupt;
        const isMe     = i === _myIdx();
        html += `<tr style="border-bottom:1px solid #eee${p.bankrupt ? ';opacity:0.4' : ''}${isActive ? ';background:#fffde7' : ''}">
            <td style="padding:5px 4px">
                <span style="display:inline-block;width:14px;height:14px;background:${p.color};border-radius:50%;vertical-align:middle"></span>
                <b>${p.name}</b>${p.bankrupt ? ' 💀' : ''}${isActive ? ' 🎲' : ''}${isMe ? ' 👤' : ''}
            </td>
            <td style="text-align:center;font-weight:700;color:#2a9d3f">₴${net}</td>
            <td style="text-align:center">₴${p.money}</td>
            <td style="text-align:center">${p.properties.length}</td>
            <td style="text-align:center">${p.stats.housesBuilt}/${p.stats.hotelsBuilt}</td>
            <td style="text-align:center;color:#2a9d3f">+₴${p.stats.rentReceived}</td>
            <td style="text-align:center;color:#cc1f1f">−₴${p.stats.rentPaid}</td>
            <td style="text-align:center">₴${p.stats.taxesPaid}</td>
            <td style="text-align:center">${p.loan + p.loanInterest > 0 ? `₴${p.loan + p.loanInterest}` : '—'}</td>
        </tr>`;
    });
    html += '</table>';
    html += `<p style="margin-top:10px;font-size:11px;color:#888">
        <b>Капітал</b> = готівка + ціна ділянок + будинки. Заставлені рахуються як 50%.<br>
        <b>Карток узято за гру:</b> ${players.map(p => `${p.icon} ${p.stats.cardsTotal}`).join(', ')}
    </p>`;
    showModal({ title: '📊 Статистика гри', body: `<div style="overflow-x:auto">${html}</div>`,
                buttons: [{ text: 'Закрити', class: 'btn-secondary', action: closeModal }],
                wide: true });
}

// ============================================
// ОБМІН — UI
// ============================================
function showTradeMenu() {
    const me = players[currentPlayerIndex];
    const others = players.filter(p => !p.bankrupt && p.id !== me.id);
    if (others.length === 0) {
        showModal({ title: 'Немає партнерів',
                    body: '<p>Поки немає інших гравців для обміну.</p>',
                    buttons: [{ text: 'Ок', class: 'btn-primary', action: closeModal }]});
        return;
    }
    let html = '<p>Виберіть гравця для обміну:</p>';
    others.forEach(p => {
        html += `<button class="btn-primary" style="display:flex;align-items:center;gap:10px;width:100%;margin:6px 0;background:${p.color};color:white;justify-content:flex-start"
                onclick="openTradeBuilder(${p.id})">
                <span style="font-size:20px">${p.icon}</span>
                <span><b>${p.name}</b> · ₴${p.money} · ${p.properties.length} ділянок</span>
                </button>`;
    });
    showModal({ title: '🤝 Обмін / Торг', body: html,
                buttons: [{ text: 'Скасувати', class: 'btn-secondary', action: closeModal }]});
}

function openTradeBuilder(targetId) {
    const me = players[currentPlayerIndex];
    const target = players[targetId];

    const renderPropList = (player, side) => {
        if (player.properties.length === 0) {
            return '<p style="color:#888;font-size:12px">Немає ділянок</p>';
        }
        return player.properties.map(pos => {
            const c = BOARD[pos];
            const s = cellState[pos];
            const blocked = !canTradeProperty(pos);
            return `<label style="display:flex;align-items:center;gap:6px;padding:5px;border-left:6px solid ${c.color || '#888'};margin:3px 0;background:${blocked ? '#fee' : '#f5f5f5'};border-radius:4px;font-size:12px;${blocked ? 'opacity:0.6' : ''}">
                <input type="checkbox" data-side="${side}" data-pos="${pos}" ${blocked ? 'disabled' : ''}>
                <span><b>${c.name}</b>${s.mortgaged ? ' 🏷️' : ''}${blocked ? ' (з будинками)' : ''}</span>
            </label>`;
        }).join('');
    };

    const html = `
        <p style="font-size:13px;color:#666;margin-bottom:10px">Поставте галочки на ділянках, які входять у обмін, і вкажіть готівку. Доплачує та сторона, яка додає кошти.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div style="border:2px solid #0057b7;border-radius:8px;padding:8px">
                <h4 style="color:#0057b7;font-size:14px;margin-bottom:6px">${me.icon} Я (${me.name}) даю:</h4>
                ${renderPropList(me, 'from')}
                <div style="margin-top:8px;font-size:12px">
                    <label>Я доплачу:<br>
                    <input type="number" id="trade-from-cash" value="0" min="0" max="${me.money}" style="width:90px;padding:4px;border:1px solid #ccc;border-radius:4px;margin-top:2px"> ₴
                    </label>
                </div>
            </div>
            <div style="border:2px solid #2a9d3f;border-radius:8px;padding:8px">
                <h4 style="color:#2a9d3f;font-size:14px;margin-bottom:6px">${target.icon} ${target.name} дає:</h4>
                ${renderPropList(target, 'to')}
                <div style="margin-top:8px;font-size:12px">
                    <label>${target.name} доплатить:<br>
                    <input type="number" id="trade-to-cash" value="0" min="0" max="${target.money}" style="width:90px;padding:4px;border:1px solid #ccc;border-radius:4px;margin-top:2px"> ₴
                    </label>
                </div>
            </div>
        </div>
    `;

    showModal({
        title: `🤝 Обмін: ${me.name} ↔ ${target.name}`,
        body: html,
        buttons: [
            { text: 'Запропонувати', class: 'btn-success', action: () => {
                const fromProps = [...document.querySelectorAll('input[data-side="from"]:checked')].map(i => +i.dataset.pos);
                const toProps = [...document.querySelectorAll('input[data-side="to"]:checked')].map(i => +i.dataset.pos);
                let fromCash = parseInt(document.getElementById('trade-from-cash').value) || 0;
                let toCash = parseInt(document.getElementById('trade-to-cash').value) || 0;
                if (fromCash < 0) fromCash = 0;
                if (toCash < 0) toCash = 0;
                if (fromProps.length === 0 && toProps.length === 0 && fromCash === 0 && toCash === 0) {
                    log('Порожня пропозиція — обмін скасовано', 'warn');
                    return;
                }
                if (fromCash > me.money) {
                    log(`У вас лише ₴${me.money} — не можна доплатити ₴${fromCash}`, 'error');
                    return;
                }
                if (toCash > target.money) {
                    log(`У ${target.name} лише ₴${target.money} — не може доплатити ₴${toCash}`, 'error');
                    return;
                }
                closeModal();
                proposeTrade(me, target, fromProps, toProps, fromCash, toCash);
            }},
            { text: 'Скасувати', class: 'btn-secondary', action: closeModal }
        ]
    });
}

function proposeTrade(me, target, fromProps, toProps, fromCash, toCash) {
    const propsHTML = (props, ownerName) => {
        if (props.length === 0) return '<p style="color:#888;font-size:12px;margin:0">— нічого —</p>';
        return props.map(pos => {
            const c = BOARD[pos];
            const s = cellState[pos];
            return `<div style="border-left:6px solid ${c.color || '#888'};padding:4px 6px;margin:3px 0;background:white;border-radius:3px;font-size:12px">
                <b>${c.name}</b>${c.city ? ' · ' + c.city : ''}${s.mortgaged ? ' 🏷️' : ''}
            </div>`;
        }).join('');
    };

    const body = `
        <p style="font-size:13px;color:#444;text-align:center;margin-bottom:10px">
            <b>${me.icon} ${me.name}</b> пропонує обмін.<br>
            <span style="color:#888;font-size:11px">Передайте пристрій ${target.icon} ${target.name} для відповіді</span>
        </p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div style="background:#fff4e0;padding:10px;border-radius:8px;border:1px solid #ffaa00">
                <h4 style="color:#cc5500;font-size:13px;margin-bottom:6px">${target.name} віддає:</h4>
                ${propsHTML(toProps, target.name)}
                ${toCash > 0 ? `<div style="margin-top:6px;padding:4px;background:white;border-radius:3px;font-weight:700;font-size:13px">+ ₴${toCash} готівкою</div>` : ''}
            </div>
            <div style="background:#e8f8ec;padding:10px;border-radius:8px;border:1px solid #2a9d3f">
                <h4 style="color:#1d7a2c;font-size:13px;margin-bottom:6px">${target.name} отримує:</h4>
                ${propsHTML(fromProps, me.name)}
                ${fromCash > 0 ? `<div style="margin-top:6px;padding:4px;background:white;border-radius:3px;font-weight:700;font-size:13px">+ ₴${fromCash} готівкою</div>` : ''}
            </div>
        </div>
    `;

    showModal({
        title: `📋 Пропозиція для ${target.name}`,
        body: body,
        buttons: [
            { text: '✅ Прийняти обмін', class: 'btn-success', action: () => {
                executeTrade(me, target, fromProps, toProps, fromCash, toCash);
                closeModal();
            }},
            { text: '❌ Відхилити', class: 'btn-danger', action: () => {
                log(`${target.name} відхилив пропозицію обміну від ${me.name}`, 'warn');
                closeModal();
            }}
        ]
    });
}

// ============================================
// ПЕРЕМОЖЕЦЬ + ПРАВИЛА
// ============================================
function spawnConfetti() {
    const colors = ['#ffd700','#0057b7','#e53935','#43a047','#ff9800','#9c27b0','#ffffff'];
    for (let i = 0; i < 90; i++) {
        const el = document.createElement('div');
        const size = 6 + Math.random() * 8;
        el.style.cssText = `
            position:fixed;top:-12px;left:${Math.random()*100}vw;
            width:${size}px;height:${size}px;
            background:${colors[Math.floor(Math.random()*colors.length)]};
            border-radius:${Math.random()>0.5?'50%':'2px'};
            animation:confetti-fall ${2+Math.random()*3}s linear ${Math.random()*1.5}s forwards;
            z-index:10000;pointer-events:none;opacity:1`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 6000);
    }
}

function announceWinner(player, allPlayers) {
    playSound('win');
    clearSavedGame();
    spawnConfetti();
    setTimeout(spawnConfetti, 1800);

    const ranked = [...(allPlayers || players)].sort((a,b) => calcNetWorth(b) - calcNetWorth(a));
    const medals = ['🥇','🥈','🥉'];
    const statsRows = ranked.map((p, i) => `
        <tr style="background:${i===0?'#fffde7':'transparent'};${p.bankrupt?'opacity:0.55':''}">
            <td style="padding:8px 12px;font-size:18px">${medals[i]||`${i+1}.`}</td>
            <td style="padding:8px 12px">
                <span style="background:${p.color};border-radius:50%;padding:1px 7px;margin-right:6px">${p.icon}</span>
                <b>${p.name}</b>${p.bankrupt?' 💀':''}
            </td>
            <td style="padding:8px 12px;font-weight:800;color:#2e7d32">₴${calcNetWorth(p)}</td>
            <td style="padding:8px 12px;font-size:12px;color:#666">
                +₴${p.stats.rentReceived} оренди<br>
                ${p.stats.housesBuilt+p.stats.hotelsBuilt} будинків
            </td>
        </tr>`).join('');

    showModal({
        title: '🏆 ПЕРЕМОЖЕЦЬ!',
        wide: true,
        body: `
            <div style="text-align:center;padding:12px 0 16px">
                <div style="font-size:72px;display:inline-block;animation:winner-bounce 0.5s ease-in-out infinite alternate">
                    ${player.icon}
                </div>
                <h3 style="color:${player.color};font-size:26px;margin:10px 0;font-weight:900">${player.name}</h3>
                <p style="color:#666;font-size:15px">став єдиним монополістом України! 🇺🇦</p>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:14px">
                <thead>
                    <tr style="background:#f4f7fc;color:#004494;font-weight:700">
                        <th style="padding:8px 12px;text-align:left">#</th>
                        <th style="padding:8px 12px;text-align:left">Гравець</th>
                        <th style="padding:8px 12px;text-align:left">Капітал</th>
                        <th style="padding:8px 12px;text-align:left">Статистика</th>
                    </tr>
                </thead>
                <tbody>${statsRows}</tbody>
            </table>`,
        buttons: [
            { text: '🎮 Нова гра', class: 'btn-primary', action: () => { if(typeof clearSession==='function') clearSession(); location.reload(); } }
        ]
    });
}


function showRules() {
    showModal({
        title: '📖 Коротко про гру',
        body: `
        <div style="font-size:13px;line-height:1.6">
            <p><b>Мета:</b> стати єдиним монополістом, не збанкрутувавши.</p>
            <p><b>Хід:</b> Кидайте кубики 🎲, рухайтесь, виконуйте дію клітинки.</p>
            <p><b>Купівля:</b> Зупинились на вільній ділянці — можете купити.</p>
            <p><b>Оренда:</b> Зупинились на чужій — платите оренду власнику.</p>
            <p><b>Монополія:</b> Володієте всією кольоровою групою — оренда ×2, можна будувати будинки 🏠 та готель 🏨.</p>
            <p><b>Дубль:</b> Однакові числа на кубиках — кидаєте ще раз. 3 дублі поспіль = в'язниця.</p>
            <p><b>СТАРТ:</b> Проходите через нього — отримуєте ₴200.</p>
            <p><b>Тюрма 🔒:</b> Вийти можна за ₴50, викинувши дубль або карткою.</p>
            <p><b>Застава:</b> Не вистачає грошей — заставте ділянку (отримайте половину ціни).</p>
            <p><b>Перемога:</b> Залишитись єдиним не-банкрутом, або мати найбільший капітал на момент завершення.</p>
        </div>`,
        buttons: [{ text: 'Зрозуміло', class: 'btn-primary', action: closeModal }]
    });
}


// ============================================
// СПЛИВАЮЧЕ ВІКНО АРЕШТУ
// ============================================
function showJailArrestModal(reason, onDismiss) {
    const body = `
        <div style="margin:-30px -30px 20px;padding:22px 24px 18px;
                    background:linear-gradient(135deg,#1a1a2e,#16213e);
                    border-radius:18px 18px 0 0;text-align:center;color:white">
            <div style="font-size:56px;margin-bottom:8px">🔒</div>
            <div style="font-size:22px;font-weight:900;letter-spacing:1px">ВИ ЗААРЕШТОВАНІ!</div>
        </div>
        <div style="background:#fff8e1;border:2px solid #f9a825;border-radius:12px;
                    padding:14px 16px;font-size:14px;line-height:1.6;color:#333;text-align:center">
            ${reason}
        </div>
        <div style="margin-top:12px;text-align:center;font-size:12px;color:#999">
            Вирушаєте прямо до В'язниці. Не проходите через СТАРТ. Не отримуєте ₴200.
        </div>`;

    const dismiss = () => { onDismiss?.(); showEndTurnBtn(); };
    showModal({
        title: '', body,
        buttons: [{ text: '😔 Зрозуміло', class: 'btn-danger', action: () => { closeModal(); dismiss(); } }],
        onClose: dismiss,  // ✕ теж виконує teleport/endTurn
    });
}

// ============================================
// СПЛИВАЮЧЕ ВІКНА КРЕДИТУ (попередження і дедлайн)
// ============================================
const LOAN_WARNINGS = [
    'Ваш кредитний менеджер Вася вже нервово кусає олівець і поглядає на годинник.',
    'Банк надіслав трьох голубів з нагадуванням. Усі три повернулись ні з чим.',
    'Директор банку особисто дізнався про ваш борг. Він незадоволений і не снідав.',
    'Вам прийшов лист з банку. На конверті написано «ДУЖЕ ТЕРМІНОВО» великими літерами і три знаки оклику.',
    'У банку закінчилось терпіння, але ще залишився один ковток кави.',
];

const LOAN_DEADLINES = [
    'Колектор Петро вже стоїть під вашими дверима і дзвонить у домофон кожні 30 секунд.',
    'Банк вичерпав запас терпіння, кави і доброго настрою одночасно. Платіть негайно!',
    'Банківська акула відчула запах боргу і вже пливе у вашому напрямку.',
    'Ваша кредитна справа потрапила на стіл начальника відділу стягнень. Він підписав усі папери.',
    'Банк оголосив вас «персоною нон грата» у всіх відділеннях країни. Час розплачуватись!',
];

function showLoanWarningModal(player) {
    const debt = player.loan + player.loanInterest;
    const warning = LOAN_WARNINGS[Math.floor(Math.random() * LOAN_WARNINGS.length)];
    showModal({
        title: '',
        body: `
            <div style="margin:-30px -30px 20px;padding:20px 24px 16px;
                        background:linear-gradient(135deg,#e65100,#bf360c);
                        border-radius:18px 18px 0 0;text-align:center;color:white">
                <div style="font-size:48px;margin-bottom:6px">⚠️</div>
                <div style="font-size:19px;font-weight:900">БАНК НАГАДУЄ!</div>
            </div>
            <div style="background:#fff8e1;border:2px solid #e65100;border-radius:12px;
                        padding:13px 16px;font-size:14px;line-height:1.6;text-align:center;margin-bottom:12px">
                ${warning}
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;
                        padding:10px 14px;background:#ffeae8;border-radius:8px">
                <span style="font-size:13px;color:#555">Борг:</span>
                <span style="font-size:22px;font-weight:900;color:#cc1f1f">₴${debt}</span>
            </div>
            <div style="text-align:center;font-size:12px;color:#999;margin-top:8px">
                Залишився <b>1 хід</b> з 10 — потім банк діятиме самостійно
            </div>`,
        buttons: [{ text: '😰 Зрозуміло, зараз сплачу', class: 'btn-primary',
            action: () => { closeModal(); showLoanMenu(); } },
            { text: 'Потім', class: 'btn-secondary', action: closeModal }]
    });
}

function showLoanDeadlineModal(player) {
    const debt = player.loan + player.loanInterest;
    const deadline = LOAN_DEADLINES[Math.floor(Math.random() * LOAN_DEADLINES.length)];
    const canPay = player.money >= debt;

    const buttons = [];
    if (canPay) {
        buttons.push({ text: `💸 Сплатити ₴${debt}`, class: 'btn-success',
            action: () => {
                takeMoney(player, debt);
                player.loan = 0; player.loanInterest = 0; player.loanTurnsLeft = 0;
                log(`✅ ${player.name} примусово повернув кредит ₴${debt}`, 'success');
                playSound('coin'); renderPlayers(); saveGame();
                closeModal(); showEndTurnBtn();
            }});
    } else {
        buttons.push({ text: '🏷️ Заставити поля', class: 'btn-primary',
            action: () => { closeModal(); showMortgageMenu(); }});
    }
    buttons.push({ text: '💀 Банкрутство', class: 'btn-danger',
        action: () => { declareBankrupt(player, null, debt); closeModal(); }});

    showModal({
        title: '',
        body: `
            <div style="margin:-30px -30px 20px;padding:20px 24px 16px;
                        background:linear-gradient(135deg,#b71c1c,#7f0000);
                        border-radius:18px 18px 0 0;text-align:center;color:white">
                <div style="font-size:48px;margin-bottom:6px">🏦</div>
                <div style="font-size:19px;font-weight:900">ЧАС ВИЙШОВ!</div>
            </div>
            <div style="background:#ffeae8;border:2px solid #b71c1c;border-radius:12px;
                        padding:13px 16px;font-size:14px;line-height:1.6;text-align:center;margin-bottom:12px">
                ${deadline}
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;
                        padding:10px 14px;background:#ffeae8;border-radius:8px;margin-bottom:6px">
                <span style="font-size:13px;color:#555">Борг до сплати:</span>
                <span style="font-size:22px;font-weight:900;color:#b71c1c">₴${debt}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;
                        padding:10px 14px;background:${canPay?'#e8f8ec':'#ffeae8'};border-radius:8px">
                <span style="font-size:13px;color:#555">Ваша готівка:</span>
                <span style="font-size:18px;font-weight:700;color:${canPay?'#2a9d3f':'#cc1f1f'}">₴${player.money}</span>
            </div>`,
        buttons
    });
}

// ============================================
// СПЛИВАЮЧЕ ВІКНО ПОДАТКУ
// ============================================
function showTaxModal(cell, reason, onDismiss) {
    const isLuxury = cell.pos === 38;
    const accent = isLuxury ? '#7b1fa2' : '#e65100';
    const icon   = isLuxury ? '💎' : '💰';
    const title  = isLuxury ? 'РОЗКІШНИЙ ПОДАТОК' : 'ПОДАТКОВА ПЕРЕВІРКА';

    const body = `
        <div style="margin:-30px -30px 20px;padding:22px 24px 18px;
                    background:linear-gradient(135deg,${accent},${accent}bb);
                    border-radius:18px 18px 0 0;text-align:center;color:white">
            <div style="font-size:52px;margin-bottom:8px">${icon}</div>
            <div style="font-size:20px;font-weight:900;letter-spacing:1px">${title}</div>
        </div>
        <div style="background:#fff8e1;border:2px solid ${accent}66;border-radius:12px;
                    padding:14px 16px;font-size:14px;line-height:1.6;color:#333;text-align:center;
                    margin-bottom:12px">
            ${reason}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:10px 14px;background:#ffeae8;border-radius:8px">
            <span style="font-size:13px;color:#555">Списано з рахунку:</span>
            <span style="font-size:22px;font-weight:900;color:#cc1f1f">₴${cell.amount}</span>
        </div>`;

    const dismiss = () => { onDismiss?.(); showEndTurnBtn(); };
    showModal({
        title: '', body,
        buttons: [{ text: '😤 Зрозуміло', class: 'btn-primary', action: () => { closeModal(); dismiss(); } }],
        onClose: dismiss,  // ✕ теж виконує teleport/endTurn
    });
}

// ============================================
// СПЛИВАЮЧЕ ВІКНО ОРЕНДИ
// ============================================
let pendingRent = null;

function showRentModal(player, cell, rent, owner) {
    pendingRent = { player, cell, rent, owner };
    renderRentModal();
}

function renderRentModal() {
    const { cell, rent, owner } = pendingRent;
    // Завжди беремо актуального гравця з глобального масиву (оновлюється при кожному stateUpdate)
    const player = players[currentPlayerIndex];
    const canPay = player.money >= rent;
    const shortage = rent - player.money;
    const accent = cell.color || '#8B0000';

    const mortgageable = player.properties.filter(pos => {
        const s = cellState[pos];
        return !s.mortgaged && s.houses === 0;
    });
    const hasBuildings = player.properties.some(
        pos => cellState[pos].houses > 0 && !cellState[pos].mortgaged
    );

    // 1. Кольоровий банер — зв'язок з ділянкою
    const banner = `
        <div style="background:linear-gradient(135deg,${accent}ee,${accent}99);
                    margin:-30px -30px 18px;padding:18px 24px 14px;
                    border-radius:18px 18px 0 0;text-align:center;color:white;
                    text-shadow:0 1px 4px rgba(0,0,0,0.45)">
            <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;opacity:0.8;margin-bottom:4px">
                Ви потрапили на чужу ділянку
            </div>
            <div style="font-size:22px;font-weight:900">${cell.name}</div>
            ${cell.city ? `<div style="font-size:12px;opacity:0.75;font-style:italic;margin-top:2px">${cell.city}</div>` : ''}
        </div>`;

    // 2. Власник (компактний)
    const ownerBlock = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;
                    padding:8px 12px;border-radius:10px;
                    background:${owner.color}18;border:1px solid ${owner.color}40">
            <span style="font-size:28px;line-height:1">${owner.icon}</span>
            <div>
                <div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:0.5px">Власник</div>
                <div style="font-weight:700;font-size:15px;color:${owner.color}">${owner.name}</div>
            </div>
        </div>`;

    // 3. ГЕРОЙ — сума оренди
    const heroRent = `
        <div style="text-align:center;padding:20px 16px;margin-bottom:12px;
                    background:${canPay ? '#fff9f9' : '#fff4f4'};
                    border:2px solid ${canPay ? '#ffcccc' : '#e53935'};
                    border-radius:14px">
            <div style="font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">
                Сума до сплати
            </div>
            <div style="font-size:56px;font-weight:900;color:#cc1f1f;line-height:1;
                        text-shadow:0 2px 8px rgba(204,31,31,0.2)">
                ₴${rent}
            </div>
        </div>`;

    // 4. Баланс + нестача
    const balanceBlock = `
        <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:10px 14px;border-radius:8px;margin-bottom:${!canPay ? '8px' : '0'};
                    background:${canPay ? '#e8f8ec' : '#ffeae8'}">
            <span style="font-size:13px;color:#555">Ваша готівка:</span>
            <span style="font-size:20px;font-weight:700;color:${canPay ? '#2a9d3f' : '#cc1f1f'}">
                ₴${player.money}
            </span>
        </div>
        ${!canPay ? `
        <div style="display:flex;align-items:center;justify-content:center;gap:6px;
                    background:#cc1f1f;color:white;border-radius:8px;
                    padding:9px;font-weight:700;font-size:14px">
            ⚠️ Не вистачає ₴${shortage}
        </div>` : ''}`;

    // 5а. Продаж будинків / готелів
    const sellable = player.properties.filter(pos => (cellState[pos]?.houses || 0) > 0);
    let sellHTML = '';
    if (sellable.length > 0) {
        const rows = sellable.map(pos => {
            const c = BOARD[pos];
            const s = cellState[pos];
            const val = Math.floor(c.housePrice * 0.9);
            const label = s.houses === 5 ? '🏨 готель' : `🏠×${s.houses}`;
            return `<div style="display:flex;justify-content:space-between;align-items:center;
                                padding:5px 8px;background:white;margin:2px 0;
                                border-radius:0 5px 5px 0;border-left:4px solid ${c.color||'#888'}">
                <span style="font-size:12px;font-weight:600">${c.name}
                    <span style="color:#888;font-weight:400">${label}</span>
                </span>
                <button class="big-btn green" style="font-size:11px;padding:2px 9px;flex-shrink:0"
                    onclick="sellHouseForRent(${pos})">+₴${val}</button>
            </div>`;
        }).join('');
        sellHTML = `
            <div style="margin-top:14px">
                <div style="font-size:10px;font-weight:700;color:#2e7d32;text-transform:uppercase;
                            letter-spacing:0.8px;margin-bottom:6px">🏠 Продати будинки / готелі</div>
                <div style="max-height:150px;overflow-y:auto;background:#f5f5f5;
                            border-radius:8px;padding:6px">${rows}</div>
            </div>`;
    }

    // 5б. Список застав згрупований по групах монополії
    let mortgageHTML = '';
    if (mortgageable.length > 0) {
        // Групуємо в порядку дошки
        const groups = {};
        BOARD.forEach(cell => {
            if (!mortgageable.includes(cell.pos)) return;
            const key = cell.type === 'property' ? cell.color
                      : cell.type === 'railway'  ? '__railway__'
                      : '__utility__';
            if (!groups[key]) groups[key] = { color: cell.color, type: cell.type, label: '', items: [] };
            groups[key].items.push(cell.pos);
        });

        // Підпис групи
        Object.entries(groups).forEach(([key, g]) => {
            if (g.type === 'property') {
                g.label = BOARD[g.items[0]]?.city || key;
                g.headerColor = g.color;
            } else if (g.type === 'railway') {
                g.label = 'Залізниці';
                g.headerColor = '#4a4a4a';
            } else {
                g.label = 'Порти';
                g.headerColor = '#0277bd';
            }
        });

        const groupsHTML = Object.values(groups).map(g => {
            const rows = g.items.map(pos => {
                const c = BOARD[pos];
                const val = Math.floor(c.price / 2);
                return `<div style="display:flex;justify-content:space-between;align-items:center;
                                    padding:5px 8px;background:white;margin:2px 0;
                                    border-radius:0 5px 5px 0;border-left:4px solid ${g.headerColor}">
                    <span style="font-size:12px;font-weight:600">${c.name}</span>
                    <button class="big-btn orange" style="font-size:11px;padding:2px 9px;flex-shrink:0"
                        onclick="mortgageForRent(${pos})">+₴${val}</button>
                </div>`;
            }).join('');

            return `<div style="margin-bottom:6px">
                <div style="background:${g.headerColor};color:white;font-size:10px;font-weight:700;
                            padding:3px 8px;border-radius:5px 5px 0 0;
                            text-shadow:0 1px 2px rgba(0,0,0,0.3)">
                    ${g.label}
                </div>
                ${rows}
            </div>`;
        }).join('');

        mortgageHTML = `
            <div style="margin-top:14px">
                <div style="font-size:10px;font-weight:700;color:#e07820;text-transform:uppercase;
                            letter-spacing:0.8px;margin-bottom:6px">🏷️ Заставити щоб зібрати суму</div>
                <div style="max-height:200px;overflow-y:auto;background:#f5f5f5;
                            border-radius:8px;padding:6px">${groupsHTML}</div>
            </div>`;
    }

    const buttons = [];
    if (canPay) {
        buttons.push({
            text: `✅ Сплатити ₴${rent}`,
            class: 'btn-success',
            action: () => {
                const { player, rent, owner, cell } = pendingRent;
                pendingRent = null;
                closeModal();
                flashCell(cell.pos, 'rent');
                takeMoney(player, rent);
                addMoney(owner, rent);
                player.stats.rentPaid += rent;
                owner.stats.rentReceived += rent;
                log(`💰 ${player.name} сплатив оренду ₴${rent} → ${owner.name}`, 'warn');
                playSound('rent');
                renderPlayers();
                saveGame();
                showEndTurnBtn();
            }
        });
    }
    if (!canPay) {
        if (mortgageable.length === 0 && hasBuildings) {
            buttons.push({
                text: '🏠 Меню застави',
                class: 'btn-primary',
                action: () => { closeModal(); showMortgageMenu(); }
            });
        }
        buttons.push({
            text: '💀 Оголосити банкрутство',
            class: 'btn-danger',
            action: () => {
                const { player, owner, rent } = pendingRent;
                pendingRent = null;
                declareBankrupt(player, owner, rent);
                closeModal();
            }
        });
    }

    showModal({
        title: '',
        body: banner + ownerBlock + heroRent + balanceBlock + sellHTML + mortgageHTML,
        buttons,
        dismissable: false, // не можна закрити без оплати/застави
    });
}

function sellHouseForRent(pos) {
    sellHouse(pos);
    renderPlayers();
    if (pendingRent) renderRentModal();
    saveGame();
}

function sellHouseForLoan(pos) {
    sellHouse(pos);
    renderPlayers();
    showLoanMenu();
    saveGame();
}

function mortgageForRent(pos) {
    mortgage(pos);
    renderRentModal();
}

// ============================================
// ЧАТ ГРАВЦІВ
// ============================================
function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    // Онлайн-режим: відправляємо через сокет (server роздає всім)
    if (typeof socket !== 'undefined' && socket.connected) {
        const idx = (typeof myPlayerIndex === 'number') ? myPlayerIndex : currentPlayerIndex;
        const p = (players && players[idx]) || { icon: '👤', name: 'Гравець', color: '#888' };
        socket.emit('chatMessage', { text, icon: p.icon, name: p.name, color: p.color });
        input.value = '';
        input.focus();
        return;
    }

    // Локальний режим (fallback)
    const player = players[currentPlayerIndex];
    const container = document.getElementById('chat-messages');
    const msg = document.createElement('div');
    msg.className = 'chat-message';
    msg.style.borderLeftColor = player.color;
    msg.innerHTML = `<span class="chat-author" style="color:${player.color}">${player.icon} ${player.name}:</span>${text}`;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    while (container.children.length > 60) container.removeChild(container.firstChild);
    input.value = '';
    input.focus();
}

// ============================================
// ВІДНОВЛЕННЯ ЗБЕРЕЖЕНОЇ ГРИ
// ============================================
function offerResumeGame() {
    let saveInfo = '';
    try {
        const data = JSON.parse(localStorage.getItem(SAVE_KEY));
        const date = new Date(data.ts).toLocaleString('uk-UA');
        const playerNames = data.players.map(p => p.icon + ' ' + p.name).join(', ');
        saveInfo = `<p style="font-size:13px;color:#666;margin-top:8px"><b>Збережено:</b> ${date}<br><b>Гравці:</b> ${playerNames}</p>`;
    } catch {}
    showModal({
        title: '💾 Знайдено збережену гру',
        body: `<p>Бажаєте продовжити з того місця, де зупинились?</p>${saveInfo}`,
        buttons: [
            { text: 'Продовжити', class: 'btn-success', action: () => {
                if (loadGame()) {
                    showGameScreen();
                    log('💾 Гру відновлено зі збереження', 'success');
                }
                closeModal();
            }},
            { text: 'Нова гра', class: 'btn-secondary', action: () => {
                clearSavedGame();
                closeModal();
            }}
        ]
    });
}

// ============================================
// ОНЛАЙН-ПАТЧ: перехоплення дій через sendAction
// Завантажується після client.js — якщо sendAction є, всі дії йдуть на сервер
// ============================================
function _online(fn, fallback) {
    return typeof sendAction !== 'undefined' ? fn : fallback;
}

// Перевизначення лише якщо client.js вже завантажено
document.addEventListener('DOMContentLoaded', () => {
    if (typeof sendAction === 'undefined') return; // локальний режим

    // Кнопки картки нерухомості
    const _isMyTurn = () => myPlayerIndex === currentPlayerIndex;
    // Після sendAction закриваємо модал і перевідкриємо тільки після stateUpdate (з актуальним станом)
    window.buildHouseFromCard = (pos) => { if (!_isMyTurn()) return; playSound('buy');  sendAction('buildHouse', { pos }); window._pendingCardPos = pos; closeModal(); };
    window.sellHouseFromCard  = (pos) => { if (!_isMyTurn()) return; playSound('coin'); sendAction('sellHouse',  { pos }); window._pendingCardPos = pos; closeModal(); };
    window.mortgageFromCard   = (pos) => { if (!_isMyTurn()) return; playSound('coin'); sendAction('mortgage',   { pos }); window._pendingCardPos = pos; closeModal(); };
    window.redeemFromCard     = (pos) => { if (!_isMyTurn()) return; playSound('buy');  sendAction('redeem',     { pos }); window._pendingCardPos = pos; closeModal(); };

    // Продаж будинків з модалу оренди — stateUpdate перемалює modal через pendingRent
    window.sellHouseForRent = (pos) => { playSound('coin'); sendAction('sellHouse', { pos }); };

    // Продаж будинків з модалу кредиту — після stateUpdate перевідкриваємо меню
    window.sellHouseForLoan = (pos) => {
        playSound('coin');
        sendAction('sellHouse', { pos });
        window._loanMenuOpen = true;
    };

    // Меню кредиту — перехоплюємо кнопку "Взяти"
    window.showLoanMenu = function() {
        window._loanMenuOpen = false;
        const player = players[currentPlayerIndex];
        const totalDebt = player.loan + player.loanInterest;
        let maxLoan = Math.max(50, player.properties.reduce((acc, pos) => {
            return acc + (!cellState[pos].mortgaged ? Math.floor(BOARD[pos].price / 2) : 0);
        }, 0));

        let html, buttons;

        if (totalDebt > 0) {
            const loanSellable = player.properties.filter(pos => (cellState[pos]?.houses || 0) > 0);
            const loanSellHTML = loanSellable.length > 0 ? `
                <div style="margin-top:14px">
                    <div style="font-size:10px;font-weight:700;color:#2e7d32;text-transform:uppercase;
                                letter-spacing:0.8px;margin-bottom:6px">🏠 Продати будинки / готелі</div>
                    <div style="max-height:130px;overflow-y:auto;background:#f5f5f5;border-radius:8px;padding:6px">
                        ${loanSellable.map(pos => {
                            const c = BOARD[pos]; const s = cellState[pos];
                            const val = Math.floor(c.housePrice * 0.9);
                            const label = s.houses === 5 ? '🏨 готель' : `\u{1F3E0}\u{D7}${s.houses}`;
                            return `<div style="display:flex;justify-content:space-between;align-items:center;
                                                padding:5px 8px;background:white;margin:2px 0;
                                                border-radius:0 5px 5px 0;border-left:4px solid ${c.color||'#888'}">
                                <span style="font-size:12px;font-weight:600">${c.name}
                                    <span style="color:#888;font-weight:400">${label}</span></span>
                                <button class="big-btn green" style="font-size:11px;padding:2px 9px;flex-shrink:0"
                                    onclick="sellHouseForLoan(${pos})">+₴${val}</button>
                            </div>`;
                        }).join('')}
                    </div>
                </div>` : '';
            html = `
                <div style="background:#fff4e0;border:2px solid #ff9800;padding:14px;border-radius:10px;margin-bottom:14px">
                    <div style="font-size:12px;color:#e65100;text-transform:uppercase;font-weight:700;margin-bottom:6px">⚠️ Діючий кредит</div>
                    <div style="font-size:22px;font-weight:900;color:#e65100">₴${totalDebt}</div>
                    <div style="font-size:11px;color:#888;margin-top:4px">тіло ₴${player.loan} + відсотки ₴${player.loanInterest} · залишилось ходів: ${player.loanTurnsLeft}</div>
                </div>
                ${loanSellHTML}
                ${loanSellable.length === 0 ? `<div style="font-size:13px;color:#666;text-align:center;padding:8px;background:#f4f7fc;border-radius:8px">Спочатку погасіть діючий кредит, щоб взяти новий.</div>` : ''}`;
            buttons = [
                { text: `✅ Погасити ₴${totalDebt}`, class: 'btn-success',
                  disabled: player.money < totalDebt,
                  action: () => { sendAction('repayLoan'); closeModal(); }},
                { text: 'Скасувати', class: 'btn-secondary', action: () => { window._loanMenuOpen = false; closeModal(); } }
            ];
        } else {
            // Немає кредиту — форма нового
            html = `
                <p style="font-size:13px;color:#666;margin-bottom:14px">Кредит повертається з 10% протягом 10 ходів.</p>
                <div>
                    <label style="font-size:13px;font-weight:700">Сума кредиту (макс ₴${maxLoan}):</label>
                    <input type="number" id="loan-amount" value="${Math.min(500, maxLoan)}" min="50" max="${maxLoan}"
                           style="width:100%;padding:8px;font-size:16px;border:2px solid #0057b7;border-radius:6px;margin-top:6px;box-sizing:border-box">
                </div>`;
            buttons = [
                { text: 'Взяти кредит', class: 'btn-primary', action: () => {
                    const amt = parseInt(document.getElementById('loan-amount').value) || 0;
                    if (amt < 50 || amt > maxLoan) { log('Невалідна сума', 'error'); return; }
                    sendAction('takeLoan', { amount: amt });
                    closeModal();
                }},
                { text: 'Скасувати', class: 'btn-secondary', action: closeModal }
            ];
        }

        showModal({ title: '🏦 Кредит у банку', body: html, buttons });
    };

    // Дедлайн кредиту — сплата через sendAction замість takeMoney
    window.showLoanDeadlineModal = function(player) {
        const debt = player.loan + player.loanInterest;
        const canPay = player.money >= debt;
        const deadline = LOAN_DEADLINES[Math.floor(Math.random() * LOAN_DEADLINES.length)];

        const buttons = [];
        if (canPay) {
            buttons.push({ text: `💸 Сплатити ₴${debt}`, class: 'btn-success',
                action: () => { sendAction('repayLoan'); closeModal(); }});
        } else {
            buttons.push({ text: '🏷️ Заставити поля', class: 'btn-primary',
                action: () => { closeModal(); window.showLoanMenu(); }});
        }
        buttons.push({ text: '💀 Банкрутство', class: 'btn-danger',
            action: () => { sendAction('declareBankrupt'); closeModal(); }});

        showModal({
            title: '',
            body: `
                <div style="margin:-30px -30px 20px;padding:20px 24px 16px;
                            background:linear-gradient(135deg,#b71c1c,#7f0000);
                            border-radius:18px 18px 0 0;text-align:center;color:white">
                    <div style="font-size:48px;margin-bottom:6px">🏦</div>
                    <div style="font-size:19px;font-weight:900">ЧАС ВИЙШОВ!</div>
                </div>
                <div style="background:#ffeae8;border:2px solid #b71c1c;border-radius:12px;
                            padding:13px 16px;font-size:14px;line-height:1.6;text-align:center;margin-bottom:12px">
                    ${deadline}
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;
                            padding:10px 14px;background:#ffeae8;border-radius:8px;margin-bottom:6px">
                    <span style="font-size:13px;color:#555">Борг до сплати:</span>
                    <span style="font-size:22px;font-weight:900;color:#b71c1c">₴${debt}</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;
                            padding:10px 14px;background:${canPay?'#e8f8ec':'#ffeae8'};border-radius:8px">
                    <span style="font-size:13px;color:#555">Ваша готівка:</span>
                    <span style="font-size:18px;font-weight:700;color:${canPay?'#2a9d3f':'#cc1f1f'}">₴${player.money}</span>
                </div>`,
            buttons
        });
    };

    // В'язниця — оплата і картка через sendAction
    window.offerJailOptions = function(player) {
        showModal({
            title: '🔒 У В\'язниці',
            body: `<p>${player.name}, ви у В\'язниці (хід ${player.jailTurns}/3).</p>`,
            buttons: [
                { text: 'Сплатити ₴50', class: 'btn-primary', disabled: player.money < 50,
                  action: () => { sendAction('jailPay'); closeModal(); }},
                ...(player.hasJailCard ? [{ text: 'Використати картку', class: 'btn-success',
                  action: () => { sendAction('jailCard'); closeModal(); }}] : []),
                { text: 'Кинути на дубль', class: 'btn-secondary', action: closeModal }
            ]
        });
    };

    // showEndTurnBtn у онлайн-режимі — стан приходить від сервера
    window.showEndTurnBtn = function() {}; // no-op, applyState вже керує кнопками
});
