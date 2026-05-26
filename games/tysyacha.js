const { shuffle, addLog } = require('./utils.js');

let _io;
function init(io) { _io = io; }

const T_SUITS    = ['♠','♣','♦','♥'];
const T_RANKS    = ['9','J','Q','K','10','A'];
const T_POINTS   = {'9':0,'J':2,'Q':3,'K':4,'10':10,'A':11};
const T_MARRIAGE = {'♠':40,'♣':60,'♦':80,'♥':100};
const T_RANK_ORD = ['9','J','Q','K','10','A'];

function tSuit(c)  { return c.slice(-1); }
function tRank(c)  { return c.slice(0,-1); }
function tPts(c)   { return T_POINTS[tRank(c)] || 0; }
function tRankN(c) { return T_RANK_ORD.indexOf(tRank(c)); }

function createTDeck() {
    return shuffle(T_SUITS.flatMap(s => T_RANKS.map(r => `${r}${s}`)));
}

function createTysyachaState(roomPlayers) {
    const n = roomPlayers.length;
    const cpp = n === 2 ? 10 : 7;
    const deck = createTDeck();
    return {
        gameType: 'tysyacha',
        players: roomPlayers.map((rp, i) => ({
            id: i, name: rp.name,
            score: 0, hand: deck.slice(i*cpp, (i+1)*cpp), trickPts: 0,
            onBarrel: false, barrelAttempts: 0,
            avatarId: rp.avatarId || null,
            avatarColor: rp.avatarColor || '#1a56db',
        })),
        talon: deck.slice(cpp*n),
        dealer: 0, round: 1,
        phase: 'auction',
        currentPlayer: 1 % n,
        auction: { current: 100, passed: Array(n).fill(false), winner: null },
        trick: { cards: [], leader: 1 % n },
        trump: null, declaredBid: null,
        marriages: {}, givenCards: [],
        talonPiles: null,
        leftoverPile: null,
        lastTrickWinner: null,
        log: [], winner: null,
    };
}

function tAssignTalon(state, w) {
    if (state.players.length === 2) {
        state.talonPiles = [state.talon.slice(0, 2), state.talon.slice(2, 4)];
    } else {
        state.players[w].hand.push(...state.talon);
    }
    state.talon = [];
    state.phase = 'talon';
    state.currentPlayer = w;
}

