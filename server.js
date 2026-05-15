// ============================================
// МОНОПОЛІЯ УКРАЇНИ — server.js
// Node.js + Express + Socket.io
// ============================================
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// ── Кімнати: { [code]: Room } ───────────────
const rooms = {};

// ── Дані дошки (дублюємо тут, бо Node не бачить browser-globals) ──
const BOARD = [
    { pos: 0,  type: 'corner',   name: 'СТАРТ',                   icon: '➡️', desc: 'Отримайте ₴200' },
    { pos: 1,  type: 'property', name: 'Сумська',      city: 'Полтава',    color: '#8B4513', price: 60,  rent: [2,10,30,90,160,250],          housePrice: 50  },
    { pos: 2,  type: 'card',     name: 'Шанс',                    icon: '❓', cardType: 'chance' },
    { pos: 3,  type: 'property', name: 'Полтавська',   city: 'Полтава',    color: '#8B4513', price: 60,  rent: [4,20,60,180,320,450],          housePrice: 50  },
    { pos: 4,  type: 'tax',      name: 'Податкова',               icon: '💰', amount: 200 },
    { pos: 5,  type: 'railway',  name: 'Львівська залізниця',      icon: '🚂', price: 200 },
    { pos: 6,  type: 'property', name: 'Хортиця',      city: 'Запоріжжя', color: '#FFD700', price: 100, rent: [6,30,90,270,400,550],          housePrice: 50  },
    { pos: 7,  type: 'card',     name: 'Екскурсія',               icon: '🗺️', cardType: 'excursion' },
    { pos: 8,  type: 'property', name: 'Дніпрогес',    city: 'Запоріжжя', color: '#FFD700', price: 100, rent: [6,30,90,270,400,550],          housePrice: 50  },
    { pos: 9,  type: 'property', name: 'Соборний пр.', city: 'Запоріжжя', color: '#FFD700', price: 120, rent: [8,40,100,300,450,600],         housePrice: 50  },
    { pos: 10, type: 'corner',   name: "В'ЯЗНИЦЯ",                icon: '🔒', desc: 'У гостях' },
    { pos: 11, type: 'property', name: 'Дерибасівська',city: 'Одеса',     color: '#FF69B4', price: 140, rent: [10,50,150,450,625,750],        housePrice: 100 },
    { pos: 12, type: 'utility',  name: 'Одеський порт',            icon: '⚓', price: 150 },
    { pos: 13, type: 'property', name: 'Молдованка',   city: 'Одеса',     color: '#FF69B4', price: 140, rent: [10,50,150,450,625,750],        housePrice: 100 },
    { pos: 14, type: 'property', name: 'Аркадія',      city: 'Одеса',     color: '#FF69B4', price: 160, rent: [12,60,180,500,700,900],        housePrice: 100 },
    { pos: 15, type: 'railway',  name: 'Південно-Західна залізниця', icon: '🚂', price: 200 },
    { pos: 16, type: 'property', name: 'Сумська',      city: 'Харків',    color: '#FFA500', price: 180, rent: [14,70,200,550,750,950],        housePrice: 100 },
    { pos: 17, type: 'card',     name: 'Шанс',                    icon: '❓', cardType: 'chance' },
    { pos: 18, type: 'property', name: 'Університетська',   city: 'Харків',    color: '#FFA500', price: 180, rent: [14,70,200,550,750,950],        housePrice: 100 },
    { pos: 19, type: 'property', name: 'Дзеркальний струмінь', city: 'Харків', color: '#FFA500', price: 200, rent: [16,80,220,600,800,1000],  housePrice: 100 },
    { pos: 20, type: 'casino',   name: 'КАЗИНО',                      icon: '🎰', desc: 'Спробуй удачу!' },
    { pos: 21, type: 'property', name: 'Соборна площа',city: 'Дніпро',    color: '#FF0000', price: 220, rent: [18,90,250,700,875,1050],       housePrice: 150 },
    { pos: 22, type: 'card',     name: 'Екскурсія',               icon: '🗺️', cardType: 'excursion' },
    { pos: 23, type: 'property', name: 'Вул. Січеславська', city: 'Дніпро', color: '#FF0000', price: 220, rent: [18,90,250,700,875,1050],     housePrice: 150 },
    { pos: 24, type: 'property', name: 'Набережна',    city: 'Дніпро',    color: '#FF0000', price: 240, rent: [20,100,300,750,925,1100],      housePrice: 150 },
    { pos: 25, type: 'railway',  name: 'Дніпровська залізниця',    icon: '🚂', price: 200 },
    { pos: 26, type: 'property', name: 'Площа Ринок',  city: 'Львів',     color: '#87CEEB', price: 260, rent: [22,110,330,800,975,1150],      housePrice: 150 },
    { pos: 27, type: 'property', name: 'Личаківська',  city: 'Львів',     color: '#87CEEB', price: 260, rent: [22,110,330,800,975,1150],      housePrice: 150 },
    { pos: 28, type: 'utility',  name: 'Маріупольський порт',      icon: '⚓', price: 150 },
    { pos: 29, type: 'property', name: 'Сихівська',    city: 'Львів',     color: '#87CEEB', price: 280, rent: [24,120,360,850,1025,1200],     housePrice: 150 },
    { pos: 30, type: 'corner',   name: "ІТИ ДО В'ЯЗНИЦІ",         icon: '👮', desc: 'У тюрму!' },
    { pos: 31, type: 'property', name: 'Андріївський узвіз', city: 'Київ', color: '#008000', price: 300, rent: [26,130,390,900,1100,1275],    housePrice: 200 },
    { pos: 32, type: 'property', name: 'Поділ',        city: 'Київ',      color: '#008000', price: 300, rent: [26,130,390,900,1100,1275],     housePrice: 200 },
    { pos: 33, type: 'card',     name: 'Шанс',                    icon: '❓', cardType: 'chance' },
    { pos: 34, type: 'property', name: 'Печерськ',     city: 'Київ',      color: '#008000', price: 320, rent: [28,150,450,1000,1200,1400],    housePrice: 200 },
    { pos: 35, type: 'railway',  name: 'Аеропорт Бориспіль',       icon: '✈️', price: 200 },
    { pos: 36, type: 'card',     name: 'Шанс',                    icon: '❓', cardType: 'chance' },
    { pos: 37, type: 'property', name: 'Хрещатик',    city: 'Київ',      color: '#00008B', price: 350, rent: [35,175,500,1100,1300,1500],    housePrice: 200 },
    { pos: 38, type: 'tax',      name: 'Розкішний податок',        icon: '💎', amount: 100 },
    { pos: 39, type: 'property', name: 'Майдан Незалежності', city: 'Київ', color: '#00008B', price: 400, rent: [50,200,600,1400,1700,2000], housePrice: 200 },
];

const TOKEN_COLORS = ['#FF4136','#0074D9','#2ECC40','#FFDC00','#B10DC9','#FF851B','#39CFFF','#85144b'];
const TOKEN_ICONS  = ['🎩','🚗','🐕','🚀','🐎','👑','⚓','🎯'];

