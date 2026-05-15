// ============================================
// МАФІЯ — клієнт
// ============================================

let mState  = null;
let mMyIdx  = null;

function initMafia(state, myIdx) {
    mState = state;
    mMyIdx = myIdx;
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('mafia-screen').classList.add('hidden');
    document.getElementById('mafia-screen').classList.add('visible');
    setQuitBtn(true);
    renderMafia();
}

function updateMafia(state) {
    mState = state;
    renderMafia();
}

function renderMafia() {
    // TODO: реалізувати рендер фаз гри
}
