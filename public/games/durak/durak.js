// ============================================
// ДУРАК — клієнт
// ============================================
let dState        = null;
let dMyIdx        = null;
let dSelCards     = new Set();
let dSelCard      = null;
let dSelAtk       = null;
let dDragCard          = null;
let dGameoverProcessed = false;
let dTimerInterval     = null;
let dDealing           = false;

const D_SUIT_COLORS = { '♠':'#1565c0', '♣':'#2e7d32', '♦':'#e53935', '♥':'#c62828' };
const D_RANK_IDX    = {'6':0,'7':1,'8':2,'9':3,'10':4,'J':5,'Q':6,'K':7,'A':8};

function dSuitColor(card){ return D_SUIT_COLORS[card.slice(-1)] || '#333'; }
function dRank(card){ return card.slice(0,-1); }
function dSuit(card){ return card.slice(-1); }
function dCanBeat(atk, def, trump){
    if(!atk || !def || !trump) return false;
    const as=dSuit(atk), ds=dSuit(def);
    if(ds===trump && as!==trump) return true;
    if(ds===as) return D_RANK_IDX[dRank(def)] > D_RANK_IDX[dRank(atk)];
    return false;
}

// ── Ініціалізація ─────────────────────────────
function initDurak(state, myIdx){
    dState = state; dMyIdx = myIdx;
    dSelCards.clear(); dSelCard = null; dSelAtk = null; dGameoverProcessed = false;
    if(dTimerInterval){ clearInterval(dTimerInterval); dTimerInterval = null; }
    dDealing = true;
    document.getElementById('game-screen').classList.add('hidden');
    const scr = document.getElementById('durak-screen');
    scr.classList.remove('hidden');
    setQuitBtn(true);
    if(typeof switchViewport==='function') switchViewport('durak');
    renderDurak();
    dStartClientTimer();
    setTimeout(() => { dDealing = false; renderDHand(dState); }, 1100);
}

function updateDurak(state, sideEffect){
    dState = state;
    dSelCards.clear(); dSelCard = null; dSelAtk = null;
    renderDurak();
    dStartClientTimer();
    if(state.phase==='attack' && state.attacker===dMyIdx) {
        playSound('myTurn');
        if(typeof _sendNotif==='function') _sendNotif('Дурак', 'Твій хід — атакуй!');
    }
    if(state.phase==='defend' && state.defender===dMyIdx) {
        if(typeof _sendNotif==='function') _sendNotif('Дурак', 'Твій хід — захищайся!');
    }
}

function dStartClientTimer(){
    if(dTimerInterval) clearInterval(dTimerInterval);
    dTimerInterval = setInterval(()=>{
        const el = document.getElementById('d-timer');
        if(!el || !dState?.turnDeadline){ if(el) el.textContent=''; return; }
        const sec = Math.max(0, Math.ceil((dState.turnDeadline - Date.now()) / 1000));
        const urgent = sec <= 10;
        el.textContent = `⏱ ${sec}с`;
        el.style.cssText = `display:inline-block;padding:2px 10px;border-radius:12px;font-size:13px;
            font-weight:900;font-family:sans-serif;
            background:${urgent?'rgba(178,34,34,0.9)':'rgba(0,0,0,0.5)'};
            color:${urgent?'#fff':'rgba(245,230,200,0.7)'};
            ${urgent?'animation:dTimerPulse 0.5s ease-in-out infinite alternate':''}`;
        if(sec === 0) clearInterval(dTimerInterval);
    }, 500);
}

function renderDurak(){
    if(!dState) return;
    renderDInfo(dState);
    renderDOpponents(dState);
    renderDTable(dState);
    renderDHand(dState);
    renderDActionBar(dState);
    renderDHandActions(dState);
    renderDLog(dState);
}

