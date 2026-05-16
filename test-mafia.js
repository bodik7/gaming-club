// ─────────────────────────────────────────────
// test-mafia.js — симулятор N гравців для Мафії
// Запуск: node test-mafia.js [кількість_гравців]
// Приклад: node test-mafia.js 7
// ─────────────────────────────────────────────
const { io } = require('socket.io-client');

const N      = parseInt(process.argv[2]) || 5;
const URL    = 'http://localhost:3000';
const NAMES  = ['Олег','Ірина','Максим','Катя','Дмитро','Наталя','Борис','Оля','Тарас','Ліна'];

const clients = [];
let roomCode  = null;

const log = (name, msg) => console.log(`[${name.padEnd(7)}] ${msg}`);

function connect(name, isHost) {
    const s = io(URL);

    s.on('connect', () => {
        log(name, `підключено`);
        if (isHost) {
            // Хост створює кімнату Мафія
            s.emit('createRoom', { gameType: 'mafia', playerName: name }, (res) => {
                if (res.error) { console.error('createRoom error:', res.error); return; }
                roomCode = res.code;
                log(name, `🏠 Кімната створена: ${roomCode}`);
                // Дочекатись поки всі підключаться, потім старт
                setTimeout(startGame, 2000);
            });
        } else {
            // Чекаємо поки хост отримає код
            const tryJoin = () => {
                if (!roomCode) { setTimeout(tryJoin, 300); return; }
                s.emit('joinRoom', { code: roomCode, playerName: name }, (res) => {
                    if (res.error) console.error(`${name} joinRoom:`, res.error);
                    else log(name, `приєднався до ${roomCode}`);
                });
            };
            tryJoin();
        }
    });

    s.on('gameStarted', ({ state }) => {
        const me = state.players[state.myId];
        log(name, `🎮 гра почалась! Роль: ${me?.role || '?'}`);
        // Одразу натискаємо "Готовий"
        setTimeout(() => s.emit('action', { type: 'mafiaReady', data: {} }), 500 + Math.random() * 1000);
    });

    s.on('stateUpdate', ({ state }) => {
        const me = state.players[state.myId];
        if (!me) return;

        if (state.phase === 'role_reveal') {
            s.emit('action', { type: 'mafiaReady', data: {} });
            return;
        }

        if (state.phase === 'night' && me.isAlive) {
            const others = state.players.filter(p => p.isAlive && p.id !== state.myId);
            if (!others.length) return;
            const target = others[Math.floor(Math.random() * others.length)];

            // Надсилаємо відповідну нічну дію залежно від ролі
            const delay = 3000 + Math.random() * 5000;
            setTimeout(() => {
                switch (me.role) {
                    case 'mafia':
                        s.emit('action', { type: 'mafiaVote', data: { targetId: target.id } });
                        log(name, `🔫 голосує вбити ${target.name}`);
                        break;
                    case 'don':
                        s.emit('action', { type: 'mafiaVote', data: { targetId: target.id } });
                        log(name, `👑 дон голосує вбити ${target.name}`);
                        break;
                    case 'sheriff':
                    case 'deputy':
                        s.emit('action', { type: 'sheriffCheck', data: { targetId: target.id } });
                        log(name, `🔍 перевіряє ${target.name}`);
                        break;
                    case 'doctor':
                        s.emit('action', { type: 'doctorHeal', data: { targetId: target.id } });
                        log(name, `💊 лікує ${target.name}`);
                        break;
                    case 'roleblocker':
                        s.emit('action', { type: 'roleblockerBlock', data: { targetId: target.id } });
                        log(name, `🚫 блокує ${target.name}`);
                        break;
                }
            }, delay);
        }

        if (state.phase === 'day_discussion' && me.isAlive && !me.isSilenced) {
            // Надсилаємо повідомлення в чат
            setTimeout(() => {
                s.emit('dayChatMsg', { text: `${name}: Я підозрюю мафію!` });
            }, 2000 + Math.random() * 3000);
        }

        if (state.phase === 'day_voting' && me.isAlive && !me.isSilenced) {
            const targets = state.players.filter(p => p.isAlive && p.id !== state.myId);
            if (!targets.length) return;
            const delay = 2000 + Math.random() * 8000;
            setTimeout(() => {
                if (Math.random() < 0.15) {
                    s.emit('action', { type: 'dayVote', data: { targetId: 'skip' } });
                    log(name, `⏭️ пропускає голосування`);
                } else {
                    const pick = targets[Math.floor(Math.random() * targets.length)];
                    s.emit('action', { type: 'dayVote', data: { targetId: pick.id } });
                    log(name, `🗳️ голосує проти ${pick.name}`);
                }
            }, delay);
        }

        if (state.phase === 'gameover') {
            log(name, `🏁 Кінець гри! Переможець: ${state.winner}`);
        }
    });

    s.on('gameOver', ({ state }) => {
        log(name, `🏁 GAMEOVER — перемогло: ${state?.winner}`);
        setTimeout(() => { s.disconnect(); }, 1000);
    });

    s.on('error', (msg) => log(name, `⚠️ помилка: ${msg}`));

    clients.push(s);
}

function startGame() {
    const host = clients[0];
    log('HOST', `▶️ запускаємо гру (${N} гравців)...`);
    host.emit('startGame', { settings: { nightDuration: 15, dayDuration: 20 } }, (res) => {
        if (res?.error) console.error('startGame error:', res.error);
    });
}

// Підключаємо гравців
console.log(`\n🔫 Тест Мафії: ${N} гравців\n`);
for (let i = 0; i < N; i++) {
    setTimeout(() => connect(NAMES[i] || `Гравець${i+1}`, i === 0), i * 200);
}

// Завершення через 5 хвилин (якщо гра не закінчилась)
setTimeout(() => {
    console.log('\n⏱️ Таймаут — зупиняємо тест');
    clients.forEach(s => s.disconnect());
    process.exit(0);
}, 5 * 60 * 1000);
