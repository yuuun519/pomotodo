// UI Module
import { PeriodRepository, TodoRepository, getState, saveState } from './store.js';
import { Timer } from './timer.js';

let currentDate = new Date();
let activeTimer = null;
let currentTimerDuration = 0;

export function renderApp() {
    applyFontSettings();
    initTimer();
    renderLayout();
    initModal();
}

function initTimer() {
    activeTimer = new Timer({
        onTick: (remainingSeconds) => {
            updateTimerDisplay(remainingSeconds);
        },
        onComplete: (periodId) => {
            PeriodRepository.updatePeriod(getFormattedDate(currentDate), periodId, { completed: true });

            const periods = PeriodRepository.getPeriodsForDate(getFormattedDate(currentDate));
            const nextPeriod = periods.find(p => !p.completed);

            if (nextPeriod) {
                renderLayout();
                const label = nextPeriod.type === 'study' ? '집중 중...' : '휴식 중...';
                startPeriod(nextPeriod.id, nextPeriod.duration, label);
            } else {
                showCustomAlert('모든 일정이 완료되었습니다! 수고하셨습니다.');
                updateTimerDisplay(0);
                renderLayout();
                updateControls('stopped');
            }
        },
        onStatusChange: (status) => {
            updateControls(status);
        }
    });
}

function updateControls(status) {
    const btn = document.getElementById('toggleTimerBtn');
    if (!btn) return;

    if (status === 'paused' || status === 'stopped') {
        btn.textContent = '시작';
        btn.classList.remove('btn-danger', 'btn-secondary');
        btn.classList.add('btn-primary');
    } else {
        btn.textContent = '일시정지';
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
    }
}

function updateTimerDisplay(remainingSeconds) {
    let isBreak = false;
    if (activeTimer.activePeriodId) {
        const periods = PeriodRepository.getPeriodsForDate(getFormattedDate(currentDate));
        const p = periods.find(p => p.id === activeTimer.activePeriodId);
        if (p && p.type === 'break') isBreak = true;
    }

    const timeDisplay = document.getElementById('timer-numbers') || document.getElementById('timer-numbers-num');
    if (timeDisplay) timeDisplay.textContent = Timer.formatTime(remainingSeconds);

    const circle = document.querySelector('.progress-ring__circle');
    const timerTextH1 = document.querySelector('.timer-text h1'); // For circular color change

    if (isBreak) {
        if (circle) circle.classList.add('break-mode');
        if (timerTextH1) timerTextH1.classList.add('break-mode-text');
        // Numeric color?
        const numDisplay = document.getElementById('timer-numbers-num');
        if (numDisplay) numDisplay.style.color = 'var(--color-success)';
    } else {
        if (circle) circle.classList.remove('break-mode');
        if (timerTextH1) timerTextH1.classList.remove('break-mode-text');
        const numDisplay = document.getElementById('timer-numbers-num');
        if (numDisplay) numDisplay.style.color = 'var(--color-text-primary)';
    }

    if (circle && currentTimerDuration > 0) {
        const radius = circle.r.baseVal.value;
        const circumference = radius * 2 * Math.PI;
        const duration = currentTimerDuration || 1;
        const offset = circumference - (remainingSeconds / (duration * 60)) * circumference;

        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        circle.style.strokeDashoffset = offset;
    }

    document.title = `${Timer.formatTime(remainingSeconds)} - PomoToDo`;
}

function getFormattedDate(date) {
    return date.toISOString().split('T')[0];
}

function renderLayout() {
    const main = document.querySelector('.app-main');
    if (!main) return;

    main.innerHTML = `
        <div class="header-actions">
            <button id="settingsBtn" class="btn btn-icon" title="설정">⚙️</button>
            <button id="exportBtn" class="btn btn-sm" title="이미지로 저장">📷 저장</button>
        </div>
        
        <!-- Date Nav Top -->
        <div class="date-nav-top">
            <button id="prevDate" class="btn btn-icon">&lt;</button>
            <div class="date-display-large" id="currentDateDisplay">${currentDate.toLocaleDateString('ko-KR')}</div>
            <button id="nextDate" class="btn btn-icon">&gt;</button>
        </div>

        <div class="app-container">
            <aside class="sidebar" id="sidebar">
                <!-- HTML Order: Timer then Settings. 
                   Mobile CSS will reverse this to: Stats then Timer.
                -->
                <div id="sidebar-timer-section"></div>
                <div id="sidebar-stats-section" class="stats-container"></div>
            </aside>
            <main class="content" id="list-content">
                <!-- Schedule -->
            </main>
        </div>
        
        <div id="export-container"></div>
    `;

    document.getElementById('prevDate').addEventListener('click', () => changeDate(-1));
    document.getElementById('nextDate').addEventListener('click', () => changeDate(1));
    document.getElementById('exportBtn').addEventListener('click', handleExport);
    document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);

    renderSidebar();
    renderScheduleList();
}

