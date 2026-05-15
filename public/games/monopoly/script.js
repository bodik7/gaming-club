// ============================================
// МОНОПОЛІЯ УКРАЇНИ — script.js
// Точка входу: стартовий екран, валідація, ініціалізація гри
// (потребує board.js → ui.js → engine.js)
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    setupStartScreen();
    // Якщо є збережена гра — пропонуємо продовжити
    if (hasSavedGame()) {
        setTimeout(() => offerResumeGame(), 100);
    }
});

// ============================================
// СТАРТОВИЙ ЕКРАН
// ============================================
function setupStartScreen() {
    const countSelect = document.getElementById('player-count');
    const namesContainer = document.getElementById('player-names');

    function renderPlayerInputs() {
        const count = parseInt(countSelect.value);
        namesContainer.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const div = document.createElement('div');
            div.className = 'player-name-input';
            div.innerHTML = `
                <div class="token-circle" style="background:${TOKEN_COLORS[i]}">${TOKEN_ICONS[i]}</div>
                <input type="text" placeholder="Гравець ${i+1}" data-idx="${i}" value="Гравець ${i+1}" maxlength="20">
            `;
            namesContainer.appendChild(div);
        }
        // прибрати попередню помилку при зміні кількості
        clearNameError();
    }

    countSelect.addEventListener('change', renderPlayerInputs);
    renderPlayerInputs();

    // На введенні в поля — приховуємо помилку
    namesContainer.addEventListener('input', clearNameError);

    document.getElementById('start-game-btn').addEventListener('click', startGame);
}

function showNameError(message) {
    let err = document.getElementById('name-error');
    if (!err) {
        err = document.createElement('div');
        err.id = 'name-error';
        err.style.cssText = 'background:#ffeae8;color:#c71f1f;padding:10px;border-radius:8px;border-left:4px solid #ff4136;margin:10px 0;font-size:13px;font-weight:600';
        document.getElementById('player-names').after(err);
    }
    err.innerText = message;
}

function clearNameError() {
    const err = document.getElementById('name-error');
    if (err) err.remove();
}

// ----- ВАЛІДАЦІЯ ІМЕН ГРАВЦІВ -----
function validatePlayerNames(rawNames) {
    // Тримаємо оригінальний регістр для відображення, порівнюємо без регістру
    const trimmed = rawNames.map(n => (n || '').trim());

    for (let i = 0; i < trimmed.length; i++) {
        if (trimmed[i].length === 0) {
            return { ok: false, message: `❌ Ім'я гравця №${i + 1} не може бути порожнім` };
        }
        if (trimmed[i].length > 20) {
            return { ok: false, message: `❌ Ім'я гравця №${i + 1} занадто довге (макс 20 символів)` };
        }
    }

    // Перевірка на дублікати (без врахування регістру)
    const seen = new Map();
    for (let i = 0; i < trimmed.length; i++) {
        const key = trimmed[i].toLowerCase();
        if (seen.has(key)) {
            const firstIdx = seen.get(key);
            return {
                ok: false,
                message: `❌ Імена гравців №${firstIdx + 1} і №${i + 1} однакові ("${trimmed[i]}"). Зробіть їх різними.`
            };
        }
        seen.set(key, i);
    }

    return { ok: true, names: trimmed };
}

// ============================================
// СТАРТ ГРИ
// ============================================
function startGame() {
    const count = parseInt(document.getElementById('player-count').value);
    const inputs = [];
    for (let i = 0; i < count; i++) {
        inputs.push(document.querySelector(`input[data-idx="${i}"]`).value);
    }

    // Валідація
    const result = validatePlayerNames(inputs);
    if (!result.ok) {
        showNameError(result.message);
        return;
    }
    clearNameError();

    players = [];
    for (let i = 0; i < count; i++) {
        players.push({
            id: i,
            name: result.names[i],
            color: TOKEN_COLORS[i],
            icon: TOKEN_ICONS[i],
            money: 1500,
            position: 0,
            inJail: false,
            jailTurns: 0,
            hasJailCard: false,
            bankrupt: false,
            properties: []
        });
    }

    currentPlayerIndex = 0;
    cellState = {};
    BOARD.forEach(c => {
        if (c.type === 'property' || c.type === 'railway' || c.type === 'utility') {
            cellState[c.pos] = { owner: null, houses: 0, mortgaged: false };
        }
    });
    chanceDeck = shuffle([...Array(CHANCE_CARDS.length).keys()]);
    excursionDeck = shuffle([...Array(EXCURSION_CARDS.length).keys()]);

    // Ініціалізація статистики та кредиту
    players.forEach(p => {
        p.stats = { rentPaid: 0, rentReceived: 0, housesBuilt: 0, hotelsBuilt: 0, taxesPaid: 0, cardsTotal: 0 };
        p.loan = 0;
        p.loanInterest = 0;
    });

    showGameScreen();
    log(`🎮 Гра почалась! Перший хід: ${players[0].name}`, 'success');
    saveGame();
}

function showGameScreen() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    buildBoard();
    renderPlayers();
    renderActionButtons();
    updateCurrentPlayerInfo();
    setTimeout(() => { placeTokens(); updateMonopolies(); refreshAllCells(); }, 50);

    const rollBtn = document.getElementById('roll-btn');
    const endBtn = document.getElementById('end-turn-btn');
    rollBtn.replaceWith(rollBtn.cloneNode(true));
    endBtn.replaceWith(endBtn.cloneNode(true));
    document.getElementById('roll-btn').addEventListener('click', rollDice);
    document.getElementById('end-turn-btn').addEventListener('click', endTurn);
    showEndTurnBtn();
}

// ============================================
// ЕКСПОРТ ФУНКЦІЙ ДЛЯ INLINE onclick="..."
// ============================================
window.buildHouse = buildHouse;
window.sellHouse = sellHouse;
window.mortgage = mortgage;
window.redeem = redeem;
window.showAllProperties = showAllProperties;
window.showBuildMenu = showBuildMenu;
window.showMortgageMenu = showMortgageMenu;
window.showTradeMenu = showTradeMenu;
window.openTradeBuilder = openTradeBuilder;
window.showRules = showRules;
window.endGameVote = endGameVote;
window.closeModal = closeModal;
window.showLoanMenu = showLoanMenu;
window.showCharityMenu = showCharityMenu;
window.charityMoveTo = charityMoveTo;
window.showJailCardSale = showJailCardSale;
window.proposeJailCardSale = proposeJailCardSale;
window.showStatsMenu = showStatsMenu;
window.toggleSounds = toggleSounds;