function processTysyachaAction(state, type, data, pidx) {
    const player = state.players[pidx];
    const n = state.players.length;

    switch (type) {
        case 'tBid': {
            if (state.phase !== 'auction' || pidx !== state.currentPlayer) break;
            if (data.pass) {
                if (player.onBarrel) break;
                state.auction.passed[pidx] = true;
                state.log.unshift(`${player.name}: пас`);
            } else {
                const amt = parseInt(data.amount) || 0;
                if (amt <= state.auction.current || amt % 10 !== 0 || amt > 840) break;
                state.auction.current = amt;
                state.log.unshift(`${player.name}: ${amt}`);
            }
            const active = state.players.map((_,i)=>i).filter(i => !state.auction.passed[i]);
            if (active.length === 0) {
                const w = (state.dealer + 1) % n;
                state.auction.passed = Array(n).fill(false);
                state.auction.winner = w;
                state.log.unshift(`⚠️ Всі спасували — ${state.players[w].name} бере за ${state.auction.current}`);
                tAssignTalon(state, w);
            } else if (active.length === 1) {
                const w = active[0];
                state.auction.winner = w;
                state.log.unshift(`🏆 ${state.players[w].name} виграє торги (${state.auction.current})`);
                tAssignTalon(state, w);
            } else {
                let next = (pidx + 1) % n;
                while (state.auction.passed[next]) next = (next + 1) % n;
                state.currentPlayer = next;
            }
            break;
        }

        case 'tChoosePile': {
            if (state.phase !== 'talon' || !state.talonPiles || pidx !== state.auction.winner) break;
            const { pileIdx } = data;
            if (pileIdx !== 0 && pileIdx !== 1) break;
            player.hand.push(...state.talonPiles[pileIdx]);
            state.leftoverPile = state.talonPiles[1 - pileIdx];
            state.talonPiles = null;
            addLog(state, `${player.name} обирає прикуп`);
            break;
        }

        case 'tGiveCard': {
            if (state.phase !== 'talon' || pidx !== state.auction.winner) break;
            if (state.talonPiles) break;
            const { card, toPlayer } = data;
            if (toPlayer === pidx || toPlayer < 0 || toPlayer >= n) break;
            if (state.givenCards.filter(g => g === toPlayer).length >= 1) break;
            const idx = player.hand.indexOf(card);
            if (idx === -1) break;
            player.hand.splice(idx, 1);
            state.players[toPlayer].hand.push(card);
            state.givenCards.push(toPlayer);
            const opponents = state.players.map((_,i)=>i).filter(i=>i!==pidx);
            const allReceived = opponents.every(i => state.givenCards.filter(g=>g===i).length >= 1);
            if (allReceived) {
                if (!state.declaredBid) state.declaredBid = state.auction.current;
                state.phase = 'playing';
                state.currentPlayer = state.auction.winner;
                state.trick.leader = state.auction.winner;
                state.log.unshift(`📢 ${state.players[state.auction.winner].name} грає на ${state.declaredBid}`);
            }
            break;
        }

        case 'tPlayCard': {
            if (state.phase !== 'playing' || pidx !== state.currentPlayer) break;
            const { card } = data;
            const hidx = player.hand.indexOf(card);
            if (hidx === -1) break;
            const trick = state.trick;

            if (trick.cards.length > 0) {
                const leadSuit = tSuit(trick.cards[0].card);
                const cardSuit = tSuit(card);
                const hasSuit  = player.hand.some(c => tSuit(c) === leadSuit);
                if (cardSuit !== leadSuit && hasSuit) break;
            }

            if (trick.cards.length === 0) {
                const rank = tRank(card);
                const suit = tSuit(card);
                if (rank === 'Q' || rank === 'K') {
                    const partner = rank === 'Q' ? `K${suit}` : `Q${suit}`;
                    const alreadyDeclared = state.marriages[pidx]?.includes(suit);
                    const trumpBlocks = state.trump && state.trump !== suit;
                    if (player.hand.includes(partner) && !alreadyDeclared && !trumpBlocks) {
                        if (!state.marriages[pidx]) state.marriages[pidx] = [];
                        state.marriages[pidx].push(suit);
                        if (!state.trump) state.trump = suit;
                        state.log.unshift(`💍 ${player.name} оголошує ${suit} (+${T_MARRIAGE[suit]})`);
                    }
                }
            }

            player.hand.splice(hidx, 1);
            trick.cards.push({ playerId: pidx, card });

            if (trick.cards.length === n) {
                const winnerId = tDetermineWinner(trick.cards, state.trump);
                const pts = trick.cards.reduce((s,c) => s + tPts(c.card), 0);
                state.players[winnerId].trickPts += pts;
                state.log.unshift(`🃏 ${state.players[winnerId].name} бере (+${pts})`);
                state.lastTrickWinner = winnerId;
                const completedCards = [...trick.cards];

                if (state.players[0].hand.length === 0) {
                    return tFinishRound(state);
                }
                state.trick = { cards: [], leader: winnerId };
                state.currentPlayer = winnerId;
                return { event: 'trickComplete', cards: completedCards, winnerId, pts };
            } else {
                state.currentPlayer = (pidx + 1) % n;
            }
            break;
        }

        case 'tSetBid': {
            if (state.phase !== 'talon' || pidx !== state.auction.winner) break;
            if (state.talonPiles) break;
            const amt = parseInt(data.amount) || 0;
            const minBid = Math.max(state.auction.current, state.declaredBid || 0);
            if (amt < minBid || amt % 10 !== 0) break;
            state.declaredBid = amt;
            state.log.unshift(`📢 ${player.name} підвищує до ${amt}`);
            break;
        }
    }
    return null;
}

function tDetermineWinner(cards, trump) {
    const leadSuit = tSuit(cards[0].card);
    let best = cards[0];
    for (let i = 1; i < cards.length; i++) {
        const c = cards[i];
        const cs = tSuit(c.card), bs = tSuit(best.card);
        if (trump && cs === trump && bs !== trump) { best = c; continue; }
        if (cs === bs && tRankN(c.card) > tRankN(best.card)) best = c;
    }
    return best.playerId;
}