// ... (renderSidebar implementation below in next chunk)

function initModal() {
    // Add Period Modal
    if (!document.getElementById('addPeriodModal')) {
        const modal = document.createElement('div');
        modal.id = 'addPeriodModal';
        modal.className = 'modal hidden';
        document.body.appendChild(modal);
        // ... build modal content ...
        // For brevity in this replace, I will call a helper or just re-inject the content properly below
        // Actually, to keep file clean, I'll stick to the original logic pattern but ensuring SettingsModal is also init.
    }

    // Inject Add Period Modal Content
    const addModal = document.getElementById('addPeriodModal');
    addModal.innerHTML = `
        <div class="modal-content">
            <span class="close-modal" onclick="document.getElementById('addPeriodModal').classList.add('hidden')">&times;</span>
            <h3 style="margin-top:0">세션 추가</h3>
            <form id="addPeriodForm">
                <div class="form-row">
                    <div class="form-group half">
                        <label for="studyDuration">집중 시간 (분)</label>
                        <input type="number" id="studyDuration" value="120" min="0" required>
                    </div>
                    <div class="form-group half">
                        <label for="breakDuration">휴식 시간 (분)</label>
                        <input type="number" id="breakDuration" value="120" min="0" required>
                    </div>
                </div>
                <button type="submit" class="btn btn-primary full-width">추가하기</button>
            </form>
        </div>
    `;
    addModal.querySelector('#addPeriodForm').onsubmit = handleAddPeriodSubmit;

    // Settings Modal
    if (!document.getElementById('settingsModal')) {
        const sm = document.createElement('div');
        sm.id = 'settingsModal';
        sm.className = 'modal hidden';
        document.body.appendChild(sm);
    }

    const settingsModal = document.getElementById('settingsModal');
    settingsModal.innerHTML = `
        <div class="modal-content">
            <span class="close-modal" onclick="document.getElementById('settingsModal').classList.add('hidden')">&times;</span>
            <h3 style="margin-top:0">설정</h3>
            <form id="settingsForm">
                <div class="form-group">
                    <label>타이머 모드</label>
                    <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                        <label style="color: #fff; cursor: pointer;">
                            <input type="radio" name="timerMode" value="circular"> 원형 (Circular)
                        </label>
                        <label style="color: #fff; cursor: pointer;">
                            <input type="radio" name="timerMode" value="numeric"> 숫자 (Numeric)
                        </label>
                    </div>
                </div>

                <div class="form-group">
                    <label style="margin-bottom:8px; display:block;">폰트 (Font)</label>
                    <select id="fontSelect" name="fontFamily" style="width: 100%; padding: 10px; background: #333; border: 1px solid #444; color: #fff; border-radius: 4px; margin-bottom: 10px;">
                        <option value="Inter">Inter (기본)</option>
                        <option value="SchoolSafetyOcarina">학교안심 오카리나</option>
                        <option value="SchoolSafeBoardMarker">학교안심 보드마카</option>
                        <option value="NanumSquareRound">나눔스퀘어라운드</option>
                        <option value="custom">사용자 지정 (Custom)</option>
                    </select>
                    
                    <div id="customFontGroup" class="hidden" style="margin-top: 10px; padding: 10px; background: #222; border-radius: 4px;">
                        <label style="font-size: 0.9rem; color: #aaa; margin-bottom: 5px; display:block;">Custom Font CSS (@font-face)</label>
                        <textarea id="customFontCss" name="customFontCss" rows="6" style="width: 100%; padding: 8px; background: #333; border: 1px solid #444; color: #aaa; font-family: monospace; font-size: 0.8rem; resize: vertical;" placeholder="@font-face { ... }"></textarea>
                        <p style="font-size: 0.8rem; color: #666; margin-top: 6px; line-height: 1.4;">
                            * @font-face 코드를 입력하세요. "font-family" 이름을 자동으로 인식하여 적용합니다.
                        </p>
                    </div>
                </div>

                <button type="submit" class="btn btn-primary full-width" style="margin-top: 10px;">저장</button>
            </form>
        </div>
    `;
    settingsModal.querySelector('#settingsForm').onsubmit = handleSettingsSubmit;

    // Add Listener for Font Select Toggle
    const fontSelect = settingsModal.querySelector('#fontSelect');
    const customGroup = settingsModal.querySelector('#customFontGroup');
    fontSelect.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
            customGroup.classList.remove('hidden');
        } else {
            customGroup.classList.add('hidden');
        }
    });

    // Global Close
    window.onclick = (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.classList.add('hidden');
        }
    };

    initGlobalModals();
}