const CHANCE_CARDS = [
    { text: '🔄 ДАІ зупинила вас за «нестандартний» розворот посеред міста. Штраф — повернутись на СТАРТ. Зате отримайте ₴200 — на адвоката.',    action: 'goToStart' },
    { text: '💸 Укрпошта доставила посилку з жовтня — лише через 8 місяців. Всередині ₴50 від бабусі і записка «на морозиво». Отримайте ₴50.',  action: 'addMoney', amount: 50 },
    { text: '🔨 ЖЕК «відремонтував» під\'їзд — поклав нову плитку прямо поверх старої. Вона вже відвалилась. Сплатіть ₴75.',                     action: 'takeMoney', amount: 75 },
    { text: '🗳️ Вас обрали старостою будинку. Традиція є традиція — проставляєтесь. Сплатіть кожному гравцю ₴50.',                                action: 'payAll', amount: 50 },
    { text: '🎁 Знайшли 500 купонів 1991 року в матрасі. Антикварна крамниця дала ₴25. Це мистецтво. Отримайте ₴25.',                            action: 'addMoney', amount: 25 },
    { text: '🎵 Вас спіймали за спів «Кораблів» Скрябіна у переході метро. За авторські права. Сплатіть ₴15.',                                    action: 'takeMoney', amount: 15 },
    { text: '🪖 Поліція знайшла у вас «сувенір» — уламок снаряду який ви підняли на пам\'ять. Це кримінал. До В\'ЯЗНИЦІ!',                       action: 'goToJail' },
    { text: '☕ Вас покликали на «важливу зустріч» у Kyiv Coffee на Хрещатику. Там зараз весь бізнес України. Переходьте на Хрещатик.',            action: 'moveTo', pos: 37 },
    { text: '🚂 Укрзалізниця надіслала смс «Ваш поїзд прибув» — три дні тому. Але поїзд все ще їде. Переходьте до найближчої залізниці.',        action: 'nearestRailway' },
    { text: '📱 Ви знайшли номер прокурора з яким колись ділили маршрутку. Корисна людина. Це картка «Безкоштовно вийти з В\'язниці»!',           action: 'jailCard' },
    { text: '🌀 Ви повірили що «завтра буде краще» і зупинились чекати. Не зупиняйтесь. Поверніться на 3 клітинки назад.',                       action: 'moveBack', amount: 3 },
    { text: '📝 Податкова надіслала «роз\'яснення» на 47 сторінках дрібним шрифтом. Бухгалтер зламався. Сплатіть ₴50.',                          action: 'takeMoney', amount: 50 },
    { text: '🎰 Квиток «Лото-Забава» зіграв. Не мільйон — але ваш бухгалтер радий. Отримайте ₴100.',                                             action: 'addMoney', amount: 100 },
    { text: '🌻 Вас викликали на мітинг «за краще майбутнє». Безкоштовний автобус і бутерброди. Переходьте на Майдан Незалежності.',              action: 'moveTo', pos: 39 },
    { text: '💎 Американський дядько Петро з Детройту, якого ви ніколи не бачили, відписав вам ₴200. Бог є. Отримайте ₴200.',                    action: 'addMoney', amount: 200 },
    { text: '🔧 Ваша «Славута» вирішила відремонтуватись сама — прямо на КПП. Евакуатор, штраф, не той деталь. Сплатіть ₴100.',                  action: 'takeMoney', amount: 100 },
    { text: '🗣️ Азаров написав звернення до народу українською. Перекладач сплакав. Лінгвісти зафіксували 23 нових слова яких досі не існувало. Ви видали словник. Отримайте ₴75.', action: 'addMoney', amount: 75 },
    { text: '🍯 Ющенко запустив власний бренд меду після президентства. Рейтинг меду — 97%. Рейтинг президентства — 5,45%. Ви вчасно інвестували в мед. Отримайте ₴50.', action: 'addMoney', amount: 50 },
    { text: '🌀 Янукович перед втечею встиг підписати 27 указів на власну користь. Рекорд за швидкістю підписання. Ви документували для Гіннесса. Отримайте ₴75.', action: 'addMoney', amount: 75 },
    { text: '🚀 «Армата» зламалась на параді посеред Красної площі і її тягнули мотузкою. Ви продали права на документалку «Наддержава». Отримайте ₴100.',       action: 'addMoney', amount: 100 },
    { text: '💇 Страхова компанія застрахувала косу Тимошенко на ₴1,2 мільйона. Ви стали агентом і взяли відсоток. Отримайте ₴60.',                              action: 'addMoney', amount: 60 },
    { text: '🏟️ Мітинг «підтримки» — людей звезли автобусами з регіонів. Водій продав репортерам маршрутний лист. Ви видали книгу «Добровільно». Отримайте ₴80.', action: 'addMoney', amount: 80 },
    { text: '🦆 Слідчий знайшов у депутата качку із золотими кранами, яхту і три паспорти. Ви знімали документалку поруч. Ексклюзив. Отримайте ₴100.',           action: 'addMoney', amount: 100 },
    { text: '📺 Азаров у прямому ефірі сказав що «украінска язик нєпрімітівна». Лінгвісти налічили 11 помилок у цьому реченні. Мем розлетівся на весь світ. Ви автор. Отримайте ₴70.', action: 'addMoney', amount: 70 },
    { text: '🏋️ Янукович «загубив» ₴1,5 мільярда — цього разу за кордоном. Ви знайшли частину і здали волонтерам. Отримайте ₴90.',                             action: 'addMoney', amount: 90 },
    { text: '🧺 Тимошенко вийшла з в\'язниці і одразу пішла до перукаря — відновлювати косу. Перукар дав інтерв\'ю CNN. Ви продали права. Отримайте ₴55.',       action: 'addMoney', amount: 55 },
    { text: '🐝 Ющенко надіслав меду всім колишнім політичним опонентам на Різдво. Ніхто не відмовився. Ви посередник. Отримайте ₴65.',                          action: 'addMoney', amount: 65 },
];

const EXCURSION_CARDS = [
    { text: '🏝️ Тур «Острів козацької слави»! Гід розповідав про Запорізьку Січ 4 години без зупинки. Де ви — незрозуміло. Переходьте на Хортицю.',         action: 'moveTo', pos: 6 },
    { text: '🌊 «Перловий» тур в Одесу! Номер пахне морем і трохи рибою. Але вид шикарний. Переходьте на Дерибасівську.',                                     action: 'moveTo', pos: 11 },
    { text: '🏙️ Службове відрядження до Києва! Готель, добові, вечеря за рахунок «фірми». Переходьте на Хрещатик.',                                            action: 'moveTo', pos: 37 },
    { text: '🔄 Тур «Вся Україна за 10 днів» закінчився там де починався. Поверніться на СТАРТ. Отримайте ₴200 — моральна компенсація.',                      action: 'goToStart' },
    { text: '📸 Ви сфоткували «секретний об\'єкт» — насправді занедбана фабрика з 1970-х. СБУ не оцінила творчий підхід. До В\'ЯЗНИЦІ!',                      action: 'goToJail' },
    { text: '✈️ Рейс скасували. Авіакомпанія повернула гроші. Вперше в житті — без суду. Отримайте ₴100.',                                                     action: 'addMoney', amount: 100 },
    { text: '🌮 «Автентичний борщ» у туристичному ресторані за ₴800 виявився банкою консервів. Шлунок висловив незгоду. Лікарня. Сплатіть ₴100.',             action: 'takeMoney', amount: 100 },
    { text: '🤝 Місцевий депутат, якому ви допомогли перенести валізи, дав корисний папірець. Картка «Безкоштовно вийти з В\'язниці»!',                        action: 'jailCard' },
    { text: '🎂 Ви брехнули що у вас день народження щоб уникнути черги в ресторані. Всі гравці дізнались. Платять. Отримайте ₴10 від кожного.',              action: 'collectAll', amount: 10 },
    { text: '🔥 Залишили включеним праску в готелі. Господиня стримана, рахунок — ні. Сплатіть ₴50.',                                                          action: 'takeMoney', amount: 50 },
    { text: '📋 Податкова переплутала ваш ІПН з чиїмось і повернула «переплачений» ПДВ. Мовчіть. Отримайте ₴20.',                                             action: 'addMoney', amount: 20 },
    { text: '🌸 Ваша вишиванка перемогла в конкурсі «Найколоритніший турист». Видали ₴10 і грамоту. Грамота гарна. Отримайте ₴10.',                           action: 'addMoney', amount: 10 },
    { text: '🏡 З\'ясувалось що дідусева дача записана на вас ще з 1994 року. Продали сусіду. Отримайте ₴100.',                                                action: 'addMoney', amount: 100 },
    { text: '💊 «Морська кухня» на пляжі. Криветки виглядали свіжими. Виглядали. Сплатіть ₴100.',                                                             action: 'takeMoney', amount: 100 },
    { text: '🎓 Записались на «інтенсив з ораторського мистецтва» від відомого коуча. Він три години говорив про себе. Сплатіть ₴150.',                       action: 'takeMoney', amount: 150 },
    { text: '🐕 Повернули загублену собаку мера невеликого містечка. Він щедрий. Отримайте ₴25.',                                                              action: 'addMoney', amount: 25 },
    { text: '🌻 Тур до Маріуполя 2021-го — місто-красень, набережна, кафе. Фото досі в телефоні. Переходьте на СТАРТ — отримайте ₴200, поки ще можна йти куди хочеш.', action: 'goToStart' },
    { text: '🪖 Відвідали виставку «Докази» в Бучі. Після цього ваш погляд на «братній народ» змінився назавжди. Безкоштовно. Картка «Вийти з В\'ЯЗНИЦІ».',      action: 'jailCard' },
    { text: '📻 В маршрутці Харків–Дніпро водій 4 години крутив агітаційне радіо РФ. Суд визнав це «тортурами» — перший такий прецедент. Страхова сплатила. Отримайте ₴100.', action: 'addMoney', amount: 100 },
    { text: '🥁 Кліп «Армії Росії» на YouTube — 94% дизлайків за 8 хвилин, новий рекорд платформи. Ви зробили нарізку реакцій і монетизували. Отримайте ₴40.',  action: 'addMoney', amount: 40 },
    { text: '🔴 Гід показав Донецьк 2013-го — квіти, кафе, парки. Потім фото 2024-го. Тур «До і після». Сплатіть ₴50 за психотерапевта.',                        action: 'takeMoney', amount: 50 },
    { text: '📸 Ви сфоткували зруйнований міст «для пам\'яті». Волонтери помітили і найняли вас документалістом. Перша виплата. Отримайте ₴60.',                  action: 'addMoney', amount: 60 },
    { text: '🏕️ Тур «Карпатська Швейцарія» — дощ, бруд, хата без вікон, борщ шикарний. Повернулись іншою людиною. Отримайте ₴10 здачі від організатора.',         action: 'addMoney', amount: 10 },
    { text: '🍦 Тур «Одеські смаки» — морозиво, устриці, вино, сонце. Продовжили ще на тиждень. Але витратились. Сплатіть ₴60.',                                  action: 'takeMoney', amount: 60 },
    { text: '🐬 «Екотур в Акваторію» — дельфіни, морський бриз, і один з них вкрав вашу кепку. Страховка не передбачала дельфінів. Сплатіть ₴30.',               action: 'takeMoney', amount: 30 },
    { text: '🏰 Тур «Замки Заходу» — Луцьк, Меджибіж, Хотин. На третьому замку гід загубив групу. Ви очолили евакуацію і отримали чайові. Отримайте ₴45.',        action: 'addMoney', amount: 45 },
    { text: '🎭 Янукович тікав на яхті — але яхта була орендована і господар хотів назад. Ви знімали це для Netflix. Отримайте ₴80.',                              action: 'addMoney', amount: 80 },
];

