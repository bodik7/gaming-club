// Спільні утиліти для всіх ігрових модулів
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function addLog(state, text, type = '') {
    state.log.unshift({ text, type, ts: Date.now() });
    if (state.log.length > 40) state.log.pop();
}

module.exports = { shuffle, addLog };
