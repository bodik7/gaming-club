// ============================================
// ТИСЯЧА — клієнт
// ============================================
let tState = null;
let tMyIdx = null;
let tSelectedCard = null;
let tMarriageMode = false;

const T_SUIT_COLOR = { '♠':'#1a1a2e','♣':'#1b4332','♦':'#7f1d1d','♥':'#7f1d1d' };
const T_SUIT_LABEL = { '♠':'Піки (40)','♣':'Трефи (60)','♦':'Бубни (80)','♥':'Червоний (100)' };

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
    tMarriageMode = false;
    renderTysyacha();
}

// ── Головний рендер ───────────────────────────
function renderTysyacha() {
    if (!tState) return;
    const s = tState;
    renderTScores(s);
    renderTLog(s);
    renderTTrick(s);
    renderTOpponents(s);
    renderTHand(s);
    renderTActions(s);
    renderTPhaseInfo(s);
}

// ── Рахунок ───────────────────────────────────
function renderTScores(s) {
    const el = document.getElementById('t-scores');
    if (!el) return;
    el.innerHTML = s.players.map(p => `
        <div class="t-score-card ${p.id === s.currentPlayer ? 'active' : ''} ${p.id === tMyIdx ? 'me' : ''}">
            <div class="t-score-name">${p.id === tMyIdx ? '👤 ' : ''}${p.name}</div>
            <div class="t-score-val">${p.score}</div>
            ${s.phase === 'playing' ? `<div class="t-score-trick">+${p.trickPts||0}</div>` : ''}
        </div>
    `).join('');
}

// ── Лог ──────────────────────────────────────
function renderTLog(s) {
    const el = document.getElementById('t-log');
    if (!el) return;
    el.innerHTML = (s.log || []).map(l => `<div class="t-log-entry">${l}</div>`).join('');
}

// ── Взятка (поточні карти на столі) ──────────
function renderTTrick(s) {
    const el = document.getElementById('t-trick');
    if (!el) return;
    if (!s.trick || s.trick.cards.length === 0) {
        el.innerHTML = '<div class="t-trick-empty">Стіл порожній</div>';
        return;
    }
    el.innerHTML = s.trick.cards.map(({ playerId, card }) => `
        <div class="t-trick-slot">
            <div class="t-card-sm ${tIsRed(card) ? 'red' : ''}">${tCardLabel(card)}</div>
            <div class="t-trick-player">${s.players[playerId]?.name}</div>
        </div>
    `).join('');
}

// ── Карти суперників (сорочкою) ───────────────
function renderTOpponents(s) {
    const el = document.getElementById('t-opponents');
    if (!el) return;
    const others = s.players.filter(p => p.id !== tMyIdx);
    el.innerHTML = others.map(p => `
        <div class="t-opponent ${p.id === s.currentPlayer ? 'active' : ''}">
            <div class="t-opp-name">${p.name} ${p.id === s.auction?.winner && s.phase !== 'auction' ? '👑' : ''}</div>
            <div class="t-opp-cards">
                ${Array(p.handCount||0).fill('<div class="t-card-back">🂠</div>').join('')}
            </div>
            <div class="t-opp-score">${p.score} очок</div>
        </div>
    `).join('');
}

// ── Моя рука ─────────────────────────────────
function renderTHand(s) {
    const el = document.getElementById('t-hand');
    if (!el) return;
    const me = s.players[tMyIdx];
    if (!me?.hand) { el.innerHTML = ''; return; }

    // Сортуємо: по масті, потім по значенню
    const sorted = [...me.hand].sort((a,b) => {
        const sd = tSuitOrder(a) - tSuitOrder(b);
        return sd !== 0 ? sd : tRankOrder(a) - tRankOrder(b);
    });

    el.innerHTML = sorted.map(card => {
        const sel = card === tSelectedCard;
        const canPlay = s.phase === 'playing' && s.currentPlayer === tMyIdx;
        const hasPartner = tHasMarriagePartner(card, me.hand);
        return `
        <div class="t-card ${tIsRed(card)?'red':''} ${sel?'selected':''} ${canPlay?'playable':''}"
             onclick="tSelectCard('${card}')"
             title="${tCardTitle(card)}">
            ${tCardLabel(card)}
            ${hasPartner && canPlay ? '<div class="t-marriage-badge">💍</div>' : ''}
        </div>`;
    }).join('');
}

// ── Інформація про фазу ───────────────────────
function renderTPhaseInfo(s) {
    const el = document.getElementById('t-phase-info');
    if (!el) return;
    const trump = s.trump ? `Козир: ${s.trump}` : 'Козир: немає';
    const bid = s.declaredBid ? `Гравець на: ${s.declaredBid}` : '';
    const round = `Раунд ${s.round}`;
    el.textContent = [round, trump, bid].filter(Boolean).join(' · ');
}