// ── Утиліти ──────────────────────────────────
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function generateCode() {
    const cities = ['KYIV', 'LVIV', 'ODESA', 'KHARKIV', 'DNIPRO', 'ZAPORIZHZHIA'];
    let code;
    do {
        code = cities[Math.floor(Math.random() * cities.length)] + '-' + (Math.floor(Math.random() * 9000) + 1000);
    } while (rooms[code]);
    return code;
}

// ── Ініціалізація стану гри ───────────────────
function createGameState(roomPlayers) {
    const players = roomPlayers.map((rp, i) => ({
        id: i,
        socketId: rp.socketId,
        name: rp.name,
        color: TOKEN_COLORS[i],
        icon: TOKEN_ICONS[i],
        money: 1500,
        position: 0,
        properties: [],
        inJail: false,
        jailTurns: 0,
        hasJailCard: false,
        bankrupt: false,
        loan: 0,
        loanInterest: 0,
        loanTurnsLeft: 0,
        stats: { rentPaid: 0, rentReceived: 0, housesBuilt: 0, hotelsBuilt: 0, taxesPaid: 0, cardsTotal: 0 },
    }));

    const cellState = {};
    BOARD.forEach(c => {
        if (c.type === 'property' || c.type === 'railway' || c.type === 'utility') {
            cellState[c.pos] = { owner: null, houses: 0, mortgaged: false };
        }
    });

    return {
        players,
        cellState,
        currentPlayerIndex: 0,
        lastDiceRoll: [0, 0],
        doublesCount: 0,
        hasRolled: false,
        chanceDeck: shuffle(CHANCE_CARDS.map((_, i) => i)),
        excursionDeck: shuffle(EXCURSION_CARDS.map((_, i) => i)),
        auctionState: null,
        pendingTrade: null,
        log: [],
        pendingAction: null,
        pendingData: null,
        turnDeadline: null,
        tradeDeadline: null,
    };
}

// ── Логування ─────────────────────────────────
function addLog(state, text, type = '') {
    state.log.unshift({ text, type, ts: Date.now() });
    if (state.log.length > 40) state.log.pop();
}

// ── Ігрова логіка ─────────────────────────────

// Викликається після будь-якого вимушеного списання (податок, картка, в'язниця).
// Якщо гравець у мінусі і немає активів — оголошує банкрутство банку.
// Повертає true якщо настало банкрутство.
function checkForcedDebt(state, player) {
    if (player.money >= 0) return false;
    const netWorth = calcNetWorth(state, player);
    if (netWorth <= 0) {
        // Нічого продати — одразу банкрут
        addLog(state, `💀 ${player.name} не може покрити борг і оголошує банкрутство!`, 'error');
        player.properties.forEach(pos => {
            state.cellState[pos].owner = null;
            state.cellState[pos].houses = 0;
            state.cellState[pos].mortgaged = false;
        });
        player.money = 0;
        player.bankrupt = true;
        player.properties = [];
        state.pendingAction = null;
        state.pendingData = null;
        return true;
    }
    // Є активи — вимагаємо покрити борг (можна продати будинки / заставити)
    const shortfall = -player.money;
    addLog(state, `⚠️ ${player.name} у мінусі ₴${shortfall} — продайте майно або оголосіть банкрутство`, 'error');
    state.pendingAction = 'coverDebt';
    state.pendingData = { shortfall };
    return false;
}

function calcNetWorth(state, player) {
    let total = player.money;
    player.properties.forEach(pos => {
        const c = BOARD[pos];
        const s = state.cellState[pos];
        total += s.mortgaged ? Math.floor(c.price / 2) : c.price;
        total += s.houses === 5 ? c.housePrice * 5 : s.houses * c.housePrice;
    });
    total -= (player.loan || 0) + (player.loanInterest || 0);
    return total;
}

function calculateRent(state, cell) {
    const s = state.cellState[cell.pos];
    const owner = state.players[s.owner];
    if (cell.type === 'property') {
        const group = BOARD.filter(b => b.type === 'property' && b.color === cell.color);
        const allSame = group.every(b => state.cellState[b.pos]?.owner === s.owner);
        let rent = cell.rent[s.houses];
        if (s.houses === 0 && allSame) rent *= 2;
        return rent;
    }
    if (cell.type === 'railway') {
        const owned = BOARD.filter(b => b.type === 'railway' && state.cellState[b.pos]?.owner === s.owner).length;
        return [0, 25, 50, 100, 200][owned];
    }
    if (cell.type === 'utility') {
        const owned = BOARD.filter(b => b.type === 'utility' && state.cellState[b.pos]?.owner === s.owner).length;
        const total = state.lastDiceRoll[0] + state.lastDiceRoll[1];
        return owned === 1 ? total * 4 : total * 10;
    }
    return 0;
}

function goToJail(state, player) {
    player.position = 10;
    player.inJail = true;
    player.jailTurns = 0;
    state.hasRolled = true;
    state.doublesCount = 0;
}

function moveTo(state, player, pos) {
    if (pos < player.position) {
        player.money += 200;
        addLog(state, `💰 ${player.name} пройшов(ла) через СТАРТ. +₴200`, 'success');
    }
    player.position = pos;
}

function drawCard(state, player, type) {
    let deck = type === 'chance' ? state.chanceDeck : state.excursionDeck;
    const cards = type === 'chance' ? CHANCE_CARDS : EXCURSION_CARDS;
    if (deck.length === 0) {
        deck = shuffle(cards.map((_, i) => i));
        if (type === 'chance') state.chanceDeck = deck;
        else state.excursionDeck = deck;
    }
    const idx = deck.shift();
    const card = cards[idx];
    player.stats.cardsTotal++;
    addLog(state, `🃏 ${player.name}: ${card.text}`, 'success');

    let nextEffect = null;

    switch (card.action) {
        case 'addMoney':    player.money += card.amount; break;
        case 'takeMoney':
            player.money -= card.amount;
            checkForcedDebt(state, player);
            break;
        case 'goToStart':   moveTo(state, player, 0); break; // +200 вже в moveTo (прохід через СТАРТ)
        case 'goToJail':    goToJail(state, player); break;
        case 'jailCard':    player.hasJailCard = true; break;
        case 'moveTo':
            moveTo(state, player, card.pos);
            nextEffect = handleLanding(state, player);
            break;
        case 'moveBack':
            player.position = (player.position - card.amount + 40) % 40;
            nextEffect = handleLanding(state, player);
            break;
        case 'payAll': {
            const alive = state.players.filter(p => !p.bankrupt && p.id !== player.id);
            alive.forEach(p => {
                const pay = Math.min(card.amount, Math.max(0, player.money));
                player.money -= pay;
                p.money += pay;
            });
            break;
        }
        case 'collectAll': {
            const alive = state.players.filter(p => !p.bankrupt && p.id !== player.id);
            alive.forEach(p => {
                const pay = Math.min(card.amount, Math.max(0, p.money));
                p.money -= pay;
                player.money += pay;
            });
            break;
        }
        case 'nearestRailway': {
            const railways = BOARD.filter(b => b.type === 'railway').map(b => b.pos);
            const next = railways.find(p => p > player.position) || railways[0];
            moveTo(state, player, next);
            nextEffect = handleLanding(state, player);
            break;
        }
    }

    return { event: 'cardDrawn', cardType: type, text: card.text, nextEffect };
}

