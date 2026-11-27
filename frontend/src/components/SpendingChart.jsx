import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatPrice } from "../utils/purchases";
import { useI18n } from "../utils/i18n";

function SpendingChart({ purchases }) {
  const { t } = useI18n();
  const dailyTotals = {};

  // Add paid purchases together for each day, keeping amounts in cents.
  for (const purchase of purchases) {
    if (purchase.purchase_payment_status !== "paid") continue;

    const day = purchase.purchase_created_at.split(" ")[0];
    dailyTotals[day] =
      (dailyTotals[day] || 0) + purchase.purchase_total;
  }

  const data = Object.keys(dailyTotals)
    .sort()
    .map((day) => ({
      date: day,
      total: dailyTotals[day],
    }));

  if (data.length === 0) {
    return <p className="points-next">{t("No spending in this period.")}</p>;
  }

  return (
    <div>
      <h3 className="account-section-title">{t("Daily Spending")}</h3>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ right: 20, bottom: 20 }}>
          <XAxis dataKey="date" stroke="#bca66b" />
          <YAxis
            width={80}
            stroke="#bca66b"
            tickFormatter={formatPrice}
          />
          <Tooltip
            formatter={(value) => [formatPrice(value), t("Spent")]}
            contentStyle={{
              backgroundColor: "#151726",
              borderColor: "#bca66b",
              color: "#fff",
            }}
            itemStyle={{ color: "#fff" }}
            cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
          />
          <Bar dataKey="total" fill="#bca029" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default SpendingChart;