// ── Кнопки дій ───────────────────────────────
function renderTActions(s) {
    const el = document.getElementById('t-actions');
    if (!el) return;
    el.innerHTML = '';
    const isMe = s.currentPlayer === tMyIdx;

    if (s.phase === 'auction') {
        if (!isMe) {
            el.innerHTML = `<div class="t-wait">Черга: ${s.players[s.currentPlayer]?.name}. Торги: ${s.auction.current}</div>`;
            return;
        }
        const cur = s.auction.current;
        el.innerHTML = `
            <div class="t-auction-ui">
                <div class="t-auction-cur">Поточна ставка: <b>${cur}</b></div>
                <div class="t-bid-row">
                    ${[10,20,50].map(d => `<button class="t-btn primary" onclick="tBid(${cur+d})">${cur+d}</button>`).join('')}
                    <button class="t-btn danger" onclick="tPass()">Пас</button>
                </div>
                <div class="t-bid-custom">
                    <input type="number" id="t-bid-input" min="${cur+10}" step="10" value="${cur+10}" placeholder="Довільна ставка">
                    <button class="t-btn primary" onclick="tBidCustom()">Поставити</button>
                </div>
            </div>`;
    }

    else if (s.phase === 'talon') {
        if (s.auction?.winner !== tMyIdx) {
            el.innerHTML = `<div class="t-wait">Очікуємо: ${s.players[s.auction?.winner]?.name} роздає карти</div>`;
            return;
        }
        const opponents = s.players.filter(p => p.id !== tMyIdx);
        const alreadyGiven = (s.givenCards || []);
        el.innerHTML = `
            <div class="t-talon-ui">
                <div class="t-talon-title">Роздайте по 1 картці кожному гравцю</div>
                ${opponents.map(p => {
                    const given = alreadyGiven.filter(g => g === p.id).length;
                    return `<div class="t-give-row">
                        <span>${p.name}:</span>
                        ${given ? '<span class="t-given">✅ отримав(ла)</span>' :
                         tSelectedCard
                            ? `<button class="t-btn success" onclick="tGiveCard(${p.id})">Дати: ${tCardLabel(tSelectedCard)}</button>`
                            : '<span class="t-hint">Оберіть картку знизу</span>'}
                    </div>`;
                }).join('')}
                <div class="t-talon-hint">Тялон додано до вашої руки. Оберіть карту → вкажіть кому дати.</div>
            </div>`;
    }

    else if (s.phase === 'playing') {
        if (!isMe) {
            el.innerHTML = `<div class="t-wait">Хід: ${s.players[s.currentPlayer]?.name}</div>`;
            return;
        }
        const me = s.players[tMyIdx];
        const hasMarriage = tSelectedCard && tHasMarriagePartner(tSelectedCard, me.hand);
        el.innerHTML = `
            <div class="t-play-ui">
                ${tSelectedCard
                    ? `<div class="t-selected-info">Обрано: <b>${tCardLabel(tSelectedCard)}</b></div>
                       <div class="t-play-btns">
                           <button class="t-btn primary" onclick="tPlayCard(false)">▶ Зіграти</button>
                           ${hasMarriage && s.trick.cards.length === 0
                               ? `<button class="t-btn gold" onclick="tPlayCard(true)">💍 Зіграти з шлюбом (+${T_MARRIAGE[tSelectedCard.slice(-1)]})</button>`
                               : ''}
                           <button class="t-btn secondary" onclick="tSelectedCard=null;renderTHand(tState)">✕ Скасувати</button>
                       </div>`
                    : '<div class="t-hint">Оберіть картку в руці</div>'}
            </div>`;
    }

    else if (s.phase === 'gameover') {
        const w = s.players[s.winner];
        el.innerHTML = `
            <div class="t-gameover">
                <div class="t-gameover-title">🏆 ${w?.name} — переможець!</div>
                <div class="t-scores-final">${s.players.map(p=>`${p.name}: ${p.score}`).join(' · ')}</div>
                <button class="t-btn primary" onclick="location.reload()">Нова гра</button>
            </div>`;
    }
}

// ── Дії гравця ───────────────────────────────
function tSelectCard(card) {
    if (tSelectedCard === card) { tSelectedCard = null; }
    else { tSelectedCard = card; }
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
function tIsRed(card) { return card.endsWith('♦') || card.endsWith('♥'); }
function tCardLabel(card) {
    const rank = card.slice(0, -1);
    const suit = card.slice(-1);
    return `<span class="t-rank">${rank}</span><span class="t-suit">${suit}</span>`;
}
function tCardTitle(card) {
    const pts = {'9':0,'J':2,'Q':3,'K':4,'10':10,'A':11};
    return `${card} = ${pts[card.slice(0,-1)]} очок`;
}
function tHasMarriagePartner(card, hand) {
    const rank = card.slice(0,-1);
    const suit = card.slice(-1);
    if (rank !== 'Q' && rank !== 'K') return false;
    const partner = rank === 'Q' ? `K${suit}` : `Q${suit}`;
    return hand.includes(partner);
}
function tSuitOrder(card) { return ['♠','♣','♦','♥'].indexOf(card.slice(-1)); }
function tRankOrder(card) { return ['9','J','Q','K','10','A'].indexOf(card.slice(0,-1)); }
