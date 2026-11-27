function SalesTable({ title, products }) {
  return (
    <section className="account-section">
      <h2 className="account-section-title">{title}</h2>

      {products.length === 0 ? (
        <p className="points-next">No products to display.</p>
      ) : (
        <div className="history-scroll">
          <table className="history-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Product</th>
                <th>Category</th>
                <th>Units Sold</th>
              </tr>
            </thead>

            <tbody>
              {products.map((product) => (
                <tr key={product.product_id}>
                  <td>{product.product_id}</td>
                  <td>{product.product_name}</td>
                  <td>{product.category_name || "Uncategorized"}</td>
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