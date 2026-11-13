import { useEffect, useState } from "react";

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function Products() {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("name");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selected, setSelected] = useState(null);

  // close the detail view with Escape
  useEffect(() => {
    if (!selected) return;
    const onKey = (e) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/products`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load products");
        return data;
      })
      .then(setProducts)
      .catch((err) => setError(err.message));
  }, []);

  const categories = products
    ? [...new Set(products.map((p) => p.product_category))].sort()
    : [];

  const visible = (products || []).filter((p) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      p.product_name.toLowerCase().includes(term) ||
      p.product_producer_company.toLowerCase().includes(term);
    const matchesCategory = category === "all" || p.product_category === category;
    const matchesStock = !inStockOnly || p.quantity_in_stock > 0;
    return matchesSearch && matchesCategory && matchesStock;
  });

  const SORTS = {
    name: (a, b) => a.product_name.localeCompare(b.product_name),
    "price-asc": (a, b) => a.product_price - b.product_price,
    "price-desc": (a, b) => b.product_price - a.product_price,
    stock: (a, b) => b.quantity_in_stock - a.quantity_in_stock,
  };
  visible.sort(SORTS[sort]);

  return (
    <main className="products-page">
      <div className="products-card">
        <div className="products-card-body">
          <h1 className="products-title">Our Products</h1>

          <p className="products-subtitle">
            <i>browse everything we have in store.</i>
          </p>

          {error && <p className="products-message">{error}</p>}
          {!error && !products && (
            <p className="products-message">
              <i>loading products...</i>
            </p>
          )}

          {products && (
            <>
              <div className="products-filters">
                <input
                  type="search"
                  placeholder="Search by name or producer"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="all">All categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="name">Name (A-Z)</option>
                  <option value="price-asc">Price: low to high</option>
                  <option value="price-desc">Price: high to low</option>
                  <option value="stock">Most in stock</option>
                </select>
                <label className="products-checkbox">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => setInStockOnly(e.target.checked)}
                  />
                  In stock only
                </label>
              </div>

              <p className="products-count">
                Showing {visible.length} of {products.length} products
              </p>

              {visible.length === 0 ? (
                <p className="products-message">No products found.</p>
              ) : (
                <div className="products-grid">
                  {visible.map((p) => {
                    const inStock = p.quantity_in_stock > 0;
                    return (
                      <article
                        className="product-tile"
                        key={p.product_id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelected(p)}
                        onKeyDown={(e) => e.key === "Enter" && setSelected(p)}
                      >
                        {p.product_image_url ? (
                          <img
                            className="product-image"
                            src={p.product_image_url}
                            alt={p.product_name}
                          />
                        ) : (
                          <div className="product-image product-image-empty">
                            {p.product_name.charAt(0)}
                          </div>
                        )}

                        <h3 className="product-name">{p.product_name}</h3>
                        <span className="product-category">{p.product_category}</span>
                        <span className="product-producer">{p.product_producer_company}</span>

                        <div className="product-footer">
                          <span className="product-price">{formatPrice(p.product_price)}</span>
                          <span
                            className={`product-stock ${inStock ? "" : "product-stock-out"}`}
                          >
                            {inStock ? `${p.quantity_in_stock} in stock` : "Out of stock"}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className="products-links">
        <a href="/home">Back to home</a>
      </div>

      {selected && (
        <div className="product-modal-backdrop" onClick={() => setSelected(null)}>
          <div
            className="product-modal"
            role="dialog"
            aria-modal="true"
            aria-label={selected.product_name}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="product-modal-close"
              aria-label="Close"
              onClick={() => setSelected(null)}
            >
              ×
            </button>

            {selected.product_image_url ? (
              <img
                className="product-image product-modal-image"
                src={selected.product_image_url}
                alt={selected.product_name}
              />
            ) : (
              <div className="product-image product-image-empty product-modal-image">
                {selected.product_name.charAt(0)}
              </div>
            )}

            <div className="product-modal-info">
              <h2 className="product-name">{selected.product_name}</h2>
              <span className="product-category">{selected.product_category}</span>
              <span className="product-price product-modal-price">
                {formatPrice(selected.product_price)}
              </span>

              <dl className="product-modal-details">
                <dt>Producer</dt>
                <dd>{selected.product_producer_company}</dd>
                <dt>Availability</dt>
                <dd className={selected.quantity_in_stock > 0 ? "" : "product-stock-out"}>
                  {selected.quantity_in_stock > 0
                    ? `${selected.quantity_in_stock} in stock`
                    : "Out of stock"}
                </dd>
                <dt>UPC</dt>
                <dd className="dashboard-subtext">{selected.product_upc}</dd>
              </dl>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default Products;
