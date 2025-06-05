import { supabase } from './supabaseClient.js';

// Helper function to get the current user session
async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session ? session.user : null;
}

// Get cart from localStorage or Supabase
async function getCart() {
  const user = await getCurrentUser();
  if (user) {
    // User is logged in, get cart from Supabase
    console.log("getCart(): User logged in, fetching from DB...");
    const { data: cartData, error: fetchError } = await supabase
      .from('carts')
      .select('items')
      .eq('user_id', user.id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error("getCart(): Error fetching cart from DB", fetchError);
      return []; // Return empty cart on error
    }

    const dbCartItems = cartData ? cartData.items : [];
    console.log("getCart(): Raw items from DB", dbCartItems);

    // If cart is not empty, fetch product details for each item
    if (dbCartItems.length > 0) {
        console.log("getCart(): Fetching product details for cart items...");
        const productIds = dbCartItems.map(item => item.id);
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('id, name, price, image_url')
            .in('id', productIds);

        if (productsError) {
            console.error("getCart(): Error fetching product details for cart items", productsError);
            // Even if product details fetch fails, return the basic cart items
            return dbCartItems; // Return cart items without full details on error
        }

        // Merge product details with cart items
        const enrichedCartItems = dbCartItems.map(item => {
            const product = products ? products.find(p => p.id === item.id) : null;
            return product ? {
                ...item,
                name: product.name,
                price: product.price,
                image_url: product.image_url,
            } : item; // Return original item if product details not found
        });

        console.log("getCart(): Enriched cart items", enrichedCartItems);
        return enrichedCartItems;

    } else {
        console.log("getCart(): DB cart is empty.");
    }

    return dbCartItems; // Return the (potentially empty) cart from DB

  } else {
    // User is logged out, get cart from localStorage
    console.log("getCart(): User logged out, fetching from localStorage...");
    const cartData = localStorage.getItem('cart');
    console.log("getCart(): Raw data from localStorage", cartData);
    const cart = JSON.parse(cartData || '[]');
    console.log("getCart(): Parsed cart", cart);
    return cart;
  }
}

// Save cart to localStorage or Supabase
async function saveCart(cart) {
  const user = await getCurrentUser();
  if (user) {
    // User is logged in, save cart to Supabase
    console.log("saveCart(): User logged in, attempting to save to DB...");
    // The 'cart' argument here might be the full enriched cart from getCart
    // For DB storage, we only need id and quantity
    const simpleCartItemsToSave = cart.map(item => ({ id: item.id, quantity: item.quantity }));
    console.log("saveCart(): Items being prepared for DB save", simpleCartItemsToSave);

    // Fetch the current cart from the database
    const { data: existingCart, error: fetchError } = await supabase
      .from('carts')
      .select('id, items')
      .eq('user_id', user.id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means no rows found
        console.error("saveCart(): Error checking for existing cart", fetchError);
        return; // Stop if there's an error fetching existing cart
    }

    let updatedCartItems = existingCart ? existingCart.items : [];
    let cartNeedsUpdate = false;

    // Merge the items to save with the existing cart items
    simpleCartItemsToSave.forEach(itemToSave => {
        const existingItemIndex = updatedCartItems.findIndex(item => item.id === itemToSave.id);
        if (existingItemIndex > -1) {
            // Item exists, update quantity if different
            if (updatedCartItems[existingItemIndex].quantity !== itemToSave.quantity) {
                 updatedCartItems[existingItemIndex].quantity = itemToSave.quantity;
                 cartNeedsUpdate = true;
            }
        } else {
            // Item does not exist, add it
            updatedCartItems.push(itemToSave);
            cartNeedsUpdate = true;
        }
    });

     // Also remove items from DB if they are not in the cartToSave (e.g. item was removed)
     // Filter out items from updatedCartItems that are not in simpleCartItemsToSave
    const originalLength = updatedCartItems.length;
    updatedCartItems = updatedCartItems.filter(existingItem => 
        simpleCartItemsToSave.some(itemToSave => itemToSave.id === existingItem.id)
    );
    if (originalLength !== updatedCartItems.length) {
        cartNeedsUpdate = true;
    }

    if (cartNeedsUpdate || !existingCart) { // Save if cart changed or if no cart existed before
        console.log("saveCart(): Final items array for DB operation:", updatedCartItems);
        if (existingCart) {
          // Update existing cart
          const { error: updateError } = await supabase
            .from('carts')
            .update({ items: updatedCartItems })
            .eq('id', existingCart.id);
          if (updateError) console.error("saveCart(): Error updating cart in DB", updateError);
        } else {
          // Insert new cart
          const { error: insertError } = await supabase
            .from('carts')
            .insert([{ user_id: user.id, items: updatedCartItems }]);
          if (insertError) console.error("saveCart(): Error inserting cart into DB", insertError);
        }
    } else {
        console.log("saveCart(): No changes to save to DB.");
    }

  } else {
    // User is logged out, save cart to localStorage
    console.log("saveCart(): User logged out, saving to localStorage...", cart);
    // For localStorage, we save the full product details
    localStorage.setItem('cart', JSON.stringify(cart));
  }
}

