// Data Layer / Store
// Responsible for LocalStorage interactions and state management

const STORAGE_KEY = 'pomotodo_schema_v1';

// --- Schema Definitions ---
// DailySchedule: { [dateString]: { periods: Period[] } }
// Period: { id: string, type: 'study'|'break', startTime: string, endTime: string, durationMinutes: number, todos: Todo[], completed: boolean }
// Todo: { id: string, text: string, completed: boolean }

export function initStore() {
    console.log('Store initialized');
    if (!localStorage.getItem(STORAGE_KEY)) {
        const initialState = {
            schedule: {}, // yyyy-mm-dd keys
            settings: {
                theme: 'dark',
                defaultStudyDuration: 25,
                defaultBreakDuration: 5
            }
        };
        saveState(initialState);
    }
}

export function getState() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (e) {
        console.error('State parse error', e);
        return {};
    }
}

export function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    // Dispatch event for reactive UI updates
    window.dispatchEvent(new CustomEvent('pomotodo-state-changed', { detail: state }));
}

// --- Repository Methods ---

export const PeriodRepository = {
    getPeriodsForDate: (dateString) => {
        const state = getState();
        return state.schedule[dateString]?.periods || [];
    },

    addPeriod: (dateString, period) => {
        const state = getState();
        if (!state.schedule[dateString]) {
            state.schedule[dateString] = { periods: [] };
        }
        state.schedule[dateString].periods.push(period);
        saveState(state);
    },

    updatePeriod: (dateString, periodId, updates) => {
        const state = getState();
        const periods = state.schedule[dateString]?.periods;
        if (!periods) return;

        const index = periods.findIndex(p => p.id === periodId);
        if (index !== -1) {
            periods[index] = { ...periods[index], ...updates };
            saveState(state);
        }
    },

    deletePeriod: (dateString, periodId) => {
        const state = getState();
        const periods = state.schedule[dateString]?.periods;
        if (!periods) return;

        state.schedule[dateString].periods = periods.filter(p => p.id !== periodId);
        saveState(state);
    }
};

export const TodoRepository = {
    addTodoToPeriod: (dateString, periodId, todoText) => {
        const state = getState();
        const periods = state.schedule[dateString]?.periods;
        if (!periods) return;

        const period = periods.find(p => p.id === periodId);
        if (period) {
            if (!period.todos) period.todos = [];
            period.todos.push({
                id: crypto.randomUUID(),
                text: todoText,
                completed: false
            });
            saveState(state);
        }
    },

    toggleTodo: (dateString, periodId, todoId) => {
        const state = getState();
        const periods = state.schedule[dateString]?.periods;
        if (!periods) return;

        const period = periods.find(p => p.id === periodId);
        if (period && period.todos) {
            const todo = period.todos.find(t => t.id === todoId);
            if (todo) {
                todo.completed = !todo.completed;
                saveState(state);
            }
        }
    }
};
