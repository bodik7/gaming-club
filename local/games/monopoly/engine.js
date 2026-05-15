// ============================================
// МОНОПОЛІЯ УКРАЇНИ — engine.js
// Ігрова логіка: ходи, гроші, картки, аукціон, банкрутство
// (потребує змінні з board.js та функції з ui.js)
// ============================================

const SAVE_KEY = 'monopolia_save_v1';

function hasSavedGame() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        return data && Array.isArray(data.players) && data.players.length > 0;
    } catch { return false; }
}

function saveGame() {
    try {
        const data = {
            players, currentPlayerIndex, cellState,
            chanceDeck, excursionDeck,
            lastDiceRoll, doublesCount, hasRolled,
            ts: Date.now()
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('Не вдалось зберегти гру:', e);
    }
}

function loadGame() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        players = data.players;
        currentPlayerIndex = data.currentPlayerIndex || 0;
        cellState = data.cellState || {};
        chanceDeck = data.chanceDeck || [];
        excursionDeck = data.excursionDeck || [];
        lastDiceRoll = data.lastDiceRoll || [0, 0];
        doublesCount = data.doublesCount || 0;
        hasRolled = false; // після відновлення гравець може кидати знову
        // міграція старих збережень
        players.forEach(p => {
            if (!p.stats) p.stats = { rentPaid: 0, rentReceived: 0, housesBuilt: 0, hotelsBuilt: 0, taxesPaid: 0, cardsTotal: 0 };
            if (p.loan === undefined) p.loan = 0;
            if (p.loanInterest === undefined) p.loanInterest = 0;
        });
        return true;
    } catch (e) {
        console.error('Помилка завантаження:', e);
        return false;
    }
}

function clearSavedGame() {
    try { localStorage.removeItem(SAVE_KEY); } catch {}
}

function refreshAllCells() {
    Object.keys(cellState).forEach(pos => updateBoardCell(parseInt(pos)));
}

// ============================================
// ХІД, КУБИКИ, РУХ
// ============================================
function rollDice() {
    if (hasRolled) {
        log('Ви вже кинули кубики цього ходу', 'warn');
        return;
    }
    // ВАЖЛИВО: блокуємо повторні кліки одразу, до setTimeout
    hasRolled = true;
    const rollBtn = document.getElementById('roll-btn');
    rollBtn.disabled = true;

    playSound('dice');
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    lastDiceRoll = [d1, d2];

    const die1 = document.getElementById('die1');
    const die2 = document.getElementById('die2');
    die1.classList.remove('rolling');
    die2.classList.remove('rolling');
    void die1.offsetWidth; // restart animation
    die1.classList.add('rolling');
    die2.classList.add('rolling');

    setTimeout(() => {
        die1.innerText = d1;
        die2.innerText = d2;
    }, 300);

    setTimeout(() => {
        rollBtn.disabled = false;
        const player = players[currentPlayerIndex];
        const total = d1 + d2;
        const isDouble = d1 === d2;

        log(`🎲 ${player.name} кинув(ла) ${d1} + ${d2} = ${total}${isDouble ? ' (дубль!)' : ''}`);

        if (player.inJail) {
            handleJailRoll(player, d1, d2);
            return;
        }

        if (isDouble && doublesCount + 1 < 3) {
            doublesCount++;
            // Дубль — після завершення руху гравець кине знову.
            // hasRolled буде тимчасово скинуто у showEndTurnBtn, щоб з'явилась кнопка "Кинути".
        } else if (isDouble) {
            // 3-й дубль поспіль — у в'язницю
            doublesCount++;
            log(`🚔 Три дублі поспіль! ${player.name} вирушає до В'ЯЗНИЦІ`, 'warn');
            goToJail(player);
            showEndTurnBtn();
            return;
        }
        // Якщо не дубль — hasRolled залишається true, далі буде "Завершити хід"

        movePlayerSteps(player, total);
    }, 700);
}

