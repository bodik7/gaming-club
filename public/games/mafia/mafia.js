// ============================================
// МАФІЯ — клієнт (Noir UI redesign)
// ============================================
let mState             = null;
let mMyIdx             = null;
let mDeadChatLog       = [];
let _mFlavorTimeouts   = [];
let _mLastNightDL      = 0;
let mGameoverProcessed = false;
let _mNightSelections  = {}; // { actionType: targetId }
let _mActiveTab        = 'players';
let _mLogBadge         = 0;
let _mChatBadge        = 0;
let _mLastLogLen       = 0;
let _mChatRound        = 0;
let _mLastPhase        = null;

function initMafia(state, myIdx) {
    mState             = state;
    mMyIdx             = myIdx;
    mDeadChatLog       = [];
    _mFlavorTimeouts   = [];
    _mLastNightDL      = 0;
    mGameoverProcessed = false;
    _mNightSelections  = {};
    _mActiveTab        = 'players';
    _mLogBadge         = 0;
    _mChatBadge        = 0;
    _mLastLogLen       = 0;
    _mChatRound        = 0;
    _mLastPhase        = null;
    mSwitchTab('players', true);
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('mafia-screen').classList.remove('hidden');
    document.getElementById('mafia-screen').classList.add('visible');
    if (typeof switchViewport === 'function') switchViewport('mafia');
    setQuitBtn(true);
    // Clear only day chat on game init; mafia chat persists across nights
    const dayChatMsgs = document.getElementById('m-day-chat-msgs');
    if (dayChatMsgs) dayChatMsgs.innerHTML = '';
    renderMafia();
}

function updateMafia(state, sideEffect) {
    const prevPhase = mState?.phase;
    if (state.phase === 'night' && prevPhase !== 'night') {
        _mNightSelections = {};
    }
    if (state.phase === 'day_discussion' && prevPhase !== 'day_discussion') {
        _mChatRound = 0;
    }
    mState = state;
    if (sideEffect) {
        // Deputy став Sheriff
        if (sideEffect.newSheriff) {
            setTimeout(() => {
                if (typeof showToast === 'function')
                    showToast('👮 Комісар загинув — тепер ви Комісар!', { color: '#0277bd' });
            }, 1200);
        }
        if (sideEffect.event === 'donResult') {
            const r = sideEffect;
            // Don result goes to mafia night chat (don is mafia faction)
            const chatMsgs = document.getElementById('m-mafia-chat-msgs');
            if (chatMsgs) {
                const msg = document.createElement('div');
                msg.className = 'm-chat-msg system';
                msg.innerHTML = `<span class="m-chat-msg-sender">Перевірка Дона</span>
                    <span class="m-chat-msg-text" style="color:${r.isSheriff ? '#fca5a5' : '#6ee7b7'}">
                        👁 ${r.targetName} — ${r.isSheriff ? '🚨 КОМІСАР!' : '✅ Не комісар'}
                    </span>`;
                chatMsgs.appendChild(msg);
                chatMsgs.scrollTop = chatMsgs.scrollHeight;
            }
        }
        // Sheriff check result goes to day chat (always visible, sheriff is town)
        if (sideEffect.event === 'sheriffResult') {
            const r = sideEffect;
            const chatMsgs = document.getElementById('m-day-chat-msgs');
            if (chatMsgs) {
                const msg = document.createElement('div');
                msg.className = 'm-chat-msg system';
                msg.innerHTML = `<span class="m-chat-msg-sender">Результат перевірки</span>
                    <span class="m-chat-msg-text" style="color:${r.isBad ? '#fca5a5' : '#6ee7b7'}">
                        🔍 ${r.targetName} — ${r.isBad ? '🔴 МАФІЯ!' : '🟢 Мирний'}
                    </span>`;
                chatMsgs.appendChild(msg);
                chatMsgs.scrollTop = chatMsgs.scrollHeight;
                mBumpChatBadge();
            }
        }
    }
    // Phase change effects
    if (state.phase !== prevPhase) {
        _mLastPhase = prevPhase;
        if (state.phase === 'night')             playSound('night');
        else if (state.phase === 'day_discussion') playSound('day');
        else if (state.phase === 'day_voting')   playSound('vote');
        else if (state.phase === 'morning' && state.lastDeaths?.length > 0) playSound('death');
        if (typeof _sendNotif === 'function') {
            if (state.phase === 'night') _sendNotif('Мафія', 'Настала ніч — час дій!');
            else if (state.phase === 'day_discussion') _sendNotif('Мафія', 'Обговорення — хто винуватий?');
            else if (state.phase === 'day_voting') _sendNotif('Мафія', 'Час голосувати!');
        }
        mPhaseFlash(state.phase);
        // Return to players tab on phase change
        mSwitchTab('players');
    }
    renderMafia();
}

// ── Tab switching ─────────────────────────────
function mSwitchTab(tab, silent) {
    _mActiveTab = tab;
    const body = document.querySelector('.m-body');
    if (body) {
        body.classList.remove('tab-chat', 'tab-players', 'tab-passport');
        body.classList.add('tab-' + tab);
    }
    document.querySelectorAll('.m-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    if (tab === 'chat') {
        _mChatBadge = 0;
        const b = document.getElementById('m-tab-badge-chat');
        if (b) b.style.display = 'none';
    }
    if (tab === 'passport') {
        _mLogBadge = 0;
        const b = document.getElementById('m-tab-badge-log');
        if (b) b.style.display = 'none';
    }
    if (tab === 'players') {
        const b = document.getElementById('m-tab-badge-players');
        if (b) b.style.display = 'none';
    }
}

function mBumpLogBadge() {
    if (_mActiveTab === 'passport') return;
    _mLogBadge++;
    const b = document.getElementById('m-tab-badge-log');
    if (b) { b.textContent = _mLogBadge > 9 ? '9+' : _mLogBadge; b.style.display = ''; }
}