function initGlobalModals() {
    if (!document.getElementById('globalConfirmModal')) {
        const cm = document.createElement('div');
        cm.id = 'globalConfirmModal';
        cm.className = 'modal hidden';
        cm.style.zIndex = '2000'; // Ensure on top
        cm.innerHTML = `
            <div class="modal-content" style="max-width: 400px; text-align: center;">
                <h3 id="globalConfirmTitle" style="margin-top:0">확인</h3>
                <p id="globalConfirmMessage" style="margin-bottom: 20px; color: #ccc;"></p>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="globalConfirmCancelBtn" class="btn btn-secondary" style="flex: 1;">취소</button>
                    <button id="globalConfirmOkBtn" class="btn btn-primary" style="flex: 1;">확인</button>
                </div>
            </div>
        `;
        document.body.appendChild(cm);
    }

    if (!document.getElementById('globalAlertModal')) {
        const am = document.createElement('div');
        am.id = 'globalAlertModal';
        am.className = 'modal hidden';
        am.style.zIndex = '2000';
        am.innerHTML = `
            <div class="modal-content" style="max-width: 400px; text-align: center;">
                <h3 id="globalAlertTitle" style="margin-top:0; display:none;">알림</h3>
                <p id="globalAlertMessage" style="margin-bottom: 20px; color: #ccc;"></p>
                <button id="globalAlertOkBtn" class="btn btn-primary full-width">확인</button>
            </div>
        `;
        document.body.appendChild(am);
    }
}

function showCustomConfirm(message, onConfirm) {
    const modal = document.getElementById('globalConfirmModal');
    const msgEl = document.getElementById('globalConfirmMessage');
    const okBtn = document.getElementById('globalConfirmOkBtn');
    const cancelBtn = document.getElementById('globalConfirmCancelBtn');

    msgEl.textContent = message;
    modal.classList.remove('hidden');

    // Remove old listeners to prevent stacking
    const newOk = okBtn.cloneNode(true);
    const newCancel = cancelBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOk, okBtn);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    newOk.addEventListener('click', () => {
        modal.classList.add('hidden');
        if (onConfirm) onConfirm();
    });

    newCancel.addEventListener('click', () => {
        modal.classList.add('hidden');
    });
}

function showCustomAlert(message) {
    const modal = document.getElementById('globalAlertModal');
    const msgEl = document.getElementById('globalAlertMessage');
    const okBtn = document.getElementById('globalAlertOkBtn');

    msgEl.textContent = message;
    modal.classList.remove('hidden');

    const newOk = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOk, okBtn);

    const timer = setTimeout(() => {
        modal.classList.add('hidden');
    }, 10000);

    newOk.addEventListener('click', () => {
        clearTimeout(timer);
        modal.classList.add('hidden');
    });
}

function handleAddPeriodSubmit(e) {
    e.preventDefault();
    const studyTime = parseInt(document.getElementById('studyDuration').value);
    const breakTime = parseInt(document.getElementById('breakDuration').value);

    if (studyTime) localStorage.setItem('lastStudyDuration', studyTime);
    if (breakTime) localStorage.setItem('lastBreakDuration', breakTime);

    const groupId = crypto.randomUUID();

    PeriodRepository.addPeriod(getFormattedDate(currentDate), {
        id: crypto.randomUUID(),
        groupId,
        type: 'study',
        duration: studyTime,
        completed: false
    });

    PeriodRepository.addPeriod(getFormattedDate(currentDate), {
        id: crypto.randomUUID(),
        groupId,
        type: 'break',
        duration: breakTime,
        completed: false
    });

    renderLayout();
    document.getElementById('addPeriodModal').classList.add('hidden');
}