function movePlayerSteps(player, steps) {
    const oldPos = player.position;
    const newPos = (player.position + steps) % 40;
    if (oldPos + steps >= 40 && oldPos !== 0) {
        // Пройшли через СТАРТ
        addMoney(player, 200);
        log(`💰 ${player.name} пройшов(ла) через СТАРТ. +₴200`, 'success');
    }
    animateTokenTo(player, newPos);
}

function animateTokenTo(player, newPos) {
    // Плавна покрокова анімація — фішка ковзає від клітинки до клітинки
    const steps = (newPos - player.position + 40) % 40 || 1;
    let stepCount = 0;
    playSound('step');
    const intervalId = setInterval(() => {
        player.position = (player.position + 1) % 40;
        placeTokens();
        stepCount++;
        if (stepCount < steps) {
            playSound('step');
        } else {
            clearInterval(intervalId);
            // 300мс після прибуття — «пауза осмислення» перед попапом
            setTimeout(() => {
                renderPlayers();
                handleLanding(player);
            }, 300);
        }
    }, 270);
}

function handleLanding(player) {
    const cell = BOARD[player.position];
    log(`📍 ${player.name} зупинив(ла)ся на: ${cell.name}`);

    if (cell.type === 'property' || cell.type === 'railway' || cell.type === 'utility') {
        const state = cellState[cell.pos];
        // ВАЖЛИВО: state.owner === 0 — це валідний ID першого гравця.
        // Не можна писати if (!state.owner) — це б трактувало Гравця 1 як "нікого немає".
        if (state.owner === null || state.owner === undefined) {
            offerPurchase(player, cell);
        } else if (state.owner !== player.id && !state.mortgaged) {
            payRent(player, cell);
        } else if (state.owner === player.id) {
            log('  Це ваша власність', 'success');
            showEndTurnBtn();
        } else {
            log('  Ділянка заставлена — оренда не сплачується');
            showEndTurnBtn();
        }
    } else if (cell.type === 'tax') {
        takeMoney(player, cell.amount);
        player.stats.taxesPaid += cell.amount;
        const taxReasons = cell.pos === 4 ? [
            `🍺 ${player.name} сплачує податок за розпиття пива «Опілля» на вулицях Львова без дозволу міської ради. ₴${cell.amount}`,
            `🌿 Сусід поскаржився що трава у ${player.name} зеленіша ніж у нього. Введено податок на надмірну зеленість. ₴${cell.amount}`,
            `🐈 ${player.name} має трьох котів. Держава порахувала. Податок на щастя. ₴${cell.amount}`,
            `☀️ Податкова помітила що у ${player.name} надто гарний настрій для понеділка. Підозріло. ₴${cell.amount}`,
            `🥣 ${player.name} їв(ла) вівсянку на сніданок замість пшоняної каші. ДФС кваліфікує це як імпорт культури. ₴${cell.amount}`,
            `📸 ${player.name} зробив(ла) фото їжі в ресторані. Податок на блогерство. ₴${cell.amount}`,
            `🧦 ${player.name} носить різні шкарпетки. Митниця оцінила це як ввезення авангардної моди. ₴${cell.amount}`,
            `🌧️ ${player.name} поскаржив(ла)ся на погоду. Нараховано збір за незадоволення кліматом. ₴${cell.amount}`,
            `🏋️ ${player.name} записав(ла)ся до спортзалу в січні і кинув у лютому. Штраф за нереалізовані амбіції. ₴${cell.amount}`,
            `🐕 Собака ${player.name} гавкав о 6 ранку. Сусіди об'єднались. Колективний позов. ₴${cell.amount}`,
            `📝 ${player.name} надіслав(ла) листівку Азарову на день народження «суто з поваги». ДФС вивчила зв'язки. ₴${cell.amount}`,
            `🍯 ${player.name} відмовив(ла)ся від меду «від Ющенка» і замовив(ла) турецький. Пасічники зафіксували зраду. ₴${cell.amount}`,
            `🪅 ${player.name} купив(ла) матрьошку «для іронії». Митниця не зрозуміла іронії. Штраф. ₴${cell.amount}`,
            `🗣️ ${player.name} спробував(ла) відтворити вимову Азарова «для сміху». Записали на відео. Тепер це доказ. ₴${cell.amount}`,
            `🏚️ ${player.name} назвав(ла) «Межигір'я» просто «дачею». Оцінювачі нерухомості вимагають компенсацію за образу. ₴${cell.amount}`,
        ] : [
            `💎 ${player.name} придбав(ла) п'яту пару взуття цього місяця. Податок на розкіш активовано. ₴${cell.amount}`,
            `✈️ ${player.name} літав(ла) бізнес-класом і попросив додаткову подушку. Зафіксовано. Сплатіть ₴${cell.amount}`,
            `🧴 ${player.name} купив(ла) крем для обличчя дорожче ніж середня зарплата по країні. Розкішний податок. ₴${cell.amount}`,
            `🍾 На вечірці у ${player.name} відкрили шампанське у неділю до 18:00. Порушення гламурного кодексу. ₴${cell.amount}`,
            `🚗 ${player.name} помив(ла) машину, а наступного дня пішов(ла) дощ. Карма і податкова діють узгоджено. ₴${cell.amount}`,
            `🛥️ ${player.name} орендував(ла) яхту на годину і весь час говорив про це. Податок на хвастощі. ₴${cell.amount}`,
            `🥩 ${player.name} замовив(ла) стейк прожарки medium rare і залишив(ла) офіціанту коментар про прожарку. Штраф за гастрономічний снобізм. ₴${cell.amount}`,
            `🏌️ ${player.name} грав(ла) у гольф хоча ніхто не просив. Розкішний збір від заздрісних сусідів. ₴${cell.amount}`,
            `👜 ${player.name} купив(ла) брендову сумку і носить її тільки додому з магазину. Податок на невикористану розкіш. ₴${cell.amount}`,
            `🍣 ${player.name} їв(ла) суші паличками хоча виделка лежала поряд. Претензії від виделочного лобі. ₴${cell.amount}`,
            `🍯 ${player.name} замовив(ла) бочку меду «від Ющенка» і підписав(ла) як «інвестиція в демократію». Бухгалтер не погодився. ₴${cell.amount}`,
            `💇 ${player.name} найняв(ла) перукаря «зробити косу як у Тимошенко». Перукар взяв подвійний тариф. Коса розпалась через годину. ₴${cell.amount}`,
            `🥂 ${player.name} заборонив(ла) на вечірці будь-яку музику пов'язану з рашкою. DJ узяв доплату за «неповний репертуар». ₴${cell.amount}`,
            `🎸 ${player.name} пішов(ла) на концерт «легенди 90-х» — виявилось що «легенда» нещодавно виступала в окупованому Маріуполі. Репутаційний збиток. ₴${cell.amount}`,
        ];
        const reason = taxReasons[Math.floor(Math.random() * taxReasons.length)];
        log(`💸 ${reason}`, 'warn');
        playSound('coin');
        renderPlayers();
        saveGame();
        showTaxModal(cell, reason);
    } else if (cell.type === 'card') {
        flashCell(cell.pos, 'card');
        drawCard(player, cell.cardType);
    } else if (cell.type === 'casino') {
        showCasinoModal(player);
    } else if (cell.pos === 0) {
        showEndTurnBtn();
    } else if (cell.pos === 10) {
        showEndTurnBtn();
    } else if (cell.pos === 30) {
        const jailReasons = [
            `🎵 ${player.name} впіймали за прослуховуванням російської музики. До В'ЯЗНИЦІ!`,
            `🗣️ У Львові хтось почув, як ${player.name} хвалив(ла) Януковича. В'ЯЗНИЦЯ чекає!`,
            `🪆 На митниці у ${player.name} знайшли матрьошку. «Це сувенір» — не врятувало. В'ЯЗНИЦЯ!`,
            `📺 ${player.name} дивив(ла)ся «Кіно» замість «Слуги народу». Художній смак покараний. До В'ЯЗНИЦІ!`,
            `🥟 ${player.name} назвав(ла) вареники пельменями. Сусіди подали скаргу. В'ЯЗНИЦЯ!`,
            `🌊 ${player.name} сказав(ла) що Крим — «просто півострів». Вирушайте до В'ЯЗНИЦІ!`,
            `🚗 ${player.name} припаркував(ла)ся на місці для інвалідів біля магазину і пішов(ла) «на хвилинку». В'ЯЗНИЦЯ!`,
            `📱 ${player.name} надіслав(ла) голосове повідомлення на 10 хвилин замість того щоб зателефонувати. Злочин! В'ЯЗНИЦЯ!`,
            `🐈 ${player.name} не погладив(ла) сусідського кота. Кіт поскаржився особисто. В'ЯЗНИЦЯ!`,
            `🧂 ${player.name} посолив(ла) борщ до того як скуштував. Господиня не пробачила. До В'ЯЗНИЦІ!`,
            `🫖 ${player.name} заварив(ла) чай у мікрохвильовці. Британці написали ноту протесту. В'ЯЗНИЦЯ!`,
            `🤳 ${player.name} ліз(ла) на Потьомкінські сходи для сторіс і заважав усім. До В'ЯЗНИЦІ!`,
            `🌭 ${player.name} назвав(ла) хот-дог із Сільпо вечерею. Рідня дізналась. В'ЯЗНИЦЯ!`,
            `🦟 ${player.name} не вбив комара вночі і той розбудив весь будинок. Мешканці вирішили колегіально. До В'ЯЗНИЦІ!`,
            `🎻 ${player.name} сказав що Скрябін — це лише Андрій Кузьменко і не знав про гурт. Фани не пробачили. В'ЯЗНИЦЯ!`,
            `🗣️ ${player.name} процитував(ла) Азарова «украінска язик нєпрімітівна». Рідні зніяковіли. Філологи написали заяву. В'ЯЗНИЦЯ!`,
            `🏆 ${player.name} сказав(ла) що Янукович «непоганий менеджер». Майдан зачув. До В'ЯЗНИЦІ!`,
            `🍯 ${player.name} відмовився купити мед «від Ющенка» — «і так солодко живу». Пасічники образились колективно. В'ЯЗНИЦЯ!`,
            `💇 ${player.name} назвав косу Тимошенко «трохи пафосною». Коса подала позов особисто. До В'ЯЗНИЦІ!`,
            `📝 ${player.name} написав «Азаров» у тесті на знання прем'єрів як «видатний лінгвіст». Вчитель не оцінив. В'ЯЗНИЦЯ!`,
            `📺 ${player.name} сказав(ла) «ну не всі росіяни» саме коли прилетіла ракета. Неймовірний тайминг. В'ЯЗНИЦЯ!`,
            `🎸 ${player.name} поставив(ла) Z-виконавця на вечірці «бо ретро». Гості пішли. Посуд залишився. До В'ЯЗНИЦІ!`,
            `🌻 ${player.name} захищав(ла) Азарова — «ну він намагався вчити мову». Сам Азаров не намагався. В'ЯЗНИЦЯ!`,
            `🥊 ${player.name} сказав(ла) що у Януковича «непоганий смак» — маючи на увазі золоті унітази. Суд не зрозумів іронії. До В'ЯЗНИЦІ!`,
        ];
        const reason = jailReasons[Math.floor(Math.random() * jailReasons.length)];
        log(`👮 ${reason}`, 'warn');
        goToJail(player);
        showJailArrestModal(reason);
    } else {
        showEndTurnBtn();
    }
}

