import { supabase } from './supabaseClient.js';
import { addToCart } from './cart.js';

console.log('products.js loaded and starting...'); // Log to check if the script loads

// Fetch and render products from Supabase with filtering
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded event fired.'); // Log to check DOM ready
  if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('shop.html') || window.location.pathname === '/') { // Check for index.html, shop.html, or root path
    console.log('On a product listing page, setting up filters and fetching products.');

    // Read category from URL parameter on shop.html load
    const urlParams = new URLSearchParams(window.location.search);
    const initialCategory = urlParams.get('category');
    console.log('Initial category from URL:', initialCategory);

    fetchAndRenderProducts({ category: initialCategory }); // Initial fetch with category filter if present
    setupSearchBarFiltering(); // Add setup for search bar filtering
    fetchAndPopulateCategories(); // Fetch and populate categories (and set up index.html listeners)

  } else {
      console.log('Not on a product listing page. Path:', window.location.pathname); // Log if not on home/shop page
  }
});

function setupSearchBarFiltering() {
  console.log('Setting up search bar filtering.');
  const searchInput = document.getElementById('search-input');
  const searchButton = document.querySelector('.search-btn');

  if (searchButton && searchInput) {
    searchButton.addEventListener('click', () => {
      console.log('Search button clicked.');
      const searchTerm = searchInput.value.trim();
      console.log('Search term:', searchTerm);
      fetchAndRenderProducts({ searchTerm }); // Pass search term as filter
    });

    // Add keypress listener for Enter key
    searchInput.addEventListener('keypress', (event) => {
      // Check if the key pressed was Enter
      if (event.key === 'Enter') {
        event.preventDefault(); // Prevent default form submission
        console.log('Enter key pressed in search input.');
        const searchTerm = searchInput.value.trim();
        console.log('Search term from Enter key:', searchTerm);
        fetchAndRenderProducts({ searchTerm }); // Pass search term as filter
      }
    });

  } else {
    console.error('Search input or button not found!');
  }
}

async function fetchAndRenderProducts(filters = {}) {
    console.log('fetchAndRenderProducts function called with filters:', filters); // Log function call
  const productList = document.getElementById('product-list');
    if(!productList) { // Check if element exists
        console.error('Product list element not found!');
        return;
    }
  productList.innerHTML = '<div style="width:100%;text-align:center;">Loading products...</div>';
  let query = supabase.from('products').select('*').order('created_at', { ascending: false });

  // Add search term filtering
  if (filters.searchTerm) {
    // Using ilike for case-insensitive partial match on product name and description
    query = query.or(
      `name.ilike.%${filters.searchTerm}%,description.ilike.%${filters.searchTerm}%`
    );
  }

  // Add category filtering
  if (filters.category && filters.category !== '') {
    console.log('Applying category filter:', filters.category);
    query = query.eq('category', filters.category);
  }

  const { data, error } = await query;
    console.log('Supabase fetch result:', { data, error }); // Log fetch result
  if (error) {
    productList.innerHTML = '<div style="color:red;">Failed to load products.</div>';
    console.error('Supabase fetch error:', error);
    return;
  }
  if (!data || data.length === 0) {
    productList.innerHTML = '<div>No products found.</div>';
    console.log('No products found.');
    return;
  }
  productList.innerHTML = '';
    console.log('Rendering products...'); // Log before rendering
  data.forEach(product => {
    const card = document.createElement('div');
    card.className = 'product-card';
    // Wrap card content in an anchor tag linking to the product detail page
    card.innerHTML = `
      <a href="product.html?id=${product.id}" class="product-card-link">
        <img src="${product.image_url || 'https://via.placeholder.com/180x180?text=No+Image'}" alt="${product.name}" loading="lazy"/>
        <h3>${product.name}</h3>
        <p>$${Number(product.price).toFixed(2)}</p>
      </a>
      <button data-id="${product.id}" class="add-to-cart-btn">Add to Cart</button>
    `;
    // Remove the old click listener on the card div
    // card.addEventListener('click', (e) => {
    //   if (e.target.tagName.toLowerCase() !== 'button') {
    //     window.location.href = `product.html?id=${product.id}`;
    //   }
    // });
    productList.appendChild(card);
  });
  // Add event listeners for add to cart buttons
  document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      addToCart(btn.getAttribute('data-id'));
    });
  });
    console.log('Finished rendering products.'); // Log after rendering
}

async function fetchAndPopulateCategories() {
  console.log('Fetching and populating categories...');
  const categorySelect = document.getElementById('filter-category');

  // Fetch distinct categories from the products table
  const { data, error } = await supabase
    .from('products')
    .select('category')
    .distinct();

  if (error) {
    console.error('Error fetching categories:', error);
    return;
  }

  console.log('Fetched categories:', data);

  if (categorySelect && data) {
    // Clear existing options except the default "All"
    categorySelect.innerHTML = '<option value="">All</option>';

    // Add fetched categories to the dropdown
    data.forEach(item => {
      if (item.category) { // Ensure category is not null or empty
        const option = document.createElement('option');
        option.value = item.category;
        option.textContent = item.category;
        categorySelect.appendChild(option);
      }
    });
    console.log('Categories populated in dropdown.');

     // Add event listener for category select change
     categorySelect.addEventListener('change', () => {
       const selectedCategory = categorySelect.value;
       console.log('Category selected:', selectedCategory);
       // Assuming search input might also be active, get current search term
       const searchInput = document.getElementById('search-input');
       const searchTerm = searchInput ? searchInput.value.trim() : '';
       fetchAndRenderProducts({ searchTerm, category: selectedCategory });
     });

  } else if (!categorySelect) {
    console.log('Category select dropdown not found on this page.');
  }

  // Add event listeners to index.html category cards
  const categoryCards = document.querySelectorAll('.category-card');
  console.log('Found category cards:', categoryCards);
  if (categoryCards.length > 0 && (window.location.pathname.endsWith('index.html') || window.location.pathname === '/')) {
      console.log('Setting up category card listeners on index.html.');
      categoryCards.forEach(card => {
          console.log('Adding listener to card:', card);
          card.addEventListener('click', () => {
              const categoryName = card.querySelector('span').textContent.trim();
              console.log('Category card clicked:', categoryName);
              // Redirect to shop.html with category as URL parameter
              window.location.href = `shop.html?category=${encodeURIComponent(categoryName)}`;
          });
      });
  } else if (categoryCards.length === 0 && (window.location.pathname.endsWith('index.html') || window.location.pathname === '/')) {
      console.log('No category cards found on index.html.');
  }

} 