// ── Суперники над столом ─────────────────────
function renderDOpponents(s){
    const el = document.getElementById('d-opponents');
    if(!el) return;
    const opponents = s.players.filter((p, i) => i !== dMyIdx);
    if(!opponents.length){ el.innerHTML=''; return; }
    el.innerHTML = opponents.map(p => {
        const isAtk = p.id === s.attacker && s.phase !== 'gameover';
        const isDef = p.id === s.defender && s.phase !== 'gameover';
        const role  = isAtk ? '<span class="d-opp-role atk">⚔</span>' : isDef ? '<span class="d-opp-role def">🛡</span>' : '';
        const done  = p.finished;
        const cnt   = done ? 0 : (p.handCount || 0);
        const cards = done
            ? '<span class="d-opp-done">✓ вийшов</span>'
            : Array.from({length: Math.min(cnt, 12)}, (_, i) =>
                `<div class="d-opp-card" style="margin-left:${i===0?0:-18}px;z-index:${i}"></div>`
              ).join('') + (cnt > 12 ? `<span class="d-opp-more">+${cnt-12}</span>` : '');
        const cls = ['d-opp-player', isAtk?'atk':isDef?'def':'', done?'done':''].filter(Boolean).join(' ');
        return `<div class="${cls}">
            <div class="d-opp-name">${role}${p.name}</div>
            <div class="d-opp-hand">${cards}</div>
        </div>`;
    }).join('');
}

// ── Топбар: гравці + козир ───────────────────
function renderDInfo(s){
    const el = document.getElementById('d-info');
    if(!el) return;
    const phaseLabel = {
        attack:'Атака', defend:'Захист', throw:'Підкидання', gameover:'Гра завершена'
    }[s.phase] || s.phase;
    const mode = s.mode==='perevodnoj' ? 'Перевідний' : 'Підкидний';
    el.innerHTML = `<div id="d-timer" style="margin-right:4px"></div>` + s.players.map((p, i) => {
        const isAtk    = p.id===s.attacker && s.phase!=='gameover';
        const isDef    = p.id===s.defender && s.phase!=='gameover';
        const isMe     = p.id===dMyIdx;
        const done     = p.finished;
        const offline  = typeof _offlinePlayers !== 'undefined' && _offlinePlayers.has(i);
        const cls      = ['d-pill', isAtk?'atk':isDef?'def':'', isMe?'me':'', done?'done':'', offline?'offline':''].filter(Boolean).join(' ');
        const badge    = isAtk ? '<span class="d-role-badge atk">⚔</span>' : isDef ? '<span class="d-role-badge def">🛡</span>' : '';
        const cnt      = done ? '✓' : `${p.handCount}<span style="font-size:8px;opacity:.5">🂠</span>`;
        const offBadge = offline ? '<span class="d-offline-badge">📴</span>' : '';
        const avHtml   = window.renderAvatarEl ? window.renderAvatarEl(p.avatarId, p.avatarColor, p.name[0], 24) : '';
        return `<div class="${cls}">${badge}${offBadge}${avHtml}<b>${isMe?'👤 ':''}${p.name}</b><span class="d-pill-cnt">${cnt}</span></div>`;
    }).join('') +
    `<div class="d-pill info">${mode} · ${phaseLabel}</div>` +
    `<div class="d-pill trump-pill" style="color:${dSuitColor(s.trumpCard)}">${s.trump} козир <span style="opacity:.5;font-size:10px">(${s.deckCount}🂠)</span></div>`;
}

