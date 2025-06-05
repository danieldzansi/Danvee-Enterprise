// Account page logic

import { checkSessionAndRedirect, logout } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Check for active session and redirect if none
  const user = await checkSessionAndRedirect();

  // If user exists (meaning session is valid), display user info and setup logout
  if (user) {
    const userInfo = document.getElementById('user-info');
    userInfo.innerHTML = `
      <p><strong>Email:</strong> ${user.email}</p>
      <p><strong>User ID:</strong> ${user.id}</p>
    `;

    // Setup logout button
    const logoutButton = document.getElementById('logout-btn');
    if (logoutButton) {
      logoutButton.addEventListener('click', () => {
        logout();
      });
    } else {
        console.error('Logout button not found!');
    }
  }
}); 