function mBumpChatBadge() {
    if (_mActiveTab === 'chat') return;
    _mChatBadge++;
    const b = document.getElementById('m-tab-badge-chat');
    if (b) { b.textContent = _mChatBadge > 9 ? '9+' : _mChatBadge; b.style.display = ''; }
}

// ── Main render ───────────────────────────────
function renderMafia() {
    if (!mState) return;
    mRenderPhaseInfo();
    mRenderPlayers();
    mRenderActions();
    mRenderPassport();
    mRenderLog();
}

// ── Phase info ────────────────────────────────
function mRenderPhaseInfo() {
    const el = document.getElementById('m-phase-info');
    const me = mMyIdx !== null ? mState.players[mMyIdx] : null;

    const phaseMap = {
        role_reveal:    { label: 'ПІДГОТОВКА',   name: 'Перегляд ролі', bar: 5  },
        night:          { label: 'ФАЗА НОЧІ',     name: 'Ніч',           bar: 33 },
        morning:        { label: 'РАНОК',          name: 'Ранок',         bar: 50 },
        resolving:      { label: 'ПІДРАХУНОК',    name: 'Голосування',   bar: 90 },
        day_discussion: { label: 'ФАЗА ДНЯ',      name: 'Обговорення',   bar: 66 },
        day_voting:     { label: 'ДЕННИЙ СУД',    name: 'Голосування',   bar: 85 },
        gameover:       { label: 'КІНЕЦЬ ГРИ',    name: 'Фінал',         bar: 100},
    };
    const ph = phaseMap[mState.phase] || { label: mState.phase.toUpperCase(), name: mState.phase, bar: 50 };

    if (el) el.textContent = `${ph.name} · Раунд ${mState.round}`;

    const lblEl   = document.getElementById('m-phase-block-label');
    const nameEl  = document.getElementById('m-phase-block-name');
    const barEl   = document.getElementById('m-phase-bar');
    const roundEl = document.getElementById('m-phase-round');
    if (lblEl)   lblEl.textContent  = ph.label;
    if (nameEl)  nameEl.textContent = ph.name;
    if (barEl)   barEl.style.width  = ph.bar + '%';
    if (roundEl) roundEl.textContent = `Раунд ${mState.round}`;

    // Phase timer in left col
    let deadline = null;
    if (mState.phase === 'night')           deadline = mState.nightDeadline;
    else if (mState.phase === 'day_discussion') deadline = mState.dayDeadline;
    else if (mState.phase === 'day_voting') deadline = mState.voteDeadline;
    else if (mState.phase === 'role_reveal') deadline = mState.revealDeadline;
    mStartPhaseTimer(deadline);

    // Phase atmosphere class
    const scr = document.getElementById('mafia-screen');
    if (scr) {
        scr.classList.remove('phase-night', 'phase-day');
        if (['night', 'morning', 'resolving'].includes(mState.phase)) scr.classList.add('phase-night');
        else if (['day_discussion', 'day_voting'].includes(mState.phase)) scr.classList.add('phase-day');
    }

    // Chat UI update
    mUpdateChatUI();

    // Action prompt
    const promptEl = document.getElementById('m-action-prompt');
    if (promptEl) {
        if (!me) {
            const spectatorPrompts = {
                night:          '👁 Ніч — спостерігаєте',
                day_discussion: '👁 Обговорення — спостерігаєте',
                day_voting:     '👁 Голосування — спостерігаєте',
                morning:        '👁 Ранок',
                role_reveal:    '👁 Режим глядача',
                resolving:      '👁 Підраховуємо голоси...',
                gameover:       '👁 Гра завершена',
            };
            promptEl.textContent = spectatorPrompts[mState.phase] || '👁 Спостерігаєте';
        } else {
            const actionType = mGetActionTypeForRole(me.role);
            const prompts = {
                night:          me.isAlive ? (actionType ? 'Нічна дія: оберіть ціль' : 'Ви спите...') : 'Ви загинули',
                day_discussion: 'Обговорення: шукайте мафію',
                day_voting:     'Голосуйте проти підозрюваного',
                morning:        'Місто прокидається...',
                role_reveal:    'Ознайомтесь зі своєю роллю',
                resolving:      'Підраховуємо голоси...',
                gameover:       'Гра завершена',
            };
            promptEl.textContent = prompts[mState.phase] || '';
        }
    }

    // Alive count
    const aliveEl = document.getElementById('m-alive-count');
    if (aliveEl) {
        const alive = mState.players.filter(p => p.isAlive).length;
        const dead  = mState.players.filter(p => !p.isAlive).length;
        aliveEl.textContent = `(${alive} живих, ${dead} мертвих)`;
    }
}

