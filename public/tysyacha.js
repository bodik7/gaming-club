// ============================================
// ТИСЯЧА — клієнт
// ============================================
let tState = null;
let tMyIdx = null;
let tSelectedCard = null;

const T_MARRIAGE = { '♠': 40, '♣': 60, '♦': 80, '♥': 100 };

// ── Ініціалізація ─────────────────────────────
function initTysyacha(state, myIdx) {
    tState  = state;
    tMyIdx  = myIdx;
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('tysyacha-screen').classList.remove('hidden');
    renderTysyacha();
}

function updateTysyacha(state) {
    tState = state;
    tSelectedCard = null;
    renderTysyacha();
}

// ── Головний рендер ───────────────────────────
function renderTysyacha() {
    if (!tState) return;
    const s = tState;
    renderTScores(s);
    renderTPhaseInfo(s);
    renderTOpponents(s);
    renderTTrick(s);
    renderTHand(s);
    renderTActions(s);
    renderTLog(s);
}

// ── Рахунок (у топбарі) ───────────────────────
function renderTScores(s) {
    const el = document.getElementById('t-scores');
    if (!el) return;
    el.innerHTML = s.players.map(p => {
        const isActive = p.id === s.currentPlayer;
        const isMe     = p.id === tMyIdx;
        const isBidder = p.id === s.auction?.winner && s.phase !== 'auction';
        return `
        <div class="t-score-pill ${isActive ? 'active' : ''} ${isMe ? 'me' : ''}">
            ${isBidder ? '👑 ' : ''}
            <span class="t-score-name">${isMe ? '👤 ' : ''}${p.name}</span>
            <span class="t-score-val">${p.score}</span>
            ${s.phase === 'playing' && p.trickPts ? `<span style="font-size:10px;color:#ff9800">+${p.trickPts}</span>` : ''}
        </div>`;
    }).join('');
}

// ── Фаза / інфо ───────────────────────────────
function renderTPhaseInfo(s) {
    const el = document.getElementById('t-phase-info');
    if (!el) return;
    const phaseMap = { auction: 'Торги', talon: 'Тялон', playing: 'Гра', gameover: 'Завершено' };
    const phase = phaseMap[s.phase] || s.phase;
    const trump = s.trump
        ? `Козир: <b style="color:${tIsRed(s.trump+'9')?'#e57373':'#aed581'}">${s.trump}</b>`
        : 'Козир: немає';
    const bid   = s.declaredBid ? `Ставка: <b style="color:#e8c547">${s.declaredBid}</b>` : '';
    const round = `Раунд ${s.round}`;
    el.innerHTML = [round, phase, trump, bid].filter(Boolean).join('&nbsp;&nbsp;·&nbsp;&nbsp;');
}

// ── Лог ──────────────────────────────────────
function renderTLog(s) {
    const el = document.getElementById('t-log');
    if (!el) return;
    el.innerHTML = (s.log || []).slice(0, 6).map(l =>
        `<div class="t-log-entry">${l}</div>`
    ).join('');
}

// ── Суперники ─────────────────────────────────
function renderTOpponents(s) {
    const el = document.getElementById('t-opponents');
    if (!el) return;
    const others = s.players.filter(p => p.id !== tMyIdx);
    el.innerHTML = others.map(p => {
        const isActive = p.id === s.currentPlayer;
        const isBidder = p.id === s.auction?.winner && s.phase !== 'auction';
        const count = p.handCount || 0;
        // карти з ефектом фану (перекриваються)
        const cards = Array.from({ length: count }, (_, i) =>
            `<div class="t-card-back" style="margin-left:${i > 0 ? '-20px' : '0'};z-index:${i}">🂠</div>`
        ).join('');
        return `
        <div class="t-opponent ${isActive ? 'active' : ''}">
            <div class="t-opp-info">
                ${isBidder ? '👑&nbsp;' : ''}${p.name}
                <span style="opacity:0.55;font-size:10px;font-style:italic">${p.score} оч.</span>
            </div>
            <div class="t-opp-cards">${cards}</div>
        </div>`;
    }).join('');
}

