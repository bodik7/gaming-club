// ============================================
// Unit-тести ігрової логіки (без сервера)
// Запуск: node tests/test-units.js
// ============================================
let passed = 0, failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (e) {
        console.error(`  ❌ ${name}: ${e.message}`);
        failed++;
    }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEqual(a, b) { assert(a === b, `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

// ── Мок io (щоб init() не падав) ────────────
const mockIo = { to: () => ({ emit: () => {} }), sockets: { sockets: new Map() } };

// ════════════════════════════════════════════
// ДУРАК
// ════════════════════════════════════════════
console.log('\n── Дурак ──');
const { createDurakState, processDurakAction, sanitizeDurak } = require('../games/durak');
require('../games/durak').init(mockIo);

test('createDurakState: 36 карт у колоді, козир визначений', () => {
    const state = createDurakState(['Аліса', 'Боб'], 'podkidnoy');
    assertEqual(state.gameType, 'durak');
    assert(state.trump, 'trump відсутній');
    const totalCards = state.deck.length
        + state.players.reduce((s, p) => s + p.hand.length, 0)
        + (state.table || []).length;
    assertEqual(totalCards, 36);
});

test('createDurakState: кожен гравець отримує 6 карт', () => {
    const state = createDurakState(['Аліса', 'Боб', 'Вася'], 'podkidnoy');
    state.players.forEach(p => assertEqual(p.hand.length, 6));
});

test('sanitizeDurak: чужа рука прихована (null)', () => {
    const state = createDurakState(['Аліса', 'Боб'], 'podkidnoy');
    const view = sanitizeDurak(state, 0);
    // Власна рука — видима
    assertEqual(view.players[0].hand.length, 6);
    // Чужа рука — null (сервер не передає карти)
    assertEqual(view.players[1].hand, null);
});

test('createDurakState: атакер і захисник різні гравці', () => {
    const state = createDurakState(['Аліса', 'Боб'], 'podkidnoy');
    assert(state.attacker !== state.defender, 'attacker === defender');
});

// ════════════════════════════════════════════
// ТИСЯЧА
// ════════════════════════════════════════════
console.log('\n── Тисяча ──');
const { createTysyachaState, sanitizeTysyacha } = require('../games/tysyacha');
require('../games/tysyacha').init(mockIo);

test('createTysyachaState: 24 карти розподілено', () => {
    const state = createTysyachaState(['А', 'Б', 'В']);
    const handCards = state.players.reduce((s, p) => s + p.hand.length, 0);
    const totalCards = handCards + (state.talon?.length || 0);
    assertEqual(totalCards, 24);
});

test('createTysyachaState: кожен гравець отримує 7 карт', () => {
    const state = createTysyachaState(['А', 'Б', 'В']);
    state.players.forEach(p => assertEqual(p.hand.length, 7));
});

test('createTysyachaState: talon = 3 карти', () => {
    const state = createTysyachaState(['А', 'Б', 'В']);
    assertEqual(state.talon.length, 3);
});

test('sanitizeTysyacha: рука противника прихована (null)', () => {
    const state = createTysyachaState(['А', 'Б', 'В']);
    const view = sanitizeTysyacha(state, 0);
    assertEqual(view.players[1].hand, null);
});

// ════════════════════════════════════════════
// МАФІЯ
// ════════════════════════════════════════════
console.log('\n── Мафія ──');
const { createMafiaState, sanitizeMafia, MAFIA_ROLE_LABELS, MAFIA_BALANCE } = require('../games/mafia');
require('../games/mafia').init(mockIo, { saveGameStats: () => {}, saveGameHistory: () => {}, deleteRoom: () => {} }, {}, () => {});

test('createMafiaState: ролі розподілено правильно (5 гравців)', () => {
    const names = ['А', 'Б', 'В', 'Г', 'Д'];
    const state = createMafiaState(names, {});
    assertEqual(state.players.length, 5);
    state.players.forEach(p => assert(p.role, 'гравець без ролі'));
});

test('MAFIA_BALANCE: визначений для 5-10 гравців', () => {
    for (let n = 5; n <= 10; n++) {
        assert(MAFIA_BALANCE[n], `MAFIA_BALANCE[${n}] відсутній`);
    }
});

test('sanitizeMafia: мирний не бачить ролей інших живих', () => {
    const names = ['А', 'Б', 'В', 'Г', 'Д'];
    const state = createMafiaState(names, {});
    const civIdx = state.players.findIndex(p => MAFIA_ROLE_LABELS[p.role]?.faction === 'city');
    if (civIdx === -1) return; // немає мирних — пропускаємо
    const view = sanitizeMafia(state, civIdx);
    const mafiaVisible = view.players.some((p, i) => {
        if (i === civIdx || state.players[i].dead) return false;
        return MAFIA_ROLE_LABELS[p.role]?.faction === 'mafia';
    });
    assert(!mafiaVisible, 'мирний бачить мафію');
});

// ════════════════════════════════════════════
// Підсумок
// ════════════════════════════════════════════
console.log(`\n${'─'.repeat(40)}`);
console.log(`Результат: ${passed} пройшло, ${failed} провалено`);
if (failed > 0) process.exit(1);