// ── Колода на столі ─────────────────────────
function dDeckIndicator(s){
    const tc = s.trumpCard;
    // Колода порожня — показуємо тільки масть козиря без картки
    if(!tc){
        if(!s.trump) return '';
        const tColor = D_SUIT_COLORS[s.trump]||'#333';
        return `<div class="d-deck-wrap">
            <div style="font-size:28px;color:${tColor};filter:drop-shadow(0 2px 6px rgba(0,0,0,0.7))"
                 title="Козир">${s.trump}</div>
        </div>`;
    }
    const tColor = dSuitColor(tc);
    const cnt = s.deckCount;
    const layers = cnt > 0 ? Math.min(6, Math.max(1, Math.ceil(cnt / 4))) : 0;
    // Стос сорочкою
    const stackCards = layers > 0
        ? Array.from({length: layers}, (_, i) =>
            `<div class="d-deck-card" style="top:${-i*4}px;left:${i*2}px;z-index:${i}"></div>`
          ).join('')
        : '';
    const cntBadge = cnt > 0
        ? `<div class="d-deck-cnt">${cnt}</div>`
        : '';
    // Козирна карта — повноцінна, відкрита, вертикально
    const trumpCard = `
        <div class="d-deck-trump" style="border-top-color:${tColor}">
            <div class="d-dt-corner" style="color:${tColor}">
                <div class="d-dt-rank">${dRank(tc)}</div>
                <div class="d-dt-suit-sm">${dSuit(tc)}</div>
            </div>
            <div class="d-dt-center" style="color:${tColor}">${dSuit(tc)}</div>
            <div class="d-dt-corner br" style="color:${tColor}">
                <div class="d-dt-rank">${dRank(tc)}</div>
                <div class="d-dt-suit-sm">${dSuit(tc)}</div>
            </div>
        </div>`;
    return `
    <div class="d-deck-wrap">
        <div class="d-deck-stack">
            ${stackCards}
            ${cntBadge}
        </div>
        ${trumpCard}
    </div>`;
}

// ── Стіл ─────────────────────────────────────
function renderDTable(s){
    const el = document.getElementById('d-table');
    if(!el) return;
    const deck = dDeckIndicator(s);
    if(!s.table.length){
        el.innerHTML = `<div class="d-table-empty">— стіл порожній —</div>${deck}`;
        return;
    }
    // Якщо є вибрана картка захисту — підсвічуємо атаки які нею можна відбити
    const beatableBySelected = dSelCard && s.phase==='defend' && s.defender===dMyIdx
        ? new Set(s.table.filter(t=>!t.defense && dCanBeat(t.attack, dSelCard, s.trump)).map(t=>t.attack))
        : new Set();

    el.innerHTML = s.table.map((slot, i) => {
        const atkColor  = dSuitColor(slot.attack);
        const defColor  = slot.defense ? dSuitColor(slot.defense) : '';
        const beaten    = !!slot.defense;
        const isSelAtk  = !beaten && s.phase==='defend' && s.defender===dMyIdx;
        const isBeatable = beatableBySelected.has(slot.attack);
        const highlight = !beaten && dSelAtk===slot.attack ? ' selected'
                        : !beaten && isBeatable ? ' beatable' : '';
        return `
        <div class="d-slot">
            <div class="d-card-table${highlight}${isSelAtk?' clickable':''}"
                 style="border-top-color:${atkColor};color:${atkColor}"
                 onclick="dClickAtkCard('${slot.attack}')">
                <div class="d-tr">${dRank(slot.attack)}</div>
                <div class="d-tc">${dSuit(slot.attack)}</div>
            </div>
            ${beaten
                ? `<div class="d-card-table def" style="border-top-color:${defColor};color:${defColor}">
                       <div class="d-tr">${dRank(slot.defense)}</div>
                       <div class="d-tc">${dSuit(slot.defense)}</div>
                   </div>`
                : `<div class="d-slot-empty"></div>`}
        </div>`;
    }).join('') + deck;
}