function mUpdateChatUI() {
    if (!mState) return;
    if (mMyIdx === null) {
        // Spectator: read-only day chat
        const dayTitleEl   = document.getElementById('m-day-chat-title');
        const dayInputWrap = document.getElementById('m-day-chat-input-wrap');
        const mafiaChatArea = document.getElementById('m-mafia-chat-area');
        const quickEl      = document.getElementById('m-quick-replies');
        if (dayTitleEl)   dayTitleEl.textContent    = '👁 Денний чат (глядач)';
        if (dayInputWrap) dayInputWrap.style.display = 'none';
        if (mafiaChatArea) mafiaChatArea.style.display = 'none';
        if (quickEl) quickEl.style.display = 'none';
        return;
    }
    const me = mState.players[mMyIdx];
    if (!me) return;

    const dayTitleEl      = document.getElementById('m-day-chat-title');
    const dayInputWrap    = document.getElementById('m-day-chat-input-wrap');
    const dayInput        = document.getElementById('m-day-chat-input');
    const mafiaChatArea   = document.getElementById('m-mafia-chat-area');
    const quickEl         = document.getElementById('m-quick-replies');

    const isNight     = mState.phase === 'night';
    const isDay       = mState.phase === 'day_discussion' || mState.phase === 'day_voting';
    const isMafia     = me.role === 'mafia' || me.role === 'don';

    // Day chat: always visible
    if (!me.isAlive) {
        if (dayTitleEl)   dayTitleEl.textContent    = 'Денний чат 💬 (привид)';
        if (dayInputWrap) dayInputWrap.style.display = '';
        if (dayInput)     dayInput.placeholder       = '👻 Написати як привид...';
    } else if (isNight) {
        if (dayTitleEl)   dayTitleEl.textContent    = '🌙 Місто спить — аналізуйте чат';
        if (dayInputWrap) dayInputWrap.style.display = 'none';
    } else if (isDay) {
        if (dayTitleEl)   dayTitleEl.textContent    = 'Денний чат 💬';
        if (dayInputWrap) dayInputWrap.style.display = me.isSilenced ? 'none' : '';
        if (dayInput)     dayInput.placeholder       = 'Написати...';
    } else {
        if (dayTitleEl)   dayTitleEl.textContent    = 'Денний чат 💬';
        if (dayInputWrap) dayInputWrap.style.display = 'none';
    }

    // Mafia night chat: only for mafia/don at night
    if (mafiaChatArea) {
        mafiaChatArea.style.display = (me.isAlive && isMafia && isNight) ? 'flex' : 'none';
    }

    // Quick replies: alive, day phase, not silenced
    if (quickEl) quickEl.style.display = (me.isAlive && isDay && !me.isSilenced) ? '' : 'none';
}

// ── Player grid ───────────────────────────────
function mRenderPlayers() {
    const el = document.getElementById('m-players-grid');
    if (!el) return;
    const s  = mState;
    const me = mMyIdx !== null ? s.players[mMyIdx] : null;

    const isGameover = s.phase === 'gameover';
    const isMorning  = s.phase === 'morning';
    const newlyDead  = isMorning ? (s.lastDeaths || []) : [];

    // Players tab badge on death
    if (newlyDead.length > 0 && _mActiveTab !== 'players') {
        const b = document.getElementById('m-tab-badge-players');
        if (b) { b.textContent = '💀'; b.style.display = ''; }
    } else if (_mActiveTab === 'players') {
        const b = document.getElementById('m-tab-badge-players');
        if (b) b.style.display = 'none';
    }

    // Sort: alive first except gameover
    const displayPlayers = isGameover
        ? s.players
        : [...s.players].sort((a, b) => (b.isAlive ? 1 : 0) - (a.isAlive ? 1 : 0));

    el.innerHTML = displayPlayers.map((p, _di) => {
        const realIdx = s.players.indexOf(p);
        const isMe = p.id === mMyIdx;
        const rl   = p.role ? mRoleLabel(p.role) : null;
        const showRole = p.role && (
            p.id === mMyIdx || isGameover ||
            (s.myFaction === 'mafia' && rl?.faction === 'mafia')
        );
        const factionCls = isGameover && rl?.faction ? `faction-${rl.faction}` : '';
        const dyingCls   = newlyDead.includes(p.id) ? 'dying' : '';
        const deadCls    = !p.isAlive ? 'dead' : '';
        const meCls      = isMe ? 'me' : '';
        const offlineCls = typeof _offlinePlayers !== 'undefined' && _offlinePlayers.has(realIdx) ? 'offline' : '';

        // Sheriff finding for this player (visible to sheriff+deputy only)
        const finding    = s.sheriffFindings?.find(f => f.id === p.id);
        const donFinding = s.donFindings?.find(f => f.id === p.id);

        // State badge
        let stateBadge = '';
        if (!p.isAlive) {
            stateBadge = `<span class="m-player-state-badge dead-badge">УБИТИЙ</span>`;
        } else if (p.isSilenced) {
            stateBadge = `<span class="m-player-state-badge silenced-badge">🤫 МОВЧИТЬ</span>`;
        } else if (s.phase === 'day_voting' && s.allVotes) {
            const cnt = Object.values(s.allVotes).filter(tid => tid === p.id).length;
            if (cnt > 0) stateBadge = `<span class="m-player-state-badge vote-badge">⚖️ ${cnt}</span>`;
        }

        // Action button
        let actionBtn = '';
        if (me?.isAlive) {
            if (s.phase === 'night') {
                const actionType = mGetActionTypeForRole(me.role);
                const secondaryType = mGetSecondaryActionForRole(me.role);
                if (actionType && !isMe) {
                    const canTarget = (!isMe) || (me.role === 'doctor');
                    if (canTarget) {
                        const isSel = _mNightSelections[actionType] === p.id;
                        const icons = { mafia:'🎯', don:'🎯', sheriff:'🔍', deputy:'🔍', doctor:'💊', roleblocker:'🚫', maniac:'🔪' };
                        // Для дона показуємо дві кнопки: вбити (🎯) і перевірити (👁)
                        if (secondaryType) {
                            const isSelCheck = _mNightSelections[secondaryType] === p.id;
                            actionBtn = `<div class="m-card-action-duo">
                                <button class="m-card-action-btn${isSel ? ' selected' : ''}"
                                    onclick="mNightAction('${actionType}', ${p.id})" title="Вбити">${isSel ? '✓' : '🎯'}</button>
                                <button class="m-card-action-btn check-btn${isSelCheck ? ' selected' : ''}"
                                    onclick="mNightAction('${secondaryType}', ${p.id})" title="Перевірити">${isSelCheck ? '✓' : '👁'}</button>
                            </div>`;
                        } else {
                            actionBtn = `<button class="m-card-action-btn${isSel ? ' selected' : ''}"
                                onclick="mNightAction('${actionType}', ${p.id})">${isSel ? '✓' : (icons[me.role] || '🎯')}</button>`;
                        }
                    }
                }
            } else if (s.phase === 'day_voting' && !isMe && !me.isSilenced) {
                const isSel = s.myVote === p.id;
                actionBtn = `<button class="m-card-action-btn vote-btn${isSel ? ' selected' : ''}"
                    onclick="mDayVote(${isSel ? 'null' : p.id})">${isSel ? '✓' : '⚖️'}</button>`;
            }
        }

        // Role display
        let roleText = '';
        let roleColor = '#71717a';
        if (showRole && rl) {
            roleText  = `${rl.icon} ${rl.ua}`;
            roleColor = rl.color || '#71717a';
        } else if (isMe && rl) {
            roleText  = `${rl.icon} ${rl.ua}`;
            roleColor = rl.color || '#71717a';
        } else if (!p.isAlive && rl) {
            roleText  = `${rl.icon} ${rl.ua}`;
            roleColor = rl.color || '#71717a';
        } else {
            roleText = '🔒 ПРИХОВАНА';
        }

        const avatarHtml = window.renderAvatarEl
            ? window.renderAvatarEl(p.avatarId, p.avatarColor, p.name[0], 32)
            : '';
        return `
        <div class="m-player-card ${deadCls} ${meCls} ${factionCls} ${dyingCls} ${offlineCls}">
            ${actionBtn}
            <div>
                <div class="m-player-card-top">
                    <div class="m-player-card-name-wrap">
                        ${avatarHtml}
                        <span class="m-player-alive-dot ${p.isAlive ? 'alive' : 'dead'}"></span>
                        <span class="m-player-card-name">${p.name}${isMe ? ' (Я)' : ''}${offlineCls ? ' 📴' : ''}</span>
                    </div>
                    ${stateBadge}
                </div>
            </div>
            <div class="m-player-card-bottom">
                <span class="m-player-card-status">${p.isAlive ? 'ЖИВИЙ' : 'МЕРТВИЙ'}</span>
                <span class="m-player-card-role${(showRole || isMe || !p.isAlive) && rl ? ' revealed' : ''}"
                    style="color:${roleColor}">${roleText}</span>
            </div>
            ${finding ? (() => {
                const frl = M_ROLE_LABELS[finding.role] || { ua: finding.role, icon: '?', faction: 'town', color: '#888' };
                const isBad = frl.faction === 'mafia';
                return `<div class="m-sheriff-finding ${isBad ? 'bad' : 'good'}">🔍 ${frl.icon} ${frl.ua}</div>`;
            })() : ''}
            ${donFinding ? `<div class="m-sheriff-finding ${donFinding.isSheriff ? 'bad' : 'good'}">
                👁 ${donFinding.isSheriff ? '🚨 КОМІСАР' : '✅ Не комісар'}
            </div>` : ''}
        </div>`;
    }).join('');
}

