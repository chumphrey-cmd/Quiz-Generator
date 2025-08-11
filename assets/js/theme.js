    // Wait for the DOM to be fully loaded before running the theme logic.
document.addEventListener('DOMContentLoaded', () => {

    // --- References for the Modern Theme Toggle Switch ---
    const themeToggleSwitch = document.getElementById('theme-toggle-switch');
    // Get a reference to the root <html> element, not the body.
    const htmlElement = document.documentElement;

    // --- Event Listener for the New Switch ---
    if (themeToggleSwitch) {
        themeToggleSwitch.addEventListener('click', () => {
            // Check the current theme on the <html> element.
            if (htmlElement.dataset.theme === 'dark') {
                // If it's dark, switch to light.
                htmlElement.dataset.theme = 'light';
                localStorage.setItem('theme', 'light');
            } else {
                // If it's light, switch to dark.
                htmlElement.dataset.theme = 'dark';
                localStorage.setItem('theme', 'dark');
            }
        });
    }

    // --- Initialize Theme on Page Load ---
    const savedTheme = localStorage.getItem('theme');
    // Apply the saved theme to the <html> element.
    // Default to 'light' theme if no theme is saved.
    htmlElement.dataset.theme = savedTheme || 'light';
    
});