// ── Рука ─────────────────────────────────────
function renderDHand(s){
    const el = document.getElementById('d-hand');
    if(!el) return;
    const me = s.players[dMyIdx];
    if(!me?.hand){ el.innerHTML=''; return; }
    const ph = s.phase;
    const isAtk = ph==='attack' && s.attacker===dMyIdx;
    const isDef = ph==='defend' && s.defender===dMyIdx;
    const isThrow = ph==='throw' && s.defender!==dMyIdx && !s.passedThrow.includes(dMyIdx);
    const canAct = isAtk||isDef||isThrow;

    const tableRanks = new Set(s.table.flatMap(t=>[dRank(t.attack), t.defense?dRank(t.defense):null].filter(Boolean)));

    // Сортування: масть (♠♣♦♥, козир останній), всередині — ранг по зростанню
    const SUIT_ORD = {'♠':0,'♣':1,'♦':2,'♥':3};
    const sorted = [...me.hand].sort((a, b) => {
        const aTrump = dSuit(a)===s.trump ? 1 : 0;
        const bTrump = dSuit(b)===s.trump ? 1 : 0;
        if(aTrump !== bTrump) return aTrump - bTrump;
        const sd = (SUIT_ORD[dSuit(a)]??0) - (SUIT_ORD[dSuit(b)]??0);
        if(sd !== 0) return sd;
        return D_RANK_IDX[dRank(a)] - D_RANK_IDX[dRank(b)];
    });

    // Перший обраний ранг для атаки на порожньому столі
    const firstSelRank = dSelCards.size > 0 ? dRank([...dSelCards][0]) : null;

    el.innerHTML = sorted.map((card, cardIdx) => {
        const color = dSuitColor(card);
        const isSel = (isAtk || isThrow) ? dSelCards.has(card) : card === dSelCard;
        const sel = isSel ? ' selected' : '';
        const dealStyle = dDealing ? `animation-delay:${cardIdx * 85}ms` : '';

        let playable = false;
        let defBeatable = false; // зелений glow під час захисту
        if(isAtk){
            if(s.table.length === 0){
                playable = !firstSelRank || dRank(card) === firstSelRank;
            } else {
                playable = tableRanks.has(dRank(card));
            }
        } else if(isDef){
            if(dSelAtk){
                // вибрана конкретна атакуюча — підсвічуємо тільки ті що б'ють її
                defBeatable = dCanBeat(dSelAtk, card, s.trump);
            } else {
                // без вибору — підсвічуємо всі що можуть відбити хоч щось
                defBeatable = s.table.some(t => !t.defense && dCanBeat(t.attack, card, s.trump));
            }
            playable = defBeatable; // для draggable/dblclick
        } else if(isThrow){
            playable = tableRanks.has(dRank(card));
        }

        const cantCls = (canAct && !isDef && !playable && !isSel) ? ' cant' : '';
        const beatCls = isDef && defBeatable  && !isSel ? ' def-beat' : '';
        const dimCls  = isDef && !defBeatable && !isSel ? ' def-dim'  : '';
        const dealCls = dDealing ? ' d-dealing' : '';
        return `
        <div class="d-card${sel}${cantCls}${beatCls}${dimCls}${dealCls}" style="border-top-color:${color};${dealStyle}"
             draggable="${canAct && playable ? 'true' : 'false'}"
             ondragstart="dDragStart('${card}',event)"
             ondblclick="dDblClick('${card}')"
             ontouchstart="dTouchStart('${card}',event)"
             onclick="dClickHandCard('${card}')">
            <div class="d-cr" style="color:${color}"><div class="d-crn">${dRank(card)}</div><div class="d-crs">${dSuit(card)}</div></div>
            <div class="d-cc" style="color:${color}">${dSuit(card)}</div>
            <div class="d-cr br" style="color:${color}"><div class="d-crn">${dRank(card)}</div><div class="d-crs">${dSuit(card)}</div></div>
        </div>`;
    }).join('');
}