// ── Actions (full-screen + panel) ─────────────
function mRenderActions() {
    const s  = mState;
    const me = mMyIdx !== null ? s.players[mMyIdx] : null;
    if (!me) return;

    const actionsEl  = document.getElementById('m-actions');
    const playersSec = document.getElementById('m-players-section');
    const panelEl    = document.getElementById('m-action-panel');

    // Spectator: always show players, no actions
    if (!me) {
        if (actionsEl)  actionsEl.style.display  = 'none';
        if (playersSec) playersSec.style.display = 'flex';
        if (panelEl)    panelEl.style.display    = 'none';
        return;
    }

    const fullScreenPhases = ['role_reveal', 'morning', 'resolving', 'gameover'];
    const isFullScreen = fullScreenPhases.includes(s.phase);

    if (isFullScreen) {
        if (actionsEl)  actionsEl.style.display  = 'flex';
        if (playersSec) playersSec.style.display = 'none';
        if (panelEl)    panelEl.style.display    = 'none';
        mRenderFullScreen(s, me, actionsEl);
    } else {
        if (actionsEl)  actionsEl.style.display  = 'none';
        if (playersSec) playersSec.style.display = 'flex';
        mRenderActionPanel(s, me);

        // Night flavor for citizens (goes to chat area)
        if (s.phase === 'night' && me.role === 'citizen' && me.isAlive) {
            if (s.nightDeadline !== _mLastNightDL) {
                _mLastNightDL = s.nightDeadline;
                mStartNightFlavor(s.nightDeadline);
            }
        }
    }
}

