// ============================================
// МАФІЯ — клієнт (п.2: нічна фаза)
// ============================================
let mState            = null;
let mMyIdx            = null;
let mSideEffect       = null;
let mDeadChatLog      = [];
let _mFlavorTimeouts  = [];
let _mLastNightDL     = 0;
let mGameoverProcessed = false;

function initMafia(state, myIdx) {
    mState             = state;
    mMyIdx             = myIdx;
    mSideEffect        = null;
    mDeadChatLog       = [];
    _mFlavorTimeouts   = [];
    _mLastNightDL      = 0;
    mGameoverProcessed = false;
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('mafia-screen').classList.remove('hidden');
    document.getElementById('mafia-screen').classList.add('visible');
    if (typeof switchViewport === 'function') switchViewport('mafia');
    setQuitBtn(true);
    renderMafia();
}

function updateMafia(state, sideEffect) {
    const prevPhase = mState?.phase;
    if (state.phase === 'night' && prevPhase !== 'night') mSideEffect = null;
    mState = state;
    if (sideEffect) mSideEffect = sideEffect;

    // Звуки при зміні фази
    if (state.phase !== prevPhase) {
        if (state.phase === 'night')           playSound('night');
        else if (state.phase === 'day_discussion') playSound('day');
        else if (state.phase === 'day_voting')  playSound('vote');
        else if (state.phase === 'morning' && state.lastDeaths?.length > 0) playSound('death');
    }
    // Deputy став Sheriff
    if (sideEffect?.newSheriff) {
        setTimeout(() => {
            if (typeof showToast === 'function')
                showToast('👮 Комісар загинув — тепер ви Комісар!', { color: '#0277bd' });
        }, 1200);
    }

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
        resolving:       '⚖️ Підрахунок голосів',
        day_discussion:  '☀️ Обговорення',
        day_voting:      '🗳️ Голосування',
        gameover:        '🏁 Кінець гри',
    };
    el.textContent = `${phaseMap[mState.phase] || mState.phase} · Раунд ${mState.round}`;
    // Фазова атмосфера
    const scr = document.getElementById('mafia-screen');
    if (scr) {
        scr.classList.remove('phase-night','phase-day');
        if (['night','morning','resolving'].includes(mState.phase)) scr.classList.add('phase-night');
        else if (['day_discussion','day_voting'].includes(mState.phase)) scr.classList.add('phase-day');
    }
}

