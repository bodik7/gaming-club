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
        const factionLabel = isMafia ? '🔴 Мафія' : '🔵 Місто';
        const allies = isMafia
            ? s.players.filter(p => p.id !== mMyIdx && s.mafiaIds?.includes(p.id)).map(p => p.name)
            : [];
        const totalPlayers = s.players.length;
        el.innerHTML = `
            <div class="m-role-reveal m-role-reveal--${isMafia ? 'mafia' : 'town'}">
                <div class="m-role-reveal-faction">${factionLabel}</div>
                <div class="m-role-reveal-icon">${rl?.icon || '?'}</div>
                <div class="m-role-reveal-name">${rl?.ua || me.role}</div>
                <div class="m-role-reveal-desc">${mRoleDesc(me.role)}</div>
                ${allies.length ? `
                <div class="m-role-allies">
                    🤝 Ваші спільники: <b>${allies.join(', ')}</b>
                </div>` : ''}
                <div class="m-reveal-footer">
                    <div class="m-reveal-auto" id="m-reveal-auto">
                        Автостарт через <b id="m-reveal-countdown">25</b>с
                    </div>
                    <button class="m-btn primary" onclick="mReady()">✅ Готовий!</button>
                    <div class="m-reveal-hint">Гравців: <b>${totalPlayers}</b></div>
                </div>
            </div>`;
        mStartTimer('m-reveal-countdown', s.revealDeadline);
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

    // ── Денне обговорення
    if (s.phase === 'day_discussion') {
        const timer = mDeadlineTimer(s.dayDeadline);
        const isSilenced = me.isSilenced;
        const isAlive    = me.isAlive;
        el.innerHTML = `
            <div class="m-day-ui">
                <div class="m-day-title">☀️ Обговорення</div>
                <div class="m-day-timer" id="m-day-timer">${timer}</div>
                <div class="m-day-players">
                    ${s.players.filter(p => p.isAlive).map(p => `
                        <div class="m-day-player ${p.isSilenced ? 'silenced' : ''} ${p.id === mMyIdx ? 'me' : ''}">
                            ${p.name}${p.isSilenced ? ' 🔇' : ''}${p.id === mMyIdx ? ' (я)' : ''}
                        </div>`).join('')}
                </div>
                <div class="m-day-chat">
                    <div class="m-day-chat-log" id="m-day-chat-log">
                        <div class="m-log-empty">Поки тихо...</div>
                    </div>
                    ${isAlive && !isSilenced
                        ? `<div class="m-chat-input-row">
                                <input id="m-day-chat-input" class="m-chat-input" maxlength="200"
                                    placeholder="Повідомлення..."
                                    onkeydown="if(event.key==='Enter')mSendDayChat()">
                                <button class="m-chat-send" onclick="mSendDayChat()">➤</button>
                           </div>`
                        : `<div class="m-day-chat-muted">${isSilenced ? '🔇 Ви заглушені' : '💀 Ви загинули'}</div>`
                    }
                </div>
            </div>`;
        mStartTimer('m-day-timer', s.dayDeadline);
        return;
    }

    // ── Голосування
    if (s.phase === 'day_voting') {
        const me = s.players[mMyIdx];
        const myVote = s.myVote;
        const timer = mDeadlineTimer(s.voteDeadline, () => renderMafia());
        const targets = s.players.filter(p => p.isAlive && p.id !== mMyIdx);

        const canVote = me.isAlive && !me.isSilenced;
        const alreadyVoted = myVote !== null && myVote !== undefined;

        el.innerHTML = `
            <div class="m-vote-ui">
                <div class="m-day-title">🗳️ Голосування</div>
                <div class="m-day-timer" id="m-vote-timer">${timer}</div>
                <div class="m-vote-count">${s.voteCount} / ${s.eligibleVoters} проголосували</div>

                ${!canVote
                    ? `<div class="m-wait">${me.isSilenced ? '🔇 Ви заглушені і не можете голосувати.' : '💀 Ви загинули.'}</div>`
                    : alreadyVoted
                    ? `<div class="m-voted-info">
                            ✅ Ви проголосували: <b>${myVote === 'skip' ? 'пропустити' : s.players[myVote]?.name || '?'}</b>
                            <button class="m-btn-small" onclick="mDayVote(null)">↩ Змінити</button>
                        </div>`
                    : `<div class="m-vote-targets">
                            ${targets.map(p => `
                                <button class="m-vote-target-btn" onclick="mDayVote(${p.id})">
                                    ${p.name}
                                </button>`).join('')}
                            <button class="m-vote-skip-btn" onclick="mDayVote('skip')">
                                ⏭️ Пропустити
                            </button>
                        </div>`}
            </div>`;
        mStartTimer('m-vote-timer', s.voteDeadline);
        return;
    }

    // ── Кінець гри
    if (s.phase === 'gameover') {
        el.innerHTML = mGameoverUI(s);
        mSpawnConfetti(s.winner);
        return;
    }
}