function mRenderFullScreen(s, me, el) {
    if (!el) return;

    // ── Role reveal
    if (s.phase === 'role_reveal') {
        const rl = mRoleLabel(me.role);
        const isMafia  = rl?.faction === 'mafia';
        const isManiac = rl?.faction === 'maniac';
        const themeCls = isMafia ? 'mafia' : isManiac ? 'maniac' : 'town';
        const factionLabel = isMafia ? '🔴 Мафія' : isManiac ? '🟣 Маньяк' : '🔵 Місто';
        const allies = isMafia
            ? s.players.filter(p => p.id !== mMyIdx && s.mafiaIds?.includes(p.id)).map(p => p.name)
            : [];

        el.innerHTML = `
            <div class="m-role-reveal m-role-reveal--${themeCls}">
                <div class="m-role-reveal-faction">${factionLabel}</div>
                <div class="m-role-reveal-icon">${rl?.icon || '?'}</div>
                <div class="m-role-reveal-name">${rl?.ua || me.role}</div>
                <div class="m-role-reveal-desc">${mRoleDesc(me.role)}</div>
                ${allies.length ? `<div class="m-role-allies">🤝 Спільники: <b>${allies.join(', ')}</b></div>` : ''}
                <div class="m-reveal-footer">
                    <div class="m-reveal-auto">Автостарт через <b id="m-reveal-countdown">25</b>с</div>
                    <button class="m-btn primary" onclick="mReady()" id="m-ready-btn">✅ Готовий!</button>
                    <div class="m-reveal-ready-count">Готові: <b>${s.readyCount}</b> / <b>${s.players.length}</b></div>
                </div>
            </div>`;
        mStartTimer('m-reveal-countdown', s.revealDeadline);
        return;
    }

    // ── Resolving
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
            </div>`;
        return;
    }

    // ── Morning
    if (s.phase === 'morning') {
        let html = `<div class="m-morning">`;
        if (!s.lastDeaths?.length) {
            html += `<div class="m-morning-title">🌅 Місто прокинулось</div>
                     <div class="m-morning-sub">Цієї ночі ніхто не загинув</div>`;
        } else {
            html += `<div class="m-morning-title">💀 Вночі загинули</div>`;
            s.lastDeaths.forEach(id => {
                const p = s.players[id];
                if (p) html += `<div class="m-morning-victim">${p.name} — ${mRoleLabel(p.role)?.ua || p.role}</div>`;
            });
        }
        if (!me.isAlive) html += `<div class="m-wait" style="margin-top:10px">💀 Ви загинули</div>`;
        else             html += `<div class="m-wait" style="margin-top:10px">⏳ Переходимо до дня...</div>`;
        html += `</div>`;
        el.innerHTML = html;
        return;
    }

    // ── Gameover
    if (s.phase === 'gameover') {
        el.innerHTML = mGameoverUI(s);
        mSpawnConfetti(s.winner);
    }
}

function mRenderActionPanel(s, me) {
    const panel      = document.getElementById('m-action-panel');
    const iconEl     = document.getElementById('m-panel-icon');
    const titleEl    = document.getElementById('m-panel-title');
    const descEl     = document.getElementById('m-panel-desc');
    const skipBtn    = document.getElementById('m-panel-skip');
    const confirmBtn = document.getElementById('m-panel-confirm');
    if (!panel || !me) return;

    if (s.phase === 'night') {
        if (!me.isAlive) { panel.style.display = 'none'; return; }

        const actionType = mGetActionTypeForRole(me.role);
        if (!actionType) {
            // Citizen: show minimal night panel
            panel.style.display = 'flex';
            if (iconEl)  iconEl.textContent  = '🌙';
            if (titleEl) titleEl.textContent = 'МІСТО СПИТЬ';
            if (descEl)  descEl.textContent  = 'Очікуйте результатів ночі...';
            if (skipBtn)    skipBtn.style.display    = 'none';
            if (confirmBtn) confirmBtn.style.display = 'none';
            return;
        }

        panel.style.display = 'flex';
        const sel     = _mNightSelections[actionType];
        const selName = sel !== undefined ? s.players.find(p => p.id === sel)?.name : null;

        const cfgs = {
            mafia:       { icon: '🩸', title: 'ГОЛОСУВАННЯ МАФІЇ', desc: 'Оберіть кого вбити цієї ночі' },
            don:         { icon: '🩸', title: 'ГОЛОСУВАННЯ ДОНА',  desc: 'Голосуйте та оберіть гравця для перевірки' },
            sheriff:     { icon: '🔍', title: 'ПЕРЕВІРКА КОМІСАРА', desc: 'Оберіть гравця для перевірки' },
            deputy:      { icon: '🔍', title: 'ПЕРЕВІРКА ПОМІЧНИКА', desc: 'Оберіть гравця для перевірки' },
            doctor:      { icon: '💊', title: 'ПОРЯТУНОК', desc: 'Оберіть кого рятувати цієї ночі' },
            roleblocker: { icon: '🚫', title: 'НІЧНИЙ ВІЗИТ', desc: 'Оберіть кого заблокувати' },
            maniac:      { icon: '🔪', title: 'ПОЛЮВАННЯ МАНЬЯКА', desc: 'Оберіть свою жертву' },
        };
        const cfg = cfgs[me.role] || { icon: '🎯', title: 'ДІЯ', desc: 'Оберіть ціль' };

        if (iconEl)  iconEl.textContent  = cfg.icon;
        if (titleEl) titleEl.textContent = cfg.title;
        if (descEl)  descEl.textContent  = selName
            ? `✅ Обрано: ${selName} — натисніть ще раз для скасування`
            : cfg.desc;
        if (skipBtn)    skipBtn.style.display    = '';
        if (confirmBtn) confirmBtn.style.display = '';

    } else if (s.phase === 'day_voting') {
        if (!me.isAlive || me.isSilenced) { panel.style.display = 'none'; return; }
        panel.style.display = 'flex';

        if (iconEl)  iconEl.textContent  = '⚖️';
        if (titleEl) titleEl.textContent = 'ДЕННИЙ СУД';

        const votedName = s.myVote && s.myVote !== 'skip' ? s.players[s.myVote]?.name : null;
        if (descEl) descEl.textContent = s.myVote
            ? `Ваш голос: ${votedName || 'пропустити'} — натисніть ↩ для скасування`
            : `${s.voteCount ?? 0}/${s.eligibleVoters ?? '?'} проголосували`;

        if (skipBtn)    { skipBtn.style.display = ''; skipBtn.textContent = 'ПРОПУСТИТИ'; }
        if (confirmBtn) confirmBtn.style.display = 'none';

    } else {
        panel.style.display = 'none';
    }
}

// ── Passport (right col) ──────────────────────
function mRenderPassport() {
    if (!mState || mMyIdx === null) return;
    const me = mState.players[mMyIdx];
    if (!me?.role) return;

    const rl   = M_ROLE_LABELS[me.role] || { ua: me.role, icon: '?', faction: 'town', color: '#888' };
    const desc = mRoleDesc(me.role);

    const fcColors = {
        town:   { chip: '#1d4ed8', bg: 'rgba(29,78,216,0.09)',   border: 'rgba(59,130,246,0.28)',  ability: 'rgba(29,78,216,0.06)',   abilityBorder: 'rgba(59,130,246,0.2)' },
        mafia:  { chip: '#b91c1c', bg: 'rgba(185,28,28,0.09)',   border: 'rgba(220,38,38,0.28)',   ability: 'rgba(185,28,28,0.06)',   abilityBorder: 'rgba(220,38,38,0.2)' },
        maniac: { chip: '#7c3aed', bg: 'rgba(109,40,217,0.09)', border: 'rgba(168,85,247,0.28)',  ability: 'rgba(109,40,217,0.06)', abilityBorder: 'rgba(168,85,247,0.2)' },
    };
    const fc = fcColors[rl.faction] || fcColors.town;

    // Chip
    const chipEl = document.getElementById('m-passport-chip');
    if (chipEl) {
        chipEl.textContent = (rl.ua || 'РОЛЬ').toUpperCase().slice(0, 10);
        chipEl.style.cssText = `background:${fc.bg};border:1px solid ${fc.border};color:${rl.color || '#aaa'}`;
    }

    // Role card
    const cardEl = document.getElementById('m-passport-card');
    if (cardEl) {
        cardEl.innerHTML = `
            <div class="m-passport-role-wrap">
                <span class="m-passport-role-emoji">${rl.icon}</span>
                <h4 class="m-passport-role-name" style="color:${rl.color}">${rl.ua}</h4>
            </div>
            <p class="m-passport-role-desc">${desc}</p>
            <div class="m-passport-ability" style="background:${fc.ability};border:1px solid ${fc.abilityBorder}">
                <span class="m-passport-ability-title" style="color:${rl.color}">Ваша здібність</span>
                <span class="m-passport-ability-text">${mRoleAbility(me.role)}</span>
            </div>`;
    }

    // Stats
    const statsEl = document.getElementById('m-passport-stats');
    if (statsEl) {
        const factionName = { town: 'МИРНІ', mafia: 'МАФІЯ', maniac: 'МАНЬЯК' }[rl.faction] || '?';
        const statusColor = me.isAlive ? '#10b981' : '#ef4444';
        const blockedColor = me.isSilenced ? '#c084fc' : '#71717a';
        statsEl.innerHTML = `
            <div class="m-passport-stat-row">
                <span class="m-passport-stat-label">СТАТУС:</span>
                <span class="m-passport-stat-value" style="color:${statusColor}">${me.isAlive ? 'ЖИВИЙ' : 'МЕРТВИЙ'}</span>
            </div>
            <div class="m-passport-stat-row">
                <span class="m-passport-stat-label">КЛАН:</span>
                <span class="m-passport-stat-value" style="color:${rl.color}">${factionName}</span>
            </div>
            <div class="m-passport-stat-row">
                <span class="m-passport-stat-label">БЛОКУВАННЯ:</span>
                <span class="m-passport-stat-value" style="color:${blockedColor}">${me.isSilenced ? 'ТАК 🔇' : 'НІ'}</span>
            </div>`;
    }
}

// ── Log ───────────────────────────────────────
function mRenderLog() {
    const el = document.getElementById('m-log');
    if (!el) return;
    const entries = (mState.log || []).slice(0, 25);
    if (!entries.length) { el.innerHTML = '<div class="m-log-empty">Лог порожній</div>'; return; }
    el.innerHTML = entries.map((e, i) => {
        const text = e.text || e;
        const type = e.type || '';
        const cls  = type ? `m-log-entry m-log-${type}` : 'm-log-entry';
        return `<div class="${cls}${i === 0 ? ' m-log-newest' : ''}">${text}</div>`;
    }).join('');
    const newLen = (mState.log || []).length;
    if (newLen > _mLastLogLen && _mLastLogLen > 0) mBumpLogBadge();
    _mLastLogLen = newLen;
}

// ── Gameover UI ───────────────────────────────
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
        const rl  = M_ROLE_LABELS[p.role] || { ua: p.role, icon: '?', faction: 'town', color: '#888' };
        const won = (isTown && rl.faction === 'town') || (isMafia && rl.faction === 'mafia') || (isManiac && p.role === 'maniac');
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
                <div class="m-result-header"><span>Гравець</span><span>Роль</span><span>Статус</span></div>
                ${playerRows}
            </div>
            <div class="m-gameover-stats">
                Раундів: <b>${s.round}</b> · Вижило: <b>${s.players.filter(p => p.isAlive).length}</b>/<b>${s.players.length}</b>
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
                    ? `<div style="font-size:10px;color:rgba(161,161,170,0.5);font-family:'Share Tech Mono',monospace;margin-bottom:6px">Статистика: ${st.w}/${st.g} перемог</div>`
                    : '';
                const rematch = isHost
                    ? `<button class="m-btn primary m-btn-wide" onclick="socket.emit('restartGame')" style="background:linear-gradient(135deg,#b91c1c,#7f1d1d);color:white;margin-bottom:6px">🔄 Реванш</button>`
                    : `<div class="m-wait" style="margin-bottom:8px">Очікуємо реваншу від хоста...</div>`;
                return statsHtml + rematch;
            })()}
            <button class="m-btn primary m-btn-wide" onclick="mReturnToLobby()">🏠 Нова гра</button>
        </div>`;
}

