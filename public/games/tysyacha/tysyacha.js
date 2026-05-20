// ============================================
// ТИСЯЧА — клієнт
// ============================================
let tState        = null;
let tMyIdx        = null;
let tSelectedCard = null;
let tLastTrump    = null;
let tDealing      = false;
let tTrickShowing = false;
let tPendingTrick = null;
let tTurnTimer    = null;
let tTurnStart    = 0;
let tPrevCurrentPlayer = null;

const T_MARRIAGE    = { '♠': 40, '♣': 60, '♦': 80, '♥': 100 };
const T_SUIT_COLORS = { '♠': '#0d47a1', '♣': '#1b5e20', '♦': '#e65100', '♥': '#b71c1c' };

function tSuitColor(card) { return T_SUIT_COLORS[card.slice(-1)] || '#1a1a1a'; }
function tCardPts(card) {
    return ({ '9':0, 'J':2, 'Q':3, 'K':4, '10':10, 'A':11 })[card.slice(0,-1)] ?? 0;
}

// ── Таймер ходу ───────────────────────────────
function tStartTurnClock() {
    clearInterval(tTurnTimer);
    tTurnStart = Date.now();
    tTurnTimer = setInterval(() => {
        const el = document.getElementById('t-turn-elapsed');
        if (el) el.textContent = Math.floor((Date.now() - tTurnStart) / 1000) + 'с';
    }, 1000);
}

// ── Ініціалізація ─────────────────────────────
function initTysyacha(state, myIdx) {
    tState             = state;
    tMyIdx             = myIdx;
    tLastTrump         = state.trump;
    tDealing           = true;
    tTrickShowing      = false;
    tPendingTrick      = null;
    tPrevCurrentPlayer = state.currentPlayer;
    tStartTurnClock();
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('tysyacha-screen').classList.remove('hidden');
    setQuitBtn(true);
    if (typeof switchViewport === 'function') switchViewport('tysyacha');
    tCheckOrientation();
    renderTysyacha();
    setTimeout(() => { tDealing = false; }, 800);
}

function tCheckOrientation() {
    const hint = document.getElementById('t-portrait-hint');
    if (!hint) return;
    // Показуємо тільки на мобільних пристроях у портретному режимі
    const isMobile  = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isPortrait = window.innerHeight > window.innerWidth;
    hint.classList.toggle('hidden', !(isMobile && isPortrait));
}

// Слухаємо зміну орієнтації
window.addEventListener('orientationchange', () => setTimeout(tCheckOrientation, 150));
window.addEventListener('resize', tCheckOrientation);

