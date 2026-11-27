import { useEffect, useState } from "react";
import {
    Bar,
    BarChart,
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import DateFilters from "./DateFilters";
import {
    checkDateFilters,
    downloadCustomerActivityCsv,
    fetchCustomerActivity,
} from "../utils/reports";

const TOOLTIP_STYLE = {
    contentStyle: {
        backgroundColor: "var(--blue-1)",
        borderColor: "var(--gold-2)",
        color: "white",
    },
    itemStyle: { color: "white" },
};

function formatDay(day) {
    if (!day) return "—";
    return new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function Stat({ label, value, detail }) {
    return (
        <div className="points-stat">
            <span className="form-label">{label}</span>
            <span className="points-value">{value}</span>
            {detail && <span className="points-next">{detail}</span>}
        </div>
    );
}

function CustomerActivityReport() {
    const [report, setReport] = useState(null);
    const [error, setError] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    useEffect(() => {
        fetchCustomerActivity()
            .then(setReport)
            .catch((err) => setError(err.message));
    }, []);

    function applyFilters() {
        const problem = checkDateFilters(startDate, endDate);
        if (problem) {
            setError(problem);
            return;
        }

        setError("");
        setReport(null);

        fetchCustomerActivity(startDate, endDate)
            .then(setReport)
            .catch((err) => setError(err.message));
    }

    const singleDay = report && report.start_date === report.end_date;
    const split = report
        ? [
              { name: "New", value: report.new_customers },
              { name: "Returning", value: report.returning_customers },
          ]
        : [];

    return (
        <>
            <button
                type="button"
                className="account-button inventory-export-button"
                onClick={() => downloadCustomerActivityCsv(report)}
                disabled={!report || Boolean(error)}
            >
                Download Customer CSV
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
            <p className="points-next">
                Pick the same start and end date to see a single day.
            </p>

            {error || !report ? (
                <p className="points-next">
                    {error || "Loading customer activity..."}
                </p>
            ) : (
                <div className="customer-activity-report">
                    <p className="points-next">
                        {singleDay
                            ? `Activity on ${report.start_date}`
                            : `Activity from ${report.start_date} to ${report.end_date}`}
                    </p>

                    <div className="points-summary">
                        <Stat
                            label="Customers who purchased"
                            value={report.total_customers}
                            detail={`+ ${report.guest_checkouts} guest checkout${report.guest_checkouts === 1 ? "" : "s"}`}
                        />
                        <Stat
                            label="New customers"
                            value={report.new_customers}
                            detail="First purchase in this period"
                        />
                        <Stat
                            label="Returning customers"
                            value={report.returning_customers}
                            detail="Also bought before this period"
                        />
                    </div>

                    {!singleDay && (
                        <div className="points-summary">
                            <Stat
                                label="Most crowded day"
                                value={formatDay(report.busiest_day)}
                                detail={`${report.busiest_day?.shoppers ?? 0} shopper(s)`}
                            />
                            <Stat
                                label="Least crowded day"
                                value={formatDay(report.quietest_day)}
                                detail={`${report.quietest_day?.shoppers ?? 0} shopper(s)`}
                            />
                        </div>
                    )}

                    <div className="customer-activity-charts">
                        <section className="account-section">
                            <h2 className="account-section-title">New vs Returning</h2>
                            {report.total_customers === 0 ? (
                                <p className="points-next">No customer purchases in this period.</p>
                            ) : (
                                <ResponsiveContainer width="100%" height={240}>
                                    <PieChart>
                                        <Pie
                                            data={split}
                                            dataKey="value"
                                            nameKey="name"
                                            innerRadius={55}
                                            outerRadius={90}
                                            label
                                        >
                                            <Cell fill="var(--gold-6)" />
                                            <Cell fill="var(--blue-7)" />
                                        </Pie>
                                        <Tooltip {...TOOLTIP_STYLE} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </section>

                        {!singleDay && (
                            <section className="account-section">
                                <h2 className="account-section-title">Shoppers per Day</h2>
                                <p className="points-next">
                                    Customers plus guest checkouts. Days with no shoppers count.
                                </p>
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={report.daily} margin={{ right: 20, bottom: 20 }}>
                                        <XAxis dataKey="date" stroke="var(--tone-8)" />
                                        <YAxis allowDecimals={false} stroke="var(--tone-8)" />
                                        <Tooltip {...TOOLTIP_STYLE} />
                                        <Legend />
                                        <Bar dataKey="customers" name="Customers" stackId="s" fill="var(--gold-6)" />
                                        <Bar dataKey="guests" name="Guests" stackId="s" fill="var(--blue-7)" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </section>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

export default CustomerActivityReport;
