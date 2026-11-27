import { useEffect, useRef, useState } from "react";
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
import { downloadCustomerActivityPdf } from "../utils/reportPdfs";
import { useI18n } from "../utils/i18n";

const TOOLTIP_STYLE = {
    contentStyle: {
        backgroundColor: "var(--blue-1)",
        borderColor: "var(--gold-2)",
        color: "white",
    },
    itemStyle: { color: "white" },
};

function formatDay(day, locale) {
    if (!day) return "—";
    return new Date(`${day.date}T00:00:00`).toLocaleDateString(locale, {
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
  const { t, locale } = useI18n();
    const [report, setReport] = useState(null);
    const [error, setError] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const pieRef = useRef(null);
    const barRef = useRef(null);

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
              { name: t("New"), value: report.new_customers },
              { name: t("Returning"), value: report.returning_customers },
          ]
        : [];

    return (
        <>
            <div className="report-export-buttons">
                <button
                    type="button"
                    className="account-button"
                    onClick={() => downloadCustomerActivityCsv(report)}
                    disabled={!report || Boolean(error)}
                >
                    {t("Download Customer CSV")}
                </button>
                <button
                    type="button"
                    className="account-button"
                    onClick={() =>
                        downloadCustomerActivityPdf(report, {
                            pieElement: pieRef.current,
                            barElement: barRef.current,
                        })
                    }
                    disabled={!report || Boolean(error)}
                >
                    {t("Download Customer PDF")}
                </button>
            </div>

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
                    {t("Apply filters")}
                </button>
            </div>
            <p className="points-next">
                {t("Pick the same start and end date to see a single day.")}
            </p>

            {error || !report ? (
                <p className="points-next">
                    {t(error) || t("Loading customer activity...")}
                </p>
            ) : (
                <div className="customer-activity-report">
                    <p className="points-next">
                        {singleDay
                            ? t("Activity on {0}", { 0: report.start_date })
                            : t("Activity from {0} to {1}", { 0: report.start_date, 1: report.end_date })}
                    </p>

                    <div className="points-summary">
                        <Stat
                            label={t("Customers who purchased")}
                            value={report.total_customers}
                            detail={t("+ {0} guest checkout{1}", { 0: report.guest_checkouts, 1: report.guest_checkouts === 1 ? "" : "s" })}
                        />
                        <Stat
                            label={t("New customers")}
                            value={report.new_customers}
                            detail={t("First purchase in this period")}
                        />
                        <Stat
                            label={t("Returning customers")}
                            value={report.returning_customers}
                            detail={t("Also bought before this period")}
                        />
                    </div>

                    {!singleDay && (
                        <div className="points-summary">
                            <Stat
                                label={t("Most crowded day")}
                                value={formatDay(report.busiest_day, locale)}
                                detail={t("{0} shopper(s)", { 0: report.busiest_day?.shoppers ?? 0 })}
                            />
                            <Stat
                                label={t("Least crowded day")}
                                value={formatDay(report.quietest_day, locale)}
                                detail={t("{0} shopper(s)", { 0: report.quietest_day?.shoppers ?? 0 })}
                            />
                        </div>
                    )}

                    <div className="customer-activity-charts">
                        <section className="account-section">
                            <h2 className="account-section-title">{t("New vs Returning")}</h2>
                            {report.total_customers === 0 ? (
                                <p className="points-next">{t("No customer purchases in this period.")}</p>
                            ) : (
                                <div ref={pieRef}>
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
                                </div>
                            )}
                        </section>

                        {!singleDay && (
                            <section className="account-section">
                                <h2 className="account-section-title">{t("Shoppers per Day")}</h2>
                                <p className="points-next">
                                    {t("Customers plus guest checkouts. Days with no shoppers count.")}
                                </p>
                                <div ref={barRef}>
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={report.daily} margin={{ right: 20, bottom: 20 }}>
                                        <XAxis dataKey="date" stroke="var(--tone-8)" />
                                        <YAxis allowDecimals={false} stroke="var(--tone-8)" />
                                        <Tooltip {...TOOLTIP_STYLE} />
                                        <Legend />
                                        <Bar dataKey="customers" name={t("Customers")} stackId="s" fill="var(--gold-6)" />
                                        <Bar dataKey="guests" name={t("Guests")} stackId="s" fill="var(--blue-7)" />
                                    </BarChart>
                                </ResponsiveContainer>
                                </div>
                            </section>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

export default CustomerActivityReport;