function updateTysyacha(state, sideEffect) {
    if (sideEffect?.event === 'trickComplete') {
        playSound('trickTaken');
        const isWinner = sideEffect.winnerId === tMyIdx;
        tTrickShowing = true;
        tPendingTrick = { winnerId: sideEffect.winnerId, nextState: state };
        tState = { ...state, trick: { cards: sideEffect.cards, winnerId: sideEffect.winnerId } };
        tSelectedCard = null;
        renderTysyacha();
        setTimeout(() => {
            document.querySelectorAll('.t-card-table').forEach(el => el.classList.add('trick-taken'));
        }, 900);
        if (!isWinner) {
            // Не переможець: авто-прибирання через 3с
            setTimeout(() => { if (tTrickShowing) tTakeTrick(); }, 3000);
        } else {
            // Переможець: чекаємо кнопку, fallback 10с
            setTimeout(() => { if (tTrickShowing) tTakeTrick(); }, 10000);
        }
        return;
    }
    if (sideEffect?.event === 'roundResult') {
        tTrickShowing = false;
        tPendingTrick = null;
        tLastTrump = null;
        tState = state;
        tDealing = true;
        tShowRoundResult(sideEffect.results, () => {
            renderTysyacha();
            setTimeout(() => { tDealing = false; }, 800);
        });
        return;
    }

    // Будь-який інший stateUpdate знімає блокування взятки
    tTrickShowing = false;
    tPendingTrick = null;
    const prevTrump = tLastTrump;
    tLastTrump = state.trump;

    // Таймер — перезапускаємо при зміні ходу
    if (state.currentPlayer !== tPrevCurrentPlayer) {
        tPrevCurrentPlayer = state.currentPlayer;
        tStartTurnClock();
        // Спалах "Ваш хід" + звук
        if (state.currentPlayer === tMyIdx && state.phase === 'playing') {
            playSound('myTurn');
            const hand = document.getElementById('t-hand');
            if (hand) {
                hand.classList.remove('t-my-turn-flash');
                void hand.offsetWidth;
                hand.classList.add('t-my-turn-flash');
                setTimeout(() => hand.classList.remove('t-my-turn-flash'), 900);
            }
        }
    }

    tState = state;
    tSelectedCard = null;
    renderTysyacha();

    // Шлюб: козир щойно з'явився під час гри
    if (state.phase === 'playing' && state.trump && state.trump !== prevTrump) {
        playSound('marriage');
        tShowMarriageBanner(state.trump);
    }
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
        const scoreCls = p.onBarrel ? 'barrel' : p.score >= 900 ? 'critical' : p.score >= 700 ? 'danger' : '';
        const pct      = Math.min(100, Math.max(0, Math.round(p.score / 10)));
        const inGame   = s.phase === 'playing' && p.trickPts;
        return `
        <div class="t-score-pill ${isActive ? 'active' : ''} ${isMe ? 'me' : ''} ${scoreCls}">
            <div class="t-score-top">
                ${p.onBarrel ? `<span class="t-barrel-icon" title="Бочка ${p.barrelAttempts}/3">🛢️</span>` : ''}
                ${isBidder ? '👑&nbsp;' : ''}
                <span class="t-score-name">${isMe ? '👤&nbsp;' : ''}${p.name}</span>
                <span class="t-score-val">${p.score}${inGame ? `<span style="font-size:9px;color:#ff9800;margin-left:2px">+${p.trickPts}</span>` : ''}</span>
                ${isActive ? `<span id="t-turn-elapsed" style="font-size:9px;color:rgba(245,230,200,0.35);font-family:sans-serif;margin-left:2px"></span>` : ''}
            </div>
            <div class="t-score-bar-track">
                <div class="t-score-bar-fill" style="width:${pct}%"></div>
            </div>
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
function tLogType(entry) {
    if (entry.includes('✅') || entry.includes('🏆')) return 'success';
    if (entry.includes('❌') || entry.includes('−'))  return 'error';
    if (entry.includes('💍') || entry.includes('📢') || entry.includes('👑')) return 'gold';
    if (entry.includes('🃏') || entry.includes('бере'))  return 'info';
    if (entry.includes('⚠️'))  return 'warn';
    return '';
}

function renderTLog(s) {
    const el = document.getElementById('t-log');
    if (!el) return;
    const entries = (s.log || []).slice(0, 20);
    if (!entries.length) {
        el.innerHTML = '<div class="t-log-empty">Лог порожній</div>';
        return;
    }
    el.innerHTML = entries.map(l =>
        `<div class="t-log-entry ${tLogType(l)}">${l}</div>`
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
            `<div class="t-card-back" style="margin-left:${i > 0 ? '-20px' : '0'};z-index:${i}"></div>`
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

// ── Прикуп (стопка карт сорочкою) ────────────
function talonPileHTML(count) {
    const cards = Array.from({ length: count }, (_, i) =>
        `<div class="t-card-back" style="position:absolute;top:${i*8}px;left:${i*5}px;z-index:${i}"></div>`
    ).join('');
    return `<div style="position:relative;width:${46+(count-1)*5}px;height:${66+(count-1)*8}px">${cards}</div>`;
}

// ── Взятка ────────────────────────────────────
function renderTTrick(s) {
    const el = document.getElementById('t-trick');
    if (!el) return;

    // Під час торгів — показуємо прикуп сорочкою
    if (s.phase === 'auction' && s.talonCount) {
        const n = s.players.length;
        const pilesHTML = n === 2
            ? `<div style="display:flex;gap:28px;align-items:flex-end">
                   ${talonPileHTML(2)}${talonPileHTML(2)}
               </div>`
            : talonPileHTML(3);
        el.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;gap:10px">
                <div style="font-size:10px;color:rgba(245,230,200,0.35);letter-spacing:2px;font-family:sans-serif">ПРИКУП</div>
                ${pilesHTML}
                <div style="font-size:10px;color:rgba(245,230,200,0.35);font-style:italic;font-family:sans-serif">
                    ${n === 2 ? '2 × 2 карти' : '3 карти'}
                </div>
            </div>`;
        return;
    }

    // Вибір стопки (2-player, таlon phase)
    if (s.phase === 'talon' && s.talonPiles) {
        const isWinner = s.auction?.winner === tMyIdx;
        el.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;gap:10px">
                <div style="font-size:10px;color:rgba(245,230,200,0.35);letter-spacing:2px;font-family:sans-serif">ОБЕРІТЬ ПРИКУП</div>
                <div style="display:flex;gap:28px;align-items:flex-end">
                    ${[0,1].map(i => `
                        <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
                            ${talonPileHTML(s.talonPiles[i])}
                            ${isWinner
                                ? `<button class="t-btn gold" style="font-size:12px;padding:5px 10px" onclick="tChoosePile(${i})">Взяти</button>`
                                : `<div style="font-size:10px;color:rgba(245,230,200,0.3);font-style:italic">2 карти</div>`}
                        </div>`
                    ).join('')}
                </div>
            </div>`;
        return;
    }

    // Козир всередині столу
    const trumpBadge = s.trump
        ? `<div class="t-trump-badge">
               <div class="t-trump-suit-big" style="color:${tSuitColor('A'+s.trump)}">${s.trump}</div>
               <div class="t-trump-label">козир</div>
           </div>`
        : '';

    // Нерозкрита стопка (2-гравці) — дискретний бейдж у верхньому куті
    const leftoverIndicator = s.leftoverPileCount > 0 && s.phase === 'playing'
        ? `<div style="position:absolute;top:8px;right:14px;
                       background:rgba(0,0,0,0.5);border:1px solid rgba(245,230,200,0.12);
                       border-radius:6px;padding:3px 8px;pointer-events:none">
               <span style="font-size:9px;color:rgba(245,230,200,0.35);font-family:sans-serif;letter-spacing:.5px">🂠 прикуп</span>
           </div>`
        : '';

    if (!s.trick || s.trick.cards.length === 0) {
        el.innerHTML = `${trumpBadge}<div class="t-table-watermark">♠♥♦♣</div>${leftoverIndicator}`;
        return;
    }
    const winnerId = s.trick.winnerId;
    el.innerHTML = trumpBadge + leftoverIndicator + s.trick.cards.map(({ playerId, card }) => {
        const rank = card.slice(0, -1);
        const suit = card.slice(-1);
        const color = tSuitColor(card);
        const isWinner = winnerId !== undefined && playerId === winnerId;
        const winnerStyle = isWinner ? 'box-shadow:0 0 0 3px #c9a227,0 4px 14px rgba(0,0,0,0.65)' : '';
        return `
        <div class="t-trick-slot">
            <div class="t-card-table"
                 style="border-top-color:${color};color:${color};${winnerStyle}">
                <div class="t-rank">${rank}</div>
                <div class="t-suit">${suit}</div>
            </div>
            <div class="t-trick-label" style="${isWinner ? 'color:#e8c547;font-weight:700' : ''}">
                ${isWinner ? '🏆 ' : ''}${s.players[playerId]?.name || ''}
            </div>
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

    // Визначаємо обмеження масті (тільки коли мій хід і взятка в процесі, не завершена)
    const inTalon  = s.phase === 'talon' && s.auction?.winner === tMyIdx && !s.talonPiles;
    const myTurn   = s.phase === 'playing' && s.currentPlayer === tMyIdx && !tTrickShowing;
    const trickStarted = myTurn && (s.trick?.cards?.length ?? 0) > 0;
    const leadSuit = trickStarted ? s.trick.cards[0].card.slice(-1) : null;
    const mustFollowSuit = leadSuit != null && me.hand.some(c => c.slice(-1) === leadSuit);

    el.innerHTML = sorted.map(card => {
        const rank = card.slice(0, -1);
        const suit = card.slice(-1);
        const color = tSuitColor(card);
        const sel   = card === tSelectedCard;

        // Чи може ця карта бути зіграна прямо зараз
        const isLeadSuit    = leadSuit != null && suit === leadSuit;
        const canPlayThisCard = myTurn && (!mustFollowSuit || isLeadSuit);

        // CSS класи
        const classes = [
            't-card',
            sel                    ? 'selected'   : '',
            (canPlayThisCard || inTalon) ? 'playable'   : '',
            myTurn && isLeadSuit && mustFollowSuit ? 'lead-suit' : '',
            myTurn && mustFollowSuit && !isLeadSuit ? 'cant-play' : '',
            tDealing        ? 'dealing'    : '',
        ].filter(Boolean).join(' ');

        // Значок шлюбу — лише коли веду (немає карт у взятці)
        const canMarry = myTurn && !trickStarted && tHasMarriagePartner(card, me.hand);

        const cardIdx = sorted.indexOf(card);
        const dealDelay = tDealing ? `animation-delay:${cardIdx * 60}ms` : '';
        const pts = tCardPts(card);
        return `
        <div class="${classes}"
             style="border-top-color:${color};${dealDelay}"
             onclick="tSelectCard('${card}')"
             title="${tCardTitle(card)}">
            <div class="t-card-corner-tl" style="color:${color}">
                <div class="t-card-rank">${rank}</div>
                <div class="t-card-suit-sm">${suit}</div>
            </div>
            <div class="t-card-center" style="color:${color}">${suit}</div>
            <div class="t-card-corner-br" style="color:${color}">
                <div class="t-card-rank">${rank}</div>
                <div class="t-card-suit-sm">${suit}</div>
            </div>
            ${pts > 0 ? `<div class="t-card-pts">${pts}</div>` : ''}
            ${canMarry ? '<div class="t-marriage-badge">💍</div>' : ''}
        </div>`;
    }).join('');
}

