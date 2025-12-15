const timerDisplay = document.getElementById('timerDisplay');
const timeInput = document.getElementById('timeInput');
const startBtn = document.getElementById('startBtn');

let countdownInterval;
let totalSeconds = 0;

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const displayMinutes = String(minutes).padStart(2, '0');
    const displaySeconds = String(remainingSeconds).padStart(2, '0');
    return `${displayMinutes}:${displaySeconds}`;
}

function updateDisplay() {
    timerDisplay.textContent = formatTime(totalSeconds);
}

function startTimer() {
    const minutes = parseInt(timeInput.value);

    if (isNaN(minutes) || minutes <= 0) {
        alert('Please enter a valid number of minutes.');
        return;
    }

    // Stop any existing timer
    clearInterval(countdownInterval);

    totalSeconds = minutes * 60;
    updateDisplay();

    // Disable input and button while running (optional, but good UX)
    timeInput.disabled = true;
    startBtn.textContent = 'Running...';
    startBtn.disabled = true;

    countdownInterval = setInterval(() => {
        totalSeconds--;
        updateDisplay();

        if (totalSeconds <= 0) {
            clearInterval(countdownInterval);
            timeInput.disabled = false;
            startBtn.disabled = false;
            startBtn.textContent = 'Start Focus';
            alert('Time is up!');
        }
    }, 1000);
}

startBtn.addEventListener('click', startTimer);