function openSettingsModal() {
    const state = getState();
    const mode = state.settings?.timerMode || 'circular';
    const family = state.settings?.fontFamily || 'Inter';
    const customCss = state.settings?.customFontCss || '';

    const form = document.querySelector('#settingsForm');
    form.elements['timerMode'].value = mode;
    form.elements['fontFamily'].value = family;
    form.elements['customFontCss'].value = customCss;

    const customGroup = document.getElementById('customFontGroup');
    if (family === 'custom') {
        customGroup.classList.remove('hidden');
    } else {
        customGroup.classList.add('hidden');
    }

    document.getElementById('settingsModal').classList.remove('hidden');
}

function handleSettingsSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const mode = form.elements['timerMode'].value;
    const family = form.elements['fontFamily'].value;
    const customCss = form.elements['customFontCss'].value;

    const state = getState();
    if (!state.settings) state.settings = {};
    state.settings.timerMode = mode;
    state.settings.fontFamily = family;
    state.settings.customFontCss = customCss;

    saveState(state);

    applyFontSettings(); // Apply new fonts
    renderSidebar(); // Update sidebar immediately
    // Ideally re-render whole layout to ensure font applies everywhere if needed, 
    // but CSS variable change should be instant.

    document.getElementById('settingsModal').classList.add('hidden');
}


function renderSidebar() {
    const timerSection = document.getElementById('sidebar-timer-section');
    const statsSection = document.getElementById('sidebar-stats-section');
    if (!timerSection || !statsSection) return;

    const state = getState();
    const mode = state.settings?.timerMode || 'circular';

    // Calc Stats
    const periods = PeriodRepository.getPeriodsForDate(getFormattedDate(currentDate));
    let totalCompletedStudyMins = periods.filter(p => p.type === 'study' && p.completed).reduce((a, b) => a + b.duration, 0);
    const hours = Math.floor(totalCompletedStudyMins / 60);
    const mins = totalCompletedStudyMins % 60;
    const totalTimeStr = `${hours}시간 ${mins}분`;

    let totalTodos = 0;
    let completedTodos = 0;
    periods.forEach(p => {
        if (p.todos) {
            totalTodos += p.todos.length;
            completedTodos += p.todos.filter(t => t.completed).length;
        }
    });
    const rate = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;

    // Render Stats
    statsSection.innerHTML = `
        <div class="stat-item">
            <span class="stat-label">총 학습 시간</span>
            <span class="stat-value" id="total-focus-time">${totalTimeStr}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">목표 달성률</span>
            <span class="stat-value" id="goal-rate-display">${rate}%</span>
        </div>
    `;

    // Determine Initial Timer State
    const currentInfo = getCurrentPeriodInfo();
    let initialLabel = '준비';
    let initialTime = '00:00';
    let isBreakInitial = false;

    if (currentInfo) {
        if (currentInfo.type === 'done') {
            initialLabel = '완료';
            initialTime = '00:00';
        } else {
            initialLabel = currentInfo.label;
            initialTime = Timer.formatTime(currentInfo.duration * 60);
            if (currentInfo.type === 'break') isBreakInitial = true;
            // Only update global duration if not currently running/active to avoid overriding?
            // Actually, if activeTimer is running, we sync at end. If not, this is correct.
            if (!activeTimer.isRunning && activeTimer.remainingSeconds <= 0) {
                currentTimerDuration = currentInfo.duration;
            }
        }
    }

    // Render Timer
    let timerHTML = '';
    if (mode === 'circular') {
        const breakClass = isBreakInitial ? 'break-mode-text' : '';
        const circleClass = isBreakInitial ? 'break-mode' : '';

        timerHTML = `
            <div class="circular-timer-container">
                <svg class="progress-ring" width="220" height="220">
                    <circle class="progress-ring__circle-bg" stroke="var(--color-bg-input)" stroke-width="8" fill="transparent" r="100" cx="110" cy="110"/>
                    <circle class="progress-ring__circle ${circleClass}" stroke="var(--color-accent)" stroke-width="8" fill="transparent" r="100" cx="110" cy="110"/>
                </svg>
                <div class="timer-text">
                    <p id="timer-label">${initialLabel}</p>
                    <h1 id="timer-numbers" class="${breakClass}">${initialTime}</h1>
                </div>
            </div>
        `;
    } else {
        const colorStyle = isBreakInitial ? 'color: var(--color-success);' : '';
        timerHTML = `
            <div class="timer-display-numeric-container">
                 <div class="timer-display-numeric-label" id="timer-label-num">${initialLabel}</div>
                 <div class="timer-display-numeric" id="timer-numbers-num" style="${colorStyle}">${initialTime}</div>
            </div>
        `;
    }

    timerSection.innerHTML = `
        <div class="timer-section">
            ${timerHTML}
            <div class="timer-main-controls" style="justify-content: center;">
                <button id="toggleTimerBtn" class="btn btn-primary btn-lg">시작</button>
                <button id="resetTimerBtn" class="btn btn-transparent btn-lg" style="font-size: 0.9rem; color: #888;">초기화</button>
            </div>
        </div>
    `;

    document.getElementById('toggleTimerBtn').addEventListener('click', handleToggleTimer);
    document.getElementById('resetTimerBtn').addEventListener('click', () => {
        showCustomConfirm('타이머를 초기화 하시겠습니까?', () => {
            activeTimer.stop();

            // Allow recalculation
            const resetInfo = getCurrentPeriodInfo();
            let rLabel = '준비';
            let rTime = '00:00';
            let rIsBreak = false;

            if (resetInfo) {
                if (resetInfo.type === 'done') {
                    rLabel = '완료';
                } else {
                    rLabel = resetInfo.label;
                    rTime = Timer.formatTime(resetInfo.duration * 60);
                    currentTimerDuration = resetInfo.duration;
                    if (resetInfo.type === 'break') rIsBreak = true;
                }
            }

            // Reset Display based on mode
            const numDisplay = document.getElementById('timer-numbers') || document.getElementById('timer-numbers-num');
            const labelDisplay = document.getElementById('timer-label') || document.getElementById('timer-label-num');
            if (numDisplay) numDisplay.textContent = rTime;
            if (labelDisplay) labelDisplay.textContent = rLabel;

            const circle = document.querySelector('.progress-ring__circle');
            if (circle) circle.style.strokeDashoffset = 0;

            // Reset classes
            const h1 = document.querySelector('.timer-text h1');

            if (rIsBreak) {
                if (circle) circle.classList.add('break-mode');
                if (h1) h1.classList.add('break-mode-text');
                if (numDisplay && !circle) numDisplay.style.color = 'var(--color-success)';
            } else {
                if (circle) circle.classList.remove('break-mode');
                if (h1) h1.classList.remove('break-mode-text');
                if (numDisplay && !circle) numDisplay.style.color = 'var(--color-text-primary)';
            }

            updateControls('stopped');
        });
    });

    // Sync Initial State (if actively running or paused mid-way)
    if (activeTimer.isRunning || activeTimer.remainingSeconds > 0) {
        updateTimerDisplay(activeTimer.remainingSeconds);
        updateControls(activeTimer.isRunning ? 'running' : 'paused');
    }
}