// Clear cart from localStorage and Supabase
export async function clearCart() {
  console.log("clearCart() called.");
  const user = await getCurrentUser();
  if (user) {
    // User is logged in, clear cart in Supabase
    console.log("clearCart(): Clearing cart in DB for user", user.id);
    const { error } = await supabase
        .from('carts')
        .update({ items: [] })
        .eq('user_id', user.id);
    if (error) console.error("clearCart(): Error clearing cart in DB", error);
  }
  // Always clear local storage as a fallback/for consistency
  console.log("clearCart(): Clearing cart in localStorage.");
  localStorage.removeItem('cart');
}

// Add product to cart
export async function addToCart(productId) {
  // Fetch product details from Supabase (needed for guest cart display)
  const { data: product, error } = await supabase.from('products').select('id, name, price, image_url').eq('id', productId).single();
  if (error || !product) {
    alert('Failed to add product to cart.');
    console.error("addToCart(): Error fetching product details", error);
    return;
  }

  let cart = await getCart(); // Use async getCart
  const existing = cart.find(item => item.id === productId);

  if (existing) {
    existing.quantity += 1;
  } else {
    // For local storage or initial DB save, store full product details
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      quantity: 1
    });
  }

  await saveCart(cart); // Use async saveCart
  console.log("addToCart(): Cart state before saving", cart);
  alert('Added to cart!');

  // If on the cart page, re-render after adding
  if (window.location.pathname.endsWith('cart.html')) {
    renderCart();
  }
}

// Render cart page
async function renderCart() { // Made async because getCart is now async
  console.log("renderCart(): function called.");
  const cartItemsDiv = document.getElementById('cart-items');
  const cart = await getCart(); // Use async getCart
  console.log("renderCart(): Cart data received from getCart:", cart);

  if (!cartItemsDiv) { // Check if cartItemsDiv exists
      console.error("renderCart(): #cart-items element not found.");
      return;
  }

  if (!cart || cart.length === 0) {
    cartItemsDiv.innerHTML = '<div>Your cart is empty.</div>';
    return;
  }

  let total = 0;
  cartItemsDiv.innerHTML = cart.map(item => {
    total += item.price * item.quantity;
    return `
      <div class="cart-item">
        <img src="${item.image_url || 'https://via.placeholder.com/80x80?text=No+Image'}" alt="${item.name || 'Product'}" />
        <div class="cart-item-info">
          <strong>${item.name || 'Unknown Product'}</strong><br />
          $${Number(item.price || 0).toFixed(2)} x 
          <input type="number" min="1" value="${item.quantity}" data-id="${item.id}" class="cart-qty-input" />
          <button class="cart-remove-btn" data-id="${item.id}">Remove</button>
        </div>
      </div>
    `;
  }).join('') + `<div class="cart-total">Total: <strong>$${total.toFixed(2)}</strong></div>`;

  // Quantity change
  cartItemsDiv.querySelectorAll('.cart-qty-input').forEach(input => {
    input.addEventListener('change', async (e) => { // Made async
      const id = input.getAttribute('data-id');
      const newQuantity = Math.max(1, parseInt(input.value));
      let cart = await getCart(); // Use async getCart
      // Convert id to correct type for comparison
      const item = cart.find(i => String(i.id) === String(id));
      if (item) {
        item.quantity = newQuantity;
        console.log("renderCart(): Quantity changed, cart state before saving", cart);
        await saveCart(cart); // Use async saveCart
        renderCart();
      }
    });
  });
  
  // Remove item - FIXED VERSION
  cartItemsDiv.querySelectorAll('.cart-remove-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => { // Made async
      e.preventDefault(); // Prevent any default behavior
      const id = btn.getAttribute('data-id');
      console.log("Remove button clicked for item ID:", id);
      
      let cart = await getCart(); // Use async getCart
      console.log("Current cart before removal:", cart);
      
      // Convert both IDs to strings for comparison to avoid type mismatch
      const originalLength = cart.length;
      cart = cart.filter(i => String(i.id) !== String(id));
      
      console.log("Cart after filtering:", cart);
      console.log("Items removed:", originalLength - cart.length);
      
      if (originalLength !== cart.length) {
        await saveCart(cart); // Use async saveCart
        console.log("Item removed, cart saved. Re-rendering...");
        renderCart(); // Re-render the cart
      } else {
        console.log("No item was removed - ID not found in cart");
      }
    });
  });
}

// Call renderCart if on cart.html after DOMContentLoaded
// This is important because renderCart is now async
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.endsWith('cart.html')) {
        renderCart();
    }
});