// ============================================
// ПРИДБАННЯ ТА ОРЕНДА
// ============================================
function buyProperty(player, cell) {
    takeMoney(player, cell.price);
    cellState[cell.pos].owner = player.id;
    player.properties.push(cell.pos);
    log(`🏆 ${player.name} придбав(ла) "${cell.name}" за ₴${cell.price}`, 'success');
    playSound('buy');
    flashCell(cell.pos, 'buy');
    renderPlayers();
    updateBoardCell(cell.pos);
    updateMonopolies();
    saveGame();
}

function payRent(player, cell) {
    const state = cellState[cell.pos];
    const owner = players[state.owner];
    const rent = calculateRent(cell, state, owner);

    if (rent > 0) {
        showRentModal(player, cell, rent, owner);
    } else {
        showEndTurnBtn();
    }
}

function calculateRent(cell, state, owner) {
    if (cell.type === 'property') {
        const houses = state.houses;
        // перевірка монополії (всі в групі належать одному гравцю)
        const sameGroup = BOARD.filter(c => c.type === 'property' && c.color === cell.color);
        const allSame = sameGroup.every(c => cellState[c.pos]?.owner === state.owner);
        let rent = cell.rent[houses];
        if (houses === 0 && allSame) rent *= 2; // подвійна оренда при монополії
        return rent;
    }
    if (cell.type === 'railway') {
        const ownedRailways = BOARD.filter(c => c.type === 'railway' && cellState[c.pos]?.owner === state.owner).length;
        const rentTable = [0, 25, 50, 100, 200];
        return rentTable[ownedRailways];
    }
    if (cell.type === 'utility') {
        const ownedUtils = BOARD.filter(c => c.type === 'utility' && cellState[c.pos]?.owner === state.owner).length;
        const total = lastDiceRoll[0] + lastDiceRoll[1];
        return ownedUtils === 1 ? total * 4 : total * 10;
    }
    return 0;
}