function tFinishRound(state) {
    const n = state.players.length;
    const bidder = state.auction.winner;

    if (state.leftoverPile?.length && state.lastTrickWinner !== null) {
        const pts = state.leftoverPile.reduce((s, c) => s + tPts(c), 0);
        state.players[state.lastTrickWinner].trickPts += pts;
        if (pts > 0) {
            addLog(state, `🃏 ${state.players[state.lastTrickWinner].name} отримує нерозкритий прикуп зі столу (+${pts})`);
        }
    }

    Object.entries(state.marriages).forEach(([pid, suits]) => {
        const p = state.players[+pid];
        if (p.onBarrel) {
            state.log.unshift(`🛢️ ${p.name} на бочці — шлюб не рахується`);
        } else {
            suits.forEach(s => { p.trickPts += T_MARRIAGE[s]; });
        }
    });
    const bid = state.declaredBid || state.auction.current;
    const roundResults = [];
    state.players.forEach((p, i) => {
        const rnd = Math.floor(p.trickPts / 10) * 10;
        let delta;
        if (i === bidder) {
            if (p.trickPts >= bid) {
                delta = bid;
                state.log.unshift(`✅ ${p.name}: набрав ${p.trickPts} ≥ ${bid}, +${bid}`);
            } else {
                delta = -bid;
                state.log.unshift(`❌ ${p.name}: набрав ${p.trickPts} < ${bid}, −${bid}`);
            }
        } else {
            delta = rnd;
            state.log.unshift(`${p.name}: +${rnd}`);
        }
        p.score += delta;
        roundResults.push({
            id: p.id, name: p.name, trickPts: p.trickPts,
            delta, score: p.score,
            isBidder: i === bidder, bid: i === bidder ? bid : null,
            success: i === bidder ? p.trickPts >= bid : null,
        });
    });

    state.players.forEach((p) => {
        if (p.onBarrel) {
            const succeeded = (p.score >= 1000);
            if (!succeeded) {
                p.barrelAttempts++;
                if (p.barrelAttempts >= 3) {
                    addLog(state, `💣 ${p.name}: 3 спроби на бочці — рахунок скидається до 800`, 'error');
                    p.score = 800;
                    p.onBarrel = false;
                    p.barrelAttempts = 0;
                } else {
                    addLog(state, `🛢️ ${p.name}: спроба ${p.barrelAttempts}/3 не вдалась`, 'warn');
                }
            }
        }
    });
    state.players.forEach(p => {
        if (!p.onBarrel && p.score >= 900 && p.score < 1000) {
            p.onBarrel = true;
            p.barrelAttempts = 0;
            addLog(state, `🛢️ ${p.name} на бочці! Потрібно набрати 100+ за 3 спроби`, 'warn');
        }
    });

    const winner = state.players.find(p => p.score >= 1000);
    if (winner) {
        state.phase = 'gameover';
        state.winner = winner.id;
        state.log.unshift(`🏆 ${winner.name} набрав(ла) 1000! Перемога!`);
        return { event: 'tGameOver', winner };
    }

    state.round++;
    state.dealer = (state.dealer + 1) % n;
    const cpp = n === 2 ? 10 : 7;
    const deck = createTDeck();
    state.players.forEach((p, i) => {
        p.hand = deck.slice(i * cpp, (i + 1) * cpp);
        p.trickPts = 0;
    });
    state.talon = deck.slice(cpp * n);
    state.phase = 'auction';
    state.currentPlayer = (state.dealer + 1) % n;
    state.auction = { current: 100, passed: Array(n).fill(false), winner: null };
    state.trick = { cards: [], leader: (state.dealer + 1) % n };
    state.trump = null; state.declaredBid = null;
    state.marriages = {}; state.givenCards = [];
    state.talonPiles = null; state.leftoverPile = null; state.lastTrickWinner = null;
    return { event: 'roundResult', results: roundResults };
}

