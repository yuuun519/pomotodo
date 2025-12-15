// UI Module
import { PeriodRepository, TodoRepository } from './store.js';
import { Timer } from './timer.js';

let currentDate = new Date();
let activeTimer = null;
let currentTimerDuration = 0;

export function renderApp() {
    initTimer();
    renderHeader(); // Initial structure
    renderSchedule(getFormattedDate(currentDate));
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
                renderSchedule(getFormattedDate(currentDate));
                const label = nextPeriod.type === 'study' ? '집중 중...' : '휴식 중...';
                startPeriod(nextPeriod.id, nextPeriod.duration, label);
            } else {
                alert('모든 일정이 완료되었습니다! 수고하셨습니다.');
                updateTimerDisplay(0);
                renderSchedule(getFormattedDate(currentDate));
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

function renderHeader() {
    const main = document.querySelector('.app-main');
    if (!main) return;

    // Calculate Goal Stats
    const periods = PeriodRepository.getPeriodsForDate(getFormattedDate(currentDate));
    let totalTodos = 0;
    let completedTodos = 0;

    periods.forEach(p => {
        if (p.todos) {
            totalTodos += p.todos.length;
            completedTodos += p.todos.filter(t => t.completed).length;
        }
    });

    const rate = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;

    if (document.querySelector('.timer-section')) {
        // Just update rate if exists
        const rateEl = document.getElementById('goal-rate-display');
        if (rateEl) rateEl.textContent = `목표 달성률: ${rate}%`;
        return;
    }

    main.innerHTML = `
        <div class="header-top-actions" style="position: absolute; top: 20px; right: 20px;">
            <button id="exportBtn" class="btn btn-sm" title="이미지로 저장">📷 저장</button>
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
            
            <p id="goal-rate-display" class="goal-rate">목표 달성률: ${rate}%</p>

            <div class="timer-main-controls">
                <button id="toggleTimerBtn" class="btn btn-primary btn-lg">시작</button>
                <button id="resetTimerBtn" class="btn btn-transparent btn-lg" style="font-size: 0.9rem; color: #888;">초기화</button>
            </div>
        </div>

        <div class="date-nav">
            <button id="prevDate" class="btn btn-icon">&lt;</button>
            <h2 id="currentDateDisplay">${currentDate.toLocaleDateString('ko-KR')}</h2>
            <button id="nextDate" class="btn btn-icon">&gt;</button>
        </div>
        
        <div id="schedule-container" class="schedule-container"></div>

        <button id="addPeriodBtn" class="btn btn-primary btn-floating">+</button>

        <!-- Hidden Container for Export -->
        <div id="export-container"></div>
    `;

    document.getElementById('prevDate').addEventListener('click', () => changeDate(-1));
    document.getElementById('nextDate').addEventListener('click', () => changeDate(1));
    document.getElementById('addPeriodBtn').addEventListener('click', openModal);

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

    document.getElementById('exportBtn').addEventListener('click', handleExport);
}

function handleExport() {
    const container = document.getElementById('export-container');
    const dateStr = currentDate.toLocaleDateString('ko-KR');

    const periods = PeriodRepository.getPeriodsForDate(getFormattedDate(currentDate));
    const totalStudy = periods.filter(p => p.type === 'study').reduce((a, b) => a + b.duration, 0);
    const totalBreak = periods.filter(p => p.type === 'break').reduce((a, b) => a + b.duration, 0);

    let totalTodos = 0;
    let completedTodos = 0;
    periods.forEach(p => {
        if (p.todos) {
            totalTodos += p.todos.length;
            completedTodos += p.todos.filter(t => t.completed).length;
        }
    });
    const rate = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;

    const scheduleHTML = document.getElementById('schedule-container').innerHTML;

    container.innerHTML = `
        <h2>${dateStr} 일정</h2>
        <div style="margin-bottom: 20px; text-align: center; color: #aaa;">
            총 집중: ${totalStudy}분 | 총 휴식: ${totalBreak}분 | 달성률: ${rate}%
        </div>
        <div class="schedule-export-list">
            ${scheduleHTML}
        </div>
        <div style="margin-top: 30px; text-align: right; font-size: 0.8rem; color: #666;">
            Generated by PomoToDo
        </div>
    `;

    html2canvas(container, {
        backgroundColor: '#121212',
        scale: 2
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `pomotodo-${getFormattedDate(currentDate)}.png`;
        link.href = canvas.toDataURL();
        link.click();
        container.innerHTML = '';
    }).catch(err => {
        console.error('Export failed:', err);
        alert('저장 실패');
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
    document.getElementById('currentDateDisplay').textContent = currentDate.toLocaleDateString('ko-KR');
    // Clear header section to redraw stats? Or just update stats.
    const container = document.querySelector('.app-main');
    container.innerHTML = ''; // Full redraw for simplicity to update stats in header
    renderApp();
}

async function renderSchedule(dateString) {
    const container = document.getElementById('schedule-container');
    if (!container) return;

    const periods = PeriodRepository.getPeriodsForDate(dateString);

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

    groupObjects.sort((a, b) => {
        if (a.isComplete === b.isComplete) return 0;
        return a.isComplete ? 1 : -1;
    });

    const groupHtml = groupObjects.map((groupObj, index) => {
        const study = groupObj.periods.find(p => p.type === 'study');
        const breakP = groupObj.periods.find(p => p.type === 'break');
        const groupId = groupObj.gid;

        // Todos belong to Study period primarily
        const todos = study ? (study.todos || []) : [];

        return `
        <div class="card period-group-card ${groupObj.isComplete ? 'completed-group' : ''}">
            <div class="period-group-header">
                <span class="period-number">Period ${index + 1}</span>
            </div>
            <div class="period-group-content">
                <div class="period-info-row">
                   <span class="info-label">Focus</span> ${study ? study.duration : 0} min 
                   <span class="divider">|</span> 
                   <span class="info-label">Break</span> ${breakP ? breakP.duration : 0} min
                </div>
                
                <!-- Todo Section -->
                <div class="todo-section">
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
                        <input type="text" class="todo-input" 
                            data-period-id="${study.id}" 
                            placeholder="할 일 추가... (Enter)">
                    ` : ''}
                </div>
            </div>
            ${groupId ? `
                <button class="btn btn-icon btn-delete-group" data-group-id="${groupId}" title="그룹 삭제">
                    🗑️
                </button>
            ` : ''}
        </div>
        `;
    }).join('');

    container.innerHTML = groupHtml;

    // Attach Listeners

    // Delete
    document.querySelectorAll('.btn-delete-group').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const gid = e.currentTarget.dataset.groupId;
            if (confirm('이 세션 그룹을 삭제하시겠습니까?')) {
                PeriodRepository.deletePeriodGroup(dateString, gid);
                renderApp(); // Redraw all to update stats
            }
        });
    });

    // Add Todo (Enter key)
    document.querySelectorAll('.todo-input').forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.value.trim()) {
                const pid = e.target.dataset.periodId;
                TodoRepository.addTodoToPeriod(dateString, pid, e.target.value.trim());
                renderApp(); // Redraw
            }
        });
    });

    // Toggle Todo
    document.querySelectorAll('.todo-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const pid = e.target.dataset.periodId;
            const tid = e.target.dataset.todoId;
            TodoRepository.toggleTodo(dateString, pid, tid);
            renderApp(); // Redraw
        });
    });
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
            <h3>세션 추가</h3>
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
                <button type="submit" class="btn btn-primary full-width">세션 추가</button>
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

        renderApp();
        closeModal();
    };
}

function openModal() {
    document.getElementById('addPeriodModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('addPeriodModal').classList.add('hidden');
}
