// ============================================
// ДУРАК — клієнт
// ============================================
let dState        = null;
let dMyIdx        = null;
let dSelCard      = null;
let dSelAtk       = null;
let dDragCard          = null;
let dGameoverProcessed = false;

const D_SUIT_COLORS = { '♠':'#1565c0', '♣':'#2e7d32', '♦':'#e53935', '♥':'#c62828' };
const D_RANK_IDX    = {'6':0,'7':1,'8':2,'9':3,'10':4,'J':5,'Q':6,'K':7,'A':8};

function dSuitColor(card){ return D_SUIT_COLORS[card.slice(-1)] || '#333'; }
function dRank(card){ return card.slice(0,-1); }
function dSuit(card){ return card.slice(-1); }
function dCanBeat(atk, def, trump){
    const as=dSuit(atk), ds=dSuit(def);
    if(ds===trump && as!==trump) return true;
    if(ds===as) return D_RANK_IDX[dRank(def)] > D_RANK_IDX[dRank(atk)];
    return false;
}

// ── Ініціалізація ─────────────────────────────
function initDurak(state, myIdx){
    dState = state; dMyIdx = myIdx;
    dSelCard = null; dSelAtk = null; dGameoverProcessed = false;
    document.getElementById('game-screen').classList.add('hidden');
    const scr = document.getElementById('durak-screen');
    scr.classList.remove('hidden');
    setQuitBtn(true);
    if(typeof switchViewport==='function') switchViewport('durak');
    renderDurak();
}

function updateDurak(state, sideEffect){
    dState = state;
    dSelCard = null; dSelAtk = null;
    renderDurak();
    if(state.phase==='attack' && state.attacker===dMyIdx) playSound('myTurn');
}

function renderDurak(){
    if(!dState) return;
    renderDInfo(dState);
    renderDOpponents(dState);
    renderDTable(dState);
    renderDHand(dState);
    renderDActions(dState);
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
    el.innerHTML = s.players.map(p => {
        const isAtk = p.id===s.attacker && s.phase!=='gameover';
        const isDef = p.id===s.defender && s.phase!=='gameover';
        const isMe  = p.id===dMyIdx;
        const done  = p.finished;
        const cls   = ['d-pill', isAtk?'atk':isDef?'def':'', isMe?'me':'', done?'done':''].filter(Boolean).join(' ');
        const badge = isAtk ? '<span class="d-role-badge atk">⚔</span>' : isDef ? '<span class="d-role-badge def">🛡</span>' : '';
        const cnt   = done ? '✓' : `${p.handCount}<span style="font-size:8px;opacity:.5">🂠</span>`;
        return `<div class="${cls}">${badge}<b>${isMe?'👤 ':''}${p.name}</b><span class="d-pill-cnt">${cnt}</span></div>`;
    }).join('') +
    `<div class="d-pill info">${mode} · ${phaseLabel}</div>` +
    `<div class="d-pill trump-pill" style="color:${dSuitColor(s.trumpCard)}">${s.trump} козир <span style="opacity:.5;font-size:10px">(${s.deckCount}🂠)</span></div>`;
}

// ── Колода на столі ─────────────────────────
function dDeckIndicator(s){
    const tc = s.trumpCard;
    if(!tc) return '';
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
    // Якщо є вибрана карта захисту — підсвічуємо карти які нею можна відбити
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

    el.innerHTML = me.hand.map(card => {
        const color = dSuitColor(card);
        const sel = card===dSelCard ? ' selected':'';

        let playable = false;
        if(isAtk){
            if(s.table.length===0) {
                // Same rank as first selected card (or any if none selected)
                playable = !dSelCard || dRank(card)===dRank(dSelCard);
            } else {
                playable = tableRanks.has(dRank(card));
            }
        } else if(isDef && dSelAtk){
            playable = dCanBeat(dSelAtk, card, s.trump);
        } else if(isThrow){
            playable = tableRanks.has(dRank(card));
        }

        const cantCls = canAct && !playable && !sel ? ' cant':'';
        return `
        <div class="d-card${sel}${cantCls}" style="border-top-color:${color}"
             draggable="${canAct && playable ? 'true' : 'false'}"
             ondragstart="dDragStart('${card}',event)"
             ondblclick="dDblClick('${card}')"
             onclick="dClickHandCard('${card}')">
            <div class="d-cr" style="color:${color}"><div class="d-crn">${dRank(card)}</div><div class="d-crs">${dSuit(card)}</div></div>
            <div class="d-cc" style="color:${color}">${dSuit(card)}</div>
            <div class="d-cr br" style="color:${color}"><div class="d-crn">${dRank(card)}</div><div class="d-crs">${dSuit(card)}</div></div>
        </div>`;
    }).join('');
}