function renderScheduleList() {
    const container = document.getElementById('list-content');
    if (!container) return;

    const periods = PeriodRepository.getPeriodsForDate(getFormattedDate(currentDate));

    // 1. Group & Sort Logic
    const groups = {};
    const groupOrder = []; // Logical creation order

    periods.forEach(p => {
        const gid = p.groupId || p.id;
        if (!groups[gid]) {
            groups[gid] = [];
            groupOrder.push(gid);
        }
        groups[gid].push(p);
    });

    // Determine completion status and STATIC INDEX for each group
    let allGroups = groupOrder.map((gid, index) => {
        const groupPeriods = groups[gid];
        const isComplete = groupPeriods.every(p => p.completed);
        return {
            gid,
            periods: groupPeriods,
            isComplete,
            staticIndex: index + 1 // 1-based index based on creation order
        };
    });

    // 2. Split into Incomplete and Complete
    const incompleteGroups = allGroups.filter(g => !g.isComplete);
    const completedGroups = allGroups.filter(g => g.isComplete);

    // 3. Render HTML
    let html = '';

    // Render Incomplete
    if (incompleteGroups.length > 0) {
        html += renderGroupCards(incompleteGroups, false);
    } // If no incomplete groups, we still want the button, handled below implicitly or explicitly

    // Always show the Add Session Block Button after incomplete groups (or if empty)
    if (incompleteGroups.length === 0 && completedGroups.length === 0) {
        html += `<div class="empty-state"><p>일정이 없습니다.</p></div>`;
    }

    html += `<button id="addPeriodBlockBtn" class="btn-add-session-block" style="margin-top: 20px;">+</button>`;

    // Divider & Completed
    if (completedGroups.length > 0) {
        html += `<div class="status-divider"></div>`;
        html += renderGroupCards(completedGroups, false);
    }

    container.innerHTML = html;

    // Attach Listeners
    attachCardListeners();
    // For Block Button (if it exists)
    const blockBtn = document.getElementById('addPeriodBlockBtn');
    if (blockBtn) blockBtn.addEventListener('click', openModal);
}