// ── Статус-панель (фаза + обрані карти) ─────
function renderDActionBar(s){
    const el = document.getElementById('d-action-bar');
    if(!el) return;
    const ph = s.phase;
    const isAtk   = ph==='attack' && s.attacker===dMyIdx;
    const isDef   = ph==='defend' && s.defender===dMyIdx;
    const isThrow = ph==='throw'  && s.defender!==dMyIdx && !s.passedThrow.includes(dMyIdx);
    const waiting  = ph==='throw'  && s.passedThrow.includes(dMyIdx);

    if(ph==='gameover'){ el.innerHTML=''; return; }

    if(isAtk){
        const n = dSelCards.size;
        el.innerHTML = `<span class="dab-label">⚔️ Атака</span>`
            + (n>0 ? `<span class="dab-sel">${[...dSelCards].join('  ')}</span>` : `<span class="dab-hint">Натисніть карту(и) одного рангу</span>`);
        return;
    }
    if(isDef){
        el.innerHTML = `<span class="dab-label">🛡️ Захист</span>`
            + (dSelAtk ? `<span class="dab-sel" style="color:#ef5350">${dSelAtk}</span><span style="color:rgba(245,230,200,0.4);font-size:11px;margin:0 2px">→</span>` : '')
            + (dSelCard ? `<span class="dab-sel" style="color:#66bb6a">${dSelCard}</span>` : `<span class="dab-hint">Натисніть зелену карту</span>`);
        return;
    }
    if(isThrow){
        const n = dSelCards.size;
        el.innerHTML = `<span class="dab-label">➕ Підкидання</span>`
            + (n>0 ? `<span class="dab-sel">${[...dSelCards].join('  ')}</span>` : `<span class="dab-hint">Оберіть карту або Пас</span>`);
        return;
    }
    if(waiting){
        el.innerHTML = `<span class="dab-label">⏳</span><span class="dab-wait">Пас прийнятий</span>`;
        return;
    }
    const who = s.players[ph==='defend' ? s.defender : s.attacker]?.name || '...';
    const phLabel = {attack:'атакує',defend:'захищається',throw:'підкидає'}[ph]||'ходить';
    el.innerHTML = `<span class="dab-wait">⏳ ${who} ${phLabel}...</span>`;
}

// ── Великі кнопки дій прямо над картами ─────
function renderDHandActions(s){
    const el = document.getElementById('d-hand-actions');
    if(!el) return;
    const ph = s.phase;
    const isAtk   = ph==='attack' && s.attacker===dMyIdx;
    const isDef   = ph==='defend' && s.defender===dMyIdx;
    const isThrow = ph==='throw'  && s.defender!==dMyIdx && !s.passedThrow.includes(dMyIdx);
    const waiting  = ph==='throw'  && s.passedThrow.includes(dMyIdx);

    if(ph==='gameover'){
        const loser = s.loser!==null ? s.players[s.loser]?.name : null;
        const iWon = s.loser !== dMyIdx;
        const isHost = dMyIdx===0;
        if(!dGameoverProcessed){ dGameoverProcessed=true; updateStats('durak', iWon); playSound(iWon?'win':'lose'); if(iWon) dSpawnConfetti(); }
        const st = getStats('durak');
        el.innerHTML = `
            <span class="dab-title" style="font-size:15px;font-weight:900;color:#c9a227">${loser?`🤡 ${loser} — ДУРЕНЬ!`:'🏁 Нічия!'}</span>
            ${st.g>0?`<span class="dab-stat">${st.w}/${st.g} перемог</span>`:''}
            ${isHost?`<button class="dha-btn gold" onclick="dRequestRematch()">🔄 Реванш</button>`:`<span class="dab-wait">Чекаємо реваншу...</span>`}
            <button class="dha-btn secondary" onclick="dGoLobby()">🏠 Нова гра</button>`;
        return;
    }
    if(isAtk){
        const n = dSelCards.size;
        const allBeaten = s.table.length>0 && s.table.every(t=>t.defense);
        // Підказка: є ще карти того ж рангу — можна вибрати більше
        let moreHint = '';
        if(n >= 1 && s.table.length === 0){
            const selRank = dRank([...dSelCards][0]);
            const me = s.players[dMyIdx];
            const more = (me?.hand||[]).filter(c => dRank(c)===selRank && !dSelCards.has(c)).length;
            if(more > 0) moreHint = `<span style="font-size:12px;color:#c9a227;font-family:sans-serif">
                ← ще ${more} ${selRank}</span>`;
        }
        el.innerHTML = (n>0
            ? `<button class="dha-btn success" onclick="dPlayCards()">▶ Зіграти${n>1?' ('+n+')':''}</button>
               ${moreHint}
               <button class="dha-btn cancel" onclick="dClearSel()">✕</button>`
            : '')
            + (allBeaten ? `<button class="dha-btn secondary" onclick="dPass()">⏭ Завершити хід</button>` : '');
        return;
    }
    if(isDef){
        const total = s.table.flatMap(t=>[t.attack,t.defense]).filter(Boolean).length;
        const canTransfer = s.mode==='perevodnoj' && s.table.every(t=>!t.defense) && dSelCard;
        el.innerHTML =
            (dSelCard&&dSelAtk ? `<button class="dha-btn success" onclick="dBeat()">🛡️ Відбити</button>` : '')
            + (dSelCard ? `<button class="dha-btn cancel" onclick="dClearSel()">✕</button>` : '')
            + (canTransfer ? `<button class="dha-btn gold" onclick="dTransfer()">🔄 Перевести</button>` : '')
            + `<button class="dha-btn danger" onclick="dTake()">😵 Забрати (${total})</button>`;
        return;
    }
    if(isThrow){
        const n = dSelCards.size;
        let moreHint = '';
        if(n >= 1){
            const selRank = dRank([...dSelCards][0]);
            const me = s.players[dMyIdx];
            const tableRanks = new Set(s.table.flatMap(t=>[dRank(t.attack), t.defense?dRank(t.defense):null].filter(Boolean)));
            const more = (me?.hand||[]).filter(c => tableRanks.has(dRank(c)) && !dSelCards.has(c)).length;
            if(more > 0) moreHint = `<span style="font-size:12px;color:#c9a227;font-family:sans-serif">← ще ${more}</span>`;
        }
        el.innerHTML = (n>0
            ? `<button class="dha-btn success" onclick="dPlayCards()">➕ Підкинути${n>1?' ('+n+')':''}</button>
               ${moreHint}
               <button class="dha-btn cancel" onclick="dClearSel()">✕</button>`
            : '')
            + `<button class="dha-btn secondary" onclick="dPass()">⏭ Пас</button>`;
        return;
    }
    el.innerHTML = '';
}

