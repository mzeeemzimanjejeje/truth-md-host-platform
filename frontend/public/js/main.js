// Global functions and utilities
document.addEventListener('DOMContentLoaded', () => {
    // Add any global functionality needed across all pages
    console.log('TRUTH Host Platform loaded');
    
    // Check for admin credentials in localStorage (for demo purposes)
    if (window.location.pathname.includes('login.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const adminLogin = urlParams.get('admin');
        
        if (adminLogin === 'true') {
            document.getElementById('username').value = 'darrell';
            document.getElementById('password').value = 'mucheri';
        }
    }
});
