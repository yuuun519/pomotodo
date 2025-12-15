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
            // Mark as complete and find next?
            PeriodRepository.updatePeriod(getFormattedDate(currentDate), periodId, { completed: true });

            // Audio Notification (Placeholder)
            // playNotificationSound(); 

            alert('세션 종료! 수고하셨습니다.');
            updateTimerDisplay(0);
            renderSchedule(getFormattedDate(currentDate));
            updateControls('stopped');

            // Optional: Auto-start next? For now just stop.
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
    // Determine active type for color
    let isBreak = false;
    if (activeTimer.activePeriodId) {
        const periods = PeriodRepository.getPeriodsForDate(getFormattedDate(currentDate));
        const p = periods.find(p => p.id === activeTimer.activePeriodId);
        if (p && p.type === 'break') isBreak = true;
    }

    // Update Text
    const timeDisplay = document.getElementById('timer-numbers');
    if (timeDisplay) timeDisplay.textContent = Timer.formatTime(remainingSeconds);

    // Update Circle
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
        // avoid divide by zero if currentTimerDuration is 0 (shouldn't happen if running)
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
        // Smart Start Logic
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
    periods.forEach(p => {
        const gid = p.groupId || p.id; // Fallback to ID if no group
        if (!groups[gid]) groups[gid] = [];
        groups[gid].push(p);
    });

    const groupHtml = Object.values(groups).map(groupPeriods => {
        // Assume group has [study, break] or just one
        const study = groupPeriods.find(p => p.type === 'study');
        const breakP = groupPeriods.find(p => p.type === 'break');

        // Use the ID of the group's first element or groupId for delete
        const groupId = groupPeriods[0].groupId;

        return `
        <div class="card period-group-card">
            <div class="period-group-content">
                ${study ? renderPeriodBlock(study, 'study') : ''}
                ${breakP ? `<div class="period-divider"></div>` : ''}
                ${breakP ? renderPeriodBlock(breakP, 'break') : ''}
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
    document.querySelectorAll('.btn-play-mini').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // prevent bubbling if needed
            const id = e.target.dataset.id;
            const duration = parseInt(e.target.dataset.duration);
            const type = e.target.dataset.type;
            const label = type === 'study' ? '집중 중...' : '휴식 중...';
            startPeriod(id, duration, label);
        });
    });

    document.querySelectorAll('.btn-delete-group').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const gid = e.currentTarget.dataset.groupId; // Use currentTarget for button
            if (confirm('이 세션 그룹을 삭제하시겠습니까?')) {
                PeriodRepository.deletePeriodGroup(dateString, gid);
                renderSchedule(dateString);
            }
        });
    });
}

function renderPeriodBlock(period, type) {
    const label = type === 'study' ? '집중' : '휴식';
    const statusClass = period.completed ? 'status-completed' : (period.id === activeTimer?.activePeriodId ? 'status-active' : '');

    return `
        <div class="period-block ${type}-block ${statusClass}" onclick="/* Optional: trigger select */">
            <div class="period-meta">
                <span class="period-type-label">${label}</span>
                <span class="period-duration-label">${period.duration}분</span>
            </div>
            <button class="btn btn-icon btn-play-mini" 
                data-id="${period.id}" 
                data-duration="${period.duration}" 
                data-type="${period.type}">
                ${period.completed ? '✓' : '▶'}
            </button>
        </div>
    `;
}

function startPeriod(id, duration, label) {
    if (activeTimer.intervalId) activeTimer.stop();

    currentTimerDuration = duration;
    document.getElementById('timer-label').textContent = label;
    document.getElementById('timer-numbers').textContent = Timer.formatTime(duration * 60);

    // Reset circle
    const circle = document.querySelector('.progress-ring__circle');
    const radius = circle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
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
    renderSchedule(getFormattedDate(currentDate)); // Update active status in list
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

        // Add Study
        PeriodRepository.addPeriod(getFormattedDate(currentDate), {
            id: crypto.randomUUID(),
            groupId,
            type: 'study',
            duration: studyTime,
            completed: false
        });

        // Add Break
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