function renderGroupCards(groupList) {
    return groupList.map(groupObj => {
        const study = groupObj.periods.find(p => p.type === 'study');
        const breakP = groupObj.periods.find(p => p.type === 'break');
        const groupId = groupObj.gid;
        const todos = study ? (study.todos || []) : [];

        // Check Highlight
        let isActive = false;
        if (activeTimer && activeTimer.isRunning || activeTimer.remainingSeconds > 0) {
            if (activeTimer.activePeriodId === (study ? study.id : null) ||
                activeTimer.activePeriodId === (breakP ? breakP.id : null)) {
                isActive = true;
            }
        }

        return `
        <div class="period-wrapper ${groupObj.isComplete ? 'completed-group' : ''} ${isActive ? 'active-period' : ''}">
             <div class="period-header">
                 <div class="period-label">
                    ${groupObj.staticIndex}교시
                 </div>
                 <div class="period-time-info">
                    공부 시간 : ${study ? study.duration : 0}분 <span class="divider">|</span> 쉬는 시간 : ${breakP ? breakP.duration : 0}분
                    ${groupId ? `<button class="btn-delete-group-text" data-group-id="${groupId}">삭제</button>` : ''}
                 </div>
             </div>
             
             <div class="period-body">
                 <ul class="todo-list" id="todo-list-${study ? study.id : ''}">
                    ${todos.map(todo => `
                        <li>
                            <label class="checkbox-container">
                                <input type="checkbox" class="todo-checkbox" 
                                    data-period-id="${study.id}" 
                                    data-todo-id="${todo.id}" 
                                    ${todo.completed ? 'checked' : ''}>
                                <span class="checkmark"></span>
                                <span class="todo-text ${todo.completed ? 'completed' : ''}">${todo.text}</span>
                            </label>
                        </li>
                    `).join('')}
                 </ul>
                 ${study ? `
                    <button class="btn-add-todo-block" data-period-id="${study.id}">
                        +
                    </button>
                    <!-- Container for inline input injection -->
                 ` : ''}
             </div>
        </div>
        `;
    }).join('');
}

function attachCardListeners() {
    // Delete Group
    document.querySelectorAll('.btn-delete-group-text').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const gid = e.currentTarget.dataset.groupId;
            showCustomConfirm('삭제하시겠습니까?', () => {
                PeriodRepository.deletePeriodGroup(getFormattedDate(currentDate), gid);
                renderLayout();
            });
        });
    });

    // Toggle Todo
    document.querySelectorAll('.todo-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const pid = e.target.dataset.periodId;
            const tid = e.target.dataset.todoId;
            TodoRepository.toggleTodo(getFormattedDate(currentDate), pid, tid);
            renderLayout();
        });
    });

    // Inline Todo Creation
    document.querySelectorAll('.btn-add-todo-block').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const pid = e.currentTarget.dataset.periodId;
            const list = document.getElementById(`todo-list-${pid}`);

            // Remove any existing inline inputs to prevent clutter? 
            // Or allow multiple? Let's check if one exists already.
            if (list.querySelector('.todo-inline-input')) {
                list.querySelector('.todo-inline-input').focus();
                return;
            }

            const li = document.createElement('li');
            li.innerHTML = `
                <div style="width: 20px; margin-right: 12px;"></div>
                <input type="text" class="todo-inline-input" placeholder="할 일 입력..." autocomplete="off">
            `;
            list.appendChild(li);

            const input = li.querySelector('input');
            input.focus();

            const save = () => {
                if (input.value.trim()) {
                    TodoRepository.addTodoToPeriod(getFormattedDate(currentDate), pid, input.value.trim());
                    // We re-render layout, which will replace the list with new data
                    renderLayout();
                } else {
                    // Remove if empty
                    li.remove();
                }
            };

            // Event Listeners for Input
            // 1. Blur -> Save or Remove
            input.addEventListener('blur', () => {
                // specific timeout to allow click events (like hitting enter?) to process? 
                // Actually blur is fine.
                setTimeout(save, 100);
            });

            // 2. Enter -> Save
            input.addEventListener('keypress', (ev) => {
                if (ev.key === 'Enter') {
                    input.blur();
                }
            });
        });
    });
}

