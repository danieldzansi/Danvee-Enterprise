import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const feedbackDiv = document.getElementById('loginFeedback');

  // Get references to the sections
  const loginSection = document.getElementById('loginSection');
  const dashboardSection = document.getElementById('dashboardSection');
  const logoutBtn = document.getElementById('logoutBtn');

  // Function to update UI based on auth state
  function updateAuthUI(session) {
    if (session) {
      // User is logged in, show dashboard, hide login
      if (loginSection) loginSection.style.display = 'none';
      if (dashboardSection) dashboardSection.style.display = 'block';
      // Update body class and title for dashboard
      document.body.className = '';
      document.title = 'Admin Dashboard - DANVEE';
      console.log('Admin user logged in.');
      
      // Clear any login feedback
      if (feedbackDiv) feedbackDiv.textContent = '';
      
      // Optionally, fetch and display admin data here (or in admin.js)
    } else {
      // User is not logged in, show login, hide dashboard
      if (loginSection) loginSection.style.display = 'block';
      if (dashboardSection) dashboardSection.style.display = 'none';
      // Update body class and title for login
      document.body.className = 'admin-auth-bg';
      document.title = 'Admin Login - DANVEE';
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

  // Handle login form submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = emailInput.value.trim();
      const password = passwordInput.value;

      // Clear previous feedback
      feedbackDiv.textContent = '';
      feedbackDiv.style.color = '';

      // Show loading state
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn.textContent;
      submitBtn.textContent = 'Logging in...';
      submitBtn.disabled = true;

      try {
        const { data, error } = await supabase.auth.signInWithPassword({ 
          email, 
          password 
        });

        if (error) {
          feedbackDiv.textContent = 'Login failed: ' + error.message;
          feedbackDiv.style.color = 'red';
        } else {
          feedbackDiv.textContent = 'Login successful! Loading dashboard...';
          feedbackDiv.style.color = 'green';
          // Clear form
          loginForm.reset();
          // The updateAuthUI function will be called automatically by onAuthStateChange
        }
      } catch (error) {
        console.error('Login error:', error);
        feedbackDiv.textContent = 'An unexpected error occurred. Please try again.';
        feedbackDiv.style.color = 'red';
      } finally {
        // Reset button state
        submitBtn.textContent = originalBtnText;
        submitBtn.disabled = false;
      }
    });
  }

  // Handle logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      
      try {
        const { error } = await supabase.auth.signOut();
        
        if (error) {
          console.error('Logout error:', error);
          alert('Error logging out. Please try again.');
        } else {
          console.log('Logout successful');
          // The updateAuthUI function will be called automatically by onAuthStateChange
        }
      } catch (error) {
        console.error('Logout error:', error);
        alert('Error logging out. Please try again.');
      }
    });
  }
});

// Export functions for use in the main index.html script if needed
export function getCurrentSession() {
  return supabase.auth.getSession();
}

export function logout() {
  return supabase.auth.signOut();
}