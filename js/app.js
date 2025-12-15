// Main Entry Point
import { initStore } from './store.js';
import { renderApp } from './ui.js';

console.log('PomoToDo App Initializing...');

document.addEventListener('DOMContentLoaded', () => {
    try {
        initStore();
        renderApp();
        console.log('PomoToDo App Initialized.');
    } catch (error) {
        console.error('Failed to initialize app:', error);
    }
});
