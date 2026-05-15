// ============================================
// МАФІЯ — клієнт (п.2: нічна фаза)
// ============================================
let mState  = null;
let mMyIdx  = null;
let mSideEffect = null; // персональний результат ночі

function initMafia(state, myIdx) {
    mState  = state;
    mMyIdx  = myIdx;
    mSideEffect = null;
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('mafia-screen').classList.remove('hidden');
    document.getElementById('mafia-screen').classList.add('visible');
    if (typeof switchViewport === 'function') switchViewport('mafia');
    setQuitBtn(true);
    renderMafia();
}

function updateMafia(state, sideEffect) {
    mState = state;
    if (sideEffect) mSideEffect = sideEffect;
    renderMafia();
}

// ── Головний рендер ───────────────────────────
function renderMafia() {
    if (!mState) return;
    mRenderPhaseInfo();
    mRenderPlayers();
    mRenderActions();
    mRenderLog();
}

// ── Інфо про фазу ─────────────────────────────
function mRenderPhaseInfo() {
    const el = document.getElementById('m-phase-info');
    if (!el) return;
    const phaseMap = {
        role_reveal:     '📋 Перегляд ролі',
        night:           '🌙 Ніч',
        morning:         '🌅 Ранок',
        day_discussion:  '☀️ Обговорення',
        day_voting:      '🗳️ Голосування',
        gameover:        '🏁 Кінець гри',
    };
    el.textContent = `${phaseMap[mState.phase] || mState.phase} · Раунд ${mState.round}`;
}

// ── Список гравців ─────────────────────────────
function mRenderPlayers() {
    const el = document.getElementById('m-players');
    if (!el) return;
    el.innerHTML = mState.players.map(p => {
        const isMe = p.id === mMyIdx;
        const roleLabel = p.role ? mRoleLabel(p.role) : null;
        return `
        <div class="m-player ${!p.isAlive ? 'dead' : ''} ${isMe ? 'me' : ''}">
            <span class="m-player-icon">${roleLabel?.icon || '👤'}</span>
            <span class="m-player-name">${p.name}${isMe ? ' (я)' : ''}</span>
            ${p.isSilenced ? '<span class="m-silenced">🔇</span>' : ''}
            ${!p.isAlive ? '<span class="m-dead-label">💀</span>' : ''}
            ${p.role && (p.id === mMyIdx || mState.phase === 'gameover')
                ? `<span class="m-role-badge" style="background:${mFactionColor(p.role)}">${roleLabel?.icon} ${roleLabel?.ua}</span>`
                : ''}
        </div>`;
    }).join('');
}

// ── Панель дій ────────────────────────────────
function mRenderActions() {
    const el = document.getElementById('m-actions');
    if (!el) return;
    const s = mState;
    const me = s.players[mMyIdx];
    if (!me) return;

    // ── Перегляд ролі
    if (s.phase === 'role_reveal') {
        const rl = mRoleLabel(me.role);
        const isMafia = rl?.faction === 'mafia';
        const allies = isMafia
            ? s.players.filter(p => p.id !== mMyIdx && s.mafiaIds?.includes(p.id)).map(p => p.name)
            : [];
        el.innerHTML = `
            <div class="m-role-reveal">
                <div class="m-role-reveal-icon" style="color:${mFactionColor(me.role)}">${rl?.icon || '?'}</div>
                <div class="m-role-reveal-name">${rl?.ua || me.role}</div>
                <div class="m-role-reveal-desc">${mRoleDesc(me.role)}</div>
                ${allies.length ? `<div class="m-role-allies">Спільники: <b>${allies.join(', ')}</b></div>` : ''}
                <button class="m-btn primary" onclick="mReady()">✅ Зрозумів, починаємо!</button>
            </div>`;
        return;
    }

    // ── Ніч
    if (s.phase === 'night') {
        if (!me.isAlive) { el.innerHTML = `<div class="m-wait">Ви загинули. Спостерігайте.</div>`; return; }
        el.innerHTML = mNightActions(s, me);
        return;
    }

    // ── Ранок
    if (s.phase === 'morning') {
        let html = `<div class="m-morning">`;
        if (s.lastDeaths?.length === 0) {
            html += `<div class="m-morning-title">🌅 Місто прокинулось</div>
                     <div class="m-morning-sub">Цієї ночі ніхто не загинув</div>`;
        } else {
            html += `<div class="m-morning-title">💀 Вночі загинули</div>`;
            s.lastDeaths.forEach(id => {
                const p = s.players[id];
                html += `<div class="m-morning-victim">${p.name} — ${mRoleLabel(p.role)?.ua || p.role}</div>`;
            });
        }
        if (mSideEffect?.event === 'sheriffResult') {
            const r = mSideEffect;
            html += `<div class="m-check-result ${r.isBad ? 'bad' : 'good'}">
                🔍 <b>${r.targetName}</b> — ${r.isBad ? '🔴 Мафія!' : '🟢 Мирний'}
            </div>`;
        }
        if (mSideEffect?.event === 'donResult') {
            const r = mSideEffect;
            html += `<div class="m-check-result ${r.isSheriff ? 'bad' : 'good'}">
                👑 <b>${r.targetName}</b> — ${r.isSheriff ? '🔍 Комісар!' : '✅ Не Комісар'}
            </div>`;
        }
        html += `<div class="m-wait" style="margin-top:12px">Переходимо до дня...</div></div>`;
        el.innerHTML = html;
        return;
    }

    // ── День (заглушка до п.3)
    if (s.phase === 'day_discussion' || s.phase === 'day_voting') {
        el.innerHTML = `<div class="m-wait">☀️ Денна фаза — буде у наступному пункті</div>`;
        return;
    }

    // ── Кінець гри
    if (s.phase === 'gameover') {
        const winnerMap = { town: '🏙️ Місто перемогло!', mafia: '🔫 Мафія перемогла!' };
        el.innerHTML = `
            <div class="m-gameover">
                <div class="m-gameover-title">${winnerMap[s.winner] || '🏁 Гра завершена'}</div>
                <button class="m-btn primary" onclick="location.reload()">🔄 Нова гра</button>
            </div>`;
    }
}