// ── Лог ──────────────────────────────────────
function renderDLog(s){
    const el = document.getElementById('d-log');
    if(!el) return;
    if(!s.log?.length){ el.innerHTML='<div class="d-log-empty">Лог порожній</div>'; return; }
    el.innerHTML = s.log.map(e=>`<div class="d-log-entry">${e?.text ?? e}</div>`).join('');
    el.scrollTop = el.scrollHeight;
}

// ── Обробники кліків ─────────────────────────
function dClickHandCard(card){
    const s = dState;
    if(!s) return;
    const ph = s.phase;
    const isAtk   = ph==='attack' && s.attacker===dMyIdx;
    const isDef   = ph==='defend' && s.defender===dMyIdx;
    const isThrow = ph==='throw'  && s.defender!==dMyIdx && !s.passedThrow.includes(dMyIdx);
    if(!isAtk && !isDef && !isThrow) return;

    if(isDef){
        if(dSelAtk){
            // є виділена атака — вибираємо карту захисту
            if(dCanBeat(dSelAtk, card, s.trump)){
                dSelCard = card;
                renderDHand(s); renderDActionBar(s); renderDHandActions(s);
            }
        } else {
            // підсвічуємо яку атаку б'є ця карта (якщо вона одна — відразу виділяємо)
            const beatable = s.table.filter(t=>!t.defense && dCanBeat(t.attack, card, s.trump));
            if(beatable.length === 1){
                dSelAtk = beatable[0].attack; dSelCard = card;
                renderDTable(s); renderDHand(s); renderDActionBar(s); renderDHandActions(s);
            } else if(beatable.length > 1){
                dSelCard = card;
                renderDHand(s); renderDTable(s); renderDActionBar(s); renderDHandActions(s);
            }
        }
        return;
    }

    // Атака / підкидання — мультивиділення однакового рангу
    const tableRanks = new Set(s.table.flatMap(t=>[dRank(t.attack), t.defense?dRank(t.defense):null].filter(Boolean)));
    const firstSelRank = dSelCards.size > 0 ? dRank([...dSelCards][0]) : null;

    if(dSelCards.has(card)){
        dSelCards.delete(card);
    } else {
        const rank = dRank(card);
        // На порожньому столі — тільки один ранг; якщо стіл непорожній — будь-який з tableRanks
        const allowed = s.table.length === 0
            ? (!firstSelRank || rank === firstSelRank)
            : tableRanks.has(rank);
        if(allowed){ dSelCards.add(card); playSound('cardSelect'); }
        else if(isAtk && s.table.length === 0 && firstSelRank && rank !== firstSelRank){
            // інший ранг — скидаємо і починаємо новий вибір
            dSelCards.clear(); dSelCards.add(card); playSound('cardSelect');
        }
    }
    renderDHand(s); renderDActionBar(s); renderDHandActions(s);
}