// ── Дії ──────────────────────────────────────
function renderDActions(s){
    const el = document.getElementById('d-actions');
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
        if(!dGameoverProcessed){ dGameoverProcessed=true; updateStats('durak', iWon); playSound(iWon?'win':'lose'); }
        const st = getStats('durak');
        el.innerHTML = `
            <div class="d-gameover">
                <div class="d-gameover-title">${loser?`🤡 ${loser} — ДУРЕНЬ!`:'🏁 Нічия!'}</div>
                <div style="font-size:11px;color:rgba(245,230,200,0.4);font-family:sans-serif;margin:4px 0 10px">
                    ${st.g>0?`Статистика: ${st.w}/${st.g} перемог`:''}
                </div>
                ${isHost?`<button class="d-btn gold" onclick="dRequestRematch()">🔄 Реванш</button>`
                        :`<div class="d-wait">Чекаємо реваншу від хоста...</div>`}
                <button class="d-btn secondary" onclick="dGoLobby()">🏠 Нова гра</button>
            </div>`;
        return;
    }

    if(isAtk){
        const hasSelected = !!dSelCard;
        const canPlay = hasSelected;
        const allBeaten = s.table.length>0 && s.table.every(t=>t.defense);
        el.innerHTML = `
            <div class="d-section-title">⚔️ Ваш хід — Атака</div>
            ${dSelCard?`<div class="d-selected">Обрано: <b>${dSelCard}</b></div>`:'<div class="d-hint">👆 Оберіть карту(и) для атаки</div>'}
            ${canPlay?`<button class="d-btn success" onclick="dPlayCards()">▶ Зіграти</button>`:''}
            ${dSelCard?`<button class="d-btn secondary" onclick="dClearSel()">✕ Скасувати</button>`:''}
            ${allBeaten?`<button class="d-btn secondary" onclick="dPass()">⏭ Завершити хід</button>`:''}`;
        return;
    }
    if(isDef){
        const unbeaten = s.table.filter(t=>!t.defense);
        const canTransfer = s.mode==='perevodnoj' && s.table.every(t=>!t.defense) && dSelCard;
        el.innerHTML = `
            <div class="d-section-title">🛡️ Ваш хід — Захист</div>
            ${dSelAtk?`<div class="d-hint-atk">Відбиваєте: <b style="color:${dSuitColor(dSelAtk)}">${dSelAtk}</b></div>`:''}
            ${dSelCard&&dSelAtk?`<button class="d-btn success" onclick="dBeat()">🛡️ Відбити</button>`:''}
            ${!dSelAtk?'<div class="d-hint">👆 Натисніть карту атаки на столі</div>':''}
            ${dSelCard?`<button class="d-btn secondary" onclick="dClearSel()">✕ Скасувати</button>`:''}
            ${canTransfer?`<button class="d-btn gold" onclick="dTransfer()">🔄 Перевести</button>`:''}
            <button class="d-btn danger" onclick="dTake()">😵 Забрати (${s.table.flatMap(t=>[t.attack,t.defense]).filter(Boolean).length} карт)</button>`;
        return;
    }
    if(isThrow){
        el.innerHTML = `
            <div class="d-section-title">➕ Підкидання</div>
            ${dSelCard?`<div class="d-selected">Обрано: <b>${dSelCard}</b></div>`:'<div class="d-hint">👆 Оберіть карту для підкидання</div>'}
            ${dSelCard?`<button class="d-btn success" onclick="dPlayCards()">➕ Підкинути</button>`:''}
            ${dSelCard?`<button class="d-btn secondary" onclick="dClearSel()">✕ Скасувати</button>`:''}
            <button class="d-btn secondary" onclick="dPass()">⏭ Пас</button>`;
        return;
    }
    if(waiting){
        el.innerHTML = `<div class="d-section-title">⏳ Ваш пас прийнятий</div>
            <div class="d-wait">Чекаємо інших гравців...</div>`;
        return;
    }
    // Not my turn
    const who = s.players[ph==='defend' ? s.defender : s.attacker]?.name || '...';
    const phLabel = {'attack':'атакує','defend':'захищається','throw':'підкидає'}[ph]||'ходить';
    el.innerHTML = `<div class="d-section-title">Хід</div>
        <div class="d-wait">${who}<br><span style="color:rgba(245,230,200,0.4)">${phLabel}</span></div>`;
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

    if(isDef && dSelAtk){
        // Selecting defense card to beat selected attack card
        if(dCanBeat(dSelAtk, card, s.trump)){
            dSelCard = card;
            renderDHand(s); renderDActions(s);
        }
        return;
    }
    dSelCard = dSelCard===card ? null : card;
    if(dSelCard) playSound('cardSelect');
    renderDHand(s); renderDActions(s);
}

function dClickAtkCard(attackCard){
    const s = dState;
    if(!s || s.phase!=='defend' || s.defender!==dMyIdx) return;
    const slot = s.table.find(t=>t.attack===attackCard && !t.defense);
    if(!slot) return;
    dSelAtk = dSelAtk===attackCard ? null : attackCard;
    dSelCard = null;
    renderDTable(s); renderDHand(s); renderDActions(s);
}

function dClearSel(){
    dSelCard=null; dSelAtk=null;
    renderDHand(dState); renderDActions(dState); renderDTable(dState);
}

// ── Дії (emit) ───────────────────────────────
function dPlayCards(){
    if(!dSelCard) return;
    // Collect all same-rank selected (for attack: allow multi)
    // For simplicity, play one card at a time; server handles it
    playSound('cardPlay');
    socket.emit('action',{type:'dPlay',data:{cards:[dSelCard]}});
    dSelCard=null;
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
        dSelCard = card;
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