function mPhaseFlash(phase) {
    const el = document.createElement('div');
    const isNight = ['night','morning','resolving'].includes(phase);
    el.style.cssText = `position:fixed;inset:0;z-index:195;pointer-events:none;
        background:${isNight ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.12)'};
        animation:mPhaseFlashAnim 0.7s ease forwards`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 750);
}

function mReturnToLobby() {
    clearSession();
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
                 (winner === 'mafia' && myFaction === 'mafia') ||
                 (winner === 'maniac' && myFaction === 'maniac');
    if (!iWon) return;
    const colors = winner === 'mafia'
        ? ['#c62828','#e53935','#ff7043','#ffd700','#880e4f']
        : winner === 'maniac'
        ? ['#6a1b9a','#ab47bc','#ce93d8','#e040fb','#4a148c']
        : ['#1565c0','#0288d1','#ffd700','#4caf50','#81d4fa'];
    for (let i = 0; i < 80; i++) {
        const el   = document.createElement('div');
        const size = 6 + Math.random() * 8;
        el.style.cssText = `position:fixed;top:-12px;left:${Math.random()*100}vw;width:${size}px;height:${size}px;
            background:${colors[Math.floor(Math.random()*colors.length)]};
            border-radius:${Math.random()>.5?'50%':'2px'};
            animation:confetti-fall ${2+Math.random()*3}s linear ${Math.random()*1.5}s forwards;
            z-index:9999;pointer-events:none`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 6000);
    }
}

