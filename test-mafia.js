// ─────────────────────────────────────────────
// test-mafia.js — симулятор N гравців для Мафії
// Запуск: node test-mafia.js [кількість_гравців]
// ─────────────────────────────────────────────
const { io } = require('socket.io-client');

const N     = parseInt(process.argv[2]) || 5;
const URL   = 'http://localhost:3000';
const NAMES = ['Олег','Ірина','Максим','Катя','Дмитро','Наталя','Борис',
               'Оля','Тарас','Ліна','Влад','Соня','Денис','Аня','Роман'];

const roleMap    = {};   // botId → role (oracle рівень тесту)
const actedRound = {};   // socketId → round (не дублюємо дії)
let joinedCount  = 0;
let gameStarted  = false;

const log = (name, msg) => console.log(`[${name.padEnd(7)}] ${msg}`);

function makeBot(name, botIdx, isHost) {
    const s = io(URL);

    s.on('connect', () => {
        if (isHost) {
            s.emit('createRoom', { gameType: 'mafia', playerName: name }, (res) => {
                if (res.error) { console.error('createRoom error:', res.error); return; }
                global.roomCode = res.code;
                log(name, `🏠 Кімната: ${global.roomCode}`);
            });
        } else {
            const tryJoin = () => {
                if (!global.roomCode) { setTimeout(tryJoin, 150); return; }
                s.emit('joinRoom', { code: global.roomCode, playerName: name }, (res) => {
                    if (res.error) { console.error(`${name} joinRoom:`, res.error); return; }
                    joinedCount++;
                    log(name, `приєднався (${joinedCount}/${N-1})`);
                    if (joinedCount === N - 1 && !gameStarted) {
                        gameStarted = true;
                        setTimeout(startGame, 500);
                    }
                });
            };
            tryJoin();
        }
    });

    s.on('gameStarted', ({ state }) => {
        roleMap[state.myId] = state.myRole;
        log(name, `🎮 Роль: ${state.myRole}`);
        setTimeout(() => s.emit('action', { type: 'mafiaReady', data: {} }), 200 + Math.random() * 400);
    });

    s.on('stateUpdate', ({ state }) => {
        const me = state.players[state.myId];
        if (!me) return;

        // role_reveal → натискаємо готовий
        if (state.phase === 'role_reveal') {
            s.emit('action', { type: 'mafiaReady', data: {} });
            return;
        }

        // Ніч — діємо тільки ОДИН РАЗ за раунд
        if (state.phase === 'night' && me.isAlive) {
            const key = `${s.id}_night_${state.round}`;
            if (actedRound[key]) return;
            actedRound[key] = true;

            const others = state.players.filter(p => p.isAlive && p.id !== state.myId);
            if (!others.length) return;

            const delay = 500 + Math.random() * 1500;
            setTimeout(() => {
                const role = me.role || roleMap[state.myId];

                // Маньяк: б'є мафію першочергово (oracle)
                if (role === 'maniac') {
                    const mafiaTargets = others.filter(p => ['mafia','don'].includes(roleMap[p.id]));
                    const pick = mafiaTargets.length
                        ? mafiaTargets[Math.floor(Math.random() * mafiaTargets.length)]
                        : others[Math.floor(Math.random() * others.length)];
                    s.emit('action', { type: 'maniacKill', data: { targetId: pick.id } });
                    log(name, `🔪 б'є ${pick.name}(${roleMap[pick.id]||'?'})`);
                    return;
                }

                // Мафія/Дон: б'ють тільки мирних (не маньяка)
                if (role === 'mafia' || role === 'don') {
                    const townOnly = others.filter(p => !['mafia','don','maniac'].includes(roleMap[p.id]));
                    const pick = townOnly.length
                        ? townOnly[Math.floor(Math.random() * townOnly.length)]
                        : others[Math.floor(Math.random() * others.length)];
                    s.emit('action', { type: 'mafiaVote', data: { targetId: pick.id } });
                    log(name, `🔫 б'є ${pick.name}`);
                    if (role === 'don') {
                        const other2 = others.find(p => p.id !== pick.id);
                        if (other2) s.emit('action', { type: 'donCheck', data: { targetId: other2.id } });
                    }
                    return;
                }

                if (role === 'sheriff' || role === 'deputy') {
                    const pick = others[Math.floor(Math.random() * others.length)];
                    s.emit('action', { type: 'sheriffCheck', data: { targetId: pick.id } });
                    return;
                }

                if (role === 'doctor') {
                    const all = state.players.filter(p => p.isAlive);
                    const pick = all[Math.floor(Math.random() * all.length)];
                    s.emit('action', { type: 'doctorHeal', data: { targetId: pick.id } });
                    return;
                }

                if (role === 'roleblocker') {
                    // Блокуємо рандом СЕРЕД МИРНИХ (не маньяка, не мафію)
                    const townOnly = others.filter(p => !['maniac'].includes(roleMap[p.id]));
                    const pick = townOnly.length ? townOnly[Math.floor(Math.random() * townOnly.length)] : others[0];
                    s.emit('action', { type: 'roleblockerBlock', data: { targetId: pick.id } });
                    return;
                }
            }, delay);
        }

        // День — голосування: всі skip (маньяк повинен дожити)
        if (state.phase === 'day_voting' && me.isAlive && !me.isSilenced) {
            const key = `${s.id}_vote_${state.round}`;
            if (actedRound[key]) return;
            actedRound[key] = true;
            setTimeout(() => {
                s.emit('action', { type: 'dayVote', data: { targetId: 'skip' } });
            }, 300 + Math.random() * 500);
        }

        if (state.phase === 'gameover') {
            log(name, `🏁 КІНЕЦЬ! переміг: ${state.winner}`);
        }
    });

    s.on('gameOver', ({ state }) => {
        const w = state?.winner;
        log(name, `🏁 GAMEOVER → ${w}`);
        if (w === 'maniac') console.log('\n🔪🔪🔪 МАНЬЯК ПЕРЕМІГ! 🔪🔪🔪\n');
        else if (w === 'town')  console.log('\n🏙️ Місто перемогло\n');
        else if (w === 'mafia') console.log('\n🔫 Мафія перемогла\n');
        setTimeout(() => s.disconnect(), 300);
    });

    s.on('error', msg => log(name, `⚠️ ${msg}`));
    return s;
}

function startGame() {
    log('SYS', `▶️ Запускаємо гру (${N} гравців)`);
    global.clients[0].emit('startGame', {
        settings: { nightDuration: 12, dayDuration: 8, voteDuration: 6 }
    });
}

console.log(`\n🔪 Тест Мафії: ${N} гравців (маньяк повинен перемогти)\n`);
global.roomCode = null;
global.clients  = [];

for (let i = 0; i < N; i++) {
    setTimeout(() => {
        global.clients.push(makeBot(NAMES[i] || `П${i+1}`, i, i === 0));
    }, i * 200);
}

setTimeout(() => {
    console.log('\n⏱️ Таймаут 10хв');
    global.clients.forEach(s => s.disconnect());
    process.exit(0);
}, 10 * 60 * 1000);