function handleLanding(state, player) {
    const cell = BOARD[player.position];
    if (!cell) return null;

    if (cell.type === 'property' || cell.type === 'railway' || cell.type === 'utility') {
        const s = state.cellState[cell.pos];
        if (s.owner === null || s.owner === undefined) {
            state.pendingAction = 'offerPurchase';
            state.pendingData = { pos: cell.pos };
            return { event: 'offerPurchase', cell };
        } else if (s.owner !== player.id && !s.mortgaged) {
            const rent = calculateRent(state, cell);
            if (rent > 0) {
                state.pendingAction = 'payRent';
                state.pendingData = { pos: cell.pos, rent, ownerId: s.owner };
                return { event: 'payRent', rent, owner: state.players[s.owner], cell };
            }
        }
    } else if (cell.type === 'tax') {
        player.money -= cell.amount;
        player.stats.taxesPaid += cell.amount;
        checkForcedDebt(state, player);
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
            `🪆 ${player.name} купив(ла) картину «нейтрального» художника — виявилось він підписував Z-листи. Повернути не можна. ₴${cell.amount}`,
            `🎸 ${player.name} пішов(ла) на концерт «легенди 90-х» — виявилось що «легенда» нещодавно виступала в окупованому Маріуполі. Репутаційний збиток. ₴${cell.amount}`,
        ];
        const taxReason = taxReasons[Math.floor(Math.random() * taxReasons.length)];
        addLog(state, `💸 ${taxReason}`, 'warn');
        return { event: 'tax', amount: cell.amount, cellPos: cell.pos, reason: taxReason };
    } else if (cell.type === 'card') {
        return drawCard(state, player, cell.cardType);
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
            `🦅 ${player.name} побачив(ла) Z на паркані і подумав що це «просто малюнок». Слідство вивчає мотив. В'ЯЗНИЦЯ!`,
            `🌻 ${player.name} захищав(ла) Азарова — «ну він намагався вчити мову». Сам Азаров не намагався. В'ЯЗНИЦЯ!`,
            `🥊 ${player.name} сказав(ла) що у Януковича «непоганий смак» — маючи на увазі золоті унітази. Суд не зрозумів іронії. До В'ЯЗНИЦІ!`,
        ];
        const jailReason = jailReasons[Math.floor(Math.random() * jailReasons.length)];
        goToJail(state, player);
        addLog(state, `👮 ${jailReason}`, 'warn');
        return { event: 'goToJail', reason: jailReason };
    } else if (cell.type === 'casino') {
        addLog(state, `🎰 ${player.name} зайшов(ла) до КАЗИНО — зроби ставку!`);
        state.pendingAction = 'casino';
        state.pendingData = { pos: 20 };
        return { event: 'casino', playerMoney: player.money };
    }
    return null;
}

function nextPlayer(state) {
    // Очищаємо будь-яку незавершену дію попереднього гравця
    // (наприклад, казино яке обійшли через прямий endTurn до фіксу)
    state.pendingAction = null;
    state.pendingData   = null;

    // зменшуємо лічильник кредиту поточного гравця
    const cur = state.players[state.currentPlayerIndex];
    if (cur.loan > 0 && cur.loanTurnsLeft > 0) cur.loanTurnsLeft--;

    state.doublesCount = 0;
    state.hasRolled = false;
    const totalPlayers = state.players.length;
    let steps = 0;
    do {
        state.currentPlayerIndex = (state.currentPlayerIndex + 1) % totalPlayers;
        if (++steps > totalPlayers) return null; // всі банкрути — гра вже завершена
    } while (state.players[state.currentPlayerIndex].bankrupt);

    // перевіряємо кредит нового гравця
    const next = state.players[state.currentPlayerIndex];

    // Jail перевіряємо першим — гравець у в'язниці може мати кредит, але основна дія — вийти
    if (next.inJail) return { event: 'inJail', player: next };

    if (next.loan > 0) {
        if (next.loanTurnsLeft === 1) return { event: 'loanWarning', player: next };
        if (next.loanTurnsLeft <= 0) {
            // Автоматично списуємо якщо є кошти, інакше — банкрутство
            const total = next.loan + next.loanInterest;
            if (next.money >= total) {
                next.money -= total;
                next.loan = 0;
                next.loanInterest = 0;
                next.loanTurnsLeft = 0;
                addLog(state, `🏦 Банк автоматично списав борг ₴${total} з ${next.name}`, 'warn');
            } else {
                return { event: 'loanDeadline', player: next };
            }
        }
    }
    return null;
}

function awardAuction(state, a) {
    const winner = state.players[a.currentBidder];
    if (winner.money < a.currentBid) {
        // Переможець не може сплатити — аукціон анулюється
        addLog(state, `💀 ${winner.name} не може сплатити аукціон ₴${a.currentBid} — скасовано`, 'error');
        state.auctionState = null;
        return;
    }
    winner.money -= a.currentBid;
    state.cellState[a.cell.pos].owner = a.currentBidder;
    winner.properties.push(a.cell.pos);
    addLog(state, `🔨 ${winner.name} виграв(ла) аукціон "${a.cell.name}" за ₴${a.currentBid}`, 'success');
    state.auctionState = null;
}

