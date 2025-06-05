// Placeholder: Auth logic

// Auth logic for Jumia-style login (magic link)

// Two-step login/register flow

import { supabase } from './supabaseClient.js';
import { clearCart } from './cart.js'; // Import clearCart function

document.addEventListener('DOMContentLoaded', () => {
  // Only run this script on login.html and signup.html
  if (window.location.pathname.endsWith('login.html')) {
    setupLoginFlow();
  } else if (window.location.pathname.endsWith('signup.html')) {
      // Redirect signup page to login page to use the unified flow
      window.location.replace('login.html');
  }
});

function setupLoginFlow() {
    const stepEmail = document.getElementById('step-email');
    const stepPassword = document.getElementById('step-password');
    const continueBtn = document.getElementById('continue-btn');
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const editEmailBtn = document.getElementById('edit-email-btn');
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const emailSummaryText = document.getElementById('email-summary-text');
    const feedback = document.getElementById('login-feedback');
    const authTitle = document.getElementById('auth-title');
    const authDesc = document.getElementById('auth-desc');
    let currentEmail = '';
  
    // Step 1: Continue with email
    continueBtn.addEventListener('click', async () => { // Made async to check user existence
      const email = emailInput.value.trim();
      if (!email) {
        feedback.textContent = 'Please enter your email.';
        feedback.style.color = 'red';
        return;
      }
      currentEmail = email;
      emailSummaryText.textContent = email;
      stepEmail.style.display = 'none';
      stepPassword.style.display = 'block';
      passwordInput.value = '';
      feedback.textContent = '';
  
      // Directly show password step and both buttons
      stepEmail.style.display = 'none';
      stepPassword.style.display = 'block';
      authTitle.textContent = 'Welcome!'; // Neutral title
      authDesc.textContent = 'Enter your password or create a new account.'; // Neutral description
      passwordInput.focus();
      loginBtn.style.display = 'inline-block'; // Show both login and register
      registerBtn.style.display = 'inline-block';
    });
  
    // Step 2: Try login
    loginBtn.addEventListener('click', async () => {
      const password = passwordInput.value;
      if (!password) {
        feedback.textContent = 'Please enter your password.';
        feedback.style.color = 'red';
        return;
      }
      feedback.textContent = 'Logging in...';
      feedback.style.color = '#333';
      const { error } = await supabase.auth.signInWithPassword({ email: currentEmail, password });
      if (error) {
         // Specific handling for invalid password, others are unexpected after email check
         if (error.message.toLowerCase().includes('invalid login credentials')) {
            feedback.textContent = 'Incorrect password. Please try again.';
            feedback.style.color = 'red';
         } else {
            feedback.textContent = 'Login failed: ' + error.message;
            feedback.style.color = 'red';
         }
      } else {
        feedback.textContent = 'Login successful! Redirecting...';
        feedback.style.color = 'green';
        setTimeout(() => {
          window.location.href = 'index.html'; // Redirect to home page
        }, 1000);
      }
    });
  
    // Register new user
    registerBtn.addEventListener('click', async () => {
      const password = passwordInput.value;
      if (!password) {
        feedback.textContent = 'Please enter a password.';
        feedback.style.color = 'red';
        return;
      }
      feedback.textContent = 'Registering...';
      feedback.style.color = '#333';
      const { error } = await supabase.auth.signUp({ email: currentEmail, password }, {
        redirectTo: 'https://danvee-enterprise.vercel.app/index.html'
      });
      if (error) {
        feedback.textContent = 'Registration failed: ' + error.message;
        feedback.style.color = 'red';
      } else {
        feedback.textContent = 'Registration successful! Please check your email to confirm your account.';
        feedback.style.color = 'green';
        // No redirect here, keep user on the page with success message
      }
    });
  
    // Edit email
    editEmailBtn.addEventListener('click', () => {
      stepEmail.style.display = 'block';
      stepPassword.style.display = 'none';
      feedback.textContent = '';
      authTitle.textContent = 'Welcome to DANVEE';
      authDesc.textContent = 'Type your email to log in or create a DANVEE account.';
      emailInput.focus();
    });
  
    // Forgot password
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    if(forgotPasswordLink) { // Check if the element exists
        forgotPasswordLink.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!currentEmail) {
              feedback.textContent = 'Please enter your email first.';
              feedback.style.color = 'red';
              return;A
            }
            feedback.textContent = 'Sending password reset email...';
            feedback.style.color = '#333';
            const { error } = await supabase.auth.resetPasswordForEmail(currentEmail);
            if (error) {
              feedback.textContent = 'Error: ' + error.message;
              feedback.style.color = 'red';
            } else {
              feedback.textContent = 'Password reset email sent! Check your inbox.';
              feedback.style.color = 'green';
            }
        });
    }
}

// Logout function
export async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('Logout failed:', error.message);
    } else {
        clearCart(); // Call clearCart after successful sign out
        // Redirect to home page after logout
        window.location.href = 'index.html';
    }
}

// Function to check session and redirect if necessary
export async function checkSessionAndRedirect(redirectUrl = 'login.html') {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
        console.error('Error getting session:', error.message);
        window.location.replace(redirectUrl); // Redirect on error
        return null;
    }
    if (!data || !data.session) {
        console.log('No active session, redirecting...');
        window.location.replace(redirectUrl); // Redirect if no session
        return null;
    }
    console.log('Active session found:', data.session);
    return data.session.user; // Return user info if session exists 
} 