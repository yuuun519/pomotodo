// UI Module
import { PeriodRepository, TodoRepository } from './store.js';
import { Timer } from './timer.js';

let currentDate = new Date();
let activeTimer = null;
let currentTimerDuration = 0;

export function renderApp() {
    initTimer();
    renderLayout(); // New full layout render
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
                renderLayout(); // Re-render stats and schedule
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

// Main Render Function for Wireframe Layout
function renderLayout() {
    const main = document.querySelector('.app-main'); // This is #app .app-main from index.html (we might need to replace app-main clss behavior or just use it as root)
    if (!main) return;

    // We want the structure:
    // .app-container
    //   .sidebar
    //   .content

    // Check if structure exists, if not build it
    let container = document.querySelector('.app-container');
    if (!container) {
        main.innerHTML = `
            <div class="header-top-actions" style="position: absolute; top: 20px; right: 20px;">
                <button id="exportBtn" class="btn btn-sm" title="이미지로 저장">📷 저장</button>
            </div>
            <div class="app-container">
                <aside class="sidebar" id="sidebar">
                    <!-- Timer & Stats -->
                </aside>
                <main class="content" id="list-content">
                    <!-- Schedule -->
                </main>
            </div>
            
            <button id="addPeriodBtn" class="btn btn-floating">+</button>
            <div id="export-container"></div>
        `;

        // Bind Fixed things
        document.getElementById('addPeriodBtn').addEventListener('click', openModal);
        document.getElementById('exportBtn').addEventListener('click', handleExport);
    }

    renderSidebar();
    renderScheduleList();
}

function renderSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    // Calc Stats
    const periods = PeriodRepository.getPeriodsForDate(getFormattedDate(currentDate));
    let totalStudyMins = periods.filter(p => p.type === 'study').reduce((a, b) => a + b.duration, 0);
    // Format H:MM
    const hours = Math.floor(totalStudyMins / 60);
    const mins = totalStudyMins % 60;
    const totalTimeStr = `${hours}시간 ${mins}분`; // "N시간 M분"

    let totalTodos = 0;
    let completedTodos = 0;
    periods.forEach(p => {
        if (p.todos) {
            totalTodos += p.todos.length;
            completedTodos += p.todos.filter(t => t.completed).length;
        }
    });
    const rate = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;

    // Timer HTML if not exists (preserved to avoid reset tick)
    if (!sidebar.querySelector('.circular-timer-container')) {
        sidebar.innerHTML = `
             <div class="date-nav">
                <button id="prevDate" class="btn btn-icon">&lt;</button>
                <div class="date-display" id="currentDateDisplay">${currentDate.toLocaleDateString('ko-KR')}</div>
                <button id="nextDate" class="btn btn-icon">&gt;</button>
            </div>

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

        // Listeners
        document.getElementById('prevDate').addEventListener('click', () => changeDate(-1));
        document.getElementById('nextDate').addEventListener('click', () => changeDate(1));

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
        // Update Values only
        document.getElementById('total-focus-time').textContent = totalTimeStr;
        document.getElementById('goal-rate-display').textContent = `${rate}%`;
        document.getElementById('currentDateDisplay').textContent = currentDate.toLocaleDateString('ko-KR');
    }
}

function renderScheduleList() {
    const container = document.getElementById('list-content');
    if (!container) return;

    const periods = PeriodRepository.getPeriodsForDate(getFormattedDate(currentDate));

    if (periods.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>일정이 없습니다.</p>
                <p class="text-secondary">+ 버튼을 눌러 집중 세션을 추가하세요.</p>
            </div>
        `;
        return;
    }

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

    let groupObjects = groupOrder.map((gid, index) => {
        const groupPeriods = groups[gid];
        const isComplete = groupPeriods.every(p => p.completed);
        return {
            gid,
            periods: groupPeriods,
            isComplete,
            originalIndex: index + 1
        };
    });

    groupObjects.sort((a, b) => { // User requested "Completed to Bottom"? Wireframe order is usually sequential. keeping sort for "Done" items.
        if (a.isComplete === b.isComplete) return 0;
        return a.isComplete ? 1 : -1;
    });

    const html = groupObjects.map((groupObj, index) => {
        const study = groupObj.periods.find(p => p.type === 'study');
        const breakP = groupObj.periods.find(p => p.type === 'break');
        const groupId = groupObj.gid;
        const todos = study ? (study.todos || []) : [];

        // Wireframe Style: Header Outside, Body Inside
        return `
        <div class="period-wrapper ${groupObj.isComplete ? 'completed-group' : ''}">
             <div class="period-header">
                 <div class="period-label">
                    ${index + 1}교시
                 </div>
                 <div class="period-time-info">
                    공부 시간 : ${study ? study.duration : 0}분 <span class="divider">|</span> 쉬는 시간 : ${breakP ? breakP.duration : 0}분
                    ${groupId ? `<button class="btn-delete-group-text" data-group-id="${groupId}">삭제</button>` : ''}
                 </div>
             </div>
             
             <div class="period-body">
                 <ul class="todo-list">
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
                    <!-- Hidden Input for simpler interaction? Or prompt? Wireframe imply + adds item. Let's use prompt for simplicity or Toggle Input -->
                 ` : ''}
             </div>
        </div>
        `;
    }).join('');

    container.innerHTML = html;

    // Attach Listeners
    // Delete
    document.querySelectorAll('.btn-delete-group-text').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const gid = e.currentTarget.dataset.groupId;
            if (confirm('이 세션 그룹을 삭제하시겠습니까?')) {
                PeriodRepository.deletePeriodGroup(getFormattedDate(currentDate), gid);
                renderLayout();
            }
        });
    });

    // Add Todo (+)
    document.querySelectorAll('.btn-add-todo-block').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const pid = e.currentTarget.dataset.periodId;
            const text = prompt('할 일을 입력하세요'); // Use prompt to match "Click + to add" simple conceptual flow, unless inline input preferred. 
            // Inline input is better UX. Let's try to swap button with input dynamically or just prompt for now to match wireframe visual cleaness.
            // Wireframe "Plus button" implies click -> action.
            if (text && text.trim()) {
                TodoRepository.addTodoToPeriod(getFormattedDate(currentDate), pid, text.trim());
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
}

function handleExport() {
    const container = document.getElementById('export-container');
    const dateStr = currentDate.toLocaleDateString('ko-KR');

    // Build Export HTML (Simplified for image)
    const stats = document.querySelector('.stats-container').innerHTML;
    const schedule = document.getElementById('list-content').innerHTML;

    container.innerHTML = `
        <div style="padding: 20px; background: #121212; color: #fff;">
            <h2 style="text-align:center; margin-bottom: 20px;">${dateStr} PomoToDo</h2>
            <div style="display:flex; justify-content:center; margin-bottom: 30px;">
                ${stats}
            </div>
            <div>
                ${schedule}
            </div>
        </div>
    `;

    html2canvas(container, {
        backgroundColor: '#121212',
        scale: 2
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `pomotodo-export.png`;
        link.href = canvas.toDataURL();
        link.click();
        container.innerHTML = '';
    }).catch(err => console.error(err));
}

function handleToggleTimer() {
    if (activeTimer.isRunning) {
        activeTimer.pause();
    } else {
        if (!activeTimer.activePeriodId || activeTimer.remainingSeconds <= 0) {
            const periods = PeriodRepository.getPeriodsForDate(getFormattedDate(currentDate));
            const nextPeriod = periods.find(p => !p.completed); // Smart Start

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
