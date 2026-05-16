// test-mafia.js — node test-mafia.js [N]
const { io } = require('socket.io-client');
const N     = parseInt(process.argv[2]) || 5;
const URL   = 'http://localhost:3000';
const NAMES = ['Олег','Ірина','Максим','Катя','Дмитро','Наталя','Борис',
               'Оля','Тарас','Ліна','Влад','Соня','Денис','Аня','Роман'];

const roleMap = {};   // myId → role
const acted   = {};   // socketId+phase+round → true (один раз за раунд)
let joinedCount = 0, gameStarted = false;
const log = (n, m) => console.log(`[${n.padEnd(7)}] ${m}`);

function makeBot(name, isHost) {
    const s = io(URL, { transports: ['websocket'] });

    s.on('connect_error', e => { log(name, `connect_error: ${e.message}`); });

    s.on('connect', () => {
        if (isHost) {
            s.emit('createRoom', { gameType: 'mafia', playerName: name }, r => {
                if (r.error) return console.error('createRoom:', r.error);
                global.roomCode = r.code;
                log(name, `🏠 ${r.code}`);
            });
        } else {
            const j = () => {
                if (!global.roomCode) return setTimeout(j, 100);
                s.emit('joinRoom', { code: global.roomCode, playerName: name }, r => {
                    if (r.error) return console.error(`${name} join:`, r.error);
                    joinedCount++;
                    log(name, `joined (${joinedCount}/${N - 1})`);
                    if (joinedCount === N - 1 && !gameStarted) {
                        gameStarted = true;
                        setTimeout(() => {
                            log('SYS', `▶️ start (${N} players)`);
                            global.clients[0].emit('startGame', {
                                settings: { nightDuration: 15, dayDuration: 10, voteDuration: 8 }
                            });
                        }, 400);
                    }
                });
            };
            j();
        }
    });

    s.on('gameStarted', ({ state }) => {
        roleMap[state.myId] = state.myRole;
        log(name, `role=${state.myRole} id=${state.myId}`);
        setTimeout(() => s.emit('action', { type: 'mafiaReady', data: {} }), 200 + Math.random() * 300);
    });

    s.on('stateUpdate', ({ state, sideEffect }) => {
        const me = state.players[state.myId];
        if (!me) return;

        if (state.phase === 'role_reveal') {
            s.emit('action', { type: 'mafiaReady', data: {} });
            return;
        }

        if (state.phase === 'night' && me.isAlive) {
            const k = `${s.id}_n${state.round}`;
            if (acted[k]) return;
            acted[k] = true;

            const alive   = state.players.filter(p => p.isAlive);
            const others  = alive.filter(p => p.id !== state.myId);
            const role    = me.role || roleMap[state.myId];

            setTimeout(() => {
                switch (role) {
                    case 'mafia':
                    case 'don': {
                        // Б'ємо мирних (не мафію, не маньяка)
                        const targets = others.filter(p => !['mafia','don','maniac'].includes(roleMap[p.id]));
                        const t = targets[Math.floor(Math.random() * targets.length)] || others[0];
                        if (!t) break;
                        s.emit('action', { type: 'mafiaVote', data: { targetId: t.id } });
                        log(name, `🔫 → ${t.name}`);
                        if (role === 'don') {
                            // Дон перевіряє підозрілого
                            const chk = others.find(p => p.id !== t.id);
                            if (chk) s.emit('action', { type: 'donCheck', data: { targetId: chk.id } });
                        }
                        break;
                    }
                    case 'maniac': {
                        // Б'ємо мафію першочергово, потім мирних
                        const mafT = others.filter(p => ['mafia','don'].includes(roleMap[p.id]));
                        const t = (mafT.length ? mafT : others)[Math.floor(Math.random() * (mafT.length || others.length))];
                        if (!t) break;
                        s.emit('action', { type: 'maniacKill', data: { targetId: t.id } });
                        log(name, `🔪 → ${t.name}(${roleMap[t.id]})`);
                        break;
                    }
                    case 'sheriff':
                    case 'deputy': {
                        // Перевіряємо підозрілих (пріоритет — незнайомців)
                        const t = others[Math.floor(Math.random() * others.length)];
                        if (!t) break;
                        s.emit('action', { type: 'sheriffCheck', data: { targetId: t.id } });
                        log(name, `🔍 → ${t.name}`);
                        break;
                    }
                    case 'doctor': {
                        // Лікуємо себе або рандом живого
                        const t = alive[Math.floor(Math.random() * alive.length)];
                        s.emit('action', { type: 'doctorHeal', data: { targetId: t.id } });
                        log(name, `💊 → ${t.name}`);
                        break;
                    }
                    case 'roleblocker': {
                        // Блокуємо не-маньяка
                        const t = others.filter(p => roleMap[p.id] !== 'maniac')[0] || others[0];
                        if (!t) break;
                        s.emit('action', { type: 'roleblockerBlock', data: { targetId: t.id } });
                        log(name, `🚫 → ${t.name}`);
                        break;
                    }
                }
            }, 600 + Math.random() * 1200);
        }

        // Показуємо результат перевірки комісара вранці
        if (sideEffect?.event === 'sheriffResult') {
            log(name, `🔍 result: ${sideEffect.targetName} is ${sideEffect.isBad ? '🔴mafia' : '🟢town'}`);
        }

        if (state.phase === 'day_voting' && me.isAlive && !me.isSilenced) {
            const k = `${s.id}_v${state.round}`;
            if (acted[k]) return;
            acted[k] = true;

            // Якщо комісар знайшов мафію — голосуємо проти неї
            // Інакше — рандом або skip
            setTimeout(() => {
                const targets = state.players.filter(p => p.isAlive && p.id !== state.myId);
                // Проста логіка: 70% голосуємо проти когось, 30% skip
                if (Math.random() < 0.7 && targets.length) {
                    const t = targets[Math.floor(Math.random() * targets.length)];
                    s.emit('action', { type: 'dayVote', data: { targetId: t.id } });
                    log(name, `🗳️ → ${t.name}`);
                } else {
                    s.emit('action', { type: 'dayVote', data: { targetId: 'skip' } });
                    log(name, `⏭️ skip`);
                }
            }, 400 + Math.random() * 800);
        }

        if (state.phase === 'gameover') {
            log(name, `🏁 winner=${state.winner}`);
        }
    });

    s.on('gameOver', ({ state }) => {
        const w = state?.winner;
        console.log(`\n${'═'.repeat(40)}`);
        console.log(`  GAMEOVER → ${w?.toUpperCase()}`);
        if (w === 'maniac') console.log('  🔪 МАНЬЯК ПЕРЕМІГ!');
        if (w === 'town')   console.log('  🏙️  МІСТО ПЕРЕМОГЛО!');
        if (w === 'mafia')  console.log('  🔫 МАФІЯ ПЕРЕМОГЛА!');
        console.log('  Гравці:');
        state?.players?.forEach(p => {
            const alive = p.isAlive ? '✅' : '💀';
            console.log(`    ${alive} ${p.name.padEnd(8)} ${p.role}`);
        });
        console.log(`${'═'.repeat(40)}\n`);
        setTimeout(() => { global.clients.forEach(c => c.disconnect()); process.exit(0); }, 300);
    });

    s.on('mafiaChat', ({ name: n, text }) => log(name, `💬 [mafia] ${n}: ${text}`));
    s.on('error', m => log(name, `⚠️ ${m}`));
    return s;
}

console.log(`\n🔫 Мафія тест: ${N} гравців\n`);
global.roomCode = null;
global.clients  = [];

for (let i = 0; i < N; i++) {
    setTimeout(() => global.clients.push(makeBot(NAMES[i], i === 0)), i * 180);
}

// 2 хвилини — якщо не завершились, виводимо стан і виходимо
setTimeout(() => {
    console.log('\n⏱️  2хв таймаут — перевір сервер\n');
    global.clients.forEach(c => c.disconnect());
    process.exit(1);
}, 2 * 60 * 1000);