// ── Обробка дій від клієнта ───────────────────
function processAction(state, type, data, room) {
    const player = state.players[state.currentPlayerIndex];
    let sideEffect = null;

    switch (type) {

        case 'rollDice': {
            if (state.hasRolled) break;
            const d1 = Math.floor(Math.random() * 6) + 1;
            const d2 = Math.floor(Math.random() * 6) + 1;
            state.lastDiceRoll = [d1, d2];
            const isDouble = d1 === d2;
            if (isDouble) state.doublesCount++;
            else state.doublesCount = 0;

            addLog(state, `🎲 ${player.name} кинув(ла) ${d1}+${d2}=${d1+d2}${isDouble ? ' (дубль!)' : ''}`, '');

            if (player.inJail) {
                if (isDouble) {
                    player.inJail = false;
                    player.jailTurns = 0;
                    // Дубль з в'язниці не дає повторного ходу — це хід виходу
                    state.doublesCount = 0;
                    state.hasRolled = true;
                    addLog(state, `🔓 ${player.name} вийшов(ла) з В'язниці дублем!`, 'success');
                } else {
                    player.jailTurns++;
                    if (player.jailTurns >= 3) {
                        player.money -= 50;
                        player.inJail = false;
                        addLog(state, `💸 ${player.name} сплатив(ла) ₴50 і вийшов(ла) з В'язниці`, 'warn');
                        checkForcedDebt(state, player);
                    } else {
                        state.hasRolled = true;
                        addLog(state, `🔒 ${player.name} залишається у В'язниці (хід ${player.jailTurns}/3)`, 'warn');
                        break;
                    }
                }
            }

            if (state.doublesCount >= 3) {
                addLog(state, `👮 Три дублі поспіль — ${player.name} до В'ЯЗНИЦІ!`, 'warn');
                goToJail(state, player);
                break;
            }

            if (!isDouble) state.hasRolled = true;

            player.position = (player.position + d1 + d2) % 40;
            if (player.position < (player.position - d1 - d2 + 40) % 40 || (player.position === 0)) {
                // passed start — handled in moveTo; simpler check:
            }
            // check passing start
            const prevPos = ((player.position - d1 - d2) % 40 + 40) % 40;
            if (prevPos + d1 + d2 >= 40) {
                player.money += 200;
                addLog(state, `💰 ${player.name} пройшов(ла) через СТАРТ. +₴200`, 'success');
            }

            const landingPos = player.position; // позиція до обробки ефектів (В'язниця змінює на 10)
            addLog(state, `📍 ${player.name} зупинив(ла)ся на: ${BOARD[landingPos].name}`);
            sideEffect = handleLanding(state, player);
            if (sideEffect) sideEffect.landingPos = landingPos; // куди фізично потрапив токен
            break;
        }

        case 'buyProperty': {
            const { pos } = state.pendingData || {};
            const cell = BOARD[pos];
            if (!cell || state.cellState[pos].owner !== null) break;
            if (player.money < cell.price) break; // недостатньо коштів
            player.money -= cell.price;
            state.cellState[pos].owner = player.id;
            player.properties.push(pos);
            addLog(state, `🏆 ${player.name} придбав(ла) "${cell.name}" за ₴${cell.price}`, 'success');
            state._toast = { text: `🏠 ${player.name} купив ${cell.name} за ₴${cell.price}`, color: '#2e7d32' };
            state.pendingAction = null;
            state.pendingData = null;
            break;
        }

        case 'startAuction': {
            const { pos } = state.pendingData || {};
            const cell = BOARD[pos];
            // Учасники в порядку ходів — починаємо від НАСТУПНОГО після того хто відмовився
            const n = state.players.length;
            const eligible = [];
            for (let i = 1; i < n; i++) {
                const p = state.players[(state.currentPlayerIndex + i) % n];
                if (!p.bankrupt) eligible.push(p.id);
            }
            if (eligible.length < 1) { addLog(state, 'Немає учасників для аукціону', 'warn'); break; }
            state.auctionState = {
                cell,
                currentBid: Math.floor(cell.price / 2),
                currentBidder: null,
                active: eligible,
                turnIdx: 0,
                declinerId: player.id,
            };
            state.pendingAction = null;
            state.pendingData = null;
            addLog(state, `🔨 Аукціон на "${cell.name}" (старт ₴${state.auctionState.currentBid})`, 'warn');
            sideEffect = { event: 'auctionStarted' };
            break;
        }

        case 'auctionBid': {
            const a = state.auctionState;
            if (!a) break;
            const bidderId = a.active[a.turnIdx % a.active.length];
            const bidder = state.players[bidderId];
            const { bid } = data;
            if (bid < a.currentBid + 1 || bid > bidder.money) break;
            a.currentBid = bid;
            a.currentBidder = bidderId;
            a.turnIdx++;
            addLog(state, `💰 ${bidder.name} ставить ₴${bid}`);
            // Якщо ставник єдиний в active (решта вже пасували) — він виграє
            if (a.active.length === 1) {
                awardAuction(state, a);
            } else {
                sideEffect = { event: 'auctionUpdated' };
            }
            break;
        }

        case 'auctionPass': {
            const a = state.auctionState;
            if (!a) break;
            const bidderId = a.active[a.turnIdx % a.active.length];
            const bidder = state.players[bidderId];
            addLog(state, `⏭️ ${bidder.name} пасує`, 'warn');
            a.active = a.active.filter(id => id !== bidderId);

            if (a.active.length === 0) {
                addLog(state, 'Аукціон завершився без покупця', 'warn');
                state.auctionState = null;
            } else if (a.active.length === 1) {
                // Єдиний учасник — виграє навіть якщо не робив ставку (стартова ціна)
                if (a.currentBidder === null) a.currentBidder = a.active[0];
                awardAuction(state, a);
            } else {
                if (a.turnIdx >= a.active.length) a.turnIdx %= a.active.length;
                sideEffect = { event: 'auctionUpdated' };
            }
            break;
        }

        case 'payRent': {
            const { rent, ownerId } = state.pendingData || {};
            const owner = state.players[ownerId];
            if (player.money < rent) break;
            player.money -= rent;
            owner.money += rent;
            player.stats.rentPaid += rent;
            owner.stats.rentReceived += rent;
            addLog(state, `💰 ${player.name} сплатив(ла) оренду ₴${rent} → ${owner.name}`, 'warn');
            state._toast = { text: `💸 ${player.name} сплатив(ла) ₴${rent} → ${owner.name}`, color: '#1565c0' };
            state.pendingAction = null;
            state.pendingData = null;
            break;
        }

        case 'declareBankrupt': {
            const creditorId = state.pendingData?.ownerId ?? null;
            const creditor = creditorId !== null ? state.players[creditorId] : null;
            addLog(state, `💀 ${player.name} оголосив(ла) банкрутство!`, 'error');
            if (creditor) {
                creditor.money += player.money;
                player.properties.forEach(pos => {
                    state.cellState[pos].owner = creditor.id;
                    state.cellState[pos].houses = 0; // скидаємо будинки при передачі
                    creditor.properties.push(pos);
                });
            } else {
                player.properties.forEach(pos => {
                    state.cellState[pos].owner = null;
                    state.cellState[pos].houses = 0;
                    state.cellState[pos].mortgaged = false;
                });
            }
            player.money = 0;
            player.bankrupt = true;
            player.properties = [];
            state.pendingAction = null;
            state.pendingData = null;
            break;
        }

        case 'buildHouse': {
            const { pos } = data;
            const cell = BOARD[pos];
            const s = state.cellState[pos];
            if (!s || s.owner !== player.id) break;
            if (s.houses >= 5 || player.money < cell.housePrice) break;
            const group = BOARD.filter(b => b.type === 'property' && b.color === cell.color);
            const allOwned = group.every(b => state.cellState[b.pos].owner === player.id && !state.cellState[b.pos].mortgaged);
            const minH = Math.min(...group.map(b => state.cellState[b.pos].houses));
            if (!allOwned || s.houses !== minH) break;
            player.money -= cell.housePrice;
            s.houses++;
            if (s.houses === 5) player.stats.hotelsBuilt++;
            else player.stats.housesBuilt++;
            addLog(state, `🏠 ${player.name} збудував(ла) ${s.houses === 5 ? 'готель' : 'будинок'} на "${cell.name}"`, 'success');
            break;
        }

        case 'sellHouse': {
            const { pos } = data;
            const cell = BOARD[pos];
            const s = state.cellState[pos];
            if (!s || s.owner !== player.id) break;
            if (s.houses === 0) break;
            const group = BOARD.filter(b => b.type === 'property' && b.color === cell.color);
            const maxH = Math.max(...group.map(b => state.cellState[b.pos].houses));
            if (s.houses !== maxH) break;
            s.houses--;
            player.money += Math.floor(cell.housePrice * 0.9);
            addLog(state, `🔻 ${player.name} продав(ла) будинок на "${cell.name}"`, 'success');
            break;
        }

        case 'mortgage': {
            const { pos } = data;
            const cell = BOARD[pos];
            const s = state.cellState[pos];
            if (!s || s.owner !== player.id) break;
            if (s.mortgaged || s.houses > 0) break;
            s.mortgaged = true;
            player.money += Math.floor(cell.price / 2);
            addLog(state, `🏷️ ${player.name} заставив(ла) "${cell.name}"`, 'warn');
            break;
        }

        case 'redeem': {
            const { pos } = data;
            const cell = BOARD[pos];
            const s = state.cellState[pos];
            if (!s || s.owner !== player.id) break;
            const cost = Math.ceil(Math.floor(cell.price / 2) * 1.1);
            if (!s.mortgaged || player.money < cost) break;
            s.mortgaged = false;
            player.money -= cost;
            addLog(state, `💸 ${player.name} викупив(ла) "${cell.name}" за ₴${cost}`, 'success');
            break;
        }

        case 'takeLoan': {
            const { amount } = data;
            if (player.loan > 0) break; // спочатку погаси діючий кредит
            const maxLoan = player.properties.reduce((acc, pos) => {
                return acc + (!state.cellState[pos].mortgaged ? Math.floor(BOARD[pos].price / 2) : 0);
            }, 0);
            if (maxLoan < 50) break; // без майна — кредит недоступний
            if (amount < 50 || amount > maxLoan) break;
            player.money += amount;
            player.loan += amount;
            player.loanInterest += Math.ceil(amount * 0.1);
            if (!player.loanTurnsLeft || player.loanTurnsLeft <= 0) player.loanTurnsLeft = 10;
            addLog(state, `🏦 ${player.name} взяв ₴${amount} кредиту (повернути за 10 ходів)`, 'success');
            break;
        }

        case 'repayLoan': {
            const total = player.loan + player.loanInterest;
            if (player.money < total) break;
            player.money -= total;
            player.loan = 0;
            player.loanInterest = 0;
            player.loanTurnsLeft = 0;
            addLog(state, `✅ ${player.name} повернув(ла) кредит ₴${total}`, 'success');
            break;
        }

        case 'jailPay': {
            if (player.money < 50) break;
            player.money -= 50;
            player.inJail = false;
            addLog(state, `💸 ${player.name} сплатив(ла) ₴50 і вийшов(ла) з В'язниці`, 'success');
            break;
        }

        case 'jailCard': {
            if (!player.hasJailCard || !player.inJail) break;
            player.hasJailCard = false;
            player.inJail = false;
            player.jailTurns = 0;
            addLog(state, `🔓 ${player.name} використав картку виходу з В'язниці`, 'success');
            break;
        }

        case 'casinoBet': {
            if (state.pendingAction !== 'casino') break;
            const bet = parseInt(data.amount) || 0;
            if (bet < 50 || bet > player.money) break;

            const d1 = Math.floor(Math.random() * 6) + 1;
            const d2 = Math.floor(Math.random() * 6) + 1;
            const sum = d1 + d2;
            const isDouble = d1 === d2;

            let result, delta;
            if (isDouble) {
                // Дубль → виграш 3x ставки
                delta  = bet * 3;
                result = `🎉 ДУБЛЬ ${d1}+${d2}! Виграш ×3 → +₴${delta}`;
                player.money += delta;
            } else if (sum >= 8) {
                // Сума ≥ 8 → виграш 2x ставки
                delta  = bet * 2;
                result = `✅ ${d1}+${d2}=${sum} — виграш ×2 → +₴${delta}`;
                player.money += delta;
            } else {
                // Сума ≤ 7 → програш
                delta  = -bet;
                result = `❌ ${d1}+${d2}=${sum} — програш → -₴${bet}`;
                player.money -= bet;
            }

            addLog(state, `🎰 ${player.name}: ставка ₴${bet}. ${result}`, isDouble ? 'success' : sum >= 8 ? 'success' : 'warn');
            state._toast = { text: `🎰 ${result}`, color: isDouble ? '#2e7d32' : sum >= 8 ? '#1565c0' : '#c62828' };
            state.pendingAction = null;
            state.pendingData = null;
            sideEffect = { event: 'casinoResult', d1, d2, sum, isDouble, bet, delta, result };
            break;
        }

        case 'casinoSkip': {
            if (state.pendingAction !== 'casino') break;
            addLog(state, `🎰 ${player.name} пройшов(ла) мимо казино`);
            state.pendingAction = null;
            state.pendingData = null;
            break;
        }

        case 'endTurn': {
            if (!state.hasRolled) break;
            if (state.pendingAction) break; // не можна завершити хід з невирішеною дією (оренда, казино, купівля)
            sideEffect = nextPlayer(state);
            break;
        }

        case 'offerTrade': {
            const { toIdx, offerMoney = 0, offerProps = [], requestMoney = 0, requestProps = [] } = data;
            if (toIdx < 0 || toIdx >= state.players.length) break;
            const to = state.players[toIdx];
            if (!to || to.bankrupt || toIdx === state.currentPlayerIndex) break;
            if (offerMoney > player.money || requestMoney > to.money) break;
            if (offerProps.some(pos => !player.properties.includes(pos))) break;
            if (requestProps.some(pos => !to.properties.includes(pos))) break;
            state.pendingTrade = { fromIdx: state.currentPlayerIndex, toIdx, offerMoney, offerProps, requestMoney, requestProps };
            addLog(state, `🤝 ${player.name} пропонує угоду до ${to.name}`);
            sideEffect = { event: 'tradeOffer', trade: state.pendingTrade };
            break;
        }

        case 'acceptTrade': {
            const trade = state.pendingTrade;
            if (!trade || data.callerIdx !== trade.toIdx) break;
            const from = state.players[trade.fromIdx];
            const to   = state.players[trade.toIdx];
            // Повторна перевірка: баланс міг змінитись між offerTrade і acceptTrade
            if (from.money < trade.offerMoney || to.money < trade.requestMoney) {
                addLog(state, `❌ Угоду скасовано — умови більше не діють (недостатньо коштів)`, 'error');
                state.pendingTrade = null;
                break;
            }
            from.money -= trade.offerMoney;  to.money   += trade.offerMoney;
            from.money += trade.requestMoney; to.money  -= trade.requestMoney;
            for (const pos of trade.offerProps) {
                from.properties = from.properties.filter(p => p !== pos);
                to.properties.push(pos);
                state.cellState[pos].owner = trade.toIdx;
            }
            for (const pos of trade.requestProps) {
                to.properties = to.properties.filter(p => p !== pos);
                from.properties.push(pos);
                state.cellState[pos].owner = trade.fromIdx;
            }
            addLog(state, `✅ ${from.name} і ${to.name} уклали угоду!`, 'success');
            state._toast = { text: `🤝 ${from.name} і ${to.name} обмінялись!`, color: '#1565c0' };
            state.pendingTrade = null;
            break;
        }

        case 'rejectTrade': {
            const trade = state.pendingTrade;
            if (!trade || data.callerIdx !== trade.toIdx) break;
            const from = state.players[trade.fromIdx];
            const to   = state.players[trade.toIdx];
            addLog(state, `❌ ${to.name} відхилив угоду від ${from.name}`, 'warn');
            state._toast = { text: `❌ ${to.name} відхилив угоду від ${from.name}`, color: '#c62828' };
            state.pendingTrade = null;
            break;
        }
    }

    return sideEffect;
}