// ============================================
// В'ЯЗНИЦЯ
// ============================================
function goToJail(player) {
    player.position = 10;
    player.inJail = true;
    player.jailTurns = 0;
    hasRolled = true; // тюрма завжди завершує хід (жодних дублів)
    doublesCount = 0;
    playSound('jail');
    placeTokens();
    renderPlayers();
    saveGame();
}

function handleJailRoll(player, d1, d2) {
    // hasRolled вже встановлено в true у rollDice. Тут не робимо повторного кидка з тюрми.
    if (d1 === d2) {
        log(`🔓 ${player.name} викинув(ла) дубль і виходить з В'язниці!`, 'success');
        player.inJail = false;
        // НЕ збільшуємо doublesCount — дубль для виходу не рахується
        movePlayerSteps(player, d1 + d2);
    } else {
        player.jailTurns++;
        log(`🔒 ${player.name} залишається у В'язниці (хід ${player.jailTurns}/3)`, 'warn');
        if (player.jailTurns >= 3) {
            log(`Час вийшов! ${player.name} сплачує ₴50 і виходить.`, 'warn');
            takeMoney(player, 50);
            player.inJail = false;
            movePlayerSteps(player, d1 + d2);
        } else {
            showEndTurnBtn();
        }
    }
}

// ============================================
// КАРТКИ + ГРОШОВІ ДІЇ + РУХ
// ============================================
function drawCard(player, type) {
    const deck = type === 'chance' ? chanceDeck : excursionDeck;
    const cards = type === 'chance' ? CHANCE_CARDS : EXCURSION_CARDS;
    if (deck.length === 0) {
        // перетасувати наново
        for (let i = 0; i < cards.length; i++) deck.push(i);
        shuffleArray(deck);
    }
    const cardIdx = deck.shift();
    const card = cards[cardIdx];
    log(`🃏 ${player.name} взяв картку: "${card.text}"`, 'success');
    player.stats.cardsTotal++;
    playSound('card');
    const doCardAction = () => {
        closeModal();
        card.action(player);
        renderPlayers();
        placeTokens();
        if (!modalOpen()) showEndTurnBtn();
    };
    showModal({
        title: type === 'chance' ? '❓ ШАНС' : '🗺️ ЕКСКУРСІЯ',
        body: `<p style="font-size:18px;text-align:center;padding:20px 0">${card.text}</p>`,
        buttons: [
            { text: 'Ок', class: 'btn-primary', action: doCardAction }
        ],
        onClose: doCardAction
    });
    deck.push(cardIdx); // картку повертаємо донизу колоди
}

