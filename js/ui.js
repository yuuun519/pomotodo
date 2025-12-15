// UI Module
// Responsible for rendering the application interface

export function renderApp() {
    const main = document.querySelector('.app-main');
    if (main) {
        main.innerHTML = `
            <div class="welcome-screen">
                <h2>Welcome to PomoToDo</h2>
                <p>Your custom study/break manager.</p>
                <div class="card">
                    <h3>Today's Schedule</h3>
                    <p>No periods added yet.</p>
                </div>
            </div>
        `;
    }
}
