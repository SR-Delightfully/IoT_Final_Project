import { useEffect, useState } from "react";
import { fetchSalesReport, downloadSalesCsv, checkDateFilters } from "../utils/reports";
import { formatPrice } from "../utils/purchases";
import DateFilters from "../components/DateFilters";
import SalesTable from "../components/SalesTable";
import SalesChart from "../components/SalesChart";
import CustomerActivityReport from "../components/CustomerActivityReport";

const TABS = [
    { id: "sales", label: "Sales" },
    { id: "customers", label: "Customer Activity" },
];

function Reports() {
    const [tab, setTab] = useState("sales");

    return (
        <main className="account-page sales-reports-page">
            <div className="account-card">
                <div className="account-card-body">
                    <h1 className="account-title">Reports</h1>
                    <div className="report-tabs" role="tablist">
                        {TABS.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                role="tab"
                                aria-selected={tab === t.id}
                                className={`report-tab ${tab === t.id ? "is-active" : ""}`}
                                onClick={() => setTab(t.id)}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {tab === "sales" ? <SalesReport /> : <CustomerActivityReport />}
                </div>
            </div>
        </main>
    );
}

function SalesReport() {
    const [report, setReport] = useState(null);
    const [error, setError] = useState("");
    // Store the selected sales-report dates.
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [rankingCount, setRankingCount] = useState(5);
    const [category, setCategory] = useState("");
    useEffect(() => {
        fetchSalesReport()
            .then(setReport)
            .catch((err) => setError(err.message));
    }, []);
    function applyFilters() {
        // Check typed dates against the calendar's accepted selections.
        const problem = checkDateFilters(startDate, endDate);
        if (problem) {
            setError(problem);
            return;
        }
        setError("");

        setReport(null);

        fetchSalesReport(startDate, endDate)
            .then(setReport)
            .catch((err) => setError(err.message));
    }
    const allProducts = report ? report.products : [];

    const categories = [
        ...new Set(allProducts.map((p) => p.category_name || "Uncategorized")),
    ].sort();

    const products = allProducts.filter((p) =>
        category === "" || (p.category_name || "Uncategorized") === category
    );
    // Category totals use the same applied dates as the report.
    const categorySalesCents = report
        ? report.daily_sales
            .filter((row) =>
                category === "" || (row.category_name || "Uncategorized") === category
            )
            .reduce((total, row) => total + row.product_sales_cents, 0)
        : 0;

    const categoryUnitsSold = products.reduce(
        (total, product) => total + product.units_sold,
        0
    );

    // Highest quantities first; exclude products with no sales.
    const mostSold = [...products]
        .filter((p) => p.units_sold > 0)
        .sort((a, b) => b.units_sold - a.units_sold || a.product_id - b.product_id)
        .slice(0, rankingCount);

    // Lowest quantities first, including unsold active products.
    const leastSold = [...products]
        .sort((a, b) => a.units_sold - b.units_sold || a.product_id - b.product_id)
        .slice(0, rankingCount);

    return (
        <>
                    <button
                        type="button"
                        className="account-button inventory-export-button"
                        onClick={() =>
                            downloadSalesCsv(
                                report,
                                products,
                                category,
                                categorySalesCents,
                                categoryUnitsSold
                            )
                        }
                        disabled={!report || Boolean(error)}
                    >
                        Download Sales CSV
                    </button>
                    <div className="spending-section">
                        <DateFilters
                            startDate={startDate}
                            endDate={endDate}
                            setStartDate={setStartDate}
                            setEndDate={setEndDate}
                        />
                        <button
                            type="button"
                            className="account-button spending-filter-button"
                            onClick={applyFilters}
                            disabled={!report && !error}
                        >
                            Apply filters
                        </button>
                    </div>

                    {error || !report ? (
                        <p className="points-next">
                            {error || "Loading sales report..."}
                        </p>
                    ) : (
                        <div className="sales-report-columns">
                            <div className="sales-report-overview">
                                <div className="points-summary">
                                    <div className="points-stat">
                                        <span className="form-label">Product Sales</span>
                                        <span className="points-value">
                                            {formatPrice(categorySalesCents)}
                                        </span>
                                    </div>

                                    <div className="points-stat">
                                        <span className="form-label">Units Sold</span>
                                        <span className="points-value">
                                            {categoryUnitsSold}
                                        </span>
                                    </div>
                                </div>
                                <SalesChart dailySales={report.daily_sales} category={category} />
                            </div>

                            <div className="sales-report-products">
                                <div className="form-field sales-category-filter">
                                    <label htmlFor="sales-category">Product category</label>
                                    <select
                                        id="sales-category"
                                        value={category}
                                        onChange={(event) => setCategory(event.target.value)}
                                    >
                                        <option value="">All categories</option>
                                        {categories.map((name) => (
                                            <option key={name} value={name}>
                                                {name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <p className="points-next">
                                    Category filters apply to the totals, graph, product tables and rankings.
                                    Product sales exclude tax and purchase-level discounts.
                                </p>
                                <SalesTable
                                    title="Units Sold by Product"
                                    products={products}
                                />
                            </div>

                            <div className="sales-rankings">
                                <div className="form-field sales-ranking-filter">
                                    <label htmlFor="sales-ranking-count">Products per ranking</label>
                                    <select
                                        id="sales-ranking-count"
                                        value={rankingCount}
                                        onChange={(event) => setRankingCount(Number(event.target.value))}
                                    >
                                        {[1, 2, 3, 5, 10, 20].map((count) => (
                                            <option key={count} value={count}>
                                                {count}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="sales-ranking-tables">
                                    <SalesTable title="Most Sold Products" products={mostSold} />
                                    <SalesTable title="Least Sold Products" products={leastSold} />
                                </div>
                            </div>
                        </div>
                    )}
        </>
    );
}

export default Reports;