// ============================================
// КАЗИНО
// ============================================
function runCasinoBet(player, amount) {
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const sum = d1 + d2;
    const isDouble = d1 === d2;
    let result, delta;
    if (isDouble) {
        delta = amount * 3;
        result = `🎉 ДУБЛЬ ${d1}+${d2}! Виграш ×3 → +₴${delta}`;
        addMoney(player, delta);
    } else if (sum >= 8) {
        delta = amount * 2;
        result = `✅ ${d1}+${d2}=${sum} — виграш ×2 → +₴${delta}`;
        addMoney(player, delta);
    } else {
        delta = -amount;
        result = `❌ ${d1}+${d2}=${sum} — програш → -₴${amount}`;
        takeMoney(player, amount);
    }
    log(`🎰 ${player.name}: ставка ₴${amount}. ${result}`, isDouble || sum >= 8 ? 'success' : 'warn');
    renderPlayers();
    saveGame();
    showCasinoSpinModal();
    setTimeout(() => {
        showCasinoResult({ d1, d2, sum, isDouble, bet: amount, delta, result });
        setTimeout(() => { if (!modalOpen()) showEndTurnBtn(); }, 100);
    }, 1200);
}

// допоміжні дії карток
function addMoney(p, amt) { p.money += amt; }
function takeMoney(p, amt) {
    p.money -= amt;
    if (p.money < 0) {
        // спробувати закрити пасивно (в реальній грі тут аукціон)
        log(`⚠️ ${p.name} у мінусі!`, 'error');
    }
}
function payAllPlayers(p, amt) {
    players.forEach(other => {
        if (other.id !== p.id && !other.bankrupt) {
            takeMoney(p, amt);
            addMoney(other, amt);
        }
    });
}
function collectFromAll(p, amt) {
    players.forEach(other => {
        if (other.id !== p.id && !other.bankrupt) {
            takeMoney(other, amt);
            addMoney(p, amt);
        }
    });
}
function moveTo(p, pos) {
    if (pos < p.position) addMoney(p, 200); // пройшли СТАРТ
    p.position = pos;
    placeTokens();
    setTimeout(() => handleLanding(p), 400);
}
function moveToNearest(p, type) {
    let pos = p.position;
    while (true) {
        pos = (pos + 1) % 40;
        if (BOARD[pos].type === type) {
            moveTo(p, pos);
            return;
        }
    }
}


