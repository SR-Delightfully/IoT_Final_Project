import { useI18n } from "../utils/i18n";
function SalesTable({ title, products }) {
  const { t } = useI18n();
  return (
    <section className="account-section">
      <h2 className="account-section-title">{title}</h2>

      {products.length === 0 ? (
        <p className="points-next">{t("No products to display.")}</p>
      ) : (
        <div className="history-scroll">
          <table className="history-table">
            <thead>
              <tr>
                <th>{t("ID")}</th>
                <th>{t("Product")}</th>
                <th>{t("Category")}</th>
                <th>{t("Units Sold")}</th>
              </tr>
            </thead>

            <tbody>
              {products.map((product) => (
                <tr key={product.product_id}>
                  <td>{product.product_id}</td>
                  <td>{product.product_name}</td>
                  <td>{product.category_name || t("Uncategorized")}</td>
                  <td>{product.units_sold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default SalesTable;