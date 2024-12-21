// Wait for the DOM to be fully loaded before running any code
document.addEventListener('DOMContentLoaded', () => {
    // Get the theme toggle button element from the HTML
    const themeButton = document.getElementById('theme-button');
    
    // Add click event listener to the theme button
    themeButton.addEventListener('click', () => {
        // Get the root HTML element
        const html = document.documentElement;
        // Check if current theme is dark by looking for 'data-theme' attribute
        const isDark = html.getAttribute('data-theme') === 'dark';
        
        // Toggle between light and dark themes
        if (isDark) {
            // If currently dark, switch to light
            html.removeAttribute('data-theme');
            themeButton.textContent = '🌙 Dark Mode';
        } else {
            // If currently light, switch to dark
            html.setAttribute('data-theme', 'dark');
            themeButton.textContent = '☀️ Light Mode';
        }
        
        // Save the user's theme preference to browser's localStorage
        // If isDark is true, save 'light', otherwise save 'dark'
        localStorage.setItem('theme', isDark ? 'light' : 'dark');
    });

    // Check if user has a saved theme preference
    const savedTheme = localStorage.getItem('theme');
    // If user previously selected dark theme, apply it
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeButton.textContent = '☀️ Light Mode';
    }
});