// ════════════════════════════════════════════
// ТИСЯЧА — карткова гра
// ════════════════════════════════════════════
const T_SUITS   = ['♠','♣','♦','♥'];
const T_RANKS   = ['9','J','Q','K','10','A'];
const T_POINTS  = {'9':0,'J':2,'Q':3,'K':4,'10':10,'A':11};
const T_MARRIAGE= {'♠':40,'♣':60,'♦':80,'♥':100};
const T_RANK_ORD= ['9','J','Q','K','10','A'];

function tSuit(c) { return c.slice(-1); }
function tRank(c) { return c.slice(0,-1); }
function tPts(c)  { return T_POINTS[tRank(c)] || 0; }
function tRankN(c){ return T_RANK_ORD.indexOf(tRank(c)); }

function createTDeck() {
    return shuffle(T_SUITS.flatMap(s => T_RANKS.map(r => `${r}${s}`)));
}

function createTysyachaState(roomPlayers) {
    const n = roomPlayers.length;
    const cpp = n === 2 ? 10 : 7; // cards per player
    const deck = createTDeck();
    return {
        gameType: 'tysyacha',
        players: roomPlayers.map((rp, i) => ({
            id: i, name: rp.name,
            score: 0, hand: deck.slice(i*cpp, (i+1)*cpp), trickPts: 0,
        })),
        talon: deck.slice(cpp*n),
        dealer: 0, round: 1,
        phase: 'auction',
        currentPlayer: 1 % n,
        auction: { current: 100, passed: Array(n).fill(false), winner: null },
        trick: { cards: [], leader: 1 % n },
        trump: null, declaredBid: null,
        marriages: {}, givenCards: [],
        talonPiles: null,      // 2-player: [[c,c],[c,c]] до вибору
        leftoverPile: null,    // 2-player: нерозкрита стопка
        lastTrickWinner: null, // хто взяв останню взятку
        log: [], winner: null,
    };
}