function handleExport() {
    const container = document.getElementById('export-container');
    const dateStr = currentDate.toLocaleDateString('ko-KR');

    // Custom Export Layout
    const totalTimeText = document.getElementById('total-focus-time').textContent;
    const goalRateText = document.getElementById('goal-rate-display').textContent;
    const schedule = document.getElementById('list-content').innerHTML;

    const computedFont = getComputedStyle(document.body).fontFamily;

    container.innerHTML = `
        <div style="padding: 40px; background: #121212; color: #fff; width: 800px; font-family: ${computedFont};">
            <div style="font-size: 2.5rem; font-weight: bold; text-align: center; margin-bottom: 40px; letter-spacing: 0.1em;">
                ${dateStr}
            </div>
            
            <div class="export-stats-row" style="display: flex; justify-content: center; gap: 80px; margin-bottom: 50px; border-bottom: 1px solid #333; padding-bottom: 30px;">
                <div style="text-align: center;">
                    <div style="color: #888; margin-bottom: 10px; font-size: 1.2rem;">총 학습 시간</div>
                    <div style="font-size: 2.5rem; font-weight: bold;">${totalTimeText}</div>
                </div>
                <div style="text-align: center; border-left: 1px solid #333; padding-left: 80px;">
                    <div style="color: #888; margin-bottom: 10px; font-size: 1.2rem;">목표 달성률</div>
                    <div style="font-size: 2.5rem; font-weight: bold;">${goalRateText}</div>
                </div>
            </div>
            
            <div style="margin-bottom: 40px;">
                ${schedule}
            </div>
            
            <div style="text-align: center; color: #666; font-size: 0.9rem; margin-top: 50px; border-top: 1px solid #333; padding-top: 20px;">
                Generated by PomoToDo
            </div>
        </div>
    `;

    // Clean up interactables for image
    // Remove "Add Todo", "Add Session", "Delete" buttons from the cloned HTML
    container.querySelectorAll('button').forEach(b => b.remove());
    container.querySelectorAll('.btn-add-todo-block').forEach(b => b.remove());
    container.querySelectorAll('.btn-add-session-inline').forEach(b => b.remove());
    container.querySelectorAll('.btn-add-session-block').forEach(b => b.remove());
    container.querySelectorAll('.btn-delete-group-text').forEach(b => b.remove());

    html2canvas(container, {
        backgroundColor: '#121212',
        scale: 2,
        useCORS: true
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `pomotodo-${getFormattedDate(currentDate)}.png`;
        link.href = canvas.toDataURL();
        link.click();
        container.innerHTML = '';
    }).catch(err => {
        console.error(err);
        showCustomAlert('이미지 저장 실패');
    });
}

function handleToggleTimer() {
    if (activeTimer.isRunning) {
        activeTimer.pause();
    } else {
        if (!activeTimer.activePeriodId || activeTimer.remainingSeconds <= 0) {
            const periods = PeriodRepository.getPeriodsForDate(getFormattedDate(currentDate));
            const nextPeriod = periods.find(p => !p.completed);

            if (nextPeriod) {
                const label = nextPeriod.type === 'study' ? '집중 중...' : '휴식 중...';
                startPeriod(nextPeriod.id, nextPeriod.duration, label);
            } else {
                showCustomAlert('모든 일정이 완료되었습니다! 새로운 세션을 추가하세요.');
            }
        } else {
            activeTimer.intervalId = setInterval(() => activeTimer.tick(), 1000);
            activeTimer.isRunning = true;
            updateControls('running');
        }
    }
}

function changeDate(days) {
    currentDate.setDate(currentDate.getDate() + days);
    renderLayout();
}

