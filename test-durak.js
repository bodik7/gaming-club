// ── Бот-тест Дурака ──────────────────────────────────────
const io = require('socket.io-client');

const URL      = process.env.URL  || 'http://localhost:3000';
const N        = parseInt(process.env.N || '3');   // кількість гравців
const MODE     = process.env.MODE || 'podkidnoy';  // або 'perevodnoj'
const TIMEOUT  = parseInt(process.env.TIMEOUT || '30000');

const D_RANK_IDX = {'6':0,'7':1,'8':2,'9':3,'10':4,'J':5,'Q':6,'K':7,'A':8};
function dRank(c){ return c.slice(0,-1); }
function dSuit(c){ return c.slice(-1); }
function dCanBeat(atk, def, trump){
    const as=dSuit(atk), ds=dSuit(def);
    if(ds===trump && as!==trump) return true;
    if(ds===as) return D_RANK_IDX[dRank(def)] > D_RANK_IDX[dRank(atk)];
    return false;
}

// Вибір кращої карти для відбиття
function bestDefense(attackCard, hand, trump){
    const samesuit = hand.filter(c=>dSuit(c)===dSuit(attackCard) && D_RANK_IDX[dRank(c)]>D_RANK_IDX[dRank(attackCard)]);
    const trumps   = dSuit(attackCard)!==trump ? hand.filter(c=>dSuit(c)===trump) : [];
    if(samesuit.length) return samesuit.sort((a,b)=>D_RANK_IDX[dRank(a)]-D_RANK_IDX[dRank(b)])[0];
    if(trumps.length)   return trumps.sort((a,b)=>D_RANK_IDX[dRank(a)]-D_RANK_IDX[dRank(b)])[0];
    return null;
}

// Вибір найслабшої карти для атаки
function weakestCard(hand){ return hand.slice().sort((a,b)=>D_RANK_IDX[dRank(a)]-D_RANK_IDX[dRank(b)])[0]; }

let bots = [];
let roomCode = null;
let round = 0;
let gameOver = false;
const acted = new Set();

function log(msg){ console.log(`[${new Date().toISOString().substr(11,8)}] ${msg}`); }

function createBot(name, idx){
    const socket = io(URL, { transports:['websocket'], timeout:5000 });
    const bot = { socket, name, idx, state: null };

    socket.on('connect', () => {
        log(`🔌 ${name} підключено`);
        if(idx===0){
            socket.emit('createRoom', { playerName: name, gameType:'durak' }, ({ code, error })=>{
                if(error){ log(`❌ createRoom: ${error}`); process.exit(1); }
                roomCode = code;
                log(`🏠 Кімната: ${code}`);
                bots.slice(1).forEach(b => joinBot(b));
            });
        }
    });

    socket.on('gameStarted', ({ state }) => {
        bot.state = state;
        log(`🃏 ${name} (idx=${idx}): гра почалась. Козир: ${state.trump}, рука: ${state.players[idx]?.hand?.join(' ')}`);
        setTimeout(()=>act(bot), 200);
    });

    socket.on('stateUpdate', ({ state }) => {
        if(state?.gameType !== 'durak') return; // ігноруємо чужі апдейти
        bot.state = state;
        acted.clear();
        setTimeout(()=>act(bot), 150 + idx*10);
    });

    socket.on('gameOver', ({ state }) => {
        gameOver = true;
        const loser = state.loser!==null ? state.players[state.loser]?.name : 'Нічия';
        log(`🏁 ГРА ЗАВЕРШЕНА! Дурень: ${loser}`);
        log(`📊 Лог: ${state.log?.slice(0,5).join(' | ')}`);
        process.exit(0);
    });

    socket.on('error', err => log(`❌ ${name}: ${err}`));
    socket.on('disconnect', r => { if(!gameOver) log(`⚡ ${name} відключено: ${r}`); });

    return bot;
}

function joinBot(bot){
    bot.socket.emit('joinRoom', { code: roomCode, playerName: bot.name }, ({ error })=>{
        if(error){ log(`❌ joinRoom: ${error}`); process.exit(1); }
        if(bots.filter(b=>b.state).length === 0 && bot.idx === N-1){
            setTimeout(()=>bots[0].socket.emit('startGame', { settings:{ mode: MODE } }), 300);
        }
    });
}