function mGameoverUI(s) {
    const isTown   = s.winner === 'town';
    const isMafia  = s.winner === 'mafia';
    const myFaction = M_ROLE_LABELS[s.players[mMyIdx]?.role]?.faction;
    const iWon     = (isTown && myFaction === 'town') || (isMafia && myFaction === 'mafia');

    const bannerClass = isTown ? 'town' : 'mafia';
    const bannerIcon  = isTown ? '🏙️' : '🔫';
    const bannerText  = isTown ? 'Місто перемогло!' : 'Мафія перемогла!';

    // Групуємо гравців: спочатку переможці, потім решта
    const sorted = [...s.players].sort((a, b) => {
        const aWin = (isTown && M_ROLE_LABELS[a.role]?.faction === 'town') ||
                     (isMafia && M_ROLE_LABELS[a.role]?.faction === 'mafia');
        const bWin = (isTown && M_ROLE_LABELS[b.role]?.faction === 'town') ||
                     (isMafia && M_ROLE_LABELS[b.role]?.faction === 'mafia');
        if (aWin && !bWin) return -1;
        if (!aWin && bWin) return  1;
        return a.isAlive ? -1 : 1;
    });

    const playerRows = sorted.map(p => {
        const rl = M_ROLE_LABELS[p.role] || { ua: p.role, icon: '?', faction: 'town', color: '#888' };
        const won = (isTown && rl.faction === 'town') || (isMafia && rl.faction === 'mafia');
        return `
        <div class="m-result-row ${won ? 'winner' : 'loser'} ${!p.isAlive ? 'dead' : ''} ${p.id === mMyIdx ? 'me' : ''}">
            <span class="m-result-icon">${rl.icon}</span>
            <span class="m-result-name">${p.name}${p.id === mMyIdx ? ' (ви)' : ''}</span>
            <span class="m-result-role" style="color:${rl.color}">${rl.ua}</span>
            <span class="m-result-status">${p.isAlive ? '✅ живий' : '💀 загинув'}</span>
        </div>`;
    }).join('');

    return `
        <div class="m-gameover-ui">
            <div class="m-gameover-banner ${bannerClass}">
                <div class="m-gameover-big-icon">${bannerIcon}</div>
                <div class="m-gameover-headline">${bannerText}</div>
                <div class="m-gameover-sub">${iWon ? '🎉 Ви у команді переможців!' : '😔 Ваша команда програла.'}</div>
            </div>

            <div class="m-result-list">
                <div class="m-result-header">
                    <span>Гравець</span><span>Роль</span><span>Статус</span>
                </div>
                ${playerRows}
            </div>

            <div class="m-gameover-stats">
                Раундів зіграно: <b>${s.round}</b> ·
                Вижило: <b>${s.players.filter(p => p.isAlive).length}</b> /
                <b>${s.players.length}</b>
            </div>

            <button class="m-btn primary m-btn-wide" onclick="mReturnToLobby()">
                🏠 Повернутись у лобі
            </button>
        </div>`;
}

function mReturnToLobby() {
    clearSession();
    document.getElementById('mafia-screen').classList.add('hidden');
    document.getElementById('mafia-screen').classList.remove('visible');
    document.getElementById('lobby-screen').classList.remove('hidden');
    setQuitBtn(false);
    if (typeof switchViewport === 'function') switchViewport('lobby');
    fetchRoomCounts();
}

