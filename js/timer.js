// Timer Module
export class Timer {
    constructor(callbacks) {
        this.callbacks = callbacks; // { onTick, onComplete }
        this.intervalId = null;
        this.remainingSeconds = 0;
        this.isRunning = false;
        this.activePeriodId = null;
    }

    start(minutes, periodId) {
        if (this.isRunning) return;

        // If starting a new period, reset remaining seconds
        if (periodId !== this.activePeriodId) {
            this.remainingSeconds = minutes * 60;
            this.activePeriodId = periodId;
        }

        this.isRunning = true;
        this.tick(); // Immediate tick
        this.intervalId = setInterval(() => this.tick(), 1000);
    }

    pause() {
        if (!this.isRunning) return;
        clearInterval(this.intervalId);
        this.isRunning = false;
        this.callbacks.onStatusChange && this.callbacks.onStatusChange('paused');
    }

    stop() {
        clearInterval(this.intervalId);
        this.isRunning = false;
        this.remainingSeconds = 0;
        this.activePeriodId = null;
        this.callbacks.onStatusChange && this.callbacks.onStatusChange('stopped');
    }

    tick() {
        if (this.remainingSeconds <= 0) {
            this.complete();
            return;
        }
        this.remainingSeconds--;
        this.callbacks.onTick(this.remainingSeconds);
    }

    complete() {
        clearInterval(this.intervalId);
        this.isRunning = false;
        this.callbacks.onComplete(this.activePeriodId);
    }

    // Utils
    static formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
}
