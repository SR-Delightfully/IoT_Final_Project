import { useEffect, useState } from "react";
import ProductImage from "../components/ProductImage";
import { useI18n } from "../utils/i18n";
import { formatPrice } from "../utils/purchases";

const API = import.meta.env.VITE_API_URL;
const FEATURED_COUNT = 4;

// Store landing page: welcome, the three main actions, and a few products.
function Home() {
  const { t } = useI18n();
  const [featured, setFeatured] = useState(null);
  const loggedIn = Boolean(localStorage.getItem("token"));

  useEffect(() => {
    fetch(`${API}/products`)
      .then((res) => (res.ok ? res.json() : []))
      .then((products) =>
        // Best-stocked products first, so the featured ones can be bought today.
        setFeatured(
          [...products]
            .filter((p) => p.quantity_in_stock > 0)
            .sort((a, b) => b.quantity_in_stock - a.quantity_in_stock)
            .slice(0, FEATURED_COUNT)
        )
      )
      .catch(() => setFeatured([]));
  }, []);

  return (
    <main className="home-page">
      <section className="home-hero">
        <span className="home-eyebrow">{t("Smart TCG Store")}</span>
        <h1 className="home-title">{t("Welcome to TCG:GO")}</h1>
        <p className="home-subtitle">
          <i>{t("Cards, sealed product and accessories, with a self-checkout that scans your whole basket at once.")}</i>
        </p>

        <div className="home-actions">
          <a className="home-action home-action-primary" href="/products">
            {t("Browse products")}
          </a>
          <a className="home-action" href="/self-checkout">
            {t("Go to self-checkout")}
          </a>
          <a className="home-action" href={loggedIn ? "/customer" : "/register"}>
            {loggedIn ? t("My loyalty points") : t("Join the loyalty program")}
          </a>
        </div>

        <ul className="home-perks">
          <li>{t("1 point for every $1 spent")}</li>
          <li>{t("Receipts emailed to members")}</li>
          <li>{t("Scan your membership card at checkout")}</li>
        </ul>
      </section>

      {featured && featured.length > 0 && (
        <section className="home-featured">
          <h2 className="home-section-title">{t("Featured products")}</h2>
          <div className="home-featured-grid">
            {featured.map((p) => (
              <a key={p.product_id} className="product-tile home-product" href="/products">
                <ProductImage product={p} />
                <h3 className="product-name">{p.product_name}</h3>
                <span className="product-category">{t(p.product_category || "Uncategorized")}</span>
                <div className="product-footer">
                  <span className="product-price">{formatPrice(p.product_price_cents)}</span>
                  <span className="product-stock">
                    {t("{0} in stock", { 0: p.quantity_in_stock })}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

export default Home;
