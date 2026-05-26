// ============================================
// МОНОПОЛІЯ — спільні дані дошки
// Джерело правди: і сервер, і браузер читають звідси
// ============================================

const BOARD = [
    { pos: 0, type: 'corner', name: 'СТАРТ', icon: '➡️', desc: 'Отримайте ₴200' },
    { pos: 1, type: 'property', name: 'Сумська', city: 'Полтава', color: '#8B4513', price: 60, rent: [2,10,30,90,160,250], housePrice: 50 },
    { pos: 2, type: 'card', name: 'Шанс', icon: '❓', cardType: 'chance' },
    { pos: 3, type: 'property', name: 'Полтавська', city: 'Полтава', color: '#8B4513', price: 60, rent: [4,20,60,180,320,450], housePrice: 50 },
    { pos: 4, type: 'tax', name: 'Податкова', icon: '💰', amount: 200 },
    { pos: 5, type: 'railway', name: 'Львівська залізниця', icon: '🚂', price: 200 },
    { pos: 6, type: 'property', name: 'Хортиця', city: 'Запоріжжя', color: '#FFD700', price: 100, rent: [6,30,90,270,400,550], housePrice: 50 },
    { pos: 7, type: 'card', name: 'Екскурсія', icon: '🗺️', cardType: 'excursion' },
    { pos: 8, type: 'property', name: 'Дніпрогес', city: 'Запоріжжя', color: '#FFD700', price: 100, rent: [6,30,90,270,400,550], housePrice: 50 },
    { pos: 9, type: 'property', name: 'Соборний пр.', city: 'Запоріжжя', color: '#FFD700', price: 120, rent: [8,40,100,300,450,600], housePrice: 50 },
    { pos: 10, type: 'corner', name: "В'ЯЗНИЦЯ", icon: '🔒', desc: 'У гостях' },
    { pos: 11, type: 'property', name: 'Дерибасівська', city: 'Одеса', color: '#FF69B4', price: 140, rent: [10,50,150,450,625,750], housePrice: 100 },
    { pos: 12, type: 'utility', name: 'Одеський порт', icon: '⚓', price: 150 },
    { pos: 13, type: 'property', name: 'Молдованка', city: 'Одеса', color: '#FF69B4', price: 140, rent: [10,50,150,450,625,750], housePrice: 100 },
    { pos: 14, type: 'property', name: 'Аркадія', city: 'Одеса', color: '#FF69B4', price: 160, rent: [12,60,180,500,700,900], housePrice: 100 },
    { pos: 15, type: 'railway', name: 'Південно-Західна залізниця', icon: '🚂', price: 200 },
    { pos: 16, type: 'property', name: 'Сумська', city: 'Харків', color: '#FFA500', price: 180, rent: [14,70,200,550,750,950], housePrice: 100 },
    { pos: 17, type: 'card', name: 'Шанс', icon: '❓', cardType: 'chance' },
    { pos: 18, type: 'property', name: 'Університетська', city: 'Харків', color: '#FFA500', price: 180, rent: [14,70,200,550,750,950], housePrice: 100 },
    { pos: 19, type: 'property', name: 'Дзеркальний струмінь', city: 'Харків', color: '#FFA500', price: 200, rent: [16,80,220,600,800,1000], housePrice: 100 },
    { pos: 20, type: 'casino', name: 'КАЗИНО', icon: '🎰', desc: 'Спробуй удачу!' },
    { pos: 21, type: 'property', name: 'Соборна площа', city: 'Дніпро', color: '#FF0000', price: 220, rent: [18,90,250,700,875,1050], housePrice: 150 },
    { pos: 22, type: 'card', name: 'Екскурсія', icon: '🗺️', cardType: 'excursion' },
    { pos: 23, type: 'property', name: 'Вул. Січеславська', city: 'Дніпро', color: '#FF0000', price: 220, rent: [18,90,250,700,875,1050], housePrice: 150 },
    { pos: 24, type: 'property', name: 'Набережна', city: 'Дніпро', color: '#FF0000', price: 240, rent: [20,100,300,750,925,1100], housePrice: 150 },
    { pos: 25, type: 'railway', name: 'Дніпровська залізниця', icon: '🚂', price: 200 },
    { pos: 26, type: 'property', name: 'Площа Ринок', city: 'Львів', color: '#87CEEB', price: 260, rent: [22,110,330,800,975,1150], housePrice: 150 },
    { pos: 27, type: 'property', name: 'Личаківська', city: 'Львів', color: '#87CEEB', price: 260, rent: [22,110,330,800,975,1150], housePrice: 150 },
    { pos: 28, type: 'utility', name: 'Маріупольський порт', icon: '⚓', price: 150 },
    { pos: 29, type: 'property', name: 'Сихівська', city: 'Львів', color: '#87CEEB', price: 280, rent: [24,120,360,850,1025,1200], housePrice: 150 },
    { pos: 30, type: 'corner', name: "ІТИ ДО В'ЯЗНИЦІ", icon: '👮', desc: 'У тюрму!' },
    { pos: 31, type: 'property', name: 'Андріївський узвіз', city: 'Київ', color: '#008000', price: 300, rent: [26,130,390,900,1100,1275], housePrice: 200 },
    { pos: 32, type: 'property', name: 'Поділ', city: 'Київ', color: '#008000', price: 300, rent: [26,130,390,900,1100,1275], housePrice: 200 },
    { pos: 33, type: 'card', name: 'Шанс', icon: '❓', cardType: 'chance' },
    { pos: 34, type: 'property', name: 'Печерськ', city: 'Київ', color: '#008000', price: 320, rent: [28,150,450,1000,1200,1400], housePrice: 200 },
    { pos: 35, type: 'railway', name: 'Аеропорт Бориспіль', icon: '✈️', price: 200 },
    { pos: 36, type: 'card', name: 'Шанс', icon: '❓', cardType: 'chance' },
    { pos: 37, type: 'property', name: 'Хрещатик', city: 'Київ', color: '#00008B', price: 350, rent: [35,175,500,1100,1300,1500], housePrice: 200 },
    { pos: 38, type: 'tax', name: 'Розкішний податок', icon: '💎', amount: 100 },
    { pos: 39, type: 'property', name: 'Майдан Незалежності', city: 'Київ', color: '#00008B', price: 400, rent: [50,200,600,1400,1700,2000], housePrice: 200 }
];

const TOKEN_COLORS = ['#FF4136', '#0074D9', '#2ECC40', '#FFDC00', '#B10DC9', '#FF851B', '#39CFFF', '#85144b'];
const TOKEN_ICONS  = ['🎩', '🚗', '🐕', '🚀', '🐎', '👑', '⚓', '🎯'];

if (typeof module !== 'undefined') module.exports = { BOARD, TOKEN_COLORS, TOKEN_ICONS };
