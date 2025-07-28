// Wait for the DOM to be fully loaded before running the theme logic.
document.addEventListener('DOMContentLoaded', () => {

    // --- References for the Modern Theme Toggle Switch ---
    const themeToggleSwitch = document.getElementById('theme-toggle-switch');
    const themeToggleText = document.getElementById('theme-toggle-text');
    // Get a reference to the root <html> element, not the body.
    const htmlElement = document.documentElement;

    // --- Helper function to update the text label and UI ---
    const updateThemeUI = () => {
        // Check the theme on the <html> element.
        if (htmlElement.dataset.theme === 'dark') {
            themeToggleText.textContent = 'Light Mode';
        } else {
            themeToggleText.textContent = 'Dark Mode';
        }
    };

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
            // After changing the theme, update the UI.
            updateThemeUI();
        });
    }

    // --- Initialize Theme on Page Load ---
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        // Apply the saved theme to the <html> element.
        htmlElement.dataset.theme = 'dark';
    } else {
        // Default to light theme.
        htmlElement.dataset.theme = 'light';
    }
    
    // Call the update function once on load to set the correct initial state.
    updateThemeUI();
});