import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import {
    formatDate,
    formatDateTime,
    formatPrice,
} from "../utils/purchases";

function ProductPriceChart({ history }) {
    if (history.length === 0) return null;
    // Compare the oldest and newest unit prices paid.
    const firstPrice = history[0].purchase_item_unit_price_cents;
    const latestPrice = history[history.length - 1].purchase_item_unit_price_cents;
    const priceChange = latestPrice - firstPrice;

    const percentageChange =
        firstPrice === 0 ? null : (priceChange / firstPrice) * 100;

    return (
        <div>
            <h3 className="account-section-title">Price History</h3>
            {history.length < 2 ? (
                <p className="points-next">
                    One purchase recorded. Price comparison needs at least two purchases.
                </p>
            ) : (
                <p className="points-next">
                    First price: {formatPrice(firstPrice)}
                    {" | "}Latest price: {formatPrice(latestPrice)}
                    {" | "}Change: {priceChange > 0 ? "+" : ""}
                    {formatPrice(priceChange)}
                    {percentageChange !== null && (
                        <>
                            {" ("}{percentageChange > 0 ? "+" : ""}
                            {percentageChange.toFixed(1)}%)
                        </>
                    )}
                </p>
            )}

            <ResponsiveContainer width="100%" height={280}>
                <LineChart data={history} margin={{ right: 20, bottom: 20 }}>
                    <XAxis
                        dataKey="purchase_created_at"
                        tickFormatter={formatDate}
                        stroke="#bca66b"
                    />
                    <YAxis
                        width={80}
                        tickFormatter={formatPrice}
                        stroke="#bca66b"
                    />
                    <Tooltip
                        labelFormatter={formatDateTime}
                        formatter={(value) => [formatPrice(value), "Unit price"]}
                        contentStyle={{
                            backgroundColor: "#151726",
                            borderColor: "#bca66b",
                            color: "#fff",
                        }}
                        itemStyle={{ color: "#fff" }}
                    />
                    <Line
                        type="linear"
                        dataKey="purchase_item_unit_price_cents"
                        stroke="#bca029"
                        strokeWidth={2}
                        dot={{ r: 5 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

export default ProductPriceChart;