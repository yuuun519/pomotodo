// UI Module
import { PeriodRepository } from './store.js';
import { Timer } from './timer.js';

let currentDate = new Date();
let activeTimer = null;
let currentTimerDuration = 0; // Needed for circle calculation

export function renderApp() {
    initTimer();
    renderHeader(); // Initial structure including Timer
    renderSchedule(getFormattedDate(currentDate));
    initModal();
}

function initTimer() {
    activeTimer = new Timer({
        onTick: (remainingSeconds) => {
            updateTimerDisplay(remainingSeconds);
        },
        onComplete: (periodId) => {
            // PeriodRepository.updatePeriod(getFormattedDate(currentDate), periodId, { completed: true });
            alert('세션 종료! 수고하셨습니다.');
            // renderTimerBar(false); // We keep the top timer, just reset?
            updateTimerDisplay(0);
            renderSchedule(getFormattedDate(currentDate));
        },
        onStatusChange: (status) => {
            console.log('Timer status:', status);
            updateControls(status);
        }
    });
}

function updateControls(status) {
    const btn = document.getElementById('toggleTimerBtn');
    if (!btn) return;

    if (status === 'paused' || status === 'stopped') {
        btn.textContent = '시작'; // Start
        btn.classList.remove('btn-danger');
        btn.classList.add('btn-primary');
    } else {
        btn.textContent = '일시정지'; // Pause
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-danger'); // Use danger color for pause/stop visibility or just neutral
    }
}

function updateTimerDisplay(remainingSeconds) {
    // Numeric Display
    const timeDisplay = document.getElementById('timer-numbers');
    if (timeDisplay) {
        timeDisplay.textContent = Timer.formatTime(remainingSeconds);
    }

    // Circular Progress
    const circle = document.querySelector('.progress-ring__circle');
    if (circle && currentTimerDuration > 0) {
        const radius = circle.r.baseVal.value;
        const circumference = radius * 2 * Math.PI;
        const offset = circumference - (remainingSeconds / (currentTimerDuration * 60)) * circumference;

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

    // New Layout: Timer at Top, then Date Nav, then Schedule
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
                <button id="resetTimerBtn" class="btn btn-secondary btn-lg">초기화</button>
            </div>
        </div>

        <div class="date-nav">
            <button id="prevDate" class="btn btn-icon">&lt;</button>
            <h2 id="currentDateDisplay">${currentDate.toLocaleDateString('ko-KR')}</h2>
            <button id="nextDate" class="btn btn-icon">&gt;</button>
        </div>
        
        <div id="schedule-container" class="schedule-container">
            <!-- Periods will be injected here -->
        </div>

        <button id="addPeriodBtn" class="btn btn-primary btn-floating">+</button>
    `;

    document.getElementById('prevDate').addEventListener('click', () => changeDate(-1));
    document.getElementById('nextDate').addEventListener('click', () => changeDate(1));
    document.getElementById('addPeriodBtn').addEventListener('click', openModal);

    document.getElementById('toggleTimerBtn').addEventListener('click', handleToggleTimer);
    document.getElementById('resetTimerBtn').addEventListener('click', () => {
        if (confirm('타이머를 초기화 하시겠습니까?')) {
            activeTimer.stop();
            updateTimerDisplay(currentTimerDuration * 60);
            updateControls('stopped');
        }
    });
}

function handleToggleTimer() {
    if (activeTimer.isRunning) {
        activeTimer.pause();
    } else {
        // If has active period, resume. If not, maybe warn?
        if (activeTimer.activePeriodId) {
            const seconds = activeTimer.remainingSeconds > 0 ? activeTimer.remainingSeconds : currentTimerDuration * 60;
            // Hacky resume for now
            activeTimer.intervalId = setInterval(() => activeTimer.tick(), 1000);
            activeTimer.isRunning = true;
            updateControls('running');
        } else {
            alert('재생할 세션을 선택해주세요.');
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

    container.innerHTML = periods.map(period => `
        <div class="card period-card type-${period.type} ${period.completed ? 'completed' : ''}">
            <div class="period-info">
                <h4>${period.type === 'study' ? '집중 (Focus)' : '휴식 (Break)'}</h4>
                <p>${period.duration}분</p>
            </div>
            <div class="period-actions">
               <button class="btn btn-icon btn-start" data-id="${period.id}" data-duration="${period.duration}" data-type="${period.type}">
                    ▶
               </button>
            </div>
        </div>
    `).join('');

    // Attach start listeners
    document.querySelectorAll('.btn-start').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            const duration = parseInt(e.target.dataset.duration);
            const type = e.target.dataset.type;
            const label = type === 'study' ? '집중 중...' : '휴식 중...';
            startPeriod(id, duration, label);
        });
    });
}

function startPeriod(id, duration, label) {
    activeTimer.stop();
    currentTimerDuration = duration;
    document.getElementById('timer-label').textContent = label;
    updateTimerDisplay(duration * 60); // Set initial visual
    activeTimer.start(duration, id);
    updateControls('running');

    // Scroll to top to show timer
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- Modal Logic ---
function initModal() {
    // Inject improved modal HTML if needed or assume index.html has it.
    // We need to UPDATE index.html's modal structure first or inject it here.
    // Let's inject it to be safe and cleaner.

    let modal = document.getElementById('addPeriodModal');
    if (!modal) {
        // Create it
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

        // Add Study Period
        PeriodRepository.addPeriod(getFormattedDate(currentDate), {
            id: crypto.randomUUID(),
            type: 'study',
            duration: studyTime,
            completed: false
        });

        // Add Break Period
        PeriodRepository.addPeriod(getFormattedDate(currentDate), {
            id: crypto.randomUUID(),
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