// ── Список гравців ─────────────────────────────
function mRenderPlayers() {
    const el = document.getElementById('m-players');
    if (!el) return;
    const isGameover = mState.phase === 'gameover';
    const isMorning  = mState.phase === 'morning';
    const newlyDead  = isMorning ? (mState.lastDeaths || []) : [];
    el.innerHTML = mState.players.map(p => {
        const isMe = p.id === mMyIdx;
        const roleLabel = p.role ? mRoleLabel(p.role) : null;
        const showRole  = p.role && (p.id === mMyIdx || isGameover ||
            (mState.myFaction === 'mafia' && roleLabel?.faction === 'mafia'));
        const factionCls = isGameover && roleLabel?.faction ? `faction-${roleLabel.faction}` : '';
        const dyingCls   = newlyDead.includes(p.id) ? 'dying' : '';
        return `
        <div class="m-player ${!p.isAlive ? 'dead' : ''} ${isMe ? 'me' : ''} ${factionCls} ${dyingCls}">
            <span class="m-player-icon">${roleLabel?.icon || '👤'}</span>
            <span class="m-player-name">${p.name}${isMe ? ' (я)' : ''}</span>
            ${p.isSilenced ? '<span class="m-silenced">🔇</span>' : ''}
            ${!p.isAlive ? '<span class="m-dead-label">💀</span>' : ''}
            ${showRole
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
                    <div class="m-reveal-auto">
                        Автостарт через <b id="m-reveal-countdown">25</b>с
                    </div>
                    <button class="m-btn primary" onclick="mReady()" id="m-ready-btn">✅ Готовий!</button>
                    <div class="m-reveal-ready-count">
                        Готові: <b>${s.readyCount}</b> / <b>${totalPlayers}</b>
                    </div>
                </div>
            </div>`;
        mStartTimer('m-reveal-countdown', s.revealDeadline);
        return;
    }

    // ── Підрахунок голосів (пауза між голосуванням і наступною ніччю)
    if (s.phase === 'resolving') {
        const eliminated = (s.lastDeaths || []).map(id => s.players[id]).filter(Boolean);
        const resultHtml = eliminated.length
            ? eliminated.map(p => `<div class="m-morning-victim">🚪 ${p.name} покидає місто</div>`).join('')
            : `<div class="m-morning-sub">Нічия — ніхто не вигнаний</div>`;
        el.innerHTML = `
            <div class="m-morning">
                <div class="m-morning-title">⚖️ Результат голосування</div>
                ${resultHtml}
                <div class="m-wait" style="margin-top:12px">🌙 Ніч починається...</div>
                ${!me.isAlive ? mDeadUI() : ''}
            </div>`;
        return;
    }

    // ── Ніч
    if (s.phase === 'night') {
        if (!me.isAlive) { el.innerHTML = mDeadUI(); return; }
        el.innerHTML = mNightActions(s, me);
        if (me.role === 'citizen') {
            mStartTimer('m-night-cit-timer', s.nightDeadline);
            if (s.nightDeadline !== _mLastNightDL) {
                _mLastNightDL = s.nightDeadline;
                mStartNightFlavor(s.nightDeadline);
            }
        } else {
            mStartTimer('m-night-act-timer', s.nightDeadline);
        }
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
        if (me.isAlive) html += `<div class="m-wait" style="margin-top:10px">⏳ Переходимо до дня...</div>`;
        else html += mDeadUI();
        html += `</div>`;
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
                <div class="m-timer-track"><div class="m-timer-bar-fill" id="m-day-timer-bar"></div></div>
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

        // Рахуємо голоси по цілях
        const voteTally = {};
        const voterMap  = {};
        Object.entries(s.allVotes || {}).forEach(([vid, tid]) => {
            const voter = s.players[+vid];
            if (!voter) return;
            voterMap[+vid] = tid;
            if (tid !== 'skip' && tid !== null) {
                voteTally[tid] = (voteTally[tid] || []);
                voteTally[tid].push(voter.name);
            }
        });

        const voteLog = Object.entries(voterMap).map(([vid, tid]) => {
            const voter  = s.players[+vid]?.name || '?';
            const target = tid === 'skip' ? 'пропуск' : (s.players[tid]?.name || '?');
            return `<span class="m-vote-log-item">${voter} → ${target}</span>`;
        }).join('');

        el.innerHTML = `
            <div class="m-vote-ui">
                <div class="m-day-title">🗳️ Голосування</div>
                <div class="m-day-timer" id="m-vote-timer">${timer}</div>
                <div class="m-timer-track"><div class="m-timer-bar-fill" id="m-vote-timer-bar"></div></div>
                <div class="m-vote-count">${s.voteCount} / ${s.eligibleVoters} проголосували</div>
                ${voteLog ? `<div class="m-vote-log">${voteLog}</div>` : ''}

                ${!canVote
                    ? `${me.isAlive ? '' : mDeadUI()}`
                    : alreadyVoted
                    ? `<div class="m-voted-info">
                            ✅ Ви проголосували: <b>${myVote === 'skip' ? 'пропустити' : s.players[myVote]?.name || '?'}</b>
                            <button class="m-btn-small" onclick="mDayVote(null)">↩ Змінити</button>
                        </div>`
                    : `<div class="m-vote-targets">
                            ${targets.map(p => {
                                const cnt = (voteTally[p.id] || []).length;
                                return `<button class="m-vote-target-btn" onclick="mDayVote(${p.id})">
                                    ${p.name}${cnt ? ` <span class="m-vote-badge">${cnt}</span>` : ''}
                                </button>`;
                            }).join('')}
                            <button class="m-vote-skip-btn" onclick="mDayVote('skip')">⏭️ Пропустити</button>
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
    const isManiac = s.winner === 'maniac';
    const myFaction = M_ROLE_LABELS[s.players[mMyIdx]?.role]?.faction;
    const iWon = (isTown && myFaction === 'town') ||
                 (isMafia && myFaction === 'mafia') ||
                 (isManiac && myFaction === 'maniac');

    const bannerClass = isTown ? 'town' : isMafia ? 'mafia' : 'maniac';
    const bannerIcon  = isTown ? '🏙️' : isMafia ? '🔫' : '🔪';
    const bannerText  = isTown ? 'Місто перемогло!' : isMafia ? 'Мафія перемогла!' : 'Маньяк переміг!';

    // Групуємо гравців: спочатку переможці, потім решта
    const sorted = [...s.players].sort((a, b) => {
        const aWin = (isTown && M_ROLE_LABELS[a.role]?.faction === 'town') ||
                     (isMafia && M_ROLE_LABELS[a.role]?.faction === 'mafia') ||
                     (isManiac && a.role === 'maniac');
        const bWin = (isTown && M_ROLE_LABELS[b.role]?.faction === 'town') ||
                     (isMafia && M_ROLE_LABELS[b.role]?.faction === 'mafia') ||
                     (isManiac && b.role === 'maniac');
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
            ${(() => {
                if (!mGameoverProcessed) {
                    mGameoverProcessed = true;
                    playSound(iWon ? 'win' : 'lose');
                    updateStats('mafia', iWon);
                }
                const st = getStats('mafia');
                const isHost = mMyIdx === 0;
                const statsHtml = st.g > 0
                    ? `<div style="font-size:11px;color:rgba(245,230,200,0.35);font-family:sans-serif;margin-bottom:8px">Статистика: ${st.w}/${st.g} перемог</div>`
                    : '';
                const rematch = isHost
                    ? `<button class="m-btn primary m-btn-wide" onclick="socket.emit('restartGame')" style="background:linear-gradient(135deg,#c9a227,#9a7a10);color:#1a0800;margin-bottom:6px">🔄 Реванш</button>`
                    : `<div class="m-wait" style="margin-bottom:8px">Очікуємо реваншу від хоста...</div>`;
                return statsHtml + rematch;
            })()}
            <button class="m-btn primary m-btn-wide" onclick="mReturnToLobby()">
                🏠 Нова гра
            </button>
        </div>`;
}

function mReturnToLobby() {
    clearSession();
    // Прибираємо confetti перед поверненням
    document.querySelectorAll('[style*="confetti-fall"]').forEach(el => el.remove());
    _mFlavorTimeouts.forEach(clearTimeout);
    _mFlavorTimeouts = [];
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
        : winner === 'maniac'
        ? ['#6a1b9a','#ab47bc','#ce93d8','#e040fb','#4a148c']
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
    // Таймер показується всім активним ролям (не тільки мирним)
    const nightTimerHtml = `
        <div class="m-night-timer-active">
            🌙 Ранок через <b id="m-night-act-timer">${mDeadlineTimer(s.nightDeadline)}</b>
        </div>`;

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
            return nightTimerHtml + targetSelect('mafiaVote', '🔫 Оберіть жертву') + mMafiaChat();

        case 'don':
            return nightTimerHtml +
                   targetSelect('mafiaVote', '🔫 Оберіть жертву') +
                   targetSelect('donCheck', '👁️ Перевірити (Комісар?)') + mMafiaChat();

        case 'sheriff':
        case 'deputy':
            return nightTimerHtml + targetSelect('sheriffCheck', '🔍 Перевірити гравця');

        case 'doctor':
            return nightTimerHtml + `<div class="m-night-action">
                <div class="m-night-label">💊 Врятувати гравця</div>
                <div class="m-target-list">
                    ${s.players.filter(p => p.isAlive).map(p => `
                        <button class="m-target-btn" onclick="mNightAction('doctorHeal', ${p.id})">
                            ${p.name}${p.id === mMyIdx ? ' (я)' : ''}
                        </button>`).join('')}
                </div>
            </div>`;

        case 'roleblocker':
            return nightTimerHtml + targetSelect('roleblockerBlock', '🚫 Заблокувати гравця');

        case 'maniac':
            return nightTimerHtml + targetSelect('maniacKill', '🔪 Оберіть жертву');

        default:
            return `
                <div class="m-night-atmosphere">
                    <div class="m-night-title">🌙 Місто спить</div>
                    <div class="m-night-timer-row">
                        Ранок через <b id="m-night-cit-timer">${mDeadlineTimer(s.nightDeadline)}</b>
                    </div>
                    <div class="m-night-flavor" id="m-night-flavor"></div>
                </div>`;
    }
}

// ── Лог ──────────────────────────────────────
function mRenderLog() {
    const el = document.getElementById('m-log');
    if (!el) return;
    const entries = (mState.log || []).slice(0, 25);
    if (!entries.length) { el.innerHTML = '<div class="m-log-empty">Лог порожній</div>'; return; }
    el.innerHTML = entries.map((e, i) => {
        const text = e.text || e;
        const type = e.type || '';
        const cls  = type ? `m-log-entry m-log-${type}` : 'm-log-entry';
        const newest = i === 0 ? ' m-log-newest' : '';
        return `<div class="${cls}${newest}">${text}</div>`;
    }).join('');
}

// ── Дії гравця ────────────────────────────────
function mReady() {
    socket.emit('action', { type: 'mafiaReady', data: {} });
    const btn = document.getElementById('m-ready-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Очікуємо інших...'; }
}

function mDayVote(targetId) {
    // null = скасування → сервер видаляє голос, stateUpdate оновить UI
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

// ── Чат мертвих ───────────────────────────────
function mDeadUI() {
    const msgs = mDeadChatLog.map(m =>
        `<div class="m-dead-chat-msg"><span class="m-day-chat-name">👻 ${m.name}:</span> ${m.text}</div>`
    ).join('') || `<div class="m-log-empty">Тут говорять привиди...</div>`;
    return `
        <div class="m-dead-chat-wrap">
            <div class="m-dead-chat-title">👻 Чат мертвих</div>
            <div class="m-dead-chat-log" id="m-dead-chat-log">${msgs}</div>
            <div class="m-chat-input-row">
                <input id="m-dead-chat-input" class="m-chat-input m-dead-input" maxlength="200"
                    placeholder="Тільки мертві чують..."
                    onkeydown="if(event.key==='Enter')mSendDeadChat()">
                <button class="m-chat-send m-dead-send" onclick="mSendDeadChat()">➤</button>
            </div>
        </div>`;
}

socket.on('deadChat', ({ name, text }) => {
    mDeadChatLog.push({ name, text });
    // Якщо вже є живий елемент — додаємо без перерендеру
    const log = document.getElementById('m-dead-chat-log');
    if (log) {
        const empty = log.querySelector('.m-log-empty');
        if (empty) empty.remove();
        const msg = document.createElement('div');
        msg.className = 'm-dead-chat-msg';
        msg.innerHTML = `<span class="m-day-chat-name">👻 ${name}:</span> ${text}`;
        log.appendChild(msg);
        log.scrollTop = log.scrollHeight;
    }
});

function mSendDeadChat() {
    const input = document.getElementById('m-dead-chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    socket.emit('deadChat', { text });
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

// ── Нічний флейвор для мирних ─────────────────
const NIGHT_FLAVOR = [
    { pct: 0.06, icon: '🌙', text: 'Місто вкрилось тишею. Але не всі лягли спати...' },
    { pct: 0.20, icon: '🤫', text: 'В темному кварталі — приглушені голоси. Кілька тіней вийшли на вулицю.' },
    { pct: 0.33, icon: '💊', text: 'У місті загострився грип. Місцевий лікар наповнив саквояж і попрямував до когось із мешканців — для профілактики.' },
    { pct: 0.46, icon: '🚪', text: 'Хтось зателефонував і замовив нічний візит. Повія зібрала сумочку і вийшла з дому — в когось цієї ночі зіпсуються плани.' },
    { pct: 0.58, icon: '🔦', text: 'Силует із блокнотом завмер під ліхтарем. Комісар перевіряє підозрюваних — хтось цієї ночі дізнається правду.' },
    { pct: 0.70, icon: '🔫', text: 'За шторою мигнула тінь. Мафія зібралась на нараду — і обрала жертву.' },
    { pct: 0.81, icon: '🔪', text: 'У провулку мигнуло щось гостре. Самотній маньяк іде через ніч зі своїми думками.' },
    { pct: 0.93, icon: '⏰', text: 'Небо на сході починає світлішати. Скоро місто дізнається що трапилось...' },
];

function mStartNightFlavor(deadline) {
    _mFlavorTimeouts.forEach(clearTimeout);
    _mFlavorTimeouts = [];
    const remaining = Math.max(500, deadline - Date.now());
    NIGHT_FLAVOR.forEach(({ pct, icon, text }) => {
        const t = setTimeout(() => {
            const feed = document.getElementById('m-night-flavor');
            if (!feed) return;
            const msg = document.createElement('div');
            msg.className = 'm-flavor-msg';
            msg.innerHTML = `<span class="m-flavor-icon">${icon}</span><span>${text}</span>`;
            feed.appendChild(msg);
            feed.scrollTop = feed.scrollHeight;
        }, pct * remaining);
        _mFlavorTimeouts.push(t);
    });
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
    const total = Math.max(1, deadline - Date.now());
    _mTimers[elId] = setInterval(() => {
        const el = document.getElementById(elId);
        if (!el) { clearInterval(_mTimers[elId]); return; }
        const rem = Math.max(0, deadline - Date.now());
        const sec = Math.ceil(rem / 1000);
        el.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2,'0')}`;
        const bar = document.getElementById(elId + '-bar');
        if (bar) {
            const pct = rem / total * 100;
            bar.style.width = pct + '%';
            bar.className = 'm-timer-bar-fill' + (pct > 40 ? '' : pct > 15 ? ' warn' : ' danger');
        }
        if (rem === 0) clearInterval(_mTimers[elId]);
    }, 300);
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
    mafia:       { ua: 'Мафія',         icon: '🔫', faction: 'mafia',   color: '#c62828' },
    don:         { ua: 'Дон',           icon: '👑', faction: 'mafia',   color: '#b71c1c' },
    maniac:      { ua: 'Маньяк',        icon: '🔪', faction: 'maniac',  color: '#6a1b9a' },
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
        maniac:      'Вбивайте всіх підряд — без різниці хто. Перемагаєте коли всі інші мертві.',
    };
    return descs[role] || '';
}