// ── Панель дій ───────────────────────────────
function renderTActions(s) {
    const el = document.getElementById('t-actions');
    if (!el) return;
    el.innerHTML = '';
    const ab = document.getElementById('t-action-bar');
    if (ab) ab.innerHTML = '';

    // ── ВЗЯТКА: дії розподіляємо між правою панеллю і action bar ──
    if (tPendingTrick) {
        const isWinner = tPendingTrick.winnerId === tMyIdx;
        const winnerName = tState?.players[tPendingTrick.winnerId]?.name || '';
        el.innerHTML = isWinner
            ? `<div class="t-section-title">Ваша взятка!</div>`
            : `<div class="t-section-title">Взятка</div>
               <div class="t-wait">Бере:<br><b style="color:#e8c547">${winnerName}</b></div>`;
        if (ab && isWinner) ab.innerHTML =
            `<button class="t-btn gold t-bar-btn" onclick="tTakeTrick()">🃏 Забрати взятку</button>`;
        return;
    }

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
        const meInAuction = s.players[tMyIdx];
        const onBarrel = meInAuction?.onBarrel;
        el.innerHTML = `
            <div class="t-section-title">Ваша ставка</div>
            ${onBarrel ? `<div class="t-barrel-notice">🛢️ Бочка — не можна пасувати<br><small>Спроба ${meInAuction.barrelAttempts}/3</small></div>` : ''}
            <div class="t-auction-cur">${cur}</div>
            <div class="t-bid-row">
                ${!onBarrel ? `<button class="t-btn danger" onclick="tPass()" title="Пас" style="flex:0 0 auto;padding:7px 10px">✕</button>` : ''}
                ${[10, 20, 50].map(d =>
                    `<button class="t-btn primary" onclick="tBid(${cur + d})">+${d}<br><small>${cur + d}</small></button>`
                ).join('')}
            </div>
            <div class="t-bid-custom">
                <input type="number" id="t-bid-input" min="${cur + 10}" step="10" value="${cur + 10}">
                <button class="t-btn primary" onclick="tBidCustom()">OK</button>
            </div>`;
        return;
    }

    // ── ТЯЛОН ──
    if (s.phase === 'talon') {
        if (s.auction?.winner !== tMyIdx) {
            const winnerName = s.players[s.auction?.winner]?.name;
            el.innerHTML = s.talonPiles
                ? `<div class="t-section-title">Вибір прикупу</div>
                   <div class="t-wait"><b style="color:#e8c547">${winnerName}</b><br>обирає стопку</div>`
                : `<div class="t-section-title">Тялон</div>
                   <div class="t-wait">Роздає:<br><b style="color:#e8c547">${winnerName}</b></div>`;
            return;
        }
        // Якщо ще не вибрав стопку (2-player)
        if (s.talonPiles) {
            el.innerHTML = `
                <div class="t-section-title">Оберіть прикуп</div>
                <div class="t-hint" style="margin:8px 0">Натисніть «Взяти»<br>на одній зі стопок</div>
                <div style="font-size:10px;color:rgba(245,230,200,0.3);font-style:italic;font-family:sans-serif;text-align:center">
                    Друга стопка залишиться на столі
                </div>`;
            return;
        }
        const opponents    = s.players.filter(p => p.id !== tMyIdx);
        const alreadyGiven = s.givenCards || [];
        const minBid       = s.auction.current;
        const curBid       = s.declaredBid || minBid;
        el.innerHTML = `
            <div class="t-section-title">Ваша ставка</div>
            <div class="t-auction-cur" style="font-size:28px">${curBid}</div>
            <div style="font-size:10px;color:rgba(245,230,200,0.4);text-align:center;font-family:sans-serif;margin:-4px 0 6px">
                мін. ${minBid}
            </div>
            <div class="t-bid-row" style="margin-bottom:4px">
                ${[10,20,50].map(d =>
                    `<button class="t-btn primary" onclick="tSetBidAmount(${curBid+d})">+${d}</button>`
                ).join('')}
            </div>
            <div class="t-bid-custom" style="margin-bottom:10px">
                <input type="number" id="t-set-bid-input" min="${minBid}" step="10" value="${curBid}">
                <button class="t-btn gold" onclick="tSetBidCustom()">OK</button>
            </div>

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
            tSelectedCard = null; // скидаємо виділення якщо хід перейшов до іншого
            el.innerHTML = `
                <div class="t-section-title">Хід</div>
                <div class="t-wait">Ходить:<br><b style="color:#e8c547">${s.players[s.currentPlayer]?.name}</b></div>`;
            return;
        }
        const me = s.players[tMyIdx];
        const hasMarriage = tSelectedCard && tHasMarriagePartner(tSelectedCard, me.hand);
        const marriageSuit = tSelectedCard ? tSelectedCard.slice(-1) : null;
        // Права панель: лише статус
        el.innerHTML = `<div class="t-section-title">Ваш хід</div>
            ${!tSelectedCard ? '<div class="t-hint" style="margin-top:8px">👆 оберіть картку</div>' : ''}`;
        // Кнопки дій — у action bar над рукою
        if (ab) ab.innerHTML = tSelectedCard
            ? `<button class="t-btn success t-bar-btn" onclick="tPlayCard(false)">▶ Зіграти&nbsp;${tCardLabel(tSelectedCard)}</button>
               ${hasMarriage && s.trick.cards.length === 0
                   ? `<button class="t-btn gold t-bar-btn" onclick="tPlayCard(true)">💍&nbsp;+${T_MARRIAGE[marriageSuit]}&nbsp;шлюб</button>`
                   : ''}
               <button class="t-btn secondary t-bar-btn" style="padding:10px 14px!important" onclick="tSelectedCard=null;renderTHand(tState);renderTActions(tState)">✕</button>`
            : '';
        return;
    }

    // ── КІНЕЦЬ ──
    if (s.phase === 'gameover') {
        const w = s.winner !== undefined ? s.players[s.winner] : null;
        const iWon = w?.id === tMyIdx;
        // Звук і статистика (тільки один раз)
        if (!el.dataset.gameoverProcessed) {
            el.dataset.gameoverProcessed = '1';
            playSound(iWon ? 'win' : 'lose');
            updateStats('tysyacha', iWon);
        }
        const st = getStats('tysyacha');
        const isHost = tMyIdx === 0;
        el.innerHTML = `
            <div class="t-gameover">
                <div class="t-gameover-title">🏆 ${w?.name || '???'}<br>переможець!</div>
                <div class="t-scores-final">
                    ${s.players.map(p => `${p.name}: <b>${p.score}</b>`).join('<br>')}
                </div>
                ${st.g > 0 ? `<div style="font-size:10px;color:rgba(245,230,200,0.35);font-family:sans-serif;margin:4px 0 8px">Ваша статистика: ${st.w}/${st.g} перемог</div>` : ''}
                ${isHost ? `<button class="t-btn gold" onclick="tRequestRematch()" style="margin-bottom:6px">🔄 Реванш</button>` : '<div class="t-hint" style="margin-bottom:6px">Чекаємо реваншу від хоста...</div>'}
                <button class="t-btn secondary" onclick="location.reload()">🏠 Нова гра</button>
            </div>`;
    }
}

function tRequestRematch() { socket.emit('restartGame'); }

// ── Дії гравця ───────────────────────────────
function tSelectCard(card) {
    const s = tState;
    if (!s) return;
    if (s.phase === 'talon' && s.auction?.winner === tMyIdx && !s.talonPiles) {
        tSelectedCard = tSelectedCard === card ? null : card;
        renderTHand(tState);
        renderTActions(tState);
        return;
    }
    if (s.phase !== 'playing' || s.currentPlayer !== tMyIdx) return;
    if (tTrickShowing) return;
    if ((s.trick?.cards?.length ?? 0) > 0) {
        const leadSuit   = s.trick.cards[0].card.slice(-1);
        const me         = s.players[tMyIdx];
        const mustFollow = me?.hand?.some(c => c.slice(-1) === leadSuit);
        if (mustFollow && card.slice(-1) !== leadSuit) {
            // Підказка: потрібно йти в масть
            const ab = document.getElementById('t-action-bar');
            if (ab) {
                const prev = ab.innerHTML;
                ab.innerHTML = `<div class="t-bar-hint" style="color:#ffb74d">Потрібно йти в масть&nbsp;${s.trick.cards[0].card.slice(-1)}</div>`;
                setTimeout(() => { if (ab.innerHTML.includes('Потрібно') ) ab.innerHTML = prev; }, 1500);
            }
            return;
        }
    }
    // Подвійне натискання на вже вибрану карту → одразу грати
    if (tSelectedCard === card) {
        tPlayCard(false);
        return;
    }
    tSelectedCard = card;
    playSound('cardSelect');
    renderTHand(tState);
    renderTActions(tState);
}

function tTakeTrick() {
    if (!tPendingTrick) return;
    const st = tPendingTrick.nextState;
    tTrickShowing = false;
    tPendingTrick = null;
    tSelectedCard = null;
    tState = st;
    renderTysyacha();
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
function tChoosePile(pileIdx) {
    socket.emit('action', { type: 'tChoosePile', data: { pileIdx } });
}
function tSetBidAmount(amount) {
    socket.emit('action', { type: 'tSetBid', data: { amount } });
}
function tSetBidCustom() {
    const val = parseInt(document.getElementById('t-set-bid-input')?.value) || 0;
    socket.emit('action', { type: 'tSetBid', data: { amount: val } });
}
function tGiveCard(toPlayer) {
    if (!tSelectedCard) return;
    playSound('cardPlay');
    socket.emit('action', { type: 'tGiveCard', data: { card: tSelectedCard, toPlayer } });
    tSelectedCard = null;
}
function tPlayCard(marriage) {
    if (!tSelectedCard) return;
    playSound('cardPlay');
    socket.emit('action', { type: 'tPlayCard', data: { card: tSelectedCard, marriage } });
    tSelectedCard = null;
}

// ── Чат ──────────────────────────────────────
// Іконки і кольори гравців Тисячі (за індексом)
const T_PLAYER_ICONS  = ['♠', '♥', '♣'];
const T_PLAYER_COLORS = ['#0d47a1', '#b71c1c', '#1b5e20'];

function sendTysyachaChat() {
    const input = document.getElementById('t-chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    const me    = tState?.players[tMyIdx];
    const icon  = T_PLAYER_ICONS[tMyIdx]  ?? '🃏';
    const color = T_PLAYER_COLORS[tMyIdx] ?? '#c9a227';
    socket.emit('chatMessage', { text, icon, name: me?.name || 'Гравець', color });
    input.value = '';
    input.focus();
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

// ── Банер шлюбу ───────────────────────────────
function tShowMarriageBanner(suit) {
    const pts   = T_MARRIAGE[suit] || 0;
    const color = { '♠':'#e8d5ff','♣':'#d5f5e3','♦':'#ffe5d5','♥':'#ffd5d5' }[suit] || 'white';
    const el    = document.createElement('div');
    el.className = 't-marriage-banner';
    el.innerHTML = `
        <div class="t-marriage-banner-suit" style="color:${color}">${suit}</div>
        <div class="t-marriage-banner-text">ШЛЮБ!</div>
        <div class="t-marriage-banner-pts">+${pts} очок</div>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
}