function act(bot){
    const s = bot.state;
    if(!s || s.phase==='gameover') return;
    const myIdx = bot.idx;
    const me = s.players[myIdx];
    if(!me?.hand?.length){
        // 0 карт — якщо у throw фазі і не захисник і не пасував — пасуємо
        if(s.phase==='throw' && s.defender!==myIdx && !s.passedThrow.includes(myIdx)){
            bot.socket.emit('action',{type:'dPass',data:{}});
        }
        return;
    }
    const key = `${s.phase}-${s.attacker}-${s.defender}-${s.table.map(t=>t.attack+(t.defense||'')).join()}`;
    if(acted.has(key+myIdx)) return;

    const ph = s.phase;
    const isAtk   = ph==='attack' && s.attacker===myIdx;
    const isDef   = ph==='defend' && s.defender===myIdx;
    const isThrow = ph==='throw'  && s.defender!==myIdx && !s.passedThrow.includes(myIdx);

    if(!isAtk && !isDef && !isThrow){
        // Діагностика: якщо це актор але нічого не може робити
        if(Date.now() - (bot._lastActTime||0) > 5000){
            bot._lastActTime = Date.now();
            log(`🔍 ${bot.name} (idx=${myIdx}): фаза=${ph} atk=${s.attacker} def=${s.defender} passed=${JSON.stringify(s.passedThrow)} hand=${me.hand?.length}`);
        }
        return;
    }
    acted.add(key+myIdx);

    if(isAtk){
        const defPlayer = s.players[s.defender];
        if(defPlayer && defPlayer.handCount === 0){
            log(`⚠️ ${bot.name}: захисник ${defPlayer.name} має 0 карт — пас`);
            return;
        }
        const tableRanks = new Set(s.table.flatMap(t=>[dRank(t.attack), t.defense?dRank(t.defense):null].filter(Boolean)));
        let card;
        if(s.table.length===0){
            // Атакуємо найслабшою
            card = weakestCard(me.hand.filter(c=>dSuit(c)!==s.trump)) || weakestCard(me.hand);
        } else {
            // Підкидаємо якщо є збіг рангу і всі карти відбиті
            const allBeaten = s.table.every(t=>t.defense);
            if(allBeaten){
                card = me.hand.find(c=>tableRanks.has(dRank(c)));
                if(!card){
                    // Пасуємо (завершуємо хід)
                    bot.socket.emit('action',{type:'dPass',data:{}});
                    log(`⏭ ${bot.name} пасує (завершує хід)`);
                    return;
                }
            } else {
                // Чекаємо поки захисник відіб'є
                return;
            }
        }
        if(card){
            bot.socket.emit('action',{type:'dPlay',data:{cards:[card]}});
            log(`⚔️ ${bot.name} атакує ${card}`);
        }
        return;
    }

    if(isDef){
        const unbeaten = s.table.filter(t=>!t.defense);
        if(!unbeaten.length) return;
        const slot = unbeaten[0];
        const def = bestDefense(slot.attack, me.hand, s.trump);
        if(def){
            bot.socket.emit('action',{type:'dBeat',data:{attackCard:slot.attack, defenseCard:def}});
            log(`🛡️ ${bot.name} відбиває ${slot.attack} → ${def}`);
        } else {
            bot.socket.emit('action',{type:'dTake',data:{}});
            log(`😵 ${bot.name} забирає карти`);
        }
        return;
    }

    if(isThrow){
        const tableRanks = new Set(s.table.flatMap(t=>[dRank(t.attack), t.defense?dRank(t.defense):null].filter(Boolean)));
        const def = s.players[s.defender];
        const unbeaten = s.table.filter(t=>!t.defense).length;
        const canThrow = me.hand.find(c=>tableRanks.has(dRank(c)) && unbeaten < def.handCount && s.table.length < 6);
        if(canThrow){
            bot.socket.emit('action',{type:'dPlay',data:{cards:[canThrow]}});
            log(`➕ ${bot.name} підкидає ${canThrow}`);
        } else {
            bot.socket.emit('action',{type:'dPass',data:{}});
            log(`⏭ ${bot.name} пасує підкидання`);
        }
        return;
    }
}

// Старт
log(`🚀 Запуск тесту Дурака: ${N} гравців, режим: ${MODE}`);
for(let i=0; i<N; i++) bots.push(createBot(`Бот${i+1}`, i));

// Запуск гри після підключення всіх (тільки для бота-0)
setTimeout(()=>{
    if(!roomCode) { log('❌ Кімнату не створено'); process.exit(1); }
    if(bots.filter(b=>b.state).length < N){
        bots[0].socket.emit('startGame', { settings:{ mode: MODE } });
    }
}, 2000);

setTimeout(()=>{
    if(!gameOver){ log('⏰ Таймаут'); process.exit(1); }
}, TIMEOUT);
