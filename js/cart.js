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

    // If we reach here, either DB cart was empty or product details fetch failed,
    // AND there was no local cart to migrate (migration logic is now within the SIGNED_IN block listener).
    // For now, the migration check will solely be in the auth state change listener.

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
    updatedCartItems = updatedCartItems.filter(existingItem => 
        simpleCartItemsToSave.some(itemToSave => itemToSave.id === existingItem.id)
    );
     cartNeedsUpdate = cartNeedsUpdate || (updatedCartItems.length !== simpleCartItemsToSave.length);

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
    // Ensure item has necessary properties for display (name, price, image_url)
    // This is important because DB stored items might only have id and quantity initially.
    // In a real app, you'd fetch full product details based on item.id if needed here.
    // For now, assuming getCart() provides enough details or they are fetched during migration.
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
      const item = cart.find(i => i.id === id);
      if (item) {
        item.quantity = newQuantity;
        console.log("renderCart(): Quantity changed, cart state before saving", cart);
        await saveCart(cart); // Use async saveCart
        renderCart();
      }
    });
  });
  // Remove item
  cartItemsDiv.querySelectorAll('.cart-remove-btn').forEach(btn => {
    btn.addEventListener('click', async () => { // Made async
      const id = btn.getAttribute('data-id');
      let cart = await getCart(); // Use async getCart
      cart = cart.filter(i => i.id !== id);
      await saveCart(cart); // Use async saveCart
      renderCart();
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

            // Proceed with checkout (simplified: save to DB)
            // saveOrderToDatabase expects the cart items with full details.
            // If the cart was loaded from DB (simple format), we need to fetch product details here.
            // For simplicity now, let's assume getCart() fetches necessary details during migration
            // or that saveOrderToDatabase can handle the simple format and fetch details itself.
            // A more robust approach would be to ensure getCart always returns enriched items for rendering/checkout.
            await saveOrderToDatabase(session.user.id, cart);

            // Clear cart and redirect
            await clearCart(); // Use async clearCart
            alert('Checkout successful!');
            window.location.href = 'index.html'; // Redirect to homepage
        });
    }
});

// Placeholder function to save order to database (adjusts to handle simple cart items)
async function saveOrderToDatabase(userId, cartItems) {
    console.log('Saving order for user', userId, ':', cartItems);

    // Ensure cartItems have full product details if they came from DB (simple format)
    // In a real app, you might fetch details here or ensure getCart does.
    // For this simplified version, we'll assume cartItems have necessary details or
    // the 'items' column in 'orders' table can store the simple format and you process it on backend.

    const { data, error } = await supabase
        .from('orders')
        .insert([
            { user_id: userId, items: cartItems, total: calculateTotal(cartItems) } // Assuming cartItems has price for total calculation
        ]);

    if (error) {
        console.error('Error saving order:', error.message);
        alert('Failed to save order.');
    }
}

// Helper function to calculate total (adjusts to handle simple cart items)
function calculateTotal(cartItems) {
     // Assuming cartItems have a 'price' property for calculation.
     // If they only have id and quantity from DB, you'd need to fetch prices here.
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
                    // If product details can't be fetched, maybe save a simpler version or alert the user.
                    // For now, we won't migrate if we can't enrich.
                } else {
                     const itemsToMigrate = localCart.map(item => {
                         const product = products ? products.find(p => p.id === item.id) : null;
                         return product ? { // Ensure product details are available
                            id: item.id,
                            name: product.name,
                            price: product.price,
                            image_url: product.image_url,
                            quantity: item.quantity
                         } : null; // Filter out items for which we couldn't get details
                    }).filter(item => item !== null);

                    if(itemsToMigrate.length > 0) {
                         await saveCart(itemsToMigrate); // Save the enriched cart to DB
                         localStorage.removeItem('cart'); // Clear local storage after successful migration
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
        // We could potentially sync DB cart to localStorage here, but clearing is simpler for now.
    }
}); 