function dClickAtkCard(attackCard){
    const s = dState;
    if(!s || s.phase!=='defend' || s.defender!==dMyIdx) return;
    const slot = s.table.find(t=>t.attack===attackCard && !t.defense);
    if(!slot) return;
    dSelAtk = dSelAtk===attackCard ? null : attackCard;
    dSelCard = null;
    renderDTable(s); renderDHand(s); renderDActionBar(s); renderDHandActions(s);
}

function dClearSel(){
    dSelCards.clear(); dSelCard=null; dSelAtk=null;
    renderDHand(dState); renderDActionBar(dState); renderDTable(dState);
}

// ── Дії (emit) ───────────────────────────────
function dPlayCards(){
    if(!dSelCards.size) return;
    playSound('cardPlay');
    socket.emit('action',{type:'dPlay',data:{cards:[...dSelCards]}});
    dSelCards.clear();
}

function dBeat(){
    if(!dSelAtk||!dSelCard) return;
    playSound('cardPlay');
    socket.emit('action',{type:'dBeat',data:{attackCard:dSelAtk, defenseCard:dSelCard}});
    dSelAtk=null; dSelCard=null;
}

function dTake(){
    playSound('lose');
    socket.emit('action',{type:'dTake',data:{}});
}

function dTransfer(){
    if(!dSelCard) return;
    socket.emit('action',{type:'dTransfer',data:{card:dSelCard}});
    dSelCard=null;
}

function dPass(){
    socket.emit('action',{type:'dPass',data:{}});
}

function dRequestRematch(){ socket.emit('restartGame'); }
function dGoLobby(){
    if(typeof clearSession==='function') clearSession();
    location.href='/';
}

// ── Touch drag ────────────────────────────────
let dTouchCard  = null;
let dTouchGhost = null;

function dTouchStart(card, event) {
    dTouchCard = card;
    const touch = event.touches[0];
    const src = event.currentTarget;
    dTouchGhost = src.cloneNode(true);
    const rect = src.getBoundingClientRect();
    dTouchGhost.style.cssText += `;position:fixed;z-index:9100;opacity:0.75;pointer-events:none;
        width:${rect.width}px;height:${rect.height}px;
        top:${touch.clientY - rect.height / 2}px;left:${touch.clientX - rect.width / 2}px;transition:none`;
    document.body.appendChild(dTouchGhost);
    document.addEventListener('touchmove',  dTouchMove,  { passive: false });
    document.addEventListener('touchend',   dTouchEnd,   { once: true });
    document.addEventListener('touchcancel',dTouchEnd,   { once: true });
    event.preventDefault();
}

function dTouchMove(event) {
    if (!dTouchGhost) return;
    const touch = event.touches[0];
    const w = dTouchGhost.offsetWidth, h = dTouchGhost.offsetHeight;
    dTouchGhost.style.top  = (touch.clientY - h / 2) + 'px';
    dTouchGhost.style.left = (touch.clientX - w / 2) + 'px';
    const table = document.getElementById('d-table');
    if (table) {
        const r = table.getBoundingClientRect();
        table.classList.toggle('drag-over',
            touch.clientX >= r.left && touch.clientX <= r.right &&
            touch.clientY >= r.top  && touch.clientY <= r.bottom);
    }
    event.preventDefault();
}

