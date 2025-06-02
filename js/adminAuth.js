import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('admin-login-form');
  const emailInput = document.getElementById('admin-email');
  const passwordInput = document.getElementById('admin-password');
  const feedbackDiv = document.getElementById('admin-login-feedback');

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
        feedbackDiv.textContent = 'Login successful! Redirecting...';
        feedbackDiv.style.color = 'green';
        // Redirect to the admin dashboard after successful login
        window.location.href = 'index.html'; 
      }
    });
  }
}); 