function mSpawnConfetti(winner) {
    const myFaction = M_ROLE_LABELS[mState?.players[mMyIdx]?.role]?.faction;
    const iWon = (winner === 'town' && myFaction === 'town') ||
                 (winner === 'mafia' && myFaction === 'mafia');
    if (!iWon) return;

    const colors = winner === 'mafia'
        ? ['#c62828','#e53935','#ff7043','#ffd700','#880e4f']
        : ['#1565c0','#0288d1','#ffd700','#4caf50','#81d4fa'];

    for (let i = 0; i < 80; i++) {
        const el = document.createElement('div');
        const size = 6 + Math.random() * 8;
        el.style.cssText = `
            position:fixed;top:-12px;left:${Math.random()*100}vw;
            width:${size}px;height:${size}px;
            background:${colors[Math.floor(Math.random()*colors.length)]};
            border-radius:${Math.random()>.5?'50%':'2px'};
            animation:confetti-fall ${2+Math.random()*3}s linear ${Math.random()*1.5}s forwards;
            z-index:9999;pointer-events:none`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 6000);
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
            return targetSelect('mafiaVote', '🔫 Оберіть жертву') + mMafiaChat();

        case 'don':
            return targetSelect('mafiaVote', '🔫 Оберіть жертву') +
                   targetSelect('donCheck', '👁️ Перевірити (Комісар?)') + mMafiaChat();

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

function mDayVote(targetId) {
    if (targetId === null) {
        // Скасувати голос — перемалюємо без відправки
        if (mState) mState.myVote = null;
        mRenderActions();
        return;
    }
    socket.emit('action', { type: 'dayVote', data: { targetId } });
}

// ── Приватний чат мафії ───────────────────────
socket.on('mafiaChat', ({ playerId, name, text }) => {
    const el = document.getElementById('m-mafia-chat');
    if (!el) return;
    const msg = document.createElement('div');
    msg.className = 'm-chat-msg';
    msg.innerHTML = `<b>${name}:</b> ${text}`;
    el.appendChild(msg);
    el.scrollTop = el.scrollHeight;
});

function mSendMafiaChat() {
    const input = document.getElementById('m-mafia-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    socket.emit('mafiaChat', { text });
    input.value = '';
}

// ── Денний чат ────────────────────────────────
socket.on('dayChatMsg', ({ playerId, name, text }) => {
    const log = document.getElementById('m-day-chat-log');
    if (!log) return;
    const empty = log.querySelector('.m-log-empty');
    if (empty) empty.remove();
    const msg = document.createElement('div');
    msg.className = 'm-day-chat-msg' + (playerId === mMyIdx ? ' me' : '');
    msg.innerHTML = `<span class="m-day-chat-name">${name}:</span> ${text}`;
    log.appendChild(msg);
    log.scrollTop = log.scrollHeight;
});

function mSendDayChat() {
    const input = document.getElementById('m-day-chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    socket.emit('dayChatMsg', { text });
    input.value = '';
}

// ── Таймер відліку ────────────────────────────
const _mTimers = {};
function mDeadlineTimer(deadline, onTick) {
    if (!deadline) return '—';
    const sec = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${m}:${String(s).padStart(2,'0')}`;
}
function mStartTimer(elId, deadline) {
    clearInterval(_mTimers[elId]);
    if (!deadline) return;
    _mTimers[elId] = setInterval(() => {
        const el = document.getElementById(elId);
        if (!el) { clearInterval(_mTimers[elId]); return; }
        const sec = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        const m = Math.floor(sec / 60), s = sec % 60;
        el.textContent = `${m}:${String(s).padStart(2,'0')}`;
        if (sec === 0) clearInterval(_mTimers[elId]);
    }, 500);
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

function mMafiaChat() {
    return `
        <div class="m-night-action" style="margin-top:16px">
            <div class="m-night-label">🔴 Чат мафії (приватний)</div>
            <div class="m-chat-box" id="m-mafia-chat"></div>
            <div class="m-chat-input-row">
                <input id="m-mafia-input" class="m-chat-input" type="text"
                       placeholder="Написати спільникам…" maxlength="120"
                       onkeydown="if(event.key==='Enter')mSendMafiaChat()">
                <button class="m-chat-send" onclick="mSendMafiaChat()">➤</button>
            </div>
        </div>`;
}

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