// ── Взятка ────────────────────────────────────
function renderTTrick(s) {
    const el = document.getElementById('t-trick');
    if (!el) return;
    if (!s.trick || s.trick.cards.length === 0) {
        el.innerHTML = '<div class="t-trick-empty">— стіл порожній —</div>';
        return;
    }
    el.innerHTML = s.trick.cards.map(({ playerId, card }) => {
        const rank = card.slice(0, -1);
        const suit = card.slice(-1);
        return `
        <div class="t-trick-slot">
            <div class="t-card-table ${tIsRed(card) ? 'red' : ''}">
                <div class="t-rank">${rank}</div>
                <div class="t-suit">${suit}</div>
            </div>
            <div class="t-trick-label">${s.players[playerId]?.name || ''}</div>
        </div>`;
    }).join('');
}

// ── Моя рука ─────────────────────────────────
function renderTHand(s) {
    const el = document.getElementById('t-hand');
    if (!el) return;
    const me = s.players[tMyIdx];
    if (!me?.hand) { el.innerHTML = ''; return; }

    const sorted = [...me.hand].sort((a, b) => {
        const sd = tSuitOrder(a) - tSuitOrder(b);
        return sd !== 0 ? sd : tRankOrder(a) - tRankOrder(b);
    });

    el.innerHTML = sorted.map(card => {
        const rank = card.slice(0, -1);
        const suit = card.slice(-1);
        const sel      = card === tSelectedCard;
        const canPlay  = s.phase === 'playing' && s.currentPlayer === tMyIdx;
        const hasPartner = tHasMarriagePartner(card, me.hand);
        return `
        <div class="t-card ${tIsRed(card) ? 'red' : ''} ${sel ? 'selected' : ''} ${canPlay ? 'playable' : ''}"
             onclick="tSelectCard('${card}')"
             title="${tCardTitle(card)}">
            <div class="t-card-corner-tl">
                <div class="t-card-rank">${rank}</div>
                <div class="t-card-suit-sm">${suit}</div>
            </div>
            <div class="t-card-center">${suit}</div>
            <div class="t-card-corner-br">
                <div class="t-card-rank">${rank}</div>
                <div class="t-card-suit-sm">${suit}</div>
            </div>
            ${hasPartner && canPlay ? '<div class="t-marriage-badge">💍</div>' : ''}
        </div>`;
    }).join('');
}