// ── Chat ──────────────────────────────────────
socket.on('mafiaChat', ({ playerId, name, text }) => {
    const msgs = document.getElementById('m-mafia-chat-msgs');
    if (!msgs) return;
    const msg = document.createElement('div');
    msg.className = 'm-chat-msg mafia' + (playerId === mMyIdx ? ' me' : '');
    msg.innerHTML = `<span class="m-chat-msg-sender">${name}</span><span class="m-chat-msg-text">${text}</span>`;
    msgs.appendChild(msg);
    msgs.scrollTop = msgs.scrollHeight;
    mBumpChatBadge();
});

socket.on('dayChatMsg', ({ playerId, name, text, round }) => {
    const msgs = document.getElementById('m-day-chat-msgs');
    if (!msgs) return;
    if (round && round !== _mChatRound) {
        _mChatRound = round;
        const sep = document.createElement('div');
        sep.className = 'm-chat-round-sep';
        sep.textContent = `— День ${round} —`;
        msgs.appendChild(sep);
    }
    const msg = document.createElement('div');
    msg.className = 'm-chat-msg' + (playerId === mMyIdx ? ' me' : '');
    msg.innerHTML = `<span class="m-chat-msg-sender">${name}</span><span class="m-chat-msg-text">${_esc ? _esc(text) : text}</span>`;
    msgs.appendChild(msg);
    msgs.scrollTop = msgs.scrollHeight;
    mBumpChatBadge();
});

socket.on('deadChat', ({ name, text }) => {
    mDeadChatLog.push({ name, text });
    const msgs = document.getElementById('m-day-chat-msgs');
    if (!msgs) return;
    const msg = document.createElement('div');
    msg.className = 'm-chat-msg ghost';
    msg.innerHTML = `<span class="m-chat-msg-sender">👻 ${name}</span><span class="m-chat-msg-text">${text}</span>`;
    msgs.appendChild(msg);
    msgs.scrollTop = msgs.scrollHeight;
    mBumpChatBadge();
});

// ── Chat send functions ───────────────────────
function mSendDayChat() {
    const input = document.getElementById('m-day-chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    const me = mState?.players[mMyIdx];
    if (!me) return;
    if (!me.isAlive) {
        socket.emit('deadChat', { text });
    } else if (mState?.phase === 'day_discussion' || mState?.phase === 'day_voting') {
        socket.emit('dayChatMsg', { text });
    }
    input.value = '';
}

function mSendMafiaChat() {
    const input = document.getElementById('m-mafia-chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    const me = mState?.players[mMyIdx];
    if (!me) return;
    if (me.isAlive && mState?.phase === 'night' && (me.role === 'mafia' || me.role === 'don')) {
        socket.emit('mafiaChat', { text });
    }
    input.value = '';
}

function mSendActiveChat() {
    const me = mState?.players[mMyIdx];
    if (!me) return;
    if (me.isAlive && mState?.phase === 'night' && (me.role === 'mafia' || me.role === 'don')) {
        mSendMafiaChat();
    } else {
        mSendDayChat();
    }
}

function mQuickReply(prefix) {
    if (!mState) return;
    let text = prefix;
    if (prefix.includes('...')) {
        const me = mState.players[mMyIdx];
        const targets = mState.players.filter(p => p.isAlive && p.id !== mMyIdx);
        if (targets.length) {
            const rnd = targets[Math.floor(Math.random() * targets.length)];
            text = prefix.replace('...', ` ${rnd.name}`);
        }
    }
    const input = document.getElementById('m-day-chat-input');
    if (input) {
        input.value = text;
        mSendDayChat();
    }
}

// ── Action panel buttons ──────────────────────
function mGetActionTypeForRole(role) {
    return { mafia:'mafiaVote', don:'mafiaVote', sheriff:'sheriffCheck', deputy:'sheriffCheck',
             doctor:'doctorHeal', roleblocker:'roleblockerBlock', maniac:'maniacKill' }[role] || null;
}
function mGetSecondaryActionForRole(role) {
    return role === 'don' ? 'donCheck' : null;
}

function mPanelSkip() {
    if (!mState || mMyIdx === null) return;
    const me = mState.players[mMyIdx];
    if (!me) return;
    if (mState.phase === 'night') {
        const actionType = mGetActionTypeForRole(me.role);
        if (actionType && _mNightSelections[actionType] !== undefined) {
            delete _mNightSelections[actionType];
            socket.emit('action', { type: 'cancelNightAction', data: { actionType } });
            renderMafia();
        }
    } else if (mState.phase === 'day_voting') {
        mDayVote('skip');
    }
}

function mPanelConfirm() {
    if (!mState || mMyIdx === null) return;
    const me = mState.players[mMyIdx];
    if (!me) return;
    const actionType = mGetActionTypeForRole(me.role);
    if (actionType && _mNightSelections[actionType] !== undefined) {
        if (typeof showToast === 'function')
            showToast('✅ Рішення зафіксовано', { duration: 2000 });
    }
}

// ── Night actions ─────────────────────────────
function mNightAction(type, targetId) {
    if (_mNightSelections[type] === targetId) {
        delete _mNightSelections[type];
        socket.emit('action', { type: 'cancelNightAction', data: { actionType: type } });
    } else {
        _mNightSelections[type] = targetId;
        socket.emit('action', { type, data: { targetId } });
    }
    if (navigator.vibrate) navigator.vibrate(35);
    renderMafia();
}

function mReady() {
    socket.emit('action', { type: 'mafiaReady', data: {} });
    const btn = document.getElementById('m-ready-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Очікуємо інших...'; }
}

function mDayVote(targetId) {
    socket.emit('action', { type: 'dayVote', data: { targetId } });
}

// ── Timers ────────────────────────────────────
const _mTimers = {};

function mDeadlineTimer(deadline) {
    if (!deadline) return '—';
    const sec = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2,'0')}`;
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
        el.textContent = `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;
        const bar = document.getElementById(elId + '-bar');
        if (bar) {
            const pct = rem / total * 100;
            bar.style.width = pct + '%';
            bar.className = 'm-timer-bar-fill' + (pct > 40 ? '' : pct > 15 ? ' warn' : ' danger');
        }
        if (rem <= 0) clearInterval(_mTimers[elId]);
    }, 300);
}

