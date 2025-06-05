import { supabase } from './supabaseClient.js';
import { logout } from './auth.js';

// Header user state logic

// Function to update the header based on session
async function updateHeaderUserState() {
  const userArea = document.getElementById('user-area');
  const { data: { session } } = await supabase.auth.getSession();

  if (userArea) { // Ensure userArea element exists
    if (session && session.user) {
      // User is logged in
      userArea.innerHTML = `
        <a href="account.html" id="account-link">Account</a> /
        <a href="#" id="logout-link">Logout</a>
      `;
      const logoutLink = document.getElementById('logout-link');
      if (logoutLink) { // Ensure logoutLink exists before adding listener
        logoutLink.addEventListener('click', async (e) => {
          e.preventDefault();
          await logout(); // Use the imported logout function
        });
      }
    } else {
      // User is logged out
      userArea.innerHTML = `
        <a href="login.html" id="login-link">Login</a> /
        <a href="login.html" id="register-link">Register</a>
      `;
    }
  }
}

// Run the header update on DOMContentLoaded
document.addEventListener('DOMContentLoaded', updateHeaderUserState);

// Also listen for auth state changes (e.g., after redirect from email confirmation)
supabase.auth.onAuthStateChange((_event, session) => {
    console.log('Auth state changed:', _event, session); // Log auth state changes
    console.log('Session data in onAuthStateChange:', session); // Add this log
    updateHeaderUserState();
    // If the event is SIGNIN and we are on the index page after a redirect,
    // potentially redirect to the account page.
    // Removed redirection from index.html for signed-in users
    // if (_event === 'SIGNED_IN' && window.location.pathname.endsWith('index.html')) {
    //      console.log('User signed in on index page, redirecting to account...');
    //      // Small delay to ensure session is fully set up
    //      setTimeout(() => { window.location.replace('account.html'); }, 100);
    // }
}); 