// ============================================
// БУДІВНИЦТВО, ЗАСТАВА
// ============================================
function buildHouse(pos) {
    const cell = BOARD[pos];
    const player = players[currentPlayerIndex];
    const s = cellState[pos];
    if (s.houses >= 5) return;
    if (player.money < cell.housePrice) return;
    takeMoney(player, cell.housePrice);
    s.houses++;
    if (s.houses === 5) player.stats.hotelsBuilt++;
    else player.stats.housesBuilt++;
    log(`🏠 ${player.name} побудував ${s.houses === 5 ? 'ГОТЕЛЬ' : 'будинок'} на "${cell.name}"`, 'success');
    playSound('buy');
    renderPlayers();
    updateBoardCell(pos);
    saveGame();
}
function sellHouse(pos) {
    const c = BOARD[pos];
    const s = cellState[pos];
    const player = players[currentPlayerIndex];
    if (s.houses === 0) return;
    s.houses--;
    addMoney(player, Math.floor(c.housePrice * 0.9));
    log(`🔻 ${player.name} продав будинок на "${c.name}" за ₴${Math.floor(c.housePrice * 0.9)}`, 'success');
    playSound('coin');
    renderPlayers();
    updateBoardCell(pos);
    saveGame();
}

function mortgage(pos) {
    const c = BOARD[pos];
    const s = cellState[pos];
    const player = players[currentPlayerIndex];
    s.mortgaged = true;
    addMoney(player, Math.floor(c.price / 2));
    log(`🏷️ ${player.name} заставив "${c.name}" за ₴${Math.floor(c.price/2)}`, 'success');
    playSound('coin');
    renderPlayers();
    updateBoardCell(pos);
    updateMonopolies();
    saveGame();
}

