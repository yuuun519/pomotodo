// UI Module
import { PeriodRepository } from './store.js';
import { Timer } from './timer.js';

let currentDate = new Date();
let activeTimer = null;

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
            // Mark period as complete in store
            // PeriodRepository.updatePeriod(getFormattedDate(currentDate), periodId, { completed: true }); // Need date context
            alert('Focus Session Complete!');
            renderTimerBar(false);
            renderSchedule(getFormattedDate(currentDate));
        },
        onStatusChange: (status) => {
            console.log('Timer status:', status);
        }
    });
}

function updateTimerDisplay(remainingSeconds) {
    const timeDisplay = document.getElementById('activeTimerDisplay');
    if (timeDisplay) {
        timeDisplay.textContent = Timer.formatTime(remainingSeconds);
    }
    // Also update tab title
    document.title = `${Timer.formatTime(remainingSeconds)} - PomoToDo`;
}

function getFormattedDate(date) {
    return date.toISOString().split('T')[0];
}

function renderHeader() {
    const main = document.querySelector('.app-main');
    if (!main) return;
    if (document.querySelector('.date-nav')) return;

    main.innerHTML = `
        <div class="date-nav">
            <button id="prevDate" class="btn btn-icon">&lt;</button>
            <h2 id="currentDateDisplay">${currentDate.toLocaleDateString()}</h2>
            <button id="nextDate" class="btn btn-icon">&gt;</button>
        </div>
        
        <div id="schedule-container" class="schedule-container">
            <!-- Periods will be injected here -->
        </div>

        <button id="addPeriodBtn" class="btn btn-primary btn-floating">+</button>
        
        <div id="timerBar" class="timer-bar hidden">
            <div class="timer-info">
                <span id="activeTimerType">Focus</span>
                <span id="activeTimerDisplay">00:00</span>
            </div>
            <div class="timer-controls">
                <button id="pauseTimerBtn" class="btn btn-sm">Pause</button>
                <button id="stopTimerBtn" class="btn btn-sm btn-danger">Stop</button>
            </div>
        </div>
    `;

    document.getElementById('prevDate').addEventListener('click', () => changeDate(-1));
    document.getElementById('nextDate').addEventListener('click', () => changeDate(1));
    document.getElementById('addPeriodBtn').addEventListener('click', openModal);

    document.getElementById('pauseTimerBtn').addEventListener('click', () => {
        if (activeTimer.isRunning) {
            activeTimer.pause();
            document.getElementById('pauseTimerBtn').textContent = 'Resume';
        } else {
            activeTimer.start(0, activeTimer.activePeriodId); // Resume (0 means don't reset)
            // Limitation: Timer.start reset logic needs improvement for resume
            // Actually Timer.start logic I wrote resets if new ID. Resuming needs care.
            // For prototype, let's just toggle text and rely on naive resume or fix Timer class.
            // Fix: accessing internal start logic.
            if (activeTimer.intervalId) {
                // It's paused but interval cleared.
                activeTimer.start(activeTimer.remainingSeconds / 60, activeTimer.activePeriodId);
            } else {
                activeTimer.start(activeTimer.remainingSeconds / 60, activeTimer.activePeriodId);
            }
            document.getElementById('pauseTimerBtn').textContent = 'Pause';
        }
    });

    document.getElementById('stopTimerBtn').addEventListener('click', () => {
        activeTimer.stop();
        renderTimerBar(false);
        document.title = 'PomoToDo';
    });
}

function renderTimerBar(visible, type = 'Focus') {
    const bar = document.getElementById('timerBar');
    if (visible) {
        bar.classList.remove('hidden');
        document.getElementById('activeTimerType').textContent = type === 'study' ? 'Focus' : 'Break';
        document.getElementById('pauseTimerBtn').textContent = 'Pause';
    } else {
        bar.classList.add('hidden');
    }
}

function changeDate(days) {
    currentDate.setDate(currentDate.getDate() + days);
    document.getElementById('currentDateDisplay').textContent = currentDate.toLocaleDateString();
    renderSchedule(getFormattedDate(currentDate));
}

async function renderSchedule(dateString) {
    const container = document.getElementById('schedule-container');
    if (!container) return;

    const periods = PeriodRepository.getPeriodsForDate(dateString);

    if (periods.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No plans for this day.</p>
                <p class="text-secondary">Tap + to add a focus period.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = periods.map(period => `
        <div class="card period-card type-${period.type} ${period.completed ? 'completed' : ''}">
            <div class="period-time">
                ${period.type.toUpperCase()}
            </div>
            <div class="period-info">
                <h4>${period.type === 'study' ? 'Focus Session' : 'Break'}</h4>
                <p>${period.duration} min</p>
            </div>
            <div class="period-actions">
                ${!period.completed ? `
                    <button class="btn btn-icon btn-start" data-id="${period.id}" data-duration="${period.duration}" data-type="${period.type}">
                        ▶
                    </button>
                ` : '<span>✓</span>'}
            </div>
        </div>
    `).join('');

    // Attach start listeners
    document.querySelectorAll('.btn-start').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            const duration = parseInt(e.target.dataset.duration);
            const type = e.target.dataset.type;
            startPeriod(id, duration, type);
        });
    });
}

function startPeriod(id, duration, type) {
    activeTimer.stop(); // Stop any existing
    activeTimer.start(duration, id);
    renderTimerBar(true, type);
}

// --- Modal Logic ---
function initModal() {
    const modal = document.getElementById('addPeriodModal');
    const closeBtn = document.querySelector('.close-modal');
    const form = document.getElementById('addPeriodForm');

    if (!modal) return;

    closeBtn.onclick = closeModal;
    window.onclick = (event) => {
        if (event.target == modal) closeModal();
    };

    form.onsubmit = (e) => {
        e.preventDefault();
        const type = document.getElementById('periodType').value;
        const duration = parseInt(document.getElementById('periodDuration').value);

        const newPeriod = {
            id: crypto.randomUUID(),
            type,
            duration,
            completed: false
        };

        PeriodRepository.addPeriod(getFormattedDate(currentDate), newPeriod);
        renderSchedule(getFormattedDate(currentDate));
        closeModal();
        form.reset();
    };
}

function openModal() {
    document.getElementById('addPeriodModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('addPeriodModal').classList.add('hidden');
}