function tAssignTalon(state, w) {
    if (state.players.length === 2) {
        // 2 гравці: розбиваємо на 2 стопки по 2 карти для вибору
        state.talonPiles = [state.talon.slice(0, 2), state.talon.slice(2, 4)];
    } else {
        // 3 гравці: переможець одразу бере всі 3 карти
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
                // Всі спасували — примусово перший гравець бере тялон
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
            if (state.talonPiles) break; // 2-player: спочатку треба вибрати стопку
            const { card, toPlayer } = data;
            if (toPlayer === pidx || toPlayer < 0 || toPlayer >= n) break;
            const idx = player.hand.indexOf(card);
            if (idx === -1) break;
            player.hand.splice(idx, 1);
            state.players[toPlayer].hand.push(card);
            state.givenCards.push(toPlayer);
            // Перевіряємо чи всі отримали по 1 картці
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
            const { card, marriage } = data;
            const hidx = player.hand.indexOf(card);
            if (hidx === -1) break;
            const trick = state.trick;

            // Валідація: масть (козир необов'язковий)
            if (trick.cards.length > 0) {
                const leadSuit = tSuit(trick.cards[0].card);
                const cardSuit = tSuit(card);
                const hasSuit  = player.hand.some(c => tSuit(c) === leadSuit);
                // Є масть — грай масть
                if (cardSuit !== leadSuit && hasSuit) break;
                // Якщо масті немає — будь-яка карта дозволена (козир необов'язковий)
            }

            // Шлюб (бракосочетання)
            if (marriage && trick.cards.length === 0) {
                const rank = tRank(card);
                const suit = tSuit(card);
                if (rank === 'Q' || rank === 'K') {
                    const partner = rank === 'Q' ? `K${suit}` : `Q${suit}`;
                    const alreadyDeclared = state.marriages[pidx]?.includes(suit);
                    // Шлюб іншої масті після встановлення козира — заборонений
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
                // Взятка завершена
                const winnerId = tDetermineWinner(trick.cards, state.trump);
                const pts = trick.cards.reduce((s,c) => s + tPts(c.card), 0);
                state.players[winnerId].trickPts += pts;
                state.log.unshift(`🃏 ${state.players[winnerId].name} бере (+${pts})`);
                state.lastTrickWinner = winnerId; // завжди оновлюємо — буде останній хто взяв
                const completedCards = [...trick.cards]; // зберігаємо ПЕРЕД очисткою

                if (state.players[0].hand.length === 0) {
                    return tFinishRound(state);
                }
                state.trick = { cards: [], leader: winnerId };
                state.currentPlayer = winnerId;
                // повертаємо завершену взятку як sideEffect — клієнт покаже її 1.3с
                return { event: 'trickComplete', cards: completedCards, winnerId, pts };
            } else {
                state.currentPlayer = (pidx + 1) % n;
            }
            break;
        }

        case 'tSetBid': {
            if (state.phase !== 'talon' || pidx !== state.auction.winner) break;
            if (state.talonPiles) break; // 2-player: спочатку треба вибрати стопку
            const amt = parseInt(data.amount) || 0;
            if (amt < state.auction.current || amt % 10 !== 0) break;
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

    // Нерозкритий прикуп (2-player) → очки йдуть тому хто взяв останню взятку
    if (state.leftoverPile?.length && state.lastTrickWinner !== null) {
        const pts = state.leftoverPile.reduce((s, c) => s + tPts(c), 0);
        state.players[state.lastTrickWinner].trickPts += pts;
        if (pts > 0) {
            addLog(state, `🃏 ${state.players[state.lastTrickWinner].name} отримує нерозкритий прикуп зі столу (+${pts})`);
        }
    }

    // Додаємо очки шлюбів
    Object.entries(state.marriages).forEach(([pid, suits]) => {
        suits.forEach(s => { state.players[+pid].trickPts += T_MARRIAGE[s]; });
    });
    const bid = state.declaredBid || state.auction.current;
    state.players.forEach((p, i) => {
        const rnd = Math.floor(p.trickPts / 10) * 10; // завжди вниз за правилами Тисячі
        if (i === bidder) {
            if (p.trickPts >= bid) {
                p.score += bid;
                state.log.unshift(`✅ ${p.name}: набрав ${p.trickPts} ≥ ${bid}, +${bid}`);
            } else {
                p.score -= bid;
                state.log.unshift(`❌ ${p.name}: набрав ${p.trickPts} < ${bid}, −${bid}`);
            }
        } else {
            p.score += rnd;
            state.log.unshift(`${p.name}: +${rnd}`);
        }
    });
    const winner = state.players.find(p => p.score >= 1000);
    if (winner) {
        state.phase = 'gameover';
        state.winner = winner.id;
        state.log.unshift(`🏆 ${winner.name} набрав(ла) 1000! Перемога!`);
        return { event: 'tGameOver', winner };
    }
    // Новий раунд
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
    return null;
}

function sanitizeTysyacha(state, forIdx) {
    return {
        gameType: 'tysyacha',
        players: state.players.map((p, i) => ({
            id: p.id, name: p.name, score: p.score, trickPts: p.trickPts,
            handCount: p.hand.length,
            hand: i === forIdx ? p.hand : null,
        })),
        talonCount: state.talonPiles
            ? state.talonPiles.reduce((s, p) => s + p.length, 0)
            : state.talon.length,
        talonPiles: state.talonPiles ? state.talonPiles.map(p => p.length) : null,
        leftoverPileCount: state.leftoverPile?.length || 0,
        talon: null,
        dealer: state.dealer, round: state.round,
        phase: state.phase, currentPlayer: state.currentPlayer,
        auction: state.auction,
        trick: state.trick,
        trump: state.trump, declaredBid: state.declaredBid,
        marriages: state.marriages,
        log: state.log.slice(0, 30),
        winner: state.winner,
    };
}

function emitTysyachaUpdate(room, sideEffect, toast) {
    room.players.forEach(rp => {
        io.to(rp.socketId).emit('stateUpdate', {
            state: sanitizeTysyacha(room.state, rp.index),
            sideEffect, toast: toast || null,
        });
    });
}

// ── Таймер ходу ──────────────────────────────
function clearTurnTimer(room) {
    if (room.turnTimer) { clearTimeout(room.turnTimer); room.turnTimer = null; }
    if (room.state) room.state.turnDeadline = null;
}

function clearTradeTimer(room) {
    if (room.tradeTimer) { clearTimeout(room.tradeTimer); room.tradeTimer = null; }
    if (room.state) room.state.tradeDeadline = null;
}

function startTradeTimer(room) {
    clearTradeTimer(room);
    clearTurnTimer(room); // пауза таймера ходу під час угоди
    room.state.tradeDeadline = Date.now() + 20000;
    room.tradeTimer = setTimeout(() => {
        if (!room.started || !room.state?.pendingTrade) return;
        const trade = room.state.pendingTrade;
        const to = room.state.players[trade.toIdx];
        addLog(room.state, `⏱️ ${to.name} не відповів на угоду — скасовано`, 'warn');
        room.state.pendingTrade = null;
        room.state.tradeDeadline = null;
        startTurnTimer(room); // відновлюємо таймер ходу
        io.to(room.code).emit('stateUpdate', {
            state: sanitize(room.state),
            sideEffect: null,
            toast: { text: `⏱️ Час на відповідь вийшов — угоду скасовано`, color: '#e65100' },
        });
    }, 20000);
}

function startTurnTimer(room) {
    if (room.state?.pendingTrade) return; // не запускаємо під час очікування угоди
    const next = room.state?.players[room.state?.currentPlayerIndex];
    if (next?.inJail) return; // гравець у в'язниці — чекаємо на його вибір (jailPay/jailCard/roll)
    clearTurnTimer(room);
    const TURN_MS = 90 * 1000;
    room.state.turnDeadline = Date.now() + TURN_MS;
    room.turnTimer = setTimeout(() => {
        if (!room.started || !room.state) return;
        const state = room.state;
        try {
            if (state.auctionState) {
                processAction(state, 'auctionPass', {}, room);
            } else if (!state.hasRolled) {
                processAction(state, 'rollDice', {}, room);
                if (state.pendingAction === 'payRent') {
                    const canPay = state.players[state.currentPlayerIndex].money >= (state.pendingData?.rent || 0);
                    processAction(state, canPay ? 'payRent' : 'declareBankrupt', {}, room);
                } else if (state.pendingAction === 'offerPurchase') {
                    processAction(state, 'startAuction', {}, room);
                }
                if (state.hasRolled && !state.auctionState)       processAction(state, 'endTurn', {}, room);
            } else if (!state.auctionState) {
                processAction(state, 'endTurn', {}, room);
            }
        } catch(e) { console.error('Auto-turn error:', e.message); }

        io.to(room.code).emit('stateUpdate', {
            state: sanitize(room.state),
            sideEffect: null,
            toast: { text: '⏱️ Час вийшов! Хід передано автоматично.', color: '#e65100' },
        });
        startTurnTimer(room);
    }, TURN_MS);
}

// ── Очищення неактивних кімнат ────────────────
setInterval(() => {
    const now = Date.now();
    const IDLE_MS = 30 * 60 * 1000;
    Object.keys(rooms).forEach(code => {
        const room = rooms[code];
        if (now - (room.lastActivityAt || room.createdAt) > IDLE_MS) {
            clearTurnTimer(room);
            clearTradeTimer(room);
            delete rooms[code];
            console.log(`🗑️ Кімнату ${code} видалено (неактивна 30+ хв)`);
        }
    });
}, 5 * 60 * 1000);

// ── Socket.io ─────────────────────────────────
io.on('connection', (socket) => {
    console.log('+ підключення:', socket.id);

    // Створити кімнату
    socket.on('createRoom', ({ playerName, gameType = 'monopoly' }, cb) => {
        const code = generateCode();
        rooms[code] = {
            code,
            players: [{ socketId: socket.id, name: playerName, index: 0 }],
            started: false,
            state: null,
            gameType: gameType === 'tysyacha' ? 'tysyacha' : 'monopoly',
            createdAt: Date.now(),
            lastActivityAt: Date.now(),
        };
        socket.join(code);
        socket.roomCode = code;
        socket.playerIndex = 0;
        console.log(`Кімната ${code} створена`);
        cb({ code, playerIndex: 0 });
    });

    // Приєднатись до кімнати
    socket.on('joinRoom', ({ code, playerName }, cb) => {
        const room = rooms[code];
        if (!room)        return cb({ error: 'Кімнату не знайдено' });
        if (room.started) return cb({ error: 'Гра вже почалась' });
        const maxPlayers = room.gameType === 'tysyacha' ? 3 : 6;
        if (room.players.length >= maxPlayers) return cb({ error: `Кімната повна (макс ${maxPlayers})` });

        const idx = room.players.length;
        room.players.push({ socketId: socket.id, name: playerName, index: idx });
        socket.join(code);
        socket.roomCode = code;
        socket.playerIndex = idx;

        io.to(code).emit('lobbyUpdate', { players: room.players.map(p => p.name), gameType: room.gameType });
        cb({ code, playerIndex: idx });
    });

    // Вийти з кімнати (до початку гри)
    socket.on('leaveRoom', () => {
        const room = rooms[socket.roomCode];
        if (!room || room.started) return;

        if (socket.playerIndex === 0) {
            // Хост виходить — видаляємо кімнату, виганяємо всіх
            io.to(socket.roomCode).emit('roomClosed', { reason: 'Хост покинув кімнату' });
            room.players.forEach(p => {
                const s = io.sockets.sockets.get(p.socketId);
                if (s) { s.leave(socket.roomCode); s.roomCode = null; s.playerIndex = null; }
            });
            delete rooms[socket.roomCode];
        } else {
            // Звичайний гравець — прибираємо і переіндексуємо
            room.players = room.players.filter(p => p.index !== socket.playerIndex);
            room.players.forEach((p, i) => { p.index = i; });
            room.players.forEach(p => {
                const s = io.sockets.sockets.get(p.socketId);
                if (s) s.playerIndex = p.index;
            });
            socket.leave(socket.roomCode);
            socket.roomCode = null;
            socket.playerIndex = null;
            io.to(room.code).emit('lobbyUpdate', { players: room.players.map(p => p.name), gameType: room.gameType });
        }
    });

    // Дострокове завершення гри
    socket.on('abandonGame', () => {
        const code = socket.roomCode;
        const room = rooms[code];
        if (!room) return;
        const name = room.players[socket.playerIndex]?.name || 'Гравець';
        io.to(code).emit('gameAbandoned', { reason: `${name} достроково завершив(ла) гру` });
        room.players.forEach(p => {
            const s = io.sockets.sockets.get(p.socketId);
            if (s) { s.leave(code); s.roomCode = null; s.playerIndex = null; }
        });
        delete rooms[code];
    });

    // Здатись у Монополії: банкрутство гравця, решта продовжує
    socket.on('surrenderMonopoly', () => {
        const code = socket.roomCode;
        const room = rooms[code];
        if (!room || !room.started) return;
        const state = room.state;
        if (!state || state.gameType === 'tysyacha') return;

        const pidx = socket.playerIndex;
        const player = state.players[pidx];
        if (!player || player.bankrupt) return;

        // Власність → банку
        player.properties.forEach(pos => {
            state.cellState[pos].owner = null;
            state.cellState[pos].houses = 0;
            state.cellState[pos].mortgaged = false;
        });
        player.properties = [];
        player.money = 0;
        player.bankrupt = true;
        state.pendingAction = null;
        state.pendingData = null;
        state.pendingRent = null;
        addLog(state, `🏳️ ${player.name} здав(ла)ся. Власність повернута банку.`, 'error');

        // Якщо зараз хід цього гравця — передаємо
        if (state.currentPlayerIndex === pidx) {
            state.hasRolled = false;
            state.doublesCount = 0;
            nextPlayer(state);
        }

        // Від'єднуємо гравця від кімнати
        socket.emit('surrendered');
        socket.leave(code);
        socket.roomCode = null;
        socket.playerIndex = null;
        clearTurnTimer(room);
        clearTradeTimer(room);

        // Перевіряємо переможця
        const alive = state.players.filter(p => !p.bankrupt);
        if (alive.length === 1) {
            addLog(state, `🏆 ${alive[0].name} — переможець!`, 'success');
            io.to(code).emit('gameOver', { winner: alive[0], state: sanitize(state) });
            return;
        }

        startTurnTimer(room);
        io.to(code).emit('stateUpdate', {
            state: sanitize(state),
            sideEffect: null,
            toast: { text: `🏳️ ${player.name} здав(ла)ся`, color: '#c62828' },
        });
    });

    // Отримати список вільних кімнат
    socket.on('getRooms', (cb) => {
        const available = Object.values(rooms)
            .filter(r => !r.started && r.players.length > 0 && r.players.length < 6)
            .map(r => ({
                code: r.code,
                playerCount: r.players.length,
                hostName: r.players[0].name,
                gameType: r.gameType || 'monopoly',
            }));
        cb({ rooms: available });
    });

    // Видалити гравця з кімнати (тільки хост, до початку гри)
    socket.on('kickPlayer', ({ kickIndex }) => {
        const room = rooms[socket.roomCode];
        if (!room || room.started || socket.playerIndex !== 0) return;

        const kicked = room.players.find(p => p.index === kickIndex);
        if (!kicked) return;

        // Повідомляємо та від'єднуємо видаленого гравця
        io.to(kicked.socketId).emit('kicked', { reason: 'Вас видалив хост' });
        const kickedSocket = io.sockets.sockets.get(kicked.socketId);
        if (kickedSocket) {
            kickedSocket.leave(socket.roomCode);
            kickedSocket.roomCode = null;
            kickedSocket.playerIndex = null;
        }

        // Видаляємо та переіндексуємо
        room.players = room.players.filter(p => p.index !== kickIndex);
        room.players.forEach((p, i) => { p.index = i; });

        // Оновлюємо playerIndex на живих сокетах
        room.players.forEach(p => {
            const s = io.sockets.sockets.get(p.socketId);
            if (s) s.playerIndex = p.index;
        });

        io.to(socket.roomCode).emit('lobbyUpdate', { players: room.players.map(p => p.name), gameType: room.gameType });
    });

    // Почати гру (тільки хост — index 0)
    socket.on('startGame', () => {
        const room = rooms[socket.roomCode];
        if (!room || socket.playerIndex !== 0) return;

        if (room.gameType === 'tysyacha') {
            if (room.players.length < 2 || room.players.length > 3)
                return io.to(socket.id).emit('error', 'Тисяча: потрібно 2 або 3 гравці');
            room.started = true;
            room.state = createTysyachaState(room.players);
            room.players.forEach(rp => {
                io.to(rp.socketId).emit('gameStarted', {
                    state: sanitizeTysyacha(room.state, rp.index),
                    gameType: 'tysyacha',
                });
            });
        } else {
            if (room.players.length < 2) return io.to(socket.id).emit('error', 'Потрібно мінімум 2 гравці');
            room.started = true;
            room.state = createGameState(room.players);
            addLog(room.state, `🎮 Гра почалась! Перший хід: ${room.state.players[0].name}`, 'success');
            startTurnTimer(room);
            io.to(socket.roomCode).emit('gameStarted', { state: sanitize(room.state) });
        }
    });

    // Дія від гравця
    socket.on('action', ({ type, data }) => {
        const room = rooms[socket.roomCode];
        if (!room?.state) return;
        const state = room.state;

        // ── Тисяча ──
        if (state.gameType === 'tysyacha') {
            room.lastActivityAt = Date.now();
            const result = processTysyachaAction(state, type, data || {}, socket.playerIndex);
            if (result?.event === 'tGameOver') {
                clearTurnTimer(room);
                room.players.forEach(rp => {
                    io.to(rp.socketId).emit('gameOver', {
                        winner: state.players[state.winner],
                        state: sanitizeTysyacha(state, rp.index),
                    });
                });
            } else {
                emitTysyachaUpdate(room, result, null);
            }
            return;
        }

        // Перевірка прав на дію
        const isAuctionAction  = ['auctionBid', 'auctionPass'].includes(type);
        const isTradeResponse  = ['acceptTrade', 'rejectTrade'].includes(type);
        if (!isAuctionAction && !isTradeResponse && state.currentPlayerIndex !== socket.playerIndex) return;
        if (isAuctionAction && state.auctionState) {
            const a = state.auctionState;
            const bidderId = a.active[a.turnIdx % a.active.length];
            if (bidderId !== socket.playerIndex) return;
        }
        if (isTradeResponse) {
            (data = data || {}).callerIdx = socket.playerIndex;
        }

        room.lastActivityAt = Date.now();
        const prevIdx = state.currentPlayerIndex;
        const sideEffect = processAction(state, type, data || {}, room);
        const toast = state._toast || null;
        delete state._toast;

        // Управління таймерами
        if (type === 'offerTrade' && state.pendingTrade) {
            startTradeTimer(room);                         // запускаємо 20с таймер угоди
        } else if (isTradeResponse && !state.pendingTrade) {
            clearTradeTimer(room);                         // угода закрита — відновлюємо хід
            startTurnTimer(room);
        } else if (state.currentPlayerIndex !== prevIdx) {
            startTurnTimer(room);                          // хід змінився — перезапуск
        }

        // Перевірка переможця
        const alive = state.players.filter(p => !p.bankrupt);
        if (alive.length === 1) {
            clearTurnTimer(room);
            addLog(state, `🏆 ${alive[0].name} — переможець!`, 'success');
            io.to(socket.roomCode).emit('gameOver', { winner: alive[0], state: sanitize(state) });
            return;
        }

        io.to(socket.roomCode).emit('stateUpdate', {
            state: sanitize(state),
            sideEffect,
            toast,
        });
    });

    // Перепідключення після оновлення сторінки
    socket.on('rejoin', ({ code, playerIndex, playerName }, cb) => {
        const room = rooms[code];
        if (!room) return cb({ error: 'Кімнату не знайдено (можливо сервер перезапускався)' });

        const rp = room.players.find(p => p.index === playerIndex && p.name === playerName);
        if (!rp) return cb({ error: 'Гравця не знайдено в кімнаті' });

        // Оновлюємо socket ID
        rp.socketId = socket.id;
        socket.join(code);
        socket.roomCode  = code;
        socket.playerIndex = playerIndex;

        if (room.started && room.state) {
            const st = room.state.gameType === 'tysyacha'
                ? sanitizeTysyacha(room.state, playerIndex)
                : sanitize(room.state);
            cb({ success: true, started: true, state: st, gameType: room.gameType });
        } else {
            cb({ success: true, started: false, players: room.players.map(p => p.name) });
            io.to(code).emit('lobbyUpdate', { players: room.players.map(p => p.name), gameType: room.gameType });
        }
    });

    // Чат
    socket.on('chatMessage', ({ text, icon, name, color }) => {
        if (!socket.roomCode) return;
        const esc = s => String(s).replace(/[&<>"']/g, c =>
            ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
        io.to(socket.roomCode).emit('chatMessage', {
            playerIndex: socket.playerIndex,
            icon:  esc(String(icon  || '').slice(0, 10)),
            name:  esc(String(name  || '').slice(0, 30)),
            color: /^#[0-9a-fA-F]{3,6}$/.test(color) ? color : '#888',
            text:  esc(String(text  || '').slice(0, 200)),
        });
    });

    // Відключення
    socket.on('disconnect', () => {
        console.log('- відключення:', socket.id);
        const room = rooms[socket.roomCode];
        if (!room) return;
        // Прибираємо гравця з активного аукціону щоб не зависав
        if (room.state?.auctionState) {
            const a = room.state.auctionState;
            a.active = a.active.filter(id => id !== socket.playerIndex);
            if (a.active.length === 0) {
                addLog(room.state, '🔨 Аукціон скасовано — всі відключились', 'warn');
                room.state.auctionState = null;
            } else if (a.active.length === 1 && a.currentBidder !== null) {
                awardAuction(room.state, a);
            }
            io.to(socket.roomCode).emit('stateUpdate', { state: sanitize(room.state), sideEffect: null });
        }
        // Якщо відключився отримувач угоди — скасовуємо pendingTrade і trade timer
        if (room.state?.pendingTrade?.toIdx === socket.playerIndex) {
            clearTradeTimer(room);
            room.state.pendingTrade = null;
            room.state.tradeDeadline = null;
            startTurnTimer(room);
            io.to(socket.roomCode).emit('stateUpdate', {
                state: sanitize(room.state), sideEffect: null,
                toast: { text: '🚪 Отримувач угоди відключився — угоду скасовано', color: '#e65100' },
            });
        }
        io.to(socket.roomCode).emit('playerDisconnected', { playerIndex: socket.playerIndex });
    });
});

// Прибираємо надмірні дані перед відправкою клієнту
function sanitize(state) {
    return {
        players: state.players,
        cellState: state.cellState,
        currentPlayerIndex: state.currentPlayerIndex,
        lastDiceRoll: state.lastDiceRoll,
        hasRolled: state.hasRolled,
        doublesCount: state.doublesCount,
        auctionState: state.auctionState,
        pendingTrade: state.pendingTrade,
        log: state.log,
        pendingAction: state.pendingAction,
        pendingData: state.pendingData,
        turnDeadline: state.turnDeadline,
        tradeDeadline: state.tradeDeadline,
    };
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🇺🇦 Монополія України запущена: http://localhost:${PORT}`));