function redeem(pos) {
    const c = BOARD[pos];
    const s = cellState[pos];
    const player = players[currentPlayerIndex];
    const cost = Math.ceil(Math.floor(c.price / 2) * 1.1);
    if (player.money < cost) return;
    takeMoney(player, cost);
    s.mortgaged = false;
    log(`💸 ${player.name} викупив "${c.name}" за ₴${cost}`, 'success');
    playSound('buy');
    renderPlayers();
    updateBoardCell(pos);
    updateMonopolies();
    saveGame();
}


// ============================================
// АУКЦІОН (стартова логіка)
// ============================================
function startAuction(cell) {
    // Учасники в порядку ходів — від НАСТУПНОГО після того хто відмовився
    const eligible = [];
    const n = players.length;
    for (let i = 1; i < n; i++) {
        const p = players[(currentPlayerIndex + i) % n];
        if (!p.bankrupt) eligible.push(p.id);
    }
    if (eligible.length < 1) {
        log('Немає інших гравців для аукціону', 'warn');
        showEndTurnBtn();
        return;
    }
    auctionState = {
        cell,
        currentBid: Math.floor(cell.price / 2),
        currentBidder: null,
        active: eligible,
        turnIdx: 0,
        declinerId: players[currentPlayerIndex].id,
    };
    log(`🔨 ${players[currentPlayerIndex].name} відмовився — аукціон серед інших гравців`, 'warn');
    showAuctionUI();
}

// ============================================
// ТОРГ — логіка перевірки/виконання
// ============================================
function canTradeProperty(pos) {
    const c = BOARD[pos];
    if (!c) return false;
    const s = cellState[pos];
    if (!s) return false;
    if (s.houses > 0) return false;
    if (c.type === 'property') {
        const group = BOARD.filter(b => b.type === 'property' && b.color === c.color);
        if (group.some(b => (cellState[b.pos]?.houses || 0) > 0)) return false;
    }
    return true;
}
function executeTrade(me, target, fromProps, toProps, fromCash, toCash) {
    // Передача ділянок me → target
    fromProps.forEach(pos => {
        cellState[pos].owner = target.id;
        me.properties = me.properties.filter(p => p !== pos);
        if (!target.properties.includes(pos)) target.properties.push(pos);
        updateBoardCell(pos);
    });
    // Передача ділянок target → me
    toProps.forEach(pos => {
        cellState[pos].owner = me.id;
        target.properties = target.properties.filter(p => p !== pos);
        if (!me.properties.includes(pos)) me.properties.push(pos);
        updateBoardCell(pos);
    });
    // Готівка
    if (fromCash > 0) {
        takeMoney(me, fromCash);
        addMoney(target, fromCash);
    }
    if (toCash > 0) {
        takeMoney(target, toCash);
        addMoney(me, toCash);
    }
    const summary = [
        fromProps.length ? `${me.name} → ${target.name}: ${fromProps.length} ділянок` : null,
        toProps.length ? `${target.name} → ${me.name}: ${toProps.length} ділянок` : null,
        fromCash > 0 ? `${me.name} доплатив ₴${fromCash}` : null,
        toCash > 0 ? `${target.name} доплатив ₴${toCash}` : null
    ].filter(Boolean).join(', ');
    log(`🤝 Обмін відбувся: ${summary}`, 'success');
    playSound('coin');
    renderPlayers();
    updateMonopolies();
    saveGame();
}

