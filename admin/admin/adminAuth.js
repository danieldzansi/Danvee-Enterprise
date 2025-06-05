import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('admin-login-form');
  const emailInput = document.getElementById('admin-email');
  const passwordInput = document.getElementById('admin-password');
  const feedbackDiv = document.getElementById('admin-login-feedback');

  // Get references to the sections
  const loginSection = document.getElementById('admin-login-section');
  const dashboardSection = document.getElementById('admin-dashboard-section');

  // Function to update UI based on auth state
  function updateAuthUI(session) {
    if (session) {
      // User is logged in, show dashboard, hide login
      if (loginSection) loginSection.style.display = 'none';
      if (dashboardSection) dashboardSection.style.display = ''; // or 'block' or 'flex' depending on layout
      console.log('Admin user logged in.');
      // Optionally, fetch and display admin data here (or in admin.js)
    } else {
      // User is not logged in, show login, hide dashboard
      if (loginSection) loginSection.style.display = ''; // or 'block' or 'flex'
      if (dashboardSection) dashboardSection.style.display = 'none';
      console.log('Admin user logged out.');
    }
  }

  // Initial check and set up auth state listener
  supabase.auth.getSession().then(({ data: { session } }) => {
    updateAuthUI(session);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    console.log('Admin auth state changed:', _event, session);
    updateAuthUI(session);
  });

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = emailInput.value;
      const password = passwordInput.value;

      feedbackDiv.textContent = ''; // Clear previous feedback

      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        feedbackDiv.textContent = 'Login failed: ' + error.message;
        feedbackDiv.style.color = 'red';
      } else {
        feedbackDiv.textContent = 'Login successful! Updating UI...';
        feedbackDiv.style.color = 'green';
        // No redirect needed, the auth state change listener handles UI update
        // The updateAuthUI function will be called automatically by onAuthStateChange
      }
    });
  }
}); 