import { supabase } from './supabaseClient.js';
import { addToCart } from './cart.js';

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    const productDetailContainer = document.getElementById('product-detail');

    if (!productId) {
        if (productDetailContainer) {
            productDetailContainer.innerHTML = '<p>Product ID is missing.</p>';
        }
        console.error('Product ID is missing from URL.');
        return;
    }

    if (!productDetailContainer) {
        console.error('Product detail container not found.');
        return;
    }

    productDetailContainer.innerHTML = '<p>Loading product...</p>';

    // Fetch product details from Supabase
    const { data: product, error } = await supabase.from('products').select('*').eq('id', productId).single();

    if (error || !product) {
        console.error('Error fetching product details:', error?.message);
        productDetailContainer.innerHTML = '<p style="color: red;">Failed to load product details.</p>';
        return;
    }

    // Render product details
    productDetailContainer.innerHTML = `
        <div class="product-detail-card">
            <img src="${product.image_url || 'https://via.placeholder.com/400x400?text=No+Image'}" alt="${product.name}" class="product-detail-image"/>
            <div class="product-detail-info">
                <h2>${product.name}</h2>
                <p class="product-price">$${Number(product.price).toFixed(2)}</p>
                <p>${product.description || 'No description available.'}</p>
                <button id="add-to-cart-button" data-id="${product.id}">Add to Cart</button>
            </div>
        </div>
    `;

    // Add event listener to Add to Cart button
    const addToCartButton = document.getElementById('add-to-cart-button');
    if (addToCartButton) {
        addToCartButton.addEventListener('click', () => {
            addToCart(addToCartButton.getAttribute('data-id'));
        });
    }
}); 