function dTouchEnd(event) {
    document.removeEventListener('touchmove', dTouchMove);
    if (dTouchGhost) { dTouchGhost.remove(); dTouchGhost = null; }
    const table = document.getElementById('d-table');
    table?.classList.remove('drag-over');
    if (!dTouchCard) return;
    const touch = event.changedTouches[0];
    if (table) {
        const r = table.getBoundingClientRect();
        if (touch.clientX >= r.left && touch.clientX <= r.right &&
            touch.clientY >= r.top  && touch.clientY <= r.bottom) {
            dActWithCard(dTouchCard);
        }
    }
    dTouchCard = null;
}

// ── Drag & Drop ───────────────────────────────
function dDragStart(card, event){
    dDragCard = card;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', card);
}

function dDragOver(event){
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    document.getElementById('d-table')?.classList.add('drag-over');
}

function dDragLeave(event){
    // Ігноруємо якщо мишка перейшла на дочірній елемент
    if(event.relatedTarget && document.getElementById('d-table')?.contains(event.relatedTarget)) return;
    document.getElementById('d-table')?.classList.remove('drag-over');
}

function dDropOnTable(event){
    event.preventDefault();
    document.getElementById('d-table')?.classList.remove('drag-over');
    const card = dDragCard || event.dataTransfer.getData('text/plain');
    dDragCard = null;
    if(card) dActWithCard(card);
}

// ── Подвійний клік ────────────────────────────
function dDblClick(card){
    dActWithCard(card);
}

// Спільна логіка для drag-drop і dblclick
function dActWithCard(card){
    const s = dState;
    if(!s) return;
    const ph = s.phase, myIdx = dMyIdx;
    const isAtk   = ph==='attack' && s.attacker===myIdx;
    const isDef   = ph==='defend' && s.defender===myIdx;
    const isThrow = ph==='throw'  && s.defender!==myIdx && !s.passedThrow.includes(myIdx);

    if(isAtk || isThrow){
        dSelCards.clear(); dSelCards.add(card);
        dPlayCards();
    } else if(isDef){
        const unbeaten = s.table.filter(t=>!t.defense);
        // Можна відбити кілька карт — беремо найслабшу щоб зберегти козирі на важке
        const beatable = unbeaten
            .filter(t => dCanBeat(t.attack, card, s.trump))
            .sort((a,b) => D_RANK_IDX[dRank(b.attack)] - D_RANK_IDX[dRank(a.attack)]); // найсильніша атака першою
        if(beatable.length === 1 || (beatable.length > 1 && dSelAtk)){
            // Або одна варіація, або вже є виділена картка атаки — б'ємо її
            const target = dSelAtk ? beatable.find(t=>t.attack===dSelAtk) || beatable[0] : beatable[0];
            dSelAtk = target.attack;
            dSelCard = card;
            dBeat();
        } else if(beatable.length > 1){
            // Кілька варіантів — виділяємо карту і підсвічуємо доступні цілі
            dSelCard = card;
            renderDHand(s); renderDTable(s); renderDActions(s);
        } else {
            dSelCard = card;
            renderDHand(s); renderDActions(s);
        }
    }
}

function dSpawnConfetti() {
    const colors = ['#c9a227','#e53935','#43a047','#1565c0','#f5e6c8','#ffd700'];
    for (let i = 0; i < 80; i++) {
        const el   = document.createElement('div');
        const size = 6 + Math.random() * 8;
        el.style.cssText = `position:fixed;top:-12px;left:${Math.random()*100}vw;width:${size}px;height:${size}px;
            background:${colors[Math.floor(Math.random()*colors.length)]};
            border-radius:${Math.random()>.5?'50%':'2px'};
            animation:confetti-fall ${2+Math.random()*3}s linear ${Math.random()*1.5}s forwards;
            z-index:9999;pointer-events:none`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 6000);
    }
}
