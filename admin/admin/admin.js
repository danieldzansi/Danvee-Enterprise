import { supabase } from './supabaseClient.js';

// Function to check if the current user is an admin
async function isAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return false; // Not logged in, not an admin
  }

  // Check if the user's ID exists in the 'admins' table
  const { data, error } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
    console.error("Error checking admin status:", error.message);
    return false; // Return false on error (be safe)
  }

  // If data is not null, the user ID was found in the admins table
  return data !== null;
}

// Function to check auth and redirect if not authorized
async function checkAdminAuthAndRedirect() {
    const userIsAdmin = await isAdmin();
    if (!userIsAdmin) {
        console.log("User is not authorized for admin dashboard. Redirecting to login.");
        // Redirect to the admin login page - REMOVED
        // window.location.replace('login.html');
        // Instead of redirecting, the adminAuth.js handles showing the login section
    }
}

// Function to fetch and display orders
async function fetchAndDisplayOrders() {
  console.log("Fetching orders for admin...");

  const ordersListDiv = document.getElementById('orders-list');

  // We already checked admin status on page load, so no need to check again here
  // unless you want a real-time check (less common on dashboard load).

  const { data: orders, error } = await supabase
    .from('orders')
    .select('*'); // Select all columns for now

  if (error) {
    console.error("Error fetching orders:", error.message);
    if (ordersListDiv) {
      ordersListDiv.innerHTML = '<p>Error loading orders.</p>';
    }
    return;
  }

  console.log("Fetched orders:", orders);

  if (!orders || orders.length === 0) {
    if (ordersListDiv) {
      ordersListDiv.innerHTML = '<p>No orders found yet.</p>';
    }
    return;
  }

  // Generate HTML for the orders table
  let ordersHtml = '<table><thead><tr><th>Order ID</th><th>User ID</th><th>Items</th><th>Total</th><th>Order Date</th></tr></thead><tbody>';

  orders.forEach(order => {
    // Convert the items JSONB array to a readable string or list
    const itemsString = order.items ? order.items.map(item => `${item.name || 'Unknown Product'} (${item.quantity})`).join(', ') : 'No items';

    ordersHtml += `
      <tr>
        <td>${order.id}</td>
        <td>${order.user_id}</td>
        <td>${itemsString}</td>
        <td>$${Number(order.total || 0).toFixed(2)}</td>
        <td>${new Date(order.created_at).toLocaleString()}</td>
      </tr>
    `;
  });

  ordersHtml += '</tbody></table>';

  if (ordersListDiv) {
    ordersListDiv.innerHTML = ordersHtml;
  }
}

// Check authentication and then fetch orders when the page loads
document.addEventListener('DOMContentLoaded', async () => {
  // await checkAdminAuthAndRedirect(); // Ensure this runs first - Commented out
  // Only attempt to fetch orders if the user was NOT redirected - Commented out
  // fetchAndDisplayOrders(); // Commented out
  console.log('Admin DOMContentLoaded: Initial checks skipped for debugging.');
}); 