function mStartPhaseTimer(deadline) {
    clearInterval(_mTimers['phase-timer']);
    const el = document.getElementById('m-phase-block-timer');
    if (!deadline) { if (el) el.textContent = ''; return; }
    const update = () => {
        const el2 = document.getElementById('m-phase-block-timer');
        if (!el2) { clearInterval(_mTimers['phase-timer']); return; }
        const rem = Math.max(0, deadline - Date.now());
        const sec = Math.ceil(rem / 1000);
        el2.textContent = `🕒 ${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;
        if (rem <= 0) clearInterval(_mTimers['phase-timer']);
    };
    update();
    _mTimers['phase-timer'] = setInterval(update, 300);
}

// ── Night flavor (into chat area) ────────────
const NIGHT_FLAVOR = [
    { pct: 0.06, icon: '🌙', text: 'Місто вкрилось тишею. Але не всі лягли спати...' },
    { pct: 0.20, icon: '🤫', text: 'В темному кварталі — приглушені голоси. Кілька тіней вийшли на вулицю.' },
    { pct: 0.33, icon: '💊', text: 'Місцевий лікар наповнив саквояж і попрямував до когось із мешканців — для профілактики.' },
    { pct: 0.46, icon: '🚪', text: 'Хтось замовив нічний візит. Повія зібрала сумочку і вийшла з дому — в когось цієї ночі зіпсуються плани.' },
    { pct: 0.58, icon: '🔦', text: 'Силует із блокнотом завмер під ліхтарем. Комісар перевіряє підозрюваних.' },
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
            const msgs = document.getElementById('m-day-chat-msgs');
            if (!msgs) return;
            const msg = document.createElement('div');
            msg.className = 'm-flavor-msg';
            msg.innerHTML = `<span class="m-flavor-icon">${icon}</span><span>${text}</span>`;
            msgs.appendChild(msg);
            msgs.scrollTop = msgs.scrollHeight;
        }, pct * remaining);
        _mFlavorTimeouts.push(t);
    });
}

// ── Role meta ─────────────────────────────────
const M_ROLE_LABELS = {
    citizen:     { ua: 'Мирний житель', icon: '👤', faction: 'town',   color: '#3b82f6' },
    sheriff:     { ua: 'Комісар',       icon: '🔍', faction: 'town',   color: '#60a5fa' },
    deputy:      { ua: 'Помічник',      icon: '🛡️', faction: 'town',   color: '#93c5fd' },
    doctor:      { ua: 'Лікар',         icon: '💊', faction: 'town',   color: '#34d399' },
    roleblocker: { ua: 'Повія',         icon: '🚫', faction: 'town',   color: '#c084fc' },
    mafia:       { ua: 'Мафія',         icon: '🔫', faction: 'mafia',  color: '#ef4444' },
    don:         { ua: 'Дон',           icon: '🍷', faction: 'mafia',  color: '#dc2626' },
    maniac:      { ua: 'Маньяк',        icon: '🔪', faction: 'maniac', color: '#a855f7' },
};

function mRoleLabel(role)    { return M_ROLE_LABELS[role] || null; }
function mFactionColor(role) { return M_ROLE_LABELS[role]?.color || '#71717a'; }

function mRoleDesc(role) {
    const d = {
        citizen:     'Знайдіть мафію та виженіть її на денному голосуванні.',
        sheriff:     'Кожної ночі перевіряйте одного гравця — ви дізнаєтесь чи він мафія.',
        deputy:      'Отримуєте результати перевірок Комісара. Якщо він гине — займаєте його місце.',
        doctor:      'Кожної ночі рятуйте одного гравця від смерті (в тому числі себе).',
        roleblocker: 'Блокуйте нічні дії будь-якого гравця. Вдень заблокований мовчить.',
        mafia:       'Разом з командою вбивайте мирних щоночі. Виживіть до перемоги.',
        don:         'Лідер мафії. Ваш голос вирішальний при рівних голосах.',
        maniac:      'Вбивайте всіх підряд — і мафію і мирних. Перемагаєте поодинці.',
    };
    return d[role] || '';
}

function mRoleAbility(role) {
    const a = {
        citizen:     'Вночі ви спите. Вдень голосуєте за вигнання підозрюваних мешканців.',
        sheriff:     '1 перевірка за ніч. Дізнаєтесь фракцію гравця (мафія / мирний).',
        deputy:      'Автоматично отримуєте результати перевірок Комісара. При його загибелі стаєте Комісаром.',
        doctor:      '1 порятунок за ніч. Можете рятувати себе, але не двічі поспіль.',
        roleblocker: '1 блокування за ніч. Скасовує нічну дію цілі та позбавляє її голосу наступного дня.',
        mafia:       'Командне голосування за жертву кожної ночі. Виграєте коли мафія ≥ мирних.',
        don:         'Голосує за жертву разом з командою. Голос Дона вирішальний при рівних.',
        maniac:      '1 вбивство за ніч (будь-який гравець). Виграє якщо залишається поодинці.',
    };
    return a[role] || 'Особлива роль.';
}

// ── Show my role (quick view) ─────────────────
function mShowMyRole() {
    if (!mState) return;
    const me = mState.players[mMyIdx];
    if (!me?.role) return;
    const rl = M_ROLE_LABELS[me.role] || { ua: me.role, icon: '?', color: '#888' };
    const desc = mRoleDesc(me.role);
    showToast(`${rl.icon} ${rl.ua}${desc ? ' — ' + desc.slice(0, 60) : ''}`, { color: rl.color || '#333', duration: 4000 });
}

