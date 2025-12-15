// UI Module
import { PeriodRepository, TodoRepository } from './store.js';
import { Timer } from './timer.js';

let currentDate = new Date();
let activeTimer = null;
let currentTimerDuration = 0;

export function renderApp() {
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
                alert('모든 일정이 완료되었습니다! 수고하셨습니다.');
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

    const timeDisplay = document.getElementById('timer-numbers');
    if (timeDisplay) timeDisplay.textContent = Timer.formatTime(remainingSeconds);

    const circle = document.querySelector('.progress-ring__circle');
    const timerTextH1 = document.querySelector('.timer-text h1');

    if (isBreak) {
        circle.classList.add('break-mode');
        if (timerTextH1) timerTextH1.classList.add('break-mode-text');
    } else {
        circle.classList.remove('break-mode');
        if (timerTextH1) timerTextH1.classList.remove('break-mode-text');
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
        <div class="header-top-actions" style="position: absolute; top: 20px; right: 20px;">
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
                <!-- Timer & Stats -->
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

    renderSidebar();
    renderScheduleList();
}

function renderSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    // Calc Stats: Total ONLY of COMPLETED periods
    const periods = PeriodRepository.getPeriodsForDate(getFormattedDate(currentDate));
    let totalCompletedStudyMins = periods.filter(p => p.type === 'study' && p.completed).reduce((a, b) => a + b.duration, 0);
    // User requested "Total Study Time" - "increase only when a period is completed".

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

    if (!sidebar.querySelector('.circular-timer-container')) {
        sidebar.innerHTML = `
            <div class="timer-section">
                <div class="circular-timer-container">
                    <svg class="progress-ring" width="220" height="220">
                        <circle class="progress-ring__circle-bg" stroke="var(--color-bg-input)" stroke-width="8" fill="transparent" r="100" cx="110" cy="110"/>
                        <circle class="progress-ring__circle" stroke="var(--color-accent)" stroke-width="8" fill="transparent" r="100" cx="110" cy="110"/>
                    </svg>
                    <div class="timer-text">
                        <h1 id="timer-numbers">00:00</h1>
                        <p id="timer-label">준비</p>
                    </div>
                </div>
                
                <div class="timer-main-controls">
                    <button id="toggleTimerBtn" class="btn btn-primary btn-lg">시작</button>
                    <button id="resetTimerBtn" class="btn btn-transparent btn-lg" style="font-size: 0.9rem; color: #888;">초기화</button>
                </div>
            </div>

            <div class="stats-container">
                <div class="stat-item">
                    <span class="stat-label">총 학습 시간</span>
                    <span class="stat-value" id="total-focus-time">${totalTimeStr}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">목표 달성률</span>
                    <span class="stat-value" id="goal-rate-display">${rate}%</span>
                </div>
            </div>
        `;

        document.getElementById('toggleTimerBtn').addEventListener('click', handleToggleTimer);
        document.getElementById('resetTimerBtn').addEventListener('click', () => {
            if (confirm('타이머를 초기화 하시겠습니까?')) {
                activeTimer.stop();
                document.querySelector('.progress-ring__circle').style.strokeDashoffset = 0;
                document.querySelector('.progress-ring__circle').classList.remove('break-mode');
                document.querySelector('.timer-text h1').classList.remove('break-mode-text');
                document.getElementById('timer-numbers').textContent = '00:00';
                document.getElementById('timer-label').textContent = '준비';
                updateControls('stopped');
            }
        });
    } else {
        document.getElementById('total-focus-time').textContent = totalTimeStr;
        document.getElementById('goal-rate-display').textContent = `${rate}%`;
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
        html += renderGroupCards(incompleteGroups);
    } else if (completedGroups.length === 0) {
        // Empty State
        html += `<div class="empty-state">
                    <p>일정이 없습니다.</p>
                </div>`;
    }

    // Add Session Button (Block) - Always after incomplete list
    html += `<button id="addPeriodBlockBtn" class="btn-add-session-block">+</button>`;

    // Divider & Completed
    if (completedGroups.length > 0) {
        html += `<div class="status-divider"></div>`;
        html += renderGroupCards(completedGroups);
    }

    container.innerHTML = html;

    // Attach Listeners
    attachCardListeners();
    document.getElementById('addPeriodBlockBtn').addEventListener('click', openModal);
}