function sanitizeTysyacha(state, forIdx) {
    return {
        gameType: 'tysyacha',
        players: state.players.map((p, i) => ({
            id: p.id, name: p.name, score: p.score, trickPts: p.trickPts,
            handCount: p.hand.length,
            hand: i === forIdx ? p.hand : null,
            onBarrel: p.onBarrel || false,
            barrelAttempts: p.barrelAttempts || 0,
            avatarId: p.avatarId || null,
            avatarColor: p.avatarColor || '#1a56db',
        })),
        talonCount: state.talonPiles
            ? state.talonPiles.reduce((s, p) => s + p.length, 0)
            : state.talon.length,
        talonPiles: state.talonPiles ? state.talonPiles.map(p => p.length) : null,
        leftoverPileCount: state.leftoverPile?.length || 0,
        talon: null,
        myId: forIdx,
        dealer: state.dealer, round: state.round,
        phase: state.phase, currentPlayer: state.currentPlayer,
        auction: state.auction,
        trick: state.trick,
        trump: state.trump, declaredBid: state.declaredBid,
        marriages: state.marriages,
        givenCards: state.givenCards,
        log: state.log.slice(0, 30),
        winner: state.winner,
        turnDeadline: state.turnDeadline || null,
    };
}

function clearTysyachaTimer(room) {
    if (room.tysyachaTimer) { clearTimeout(room.tysyachaTimer); room.tysyachaTimer = null; }
}

function startTysyachaTimer(room) {
    clearTysyachaTimer(room);
    const state = room.state;
    if (!room.started || !state || state.phase === 'gameover') return;
    state.turnDeadline = Date.now() + 60 * 1000;
    room.tysyachaTimer = setTimeout(() => {
        if (!room.started || !room.state) return;
        const st = room.state;
        if (st.phase === 'gameover') return;
        const pidx = st.currentPlayer;
        const player = st.players[pidx];
        if (!player) return;

        let result = null;
        if (st.phase === 'auction') {
            if (player.onBarrel) result = processTysyachaAction(st, 'tBid', { amount: st.auction.current + 10 }, pidx);
            else                 result = processTysyachaAction(st, 'tBid', { pass: true }, pidx);
        } else if (st.phase === 'talon') {
            if (st.talonPiles) {
                result = processTysyachaAction(st, 'tChoosePile', { pileIdx: 0 }, pidx);
            } else {
                const ungiven = st.players.map((_,i)=>i).filter(i=>i!==pidx && st.givenCards.filter(g=>g===i).length===0)[0];
                if (ungiven !== undefined && player.hand.length)
                    result = processTysyachaAction(st, 'tGiveCard', { card: player.hand[0], toPlayer: ungiven }, pidx);
                else if (!st.declaredBid)
                    result = processTysyachaAction(st, 'tSetBid', { amount: st.auction.current }, pidx);
            }
        } else if (st.phase === 'playing') {
            const leadSuit = st.trick?.cards?.length ? st.trick.cards[0].card.slice(-1) : null;
            const card = leadSuit ? (player.hand.find(c=>c.endsWith(leadSuit)) || player.hand[0]) : player.hand[0];
            if (card) result = processTysyachaAction(st, 'tPlayCard', { card, marriage: false }, pidx);
        }

        if (result?.event === 'tGameOver') {
            clearTysyachaTimer(room);
            room.players.forEach(rp => _io.to(rp.socketId).emit('gameOver', {
                winner: st.players[st.winner], state: sanitizeTysyacha(st, rp.index), gameType: 'tysyacha',
            }));
            return;
        }
        let toastText = `⏱️ Авто-хід: ${player.name}`;
        if (st.phase === 'auction') {
            toastText = player.onBarrel
                ? `⏱️ ${player.name} ставить ${st.auction.current + 10} (AFK)`
                : `⏱️ ${player.name} пасує (AFK)`;
        } else if (st.phase === 'talon') {
            toastText = st.talonPiles
                ? `⏱️ ${player.name} бере стопку 1 (AFK)`
                : `⏱️ ${player.name} роздає карту (AFK)`;
        }
        emitTysyachaUpdate(room, result, { text: toastText, color: '#e65100' });
        startTysyachaTimer(room);
    }, 60 * 1000);
}

function emitTysyachaUpdate(room, sideEffect, toast) {
    room.players.forEach(rp => {
        _io.to(rp.socketId).emit('stateUpdate', {
            state: sanitizeTysyacha(room.state, rp.index),
            sideEffect, toast: toast || null,
        });
    });
}

module.exports = {
    init,
    createTysyachaState,
    processTysyachaAction,
    sanitizeTysyacha,
    clearTysyachaTimer,
    startTysyachaTimer,
    emitTysyachaUpdate,
};
