// UI Module
import { PeriodRepository } from './store.js';
import { Timer } from './timer.js';

let currentDate = new Date();
let activeTimer = null;
let currentTimerDuration = 0;

export function renderApp() {
    initTimer();
    renderHeader();
    renderSchedule(getFormattedDate(currentDate));
    initModal();
}

function initTimer() {
    activeTimer = new Timer({
        onTick: (remainingSeconds) => {
            updateTimerDisplay(remainingSeconds);
        },
        onComplete: (periodId) => {
            // 1. Mark as complete
            PeriodRepository.updatePeriod(getFormattedDate(currentDate), periodId, { completed: true });

            // 2. Play Sound (Future)

            // 3. Find Next Period automatically
            // We need to re-fetch the list because we just updated one.
            const periods = PeriodRepository.getPeriodsForDate(getFormattedDate(currentDate));

            // Logical order is creation order (assuming array preserves it). 
            // We shouldn't rely on the "UI Sorted" order for logical progression, 
            // but since the User wants "Completed to Bottom", the top of the UI list IS the next incomplete.

            const nextPeriod = periods.find(p => !p.completed);

            if (nextPeriod) {
                // Seamless Transition
                renderSchedule(getFormattedDate(currentDate)); // Update UI first (sorting happens here)
                const label = nextPeriod.type === 'study' ? '집중 중...' : '휴식 중...';
                startPeriod(nextPeriod.id, nextPeriod.duration, label);
            } else {
                // All done
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
    // Determine active type for color styling
    let isBreak = false;
    if (activeTimer.activePeriodId) {
        const periods = PeriodRepository.getPeriodsForDate(getFormattedDate(currentDate));
        const p = periods.find(p => p.id === activeTimer.activePeriodId);
        if (p && p.type === 'break') isBreak = true;
    }

    // Update Text
    const timeDisplay = document.getElementById('timer-numbers');
    if (timeDisplay) timeDisplay.textContent = Timer.formatTime(remainingSeconds);

    // Update Circle & Colors
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
    if (document.querySelector('.timer-section')) return;

    main.innerHTML = `
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

        <div class="date-nav">
            <button id="prevDate" class="btn btn-icon">&lt;</button>
            <h2 id="currentDateDisplay">${currentDate.toLocaleDateString('ko-KR')}</h2>
            <button id="nextDate" class="btn btn-icon">&gt;</button>
        </div>
        
        <div id="schedule-container" class="schedule-container"></div>

        <button id="addPeriodBtn" class="btn btn-primary btn-floating">+</button>
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
}

function handleToggleTimer() {
    if (activeTimer.isRunning) {
        activeTimer.pause();
    } else {
        if (!activeTimer.activePeriodId || activeTimer.remainingSeconds <= 0) {
            // Find first incomplete period
            const periods = PeriodRepository.getPeriodsForDate(getFormattedDate(currentDate));
            const nextPeriod = periods.find(p => !p.completed);

            if (nextPeriod) {
                const label = nextPeriod.type === 'study' ? '집중 중...' : '휴식 중...';
                startPeriod(nextPeriod.id, nextPeriod.duration, label);
            } else {
                alert('모든 일정이 완료되었습니다! 새로운 세션을 추가하세요.');
            }
        } else {
            // Resume
            activeTimer.intervalId = setInterval(() => activeTimer.tick(), 1000);
            activeTimer.isRunning = true;
            updateControls('running');
        }
    }
}

function changeDate(days) {
    currentDate.setDate(currentDate.getDate() + days);
    document.getElementById('currentDateDisplay').textContent = currentDate.toLocaleDateString('ko-KR');
    renderSchedule(getFormattedDate(currentDate));
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

    // Grouping Logic
    const groups = {};
    const groupOrder = []; // To preserve creation order of groups for numbering if needed?
    // Actually, we want to group distinct GIDs.

    periods.forEach(p => {
        const gid = p.groupId || p.id;
        if (!groups[gid]) {
            groups[gid] = [];
            groupOrder.push(gid);
        }
        groups[gid].push(p);
    });

    // Create Group Objects for sorting
    let groupObjects = groupOrder.map((gid, index) => {
        const groupPeriods = groups[gid];
        // Check if ALL periods in this group are completed? Or ANY?
        // User wants "Completed Periods" to bottom.
        // Usually a group is complete if both parts are complete.
        const isComplete = groupPeriods.every(p => p.completed);
        return {
            gid,
            periods: groupPeriods,
            isComplete,
            originalIndex: index + 1
        };
    });

    // Sort: Incomplete first, Complete last
    groupObjects.sort((a, b) => {
        if (a.isComplete === b.isComplete) return 0;
        return a.isComplete ? 1 : -1;
    });

    const groupHtml = groupObjects.map((groupObj, index) => {
        const study = groupObj.periods.find(p => p.type === 'study');
        const breakP = groupObj.periods.find(p => p.type === 'break');
        const groupId = groupObj.gid; // for delete

        // Format: "Period {N} [ Study: XX min | Break: XX min ]"
        // Using "Period {index+1}" (visual index in the sorted list? or original?)
        // Let's use visual index for now as it's cleaner.

        return `
        <div class="card period-group-card ${groupObj.isComplete ? 'completed-group' : ''}">
            <div class="period-group-header">
                <span class="period-number">Period ${index + 1}</span>
            </div>
            <div class="period-group-content">
                <div class="period-info-text">
                   [ Study: ${study ? study.duration : 0} min <span class="divider">|</span> Break: ${breakP ? breakP.duration : 0} min ]
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

    // Attach Delete Listeners
    document.querySelectorAll('.btn-delete-group').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const gid = e.currentTarget.dataset.groupId;
            if (confirm('이 세션 그룹을 삭제하시겠습니까?')) {
                PeriodRepository.deletePeriodGroup(dateString, gid);
                renderSchedule(dateString);
            }
        });
    });
}

function startPeriod(id, duration, label) {
    if (activeTimer.intervalId) activeTimer.stop();

    currentTimerDuration = duration;
    document.getElementById('timer-label').textContent = label;
    document.getElementById('timer-numbers').textContent = Timer.formatTime(duration * 60);

    // Reset circle
    const circle = document.querySelector('.progress-ring__circle');
    circle.style.strokeDashoffset = 0;

    // Update colors immediately based on type
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

        renderSchedule(getFormattedDate(currentDate));
        closeModal();
    };
}

function openModal() {
    document.getElementById('addPeriodModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('addPeriodModal').classList.add('hidden');
}