function renderGroupCards(groupList) {
    return groupList.map(groupObj => {
        const study = groupObj.periods.find(p => p.type === 'study');
        const breakP = groupObj.periods.find(p => p.type === 'break');
        const groupId = groupObj.gid;
        const todos = study ? (study.todos || []) : [];

        return `
        <div class="period-wrapper ${groupObj.isComplete ? 'completed-group' : ''}">
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
            if (confirm('삭제하시겠습니까?')) {
                PeriodRepository.deletePeriodGroup(getFormattedDate(currentDate), gid);
                renderLayout();
            }
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

            // Allow only one editing input at a time per list? Or multiple?
            // Let's append an LI with input
            const li = document.createElement('li');
            li.innerHTML = `
                <div style="width: 20px; margin-right: 12px;"></div>
                <input type="text" class="todo-inline-input" placeholder="Enter task..." autoFocus>
            `;
            list.appendChild(li);

            const input = li.querySelector('input');
            input.focus();

            const save = () => {
                if (input.value.trim()) {
                    TodoRepository.addTodoToPeriod(getFormattedDate(currentDate), pid, input.value.trim());
                    renderLayout();
                } else {
                    li.remove();
                }
            };

            input.addEventListener('blur', save);
            input.addEventListener('keypress', (ev) => {
                if (ev.key === 'Enter') {
                    input.blur(); // Trigger save via blur
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

    container.innerHTML = `
        <div style="padding: 40px; background: #121212; color: #fff; width: 800px;">
            <div style="font-size: 2.5rem; font-weight: bold; text-align: center; margin-bottom: 40px; letter-spacing: 0.1em;">
                ${dateStr}
            </div>
            
            <div style="display: flex; justify-content: space-around; margin-bottom: 50px; border-bottom: 1px solid #333; padding-bottom: 30px;">
                <div style="text-align: center;">
                    <div style="color: #888; margin-bottom: 10px; font-size: 1.2rem;">총 학습 시간</div>
                    <div style="font-size: 2rem; font-weight: bold;">${totalTimeText}</div>
                </div>
                <div style="text-align: center;">
                    <div style="color: #888; margin-bottom: 10px; font-size: 1.2rem;">목표 달성률</div>
                    <div style="font-size: 2rem; font-weight: bold;">${goalRateText}</div>
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

    // Hide buttons in export
    container.querySelectorAll('button').forEach(b => b.style.display = 'none');
    // Hide inline inputs
    container.querySelectorAll('input').forEach(b => b.style.display = 'none');

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
        alert('이미지 저장 실패');
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
                alert('모든 일정이 완료되었습니다! 새로운 세션을 추가하세요.');
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
    document.getElementById('timer-label').textContent = label;
    document.getElementById('timer-numbers').textContent = Timer.formatTime(duration * 60);

    const circle = document.querySelector('.progress-ring__circle');
    circle.style.strokeDashoffset = 0;

    const dateStr = getFormattedDate(currentDate);
    const periods = PeriodRepository.getPeriodsForDate(dateStr);
    const p = periods.find(x => x.id === id);
    if (p && p.type === 'break') {
        circle.classList.add('break-mode');
        document.querySelector('.timer-text h1').classList.add('break-mode-text');
    } else {
        circle.classList.remove('break-mode');
        document.querySelector('.timer-text h1').classList.remove('break-mode-text');
    }

    activeTimer.start(duration, id);
    updateControls('running');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function initModal() {
    let modal = document.getElementById('addPeriodModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'addPeriodModal';
        modal.className = 'modal hidden';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-modal">&times;</span>
            <h3 style="margin-top:0">세션 추가</h3>
            <form id="addPeriodForm">
                <div class="form-row">
                    <div class="form-group half">
                        <label for="studyDuration">집중 시간 (분)</label>
                        <input type="number" id="studyDuration" value="50" min="1" required>
                    </div>
                    <div class="form-group half">
                        <label for="breakDuration">휴식 시간 (분)</label>
                        <input type="number" id="breakDuration" value="10" min="1" required>
                    </div>
                </div>
                <button type="submit" class="btn btn-primary full-width">추가하기</button>
            </form>
        </div>
    `;

    const closeBtn = modal.querySelector('.close-modal');
    const form = modal.querySelector('#addPeriodForm');

    closeBtn.onclick = closeModal;
    window.onclick = (event) => {
        if (event.target == modal) closeModal();
    };

    form.onsubmit = (e) => {
        e.preventDefault();
        const studyTime = parseInt(document.getElementById('studyDuration').value);
        const breakTime = parseInt(document.getElementById('breakDuration').value);

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
        closeModal();
    };
}

function openModal() {
    document.getElementById('addPeriodModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('addPeriodModal').classList.add('hidden');
}
