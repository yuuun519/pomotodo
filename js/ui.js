// UI Module
import { PeriodRepository } from './store.js';

let currentDate = new Date();

export function renderApp() {
    renderHeader();
    renderSchedule(getFormattedDate(currentDate));
    initModal();
}

function getFormattedDate(date) {
    return date.toISOString().split('T')[0];
}

function renderHeader() {
    const main = document.querySelector('.app-main');
    if (!main) return;

    // Only render header structure once if not exists (to preserve event listeners if we re-render)
    // But for simplicity in this vanilla app, we re-render and re-attach or use delegation.
    // Let's check if it exists:
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
    `;

    // Attach Event Listeners
    document.getElementById('prevDate').addEventListener('click', () => changeDate(-1));
    document.getElementById('nextDate').addEventListener('click', () => changeDate(1));
    document.getElementById('addPeriodBtn').addEventListener('click', openModal);
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
        <div class="card period-card type-${period.type}">
            <div class="period-time">
                 <!-- Future: Calculate actual time based on order -->
                ${period.type.toUpperCase()}
            </div>
            <div class="period-info">
                <h4>${period.type === 'study' ? 'Focus Session' : 'Break'}</h4>
                <p>${period.duration} min</p>
            </div>
        </div>
    `).join('');
}

// --- Modal Logic ---

function initModal() {
    const modal = document.getElementById('addPeriodModal');
    const closeBtn = document.querySelector('.close-modal');
    const form = document.getElementById('addPeriodForm');

    if (!modal) return;

    closeBtn.onclick = closeModal;
    window.onclick = (event) => {
        if (event.target == modal) {
            closeModal();
        }
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
    const modal = document.getElementById('addPeriodModal');
    modal.classList.remove('hidden');
}

function closeModal() {
    const modal = document.getElementById('addPeriodModal');
    modal.classList.add('hidden');
}