// ── Нічні дії по ролі ─────────────────────────
function mNightActions(s, me) {
    const alive = s.players.filter(p => p.isAlive && p.id !== mMyIdx);

    const targetSelect = (actionType, label) => `
        <div class="m-night-action">
            <div class="m-night-label">${label}</div>
            <div class="m-target-list">
                ${alive.map(p => `
                    <button class="m-target-btn" onclick="mNightAction('${actionType}', ${p.id})">
                        ${p.name}
                    </button>`).join('')}
            </div>
        </div>`;

    switch (me.role) {
        case 'mafia':
            return targetSelect('mafiaVote', '🔫 Оберіть жертву');

        case 'don':
            return targetSelect('mafiaVote', '🔫 Оберіть жертву') +
                   targetSelect('donCheck', '👁️ Перевірити (Комісар?)');

        case 'sheriff':
        case 'deputy':
            return targetSelect('sheriffCheck', '🔍 Перевірити гравця');

        case 'doctor':
            return `<div class="m-night-action">
                <div class="m-night-label">💊 Врятувати гравця</div>
                <div class="m-target-list">
                    ${s.players.filter(p => p.isAlive).map(p => `
                        <button class="m-target-btn" onclick="mNightAction('doctorHeal', ${p.id})">
                            ${p.name}${p.id === mMyIdx ? ' (я)' : ''}
                        </button>`).join('')}
                </div>
            </div>`;

        case 'roleblocker':
            return targetSelect('roleblockerBlock', '🚫 Заблокувати гравця');

        default:
            return `<div class="m-wait">😴 Ви спите... Зачекайте на ранок.</div>`;
    }
}

// ── Лог ──────────────────────────────────────
function mRenderLog() {
    const el = document.getElementById('m-log');
    if (!el) return;
    const entries = (mState.log || []).slice(0, 20);
    el.innerHTML = entries.length
        ? entries.map(e => `<div class="m-log-entry">${e.text || e}</div>`).join('')
        : '<div class="m-log-empty">Лог порожній</div>';
}

// ── Дії гравця ────────────────────────────────
function mReady() {
    socket.emit('action', { type: 'mafiaReady', data: {} });
}

function mNightAction(type, targetId) {
    socket.emit('action', { type, data: { targetId } });
    // Візуальний feedback — підсвітити обрану кнопку
    document.querySelectorAll('.m-target-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    event?.target?.classList?.add('selected');
}

// ── Хелпери ──────────────────────────────────
const M_ROLE_LABELS = {
    citizen:     { ua: 'Мирний житель', icon: '👤', faction: 'town',  color: '#1565c0' },
    sheriff:     { ua: 'Комісар',       icon: '🔍', faction: 'town',  color: '#0277bd' },
    deputy:      { ua: 'Помічник',      icon: '🛡️', faction: 'town',  color: '#01579b' },
    doctor:      { ua: 'Лікар',         icon: '💊', faction: 'town',  color: '#2e7d32' },
    roleblocker: { ua: 'Повія',         icon: '🚫', faction: 'town',  color: '#6a1b9a' },
    mafia:       { ua: 'Мафія',         icon: '🔫', faction: 'mafia', color: '#c62828' },
    don:         { ua: 'Дон',           icon: '👑', faction: 'mafia', color: '#b71c1c' },
};

function mRoleLabel(role) { return M_ROLE_LABELS[role] || null; }
function mFactionColor(role) { return M_ROLE_LABELS[role]?.color || '#555'; }

function mRoleDesc(role) {
    const descs = {
        citizen:     'Знайдіть мафію та виженіть її на денному голосуванні.',
        sheriff:     'Кожної ночі перевіряйте одного гравця — ви дізнаєтесь чи він мафія.',
        deputy:      'Отримуєте результати перевірок Комісара. Якщо він гине — займаєте його місце.',
        doctor:      'Кожної ночі рятуйте одного гравця від смерті.',
        roleblocker: 'Блокуйте нічні дії будь-якого гравця. Вдень заблокований мовчить.',
        mafia:       'Разом з командою вбивайте мирних щоночі. Виживіть до перемоги.',
        don:         'Лідер мафії. Ваш голос вирішальний. Перевіряйте чи є гравець Комісаром.',
    };
    return descs[role] || '';
}