function startPeriod(id, duration, label) {
    if (activeTimer.intervalId) activeTimer.stop();

    currentTimerDuration = duration;

    const labelDisplay = document.getElementById('timer-label') || document.getElementById('timer-label-num');
    const numDisplay = document.getElementById('timer-numbers') || document.getElementById('timer-numbers-num');

    if (labelDisplay) labelDisplay.textContent = label;
    if (numDisplay) numDisplay.textContent = Timer.formatTime(duration * 60);

    const circle = document.querySelector('.progress-ring__circle');
    if (circle) circle.style.strokeDashoffset = 0;

    const dateStr = getFormattedDate(currentDate);
    const periods = PeriodRepository.getPeriodsForDate(dateStr);
    const p = periods.find(x => x.id === id);
    if (p && p.type === 'break') {
        if (circle) circle.classList.add('break-mode');
        const h1 = document.querySelector('.timer-text h1');
        if (h1) h1.classList.add('break-mode-text');

        if (numDisplay && !circle) numDisplay.style.color = 'var(--color-success)';
    } else {
        if (circle) circle.classList.remove('break-mode');
        const h1 = document.querySelector('.timer-text h1');
        if (h1) h1.classList.remove('break-mode-text');

        if (numDisplay && !circle) numDisplay.style.color = 'var(--color-text-primary)';
    }

    activeTimer.start(duration, id);
    updateControls('running');

    // Highlight Active Period
    renderLayout(); // Re-render to apply the .active-period class logic (which is in renderGroupCards)
    // NOTE: Need to update renderGroupCards to check activeTimer.activePeriodId
    // I will append a separate update for renderGroupCards.

    // For smooth UX, maybe just scroll?
    window.scrollTo({ top: 0, behavior: 'smooth' });
}




function getCurrentPeriodInfo() {
    const periods = PeriodRepository.getPeriodsForDate(getFormattedDate(currentDate));
    if (!periods || periods.length === 0) return null;

    const groups = {};
    const groupOrder = [];
    periods.forEach(p => {
        const gid = p.groupId || p.id;
        if (!groups[gid]) {
            groups[gid] = [];
            groupOrder.push(gid);
        }
        groups[gid].push(p);
    });

    for (let i = 0; i < groupOrder.length; i++) {
        const gid = groupOrder[i];
        const groupPeriods = groups[gid];
        const incompletePeriod = groupPeriods.find(p => !p.completed);

        if (incompletePeriod) {
            const index = i + 1;
            const typeLabel = incompletePeriod.type === 'study' ? '집중' : '휴식';
            return {
                label: `${index}교시 ${typeLabel}`,
                duration: incompletePeriod.duration,
                type: incompletePeriod.type,
                id: incompletePeriod.id
            };
        }
    }

    return { label: '모든 일정 완료', duration: 0, type: 'done', id: null };
}

function openModal() {
    const studyInput = document.getElementById('studyDuration');
    const breakInput = document.getElementById('breakDuration');

    const lastStudy = localStorage.getItem('lastStudyDuration');
    const lastBreak = localStorage.getItem('lastBreakDuration');

    // Default to blank if not set, otherwise load last value
    studyInput.value = lastStudy ? lastStudy : '';
    breakInput.value = lastBreak ? lastBreak : '';

    document.getElementById('addPeriodModal').classList.remove('hidden');
}
// Font Helper
function applyFontSettings() {
    const state = getState();
    const settings = state.settings || {};
    const family = settings.fontFamily || 'Inter';
    const customCss = settings.customFontCss || '';

    // 1. Inject Custom CSS if needed
    let styleTag = document.getElementById('custom-font-style');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'custom-font-style';
        document.head.appendChild(styleTag);
    }

    // Only inject if there IS custom CSS content
    styleTag.textContent = customCss;

    // 2. Determine Font Family Name
    let applyFamily = family;

    if (family === 'custom') {
        // Try to parse font-family from the CSS text
        // Looks for: font-family: 'Name'; or "Name" or Name
        const match = customCss.match(/font-family:\s*['"]?([^'";]+)['"]?/);
        if (match && match[1]) {
            applyFamily = match[1].trim();
        } else {
            // Fallback or keep as 'custom' which won't work? 
            // If user didn't provide valid CSS, we default to sans-serif
            applyFamily = 'sans-serif';
        }
    }

    // 3. Apply to Root
    // The CSS logic uses var(--font-family)
    // We update the variable.
    document.documentElement.style.setProperty('--font-family', `"${applyFamily}", sans-serif`);

    // Also force it for good measure on body if needed, but style.css handles it.
}
