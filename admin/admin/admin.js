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

// Function to check auth and handle unauthorized access
async function checkAdminAuthAndHandle() {
  const userIsAdmin = await isAdmin();
  if (!userIsAdmin) {
    console.log("User is not authorized for admin dashboard. Showing login.");
    
    // Show login section and hide dashboard
    const loginSection = document.getElementById('loginSection');
    const dashboardSection = document.getElementById('dashboardSection');
    
    if (loginSection) loginSection.style.display = 'block';
    if (dashboardSection) dashboardSection.style.display = 'none';
    
    // Update body class and title
    document.body.className = 'admin-auth-bg';
    document.title = 'Admin Login - DANVEE';
    
    // Sign out the current user if they're not an admin
    await supabase.auth.signOut();
    
    return false;
  }
  return true;
}

// Function to fetch and display orders
async function fetchAndDisplayOrders() {
  console.log("Fetching orders for admin...");

  const ordersTableBody = document.getElementById('ordersTableBody');
  const ordersListDiv = document.getElementById('orders-list');

  // Show loading state
  if (ordersTableBody) {
    ordersTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Loading orders...</td></tr>';
  }

  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false }); // Most recent first

    if (error) {
      console.error("Error fetching orders:", error.message);
      if (ordersTableBody) {
        ordersTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">Error loading orders.</td></tr>';
      }
      return;
    }

    console.log("Fetched orders:", orders);

    if (!orders || orders.length === 0) {
      if (ordersTableBody) {
        ordersTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No orders found yet.</td></tr>';
      }
      return;
    }

    // Generate HTML for the orders table body
    let ordersHtml = '';

    orders.forEach(order => {
      // Convert the items JSONB array to a readable string
      const itemsString = order.items ? 
        order.items.map(item => `${item.name || 'Unknown Product'} (${item.quantity})`).join(', ') : 
        'No items';

      // Determine order status
      const status = order.status || 'Pending';
      const statusClass = getStatusClass(status);

      ordersHtml += `
        <tr>
          <td>#${order.id}</td>
          <td>${order.user_id ? `User ${order.user_id}` : 'Guest'}</td>
          <td>$${Number(order.total || 0).toFixed(2)}</td>
          <td><span class="status ${statusClass}">${status}</span></td>
          <td>${new Date(order.created_at).toLocaleDateString()}</td>
          <td>
            <button onclick="viewOrderDetails(${order.id})" class="btn-view">View</button>
            <button onclick="updateOrderStatus(${order.id}, '${status}')" class="btn-update">Update</button>
          </td>
        </tr>
      `;
    });

    if (ordersTableBody) {
      ordersTableBody.innerHTML = ordersHtml;
    }

  } catch (error) {
    console.error("Unexpected error fetching orders:", error);
    if (ordersTableBody) {
      ordersTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">Unexpected error occurred.</td></tr>';
    }
  }
}

// Helper function to get status CSS class
function getStatusClass(status) {
  switch (status?.toLowerCase()) {
    case 'completed':
    case 'delivered':
      return 'status-completed';
    case 'processing':
    case 'shipped':
      return 'status-processing';
    case 'cancelled':
    case 'refunded':
      return 'status-cancelled';
    default:
      return 'status-pending';
  }
}

// Function to view order details (placeholder)
window.viewOrderDetails = function(orderId) {
  // TODO: Implement order details modal or page
  console.log('View order details for order:', orderId);
  alert(`View details for Order #${orderId}\n\nThis feature will be implemented soon.`);
};

// Function to update order status (placeholder)
window.updateOrderStatus = function(orderId, currentStatus) {
  // TODO: Implement status update functionality
  console.log('Update status for order:', orderId, 'Current status:', currentStatus);
  
  const newStatus = prompt(`Update status for Order #${orderId}\nCurrent status: ${currentStatus}\n\nEnter new status:`);
  
  if (newStatus && newStatus !== currentStatus) {
    updateOrderStatusInDB(orderId, newStatus);
  }
};

// Function to actually update order status in database
async function updateOrderStatusInDB(orderId, newStatus) {
  try {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      console.error('Error updating order status:', error);
      alert('Error updating order status. Please try again.');
    } else {
      console.log('Order status updated successfully');
      alert('Order status updated successfully!');
      // Refresh the orders list
      fetchAndDisplayOrders();
    }
  } catch (error) {
    console.error('Unexpected error updating order status:', error);
    alert('Unexpected error occurred. Please try again.');
  }
}

// Function to initialize dashboard
async function initializeDashboard() {
  console.log('Initializing admin dashboard...');
  
  // Check if current user is admin
  const isAuthorized = await checkAdminAuthAndHandle();
  
  if (isAuthorized) {
    // User is authorized, load dashboard content
    await fetchAndDisplayOrders();
    
    // Set up periodic refresh (every 30 seconds)
    setInterval(fetchAndDisplayOrders, 30000);
    
    console.log('Admin dashboard initialized successfully');
  }
}

// Listen for auth state changes to initialize dashboard when user logs in
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('Admin.js - Auth state changed:', event, session);
  
  if (event === 'SIGNED_IN' && session) {
    // User just signed in, check if they're admin and initialize dashboard
    setTimeout(initializeDashboard, 500); // Small delay to ensure UI is updated
  } else if (event === 'SIGNED_OUT') {
    // User signed out, clear any dashboard data
    console.log('User signed out, dashboard cleared');
  }
});

// Initial check when page loads
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Admin.js DOMContentLoaded');
  
  // Check if user is already authenticated and admin
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session) {
    // User is already logged in, initialize dashboard
    await initializeDashboard();
  }
});

// Export functions for external use
export { isAdmin, fetchAndDisplayOrders, initializeDashboard };