// Checkout button logic
document.addEventListener('DOMContentLoaded', () => {
    const checkoutButton = document.getElementById('checkout-btn');
    if (checkoutButton) {
        checkoutButton.addEventListener('click', async () => {
            // Check if user is logged in
            const { data: { session } } = await supabase.auth.getSession();
            if (!session || !session.user) {
                alert('Please log in to proceed to checkout.');
                window.location.href = 'login.html'; // Redirect to login page
                return;
            }

            const cart = await getCart(); // Use async getCart
            if (!cart.length) {
                alert('Your cart is empty.');
                return;
            }

            // Get user email for Paystack
            const userEmail = session.user.email;
            // Calculate total amount in kobo (Paystack requires amount in smallest currency unit)
            const totalAmountKobo = calculateTotal(cart) * 100;

            // Check if PaystackPop is available before initializing
            if (typeof PaystackPop === 'undefined' || !PaystackPop.setup) {
                console.error('Paystack script not loaded or initialized properly.');
                alert('Payment system not ready. Please try again.');
                return;
            }

            // Initialize Paystack payment
            const handler = PaystackPop.setup({
                key: 'pk_test_ab1fbe944121931795d2d24d15d646458048cfb7', // Replace with your public key
                email: userEmail,
                amount: totalAmountKobo,
                currency: 'GHS', // Specify currency, e.g., 'GHS' for Ghana Cedis
                ref: '' + Math.floor((Math.random() * 1000000000) + 1), // generates a random 10 digit reference number
                callback: function(response){
                  // Payment successful, save order and clear cart
                  console.log('Paystack payment successful:', response);

                  // Define and immediately call an async function to handle async operations
                  async function handleSuccessfulPayment() {
                    await saveOrderToDatabase(session.user.id, cart);
                    await clearCart(); // Use async clearCart
                    alert('Payment successful! Your order has been placed.');
                    window.location.href = 'index.html'; // Redirect to homepage
                  }

                  handleSuccessfulPayment();
                },
                onClose: function(){
                  // User closed the modal
                  console.log('Paystack payment modal closed.');
                },
              });

              // Open the payment modal
              handler.openIframe();

        });
    }
});

// Placeholder function to save order to database (adjusts to handle simple cart items)
async function saveOrderToDatabase(userId, cartItems) {
    console.log('Saving order for user', userId, ':', cartItems);

    const { data, error } = await supabase
        .from('orders')
        .insert([
            { user_id: userId, items: cartItems, total: calculateTotal(cartItems) }
        ]);

    if (error) {
        console.error('Error saving order:', error.message);
        alert('Failed to save order.');
    }
}

// Helper function to calculate total (adjusts to handle simple cart items)
function calculateTotal(cartItems) {
    return cartItems.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
}

// Listen for auth state changes to potentially load/migrate cart
supabase.auth.onAuthStateChange(async (_event, session) => {
    console.log('Auth state change listener in cart.js triggered.', _event);
    console.log('Auth state changed in cart.js:', _event, session);
    if (_event === 'SIGNED_IN') {
        console.log('User signed in, entering SIGNED_IN block in cart.js listener...');
        console.log('User signed in, checking for localStorage cart to migrate...');
        const localCart = JSON.parse(localStorage.getItem('cart') || '[]');
        if (localCart.length > 0) {
             // Check if DB cart is empty before migrating
            const { data: dbCart, error } = await supabase
                .from('carts')
                .select('items')
                .eq('user_id', session.user.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                 console.error("onAuthStateChange: Error checking DB cart for migration", error);
            } else if (!dbCart || dbCart.items.length === 0) {
                console.log("onAuthStateChange: Migrating localStorage cart to DB...");
                 // Fetch product details needed for DB save (enrich the local cart)
                const productIds = localCart.map(item => item.id);
                const { data: products, error: productsError } = await supabase.from('products').select('id, name, price, image_url').in('id', productIds);

                if (productsError) {
                    console.error("onAuthStateChange: Error fetching product details for migration", productsError);
                } else {
                     const itemsToMigrate = localCart.map(item => {
                         const product = products ? products.find(p => p.id === item.id) : null;
                         return product ? {
                            id: item.id,
                            name: product.name,
                            price: product.price,
                            image_url: product.image_url,
                            quantity: item.quantity
                         } : null;
                    }).filter(item => item !== null);

                    if(itemsToMigrate.length > 0) {
                         await saveCart(itemsToMigrate);
                         localStorage.removeItem('cart');
                         console.log("onAuthStateChange: localStorage cart migrated.");
                         // If on the cart page, re-render after migration
                         if (window.location.pathname.endsWith('cart.html')) {
                            renderCart();
                         }
                    }
                }
            }
        }
    } else if (_event === 'SIGNED_OUT') {
        console.log('User signed out.');
        // clearCart is already called by the logout function in auth.js
    }
});