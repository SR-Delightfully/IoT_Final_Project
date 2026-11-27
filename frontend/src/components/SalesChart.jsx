import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { formatPrice } from "../utils/purchases";

function SalesChart({ dailySales, category = "" }) {
    const totals = {};

    for (const row of dailySales) {
        const name = row.category_name || "Uncategorized";

        if (category !== "" && name !== category) continue;

        totals[row.sale_date] =
            (totals[row.sale_date] || 0) + row.product_sales_cents;
    }

    const data = Object.keys(totals).sort().map((day) => ({
        sale_date: day,
        product_sales_cents: totals[day],
    }));

    if (data.length === 0) {
        return (
            <p className="points-next">
                No completed sales for this category and period.
            </p>
        );
    }

    return (
        <section className="account-section">
            <h2 className="account-section-title">
                Daily Product Sales — {category || "All Categories"}
            </h2>
            <p className="points-next">
                Before tax and purchase-level discounts.
            </p>

            <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data} margin={{ right: 20, bottom: 20 }}>
                    <XAxis dataKey="sale_date" stroke="var(--tone-8)" />
                    <YAxis
                        width={80}
                        tickFormatter={formatPrice}
                        stroke="var(--tone-8)"
                    />
                    <Tooltip
                        formatter={(value) => [formatPrice(value), "Product sales"]}
                        contentStyle={{
                            backgroundColor: "var(--blue-1)",
                            borderColor: "var(--gold-2)",
                            color: "white",
                        }}
                        itemStyle={{ color: "white" }}
                    />
                    <Line
                        type="linear"
                        dataKey="product_sales_cents"
                        stroke="var(--gold-6)"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </section>
    );
}

export default SalesChart;