// ============================================
// БАНКРУТСТВО, ПЕРЕМОЖЕЦЬ, КАПІТАЛ
// ============================================
function declareBankrupt(player, creditor, amount) {
    log(`💀 ${player.name} оголосив(ла) банкрутство!`, 'error');
    playSound('error');
    if (creditor) {
        addMoney(creditor, player.money);
        // передати власність кредитору (будинки скидаються)
        player.properties.forEach(pos => {
            cellState[pos].owner = creditor.id;
            cellState[pos].houses = 0;
            creditor.properties.push(pos);
            updateBoardCell(pos);
        });
    } else {
        // банк забирає
        player.properties.forEach(pos => {
            cellState[pos].owner = null;
            cellState[pos].houses = 0;
            cellState[pos].mortgaged = false;
            updateBoardCell(pos);
        });
    }
    player.properties = [];
    player.money = 0;
    player.bankrupt = true;
    renderPlayers();
    placeTokens();
    updateMonopolies();
    saveGame();

    const alive = players.filter(p => !p.bankrupt);
    if (alive.length === 1) {
        announceWinner(alive[0]);
    } else {
        endTurn();
    }
}
function calcNetWorth(player) {
    let total = player.money;
    player.properties.forEach(pos => {
        const c = BOARD[pos];
        const s = cellState[pos];
        if (!s.mortgaged) total += c.price;
        else total += Math.floor(c.price / 2);
        if (s.houses === 5) total += c.housePrice * 5;
        else total += s.houses * c.housePrice;
    });
    total -= (player.loan || 0) + (player.loanInterest || 0);
    return total;
}

// ============================================
// ЗАВЕРШЕННЯ ХОДУ
// ============================================
function endTurn() {
    if (endingTurn) return;
    endingTurn = true;
    const endBtn = document.getElementById('end-turn-btn');
    const rollBtn = document.getElementById('roll-btn');
    endBtn.disabled = true;
    rollBtn.disabled = true;

    setTimeout(() => {
        endingTurn = false;
        endBtn.disabled = false;
        rollBtn.disabled = false;

        const cur = players[currentPlayerIndex];
        if (!cur.bankrupt && lastDiceRoll[0] === lastDiceRoll[1] && doublesCount > 0 && doublesCount < 3 && !cur.inJail && cur.position !== 10) {
            // дубль — той самий гравець кидає ще раз
            log(`↻ Дубль! ${cur.name} ходить ще раз`, 'success');
            hasRolled = false;
            showEndTurnBtn();
            updateCurrentPlayerInfo();
            return;
        }
        // Зменшуємо лічильник кредиту поточного гравця
        const finishing = players[currentPlayerIndex];
        if (finishing.loan > 0 && finishing.loanTurnsLeft > 0) {
            finishing.loanTurnsLeft--;
        }

        doublesCount = 0;
        hasRolled = false;
        let _steps = 0;
        do {
            currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
            _steps++;
        } while (players[currentPlayerIndex].bankrupt && _steps < players.length);
        renderPlayers();
        updateCurrentPlayerInfo();
        showEndTurnBtn();

        // Перевіряємо кредит нового гравця
        const p = players[currentPlayerIndex];
        if (p.loan > 0 && p.loanTurnsLeft !== undefined) {
            if (p.loanTurnsLeft === 1) {
                setTimeout(() => showLoanWarningModal(p), 400);
            } else if (p.loanTurnsLeft <= 0) {
                setTimeout(() => showLoanDeadlineModal(p), 400);
                return;
            }
        }

        if (p.inJail) {
            offerJailOptions(p);
        }
        saveGame();
    }, 700);
}

// ============================================
// УТИЛІТИ
// ============================================
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}