// ── Панель дій ───────────────────────────────
function renderTActions(s) {
    const el = document.getElementById('t-actions');
    if (!el) return;
    el.innerHTML = '';
    const isMe = s.currentPlayer === tMyIdx;

    // ── АУКЦІОН ──
    if (s.phase === 'auction') {
        if (!isMe) {
            el.innerHTML = `
                <div class="t-section-title">Торги</div>
                <div class="t-wait">Ставить:<br><b style="color:#e8c547">${s.players[s.currentPlayer]?.name}</b></div>
                <div class="t-auction-cur">${s.auction.current}</div>`;
            return;
        }
        const cur = s.auction.current;
        el.innerHTML = `
            <div class="t-section-title">Ваша ставка</div>
            <div class="t-auction-cur">${cur}</div>
            <div class="t-bid-row">
                ${[10, 20, 50].map(d =>
                    `<button class="t-btn primary" onclick="tBid(${cur + d})">+${d}<br><small>${cur + d}</small></button>`
                ).join('')}
            </div>
            <div class="t-bid-custom">
                <input type="number" id="t-bid-input" min="${cur + 10}" step="10" value="${cur + 10}">
                <button class="t-btn primary" onclick="tBidCustom()">OK</button>
            </div>
            <button class="t-btn danger" onclick="tPass()">✕ Пас</button>`;
        return;
    }

    // ── ТЯЛОН ──
    if (s.phase === 'talon') {
        if (s.auction?.winner !== tMyIdx) {
            el.innerHTML = `
                <div class="t-section-title">Тялон</div>
                <div class="t-wait">Роздає:<br><b style="color:#e8c547">${s.players[s.auction?.winner]?.name}</b></div>`;
            return;
        }
        const opponents   = s.players.filter(p => p.id !== tMyIdx);
        const alreadyGiven = s.givenCards || [];
        el.innerHTML = `
            <div class="t-section-title">Роздайте картки</div>
            <div class="t-talon-ui">
                ${opponents.map(p => {
                    const given = alreadyGiven.includes(p.id);
                    return `<div class="t-give-row">
                        <span>${p.name}:</span>
                        ${given
                            ? '<span class="t-given">✅</span>'
                            : tSelectedCard
                                ? `<button class="t-btn success" onclick="tGiveCard(${p.id})">Дати ${tCardLabel(tSelectedCard)}</button>`
                                : '<span class="t-hint">↓ оберіть карту</span>'}
                    </div>`;
                }).join('')}
                <div class="t-talon-hint">Тялон у вашій руці. Оберіть → кому дати.</div>
            </div>`;
        return;
    }

    // ── ГРА ──
    if (s.phase === 'playing') {
        if (!isMe) {
            el.innerHTML = `
                <div class="t-section-title">Хід</div>
                <div class="t-wait">Ходить:<br><b style="color:#e8c547">${s.players[s.currentPlayer]?.name}</b></div>`;
            return;
        }
        const me = s.players[tMyIdx];
        const hasMarriage = tSelectedCard && tHasMarriagePartner(tSelectedCard, me.hand);
        const marriageSuit = tSelectedCard ? tSelectedCard.slice(-1) : null;
        el.innerHTML = `
            <div class="t-section-title">Ваш хід</div>
            <div class="t-play-ui" style="display:flex;flex-direction:column;gap:8px">
                ${tSelectedCard
                    ? `<div class="t-selected-info">Обрано:<br><b style="font-size:18px">${tCardLabel(tSelectedCard)}</b></div>
                       <button class="t-btn success" onclick="tPlayCard(false)">▶ Зіграти</button>
                       ${hasMarriage && s.trick.cards.length === 0
                           ? `<button class="t-btn gold" onclick="tPlayCard(true)">💍 +${T_MARRIAGE[marriageSuit]} шлюб</button>`
                           : ''}
                       <button class="t-btn secondary" onclick="tSelectedCard=null;renderTHand(tState);renderTActions(tState)">✕ Скасувати</button>`
                    : '<div class="t-hint">↓ оберіть картку в руці</div>'}
            </div>`;
        return;
    }

    // ── КІНЕЦЬ ──
    if (s.phase === 'gameover') {
        const w = s.winner !== undefined ? s.players[s.winner] : null;
        el.innerHTML = `
            <div class="t-gameover">
                <div class="t-gameover-title">🏆 ${w?.name || '???'}<br>переможець!</div>
                <div class="t-scores-final">
                    ${s.players.map(p => `${p.name}: <b>${p.score}</b>`).join('<br>')}
                </div>
                <button class="t-btn primary" onclick="location.reload()">Нова гра</button>
            </div>`;
    }
}

// ── Дії гравця ───────────────────────────────
function tSelectCard(card) {
    tSelectedCard = tSelectedCard === card ? null : card;
    renderTHand(tState);
    renderTActions(tState);
}

function tBid(amount) {
    socket.emit('action', { type: 'tBid', data: { amount } });
}
function tPass() {
    socket.emit('action', { type: 'tBid', data: { pass: true } });
}
function tBidCustom() {
    const val = parseInt(document.getElementById('t-bid-input')?.value) || 0;
    socket.emit('action', { type: 'tBid', data: { amount: val } });
}
function tGiveCard(toPlayer) {
    if (!tSelectedCard) return;
    socket.emit('action', { type: 'tGiveCard', data: { card: tSelectedCard, toPlayer } });
    tSelectedCard = null;
}
function tPlayCard(marriage) {
    if (!tSelectedCard) return;
    socket.emit('action', { type: 'tPlayCard', data: { card: tSelectedCard, marriage } });
    tSelectedCard = null;
}

// ── Хелпери карт ─────────────────────────────
function tIsRed(card)  { return card.endsWith('♦') || card.endsWith('♥'); }

function tCardLabel(card) {
    // коротке текстове позначення для кнопок/логу
    return card;
}

function tCardTitle(card) {
    const pts = { '9': 0, 'J': 2, 'Q': 3, 'K': 4, '10': 10, 'A': 11 };
    return `${card} = ${pts[card.slice(0, -1)] ?? 0} очок`;
}

function tHasMarriagePartner(card, hand) {
    const rank = card.slice(0, -1);
    const suit = card.slice(-1);
    if (rank !== 'Q' && rank !== 'K') return false;
    const partner = rank === 'Q' ? `K${suit}` : `Q${suit}`;
    return hand.includes(partner);
}

function tSuitOrder(card) { return ['♠', '♣', '♦', '♥'].indexOf(card.slice(-1)); }
function tRankOrder(card) { return ['9', 'J', 'Q', 'K', '10', 'A'].indexOf(card.slice(0, -1)); }