// ── Між-раундовий результат ───────────────────
function tShowRoundResult(results, onClose) {
    playSound('roundEnd');
    const overlay = document.createElement('div');
    overlay.className = 't-round-result-overlay';
    let countdown = 6;
    let done = false;

    const close = () => {
        if (done) return;
        done = true;
        clearInterval(timer);
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.35s';
        setTimeout(() => { overlay.remove(); if (onClose) onClose(); }, 350);
    };

    const rows = results.map(r => {
        const deltaSign = r.delta > 0 ? '+' : '';
        const deltaClass = r.delta >= 0 ? 'pos' : 'neg';
        const bidderNote = r.isBidder
            ? `<span style="font-size:10px;color:${r.success ? '#a5d6a7' : '#ef9a9a'}">(ставка ${r.bid}${r.success ? ' ✓' : ' ✗'})</span>`
            : '';
        return `
        <div class="t-round-result-row">
            <div>
                <div class="t-rr-name">${r.name} ${bidderNote}</div>
                <div class="t-rr-pts">${r.trickPts} очок у взятках</div>
            </div>
            <div style="text-align:right">
                <div class="t-rr-delta ${deltaClass}">${deltaSign}${r.delta}</div>
                <div class="t-rr-total">${r.score}</div>
            </div>
        </div>`;
    }).join('');

    overlay.innerHTML = `
        <div class="t-round-result-card">
            <div class="t-round-result-title">⚔️ Результат раунду</div>
            ${rows}
            <button class="t-btn primary" id="t-rr-next" onclick="this.closest('.t-round-result-overlay').__close()" style="margin-top:10px">
                Далі&nbsp;→&nbsp;<span id="t-rr-cd" style="opacity:0.5;font-size:11px">(${countdown})</span>
            </button>
        </div>`;

    overlay.__close = close;
    document.body.appendChild(overlay);

    const timer = setInterval(() => {
        countdown--;
        const cd = document.getElementById('t-rr-cd');
        if (cd) cd.textContent = `(${countdown})`;
        if (countdown <= 0) close();
    }, 1000);
}
