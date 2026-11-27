import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "../layout/header";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5050";
const REFRESH_INTERVAL = 15000;
const PAGE_SIZE = 8;

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJson(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed (${response.status})`);
  }

  return data;
}

function getUserName(user) {
  return `${user.user_fname || ""} ${user.user_lname || ""}`.trim() || "Unnamed user";
}

function getCreatedDate(user) {
  return user.user_created_at || user.created_at || user.user_date_created || null;
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value) || 0);
}

function formatCurrency(cents) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "CAD",
  }).format((Number(cents) || 0) / 100);
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function PanelHeader({ eyebrow, title, subtitle, action }) {
  return (
    <div className="dashboard-panel-header bento-panel-header">
      <div>
        {eyebrow && <span className="bento-eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function MetricCard({ label, value, detail, accent = "blue" }) {
  return (
    <article className={`dashboard-stat bento-metric bento-metric-${accent}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function EmptyAnalytics({ title, detail }) {
  return (
    <div className="dashboard-empty analytics-empty">
      <span className="analytics-empty-icon">⌁</span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

function RegistrationChart({ users }) {
  const months = useMemo(() => {
    const result = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setDate(1);
      date.setMonth(date.getMonth() - i);

      result.push({
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: date.toLocaleDateString(undefined, { month: "short" }),
        count: 0,
      });
    }

    users.forEach((user) => {
      const created = getCreatedDate(user);
      if (!created) return;

      const date = new Date(created);
      if (Number.isNaN(date.getTime())) return;

      const month = result.find(
        (item) => item.key === `${date.getFullYear()}-${date.getMonth()}`
      );

      if (month) month.count++;
    });

    return result;
  }, [users]);

  const max = Math.max(1, ...months.map((month) => month.count));
  const hasDates = users.some(getCreatedDate);

  if (!hasDates) {
    return (
      <EmptyAnalytics
        title="Registration dates unavailable"
        detail="The user records returned by the server do not include registration dates."
      />
    );
  }

  return (
    <div className="registration-chart">
      {months.map((month) => (
        <div className="registration-column" key={month.key}>
          <strong>{month.count}</strong>
          <div className="registration-track">
            <div
              className="registration-bar"
              style={{
                height: `${month.count ? Math.max(5, (month.count / max) * 100) : 0}%`,
              }}
            />
          </div>
          <span>{month.label}</span>
        </div>
      ))}
    </div>
  );
}

function AccountDistribution({ users }) {
  const counts = useMemo(() => {
    const result = { customer: 0, admin: 0, employee: 0 };

    users.forEach((user) => {
      const role = String(user.user_role || "customer").toLowerCase();
      if (role in result) result[role]++;
    });

    return result;
  }, [users]);

  return (
    <div className="distribution-content">
      {Object.entries(counts).map(([role, count]) => (
        <div className="distribution-row" key={role}>
          <div className="distribution-label">
            <span className={`distribution-dot ${role}`} />
            <span>{role.charAt(0).toUpperCase() + role.slice(1)}s</span>
            <strong>{formatNumber(count)}</strong>
          </div>
          <div className="distribution-track">
            <div
              className={`distribution-fill ${role}`}
              style={{
                width: `${users.length ? (count / users.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function UserTable({ users, onRoleChange, updatingUser }) {
  if (!users.length) {
    return (
      <div className="dashboard-empty user-table-empty">
        <strong>No accounts found</strong>
        <p>Try changing your search or filters.</p>
      </div>
    );
  }

  return (
    <div className="user-table-scroll">
      <table className="dashboard-table user-table">
        <thead>
          <tr>
            <th>Account</th>
            <th>Email</th>
            <th>Role</th>
            <th>Registered</th>
            <th>Change role</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const role = String(user.user_role || "customer").toLowerCase();
            const name = getUserName(user);

            return (
              <tr key={user.user_id}>
                <td>
                  <div className="user-table-account">
                    <span className="user-avatar">
                      {name.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <strong>{name}</strong>
                      <small>#{user.user_id}</small>
                    </div>
                  </div>
                </td>
                <td>{user.user_email || "—"}</td>
                <td>
                  <span className={`user-role-badge ${role}`}>
                    {role}
                  </span>
                </td>
                <td>{formatDate(getCreatedDate(user))}</td>
                <td>
                  <select
                    className="user-role-select"
                    value={role}
                    disabled={updatingUser === user.user_id}
                    onChange={(event) =>
                      onRoleChange(user.user_id, event.target.value)
                    }
                    aria-label={`Change role for ${name}`}
                  >
                    <option value="customer">Customer</option>
                    <option value="employee">Employee</option>
                    <option value="admin">Administrator</option>
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function UserForm({ onSubmit, onCancel, saving }) {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    address: "",
    phone: "",
    email: "",
    password: "",
    confirm_password: "",
  });

  const [formError, setFormError] = useState("");

  const updateField = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setFormError("");

    if (form.password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }

    if (form.password !== form.confirm_password) {
      setFormError("Passwords do not match.");
      return;
    }

    try {
      await onSubmit(form);
    } catch (error) {
      setFormError(error.message);
    }
  };

  return (
    <div
      className="user-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onCancel();
      }}
    >
      <div
        className="user-modal dashboard-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-user-title"
      >
        <div className="user-modal-header dashboard-panel-header">
          <div>
            <span className="bento-eyebrow">ACCOUNT MANAGEMENT</span>
            <h2 id="create-user-title">Create customer account</h2>
            <p>Add a new customer to the store.</p>
          </div>
          <button
            type="button"
            className="user-modal-close"
            onClick={onCancel}
            disabled={saving}
          >
            ×
          </button>
        </div>

        <form onSubmit={submit} className="user-form">
          <div className="user-form-grid">
            <label>
              First name
              <input
                name="first_name"
                value={form.first_name}
                onChange={updateField}
                required
              />
            </label>
            <label>
              Last name
              <input
                name="last_name"
                value={form.last_name}
                onChange={updateField}
                required
              />
            </label>
            <label>
              Email address
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={updateField}
                required
              />
            </label>
            <label>
              Phone number
              <input
                name="phone"
                type="tel"
                value={form.phone}
                onChange={updateField}
                required
              />
            </label>
            <label className="user-form-full">
              Address
              <input
                name="address"
                value={form.address}
                onChange={updateField}
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={updateField}
                minLength={8}
                required
              />
            </label>
            <label>
              Confirm password
              <input
                name="confirm_password"
                type="password"
                value={form.confirm_password}
                onChange={updateField}
                minLength={8}
                required
              />
            </label>
          </div>

          {formError && (
            <p className="user-form-error" role="alert">
              {formError}
            </p>
          )}

          <div className="user-modal-actions">
            <button
              type="button"
              className="dashboard-button user-button-secondary"
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="dashboard-button user-button-primary"
              disabled={saving}
            >
              {saving ? "Creating..." : "Create account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PurchasePanel({
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  salesReport,
  reportLoading,
  reportError,
}) {
  const dailySales = useMemo(() => {
    const totals = {};

    (salesReport?.daily_sales || []).forEach((sale) => {
      const date = sale.sale_date;
      if (!date) return;

      totals[date] = (totals[date] || 0) + Number(sale.product_sales_cents || 0);
    });

    return Object.entries(totals)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({
        date,
        total,
        label: new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
      }));
  }, [salesReport]);

  const maxDailySales = Math.max(
    1,
    ...dailySales.map((item) => item.total)
  );

  return (
    <section className="dashboard-panel bento-panel purchase-panel">
      <PanelHeader
        eyebrow="03 / CUSTOMER ACTIVITY"
        title="Purchase analytics"
        subtitle="Explore purchase volume and customer activity."
      />

      <div className="purchase-highlight-grid">
        <div className="dashboard-stat purchase-highlight">
          <span>Total sales</span>
          <strong>
            {reportLoading ? "—" : formatCurrency(salesReport?.total_sales_cents)}
          </strong>
          <small>Completed purchases, including tax and discounts</small>
        </div>
        <div className="dashboard-stat purchase-highlight">
          <span>Units sold</span>
          <strong>
            {reportLoading ? "—" : formatNumber(salesReport?.total_units_sold)}
          </strong>
          <small>Products sold during the selected period</small>
        </div>
      </div>

      <div className="purchase-range">
        <div>
          <span className="bento-eyebrow">DATE RANGE</span>
          <strong>Purchase activity</strong>
        </div>
        <div className="date-range-inputs">
          <label>
            From
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="purchase-results-grid">
        <MetricCard
          label="Total purchases"
          value="—"
          detail="Requires a purchase-count report"
          accent="blue"
        />
        <MetricCard
          label="Unique customers"
          value="—"
          detail="Requires a customer purchase report"
          accent="gold"
        />
      </div>

      <div className="finance-chart">
        <div className="finance-chart-heading">
          <strong>Daily product sales</strong>
          <span>Before tax and purchase-level discounts</span>
        </div>

        {reportError ? (
          <EmptyAnalytics
            title="Unable to load purchase analytics"
            detail={reportError}
          />
        ) : reportLoading ? (
          <div className="dashboard-empty">Loading purchase analytics...</div>
        ) : dailySales.length === 0 ? (
          <EmptyAnalytics
            title="No sales in this date range"
            detail="Completed product sales will appear here when available."
          />
        ) : (
          <div className="registration-chart">
            {dailySales.map((item) => (
              <div className="registration-column" key={item.date}>
                <strong>{formatCurrency(item.total)}</strong>
                <div className="registration-track">
                  <div
                    className="registration-bar"
                    style={{
                      height: `${Math.max(5, (item.total / maxDailySales) * 100)}%`,
                    }}
                  />
                </div>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="analytics-footnote">
        Daily purchase counts, most and fewest purchases per day, and unique
        customers require additional purchase-level aggregates from the backend.
      </p>
    </section>
  );
}

function FinancePanel({ salesReport, reportLoading, reportError }) {
  return (
    <section className="dashboard-panel bento-panel finance-panel">
      <PanelHeader
        eyebrow="04 / STORE PERFORMANCE"
        title="Financial overview"
        subtitle="Monitor completed sales and store performance."
      />

      <div className="finance-metrics">
        <MetricCard
          label="Gross earnings"
          value={reportLoading ? "—" : formatCurrency(salesReport?.total_sales_cents)}
          detail="Completed purchases, including tax and discounts"
          accent="blue"
        />
        <MetricCard
          label="Total spending"
          value="—"
          detail="Product costs and operating expenses unavailable"
          accent="gold"
        />
        <MetricCard
          label="Net balance"
          value="—"
          detail="Requires earnings and expense records"
          accent="purple"
        />
      </div>
    </section>
  );
}

export default function UserDashboard() {
  const today = getLocalDateString();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [page, setPage] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [updatingUser, setUpdatingUser] = useState(null);

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [salesReport, setSalesReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState("");

  const fetchDashboardData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);

    try {
      const usersData = await fetchJson("/admin/users");

      setUsers(
        Array.isArray(usersData)
          ? usersData
          : usersData.users || []
      );

      setError("");
    } catch (err) {
      setError(err.message || "Unable to load dashboard data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchSalesReport = useCallback(async (from, to) => {
    setReportLoading(true);
    setReportError("");

    try {
      const params = new URLSearchParams();

      if (from) params.set("start_date", from);
      if (to) params.set("end_date", to);

      const report = await fetchJson(
        `/admin/reports/sales?${params.toString()}`
      );

      setSalesReport(report);
    } catch (err) {
      setSalesReport(null);
      setReportError(err.message || "Unable to load sales report.");
    } finally {
      setReportLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();

    const interval = setInterval(
      () => fetchDashboardData(true),
      REFRESH_INTERVAL
    );

    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  useEffect(() => {
    fetchSalesReport(startDate, endDate);
  }, [startDate, endDate, fetchSalesReport]);

  const createUser = async (form) => {
    setSavingUser(true);

    try {
      const { confirm_password, ...userData } = form;

      await fetchJson("/admin/users", {
        method: "POST",
        body: JSON.stringify(userData),
      });

      setShowCreateForm(false);
      setNotice("Customer account created successfully.");

      await fetchDashboardData(true);
    } finally {
      setSavingUser(false);
    }
  };

  const changeUserRole = async (userId, role) => {
    if (!userId || !["customer", "employee", "admin"].includes(role)) return;

    const currentUser = users.find((user) => user.user_id === userId);

    if (String(currentUser?.user_role || "").toLowerCase() === role) return;

    setUpdatingUser(userId);
    setError("");
    setNotice("");

    try {
      const updatedUser = await fetchJson(`/admin/users/${userId}/role`, {
        method: "PUT",
        body: JSON.stringify({ role }),
      });

      setUsers((current) =>
        current.map((user) =>
          user.user_id === userId
            ? {
                ...user,
                ...updatedUser,
                user_role: updatedUser.user_role || role,
              }
            : user
        )
      );

      setNotice(`${getUserName(currentUser)}'s role was updated.`);
    } catch (err) {
      setError(err.message || "Unable to update user role.");
    } finally {
      setUpdatingUser(null);
    }
  };

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return users
      .filter((user) => {
        const role = String(user.user_role || "customer").toLowerCase();
        const name = getUserName(user).toLowerCase();

        return (
          (roleFilter === "all" || role === roleFilter) &&
          (!term ||
            name.includes(term) ||
            String(user.user_email || "").toLowerCase().includes(term) ||
            String(user.user_id || "").includes(term))
        );
      })
      .sort((a, b) => {
        if (sortBy === "id") {
          return Number(a.user_id) - Number(b.user_id);
        }

        if (sortBy === "role") {
          return String(a.user_role || "").localeCompare(
            String(b.user_role || "")
          );
        }

        if (sortBy === "newest") {
          return (
            new Date(getCreatedDate(b) || 0) -
            new Date(getCreatedDate(a) || 0)
          );
        }

        return getUserName(a).localeCompare(getUserName(b));
      });
  }, [users, search, roleFilter, sortBy]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredUsers.length / PAGE_SIZE)
  );

  const visibleUsers = filteredUsers.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, sortBy]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const customerCount = users.filter(
    (user) =>
      String(user.user_role || "customer").toLowerCase() === "customer"
  ).length;

  const adminCount = users.filter(
    (user) => String(user.user_role || "").toLowerCase() === "admin"
  ).length;

  const employeeCount = users.filter(
    (user) => String(user.user_role || "").toLowerCase() === "employee"
  ).length;

  const newCustomerCount = users.filter((user) => {
    const role = String(user.user_role || "customer").toLowerCase();
    const created = getCreatedDate(user);

    if (role !== "customer" || !created) return false;

    const date = new Date(created);

    if (Number.isNaN(date.getTime())) return false;

    const dateString = getLocalDateString(date);

    return dateString >= startDate && dateString <= endDate;
  }).length;

  return (
    <main className="dashboard-page user-dashboard">
      <div className="user-dashboard-heading">
        <Header
          title="User Management"
          subtitle="Manage accounts, understand customer activity, and monitor store performance."
        />
      </div>

      {error && (
        <div
          className="dashboard-alert user-feedback user-feedback-error"
          role="alert"
        >
          <div>
            <strong>Something went wrong</strong>
            <p>{error}</p>
          </div>
          <button
            type="button"
            onClick={() => fetchDashboardData()}
            disabled={refreshing}
          >
            Try again
          </button>
        </div>
      )}

      {notice && (
        <div
          className="dashboard-alert user-feedback user-feedback-success"
          role="status"
        >
          <span>✓</span>
          <p>{notice}</p>
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <div className="user-bento-grid">
        <section className="dashboard-panel bento-panel management-panel">
          <PanelHeader
            eyebrow="01 / ACCOUNTS"
            title="User management"
            subtitle="Manage registered accounts and access levels."
            action={
              <button
                type="button"
                className="dashboard-button user-button-primary"
                onClick={() => setShowCreateForm(true)}
              >
                + Add user
              </button>
            }
          />

          <div className="management-metrics">
            <MetricCard
              label="Total accounts"
              value={loading ? "—" : formatNumber(users.length)}
              detail="All registered accounts"
            />
            <MetricCard
              label="Customers"
              value={loading ? "—" : formatNumber(customerCount)}
              detail="Customer accounts"
              accent="gold"
            />
            <MetricCard
              label="Administrators"
              value={loading ? "—" : formatNumber(adminCount)}
              detail="Admin access"
              accent="purple"
            />
            <MetricCard
              label="Employees"
              value={loading ? "—" : formatNumber(employeeCount)}
              detail="Staff accounts"
              accent="neutral"
            />
          </div>

          <div className="management-tools">
            <div className="user-search">
              <span>⌕</span>
              <input
                type="search"
                placeholder="Search name, email, or ID..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search accounts"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>

            <div className="management-filters">
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                aria-label="Filter by role"
              >
                <option value="all">All roles</option>
                <option value="customer">Customers</option>
                <option value="employee">Employees</option>
                <option value="admin">Administrators</option>
              </select>

              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                aria-label="Sort accounts"
              >
                <option value="name">Name A–Z</option>
                <option value="newest">Newest first</option>
                <option value="id">User ID</option>
                <option value="role">Role</option>
              </select>
            </div>
          </div>

          <div className="user-results-summary">
            {loading
              ? "Loading accounts..."
              : `${formatNumber(filteredUsers.length)} accounts found`}
          </div>

          {loading ? (
            <div className="dashboard-empty user-loading">
              <span className="user-loading-spinner" />
              Loading accounts...
            </div>
          ) : (
            <>
              <UserTable
                users={visibleUsers}
                onRoleChange={changeUserRole}
                updatingUser={updatingUser}
              />

              {filteredUsers.length > 0 && (
                <div className="user-pagination">
                  <span>
                    {(page - 1) * PAGE_SIZE + 1}–
                    {Math.min(page * PAGE_SIZE, filteredUsers.length)} of{" "}
                    {filteredUsers.length}
                  </span>

                  <div className="user-pagination-controls">
                    <button
                      type="button"
                      className="dashboard-button"
                      onClick={() =>
                        setPage((current) => Math.max(1, current - 1))
                      }
                      disabled={page <= 1}
                    >
                      Previous
                    </button>

                    <span>
                      {page} / {totalPages}
                    </span>

                    <button
                      type="button"
                      className="dashboard-button"
                      onClick={() =>
                        setPage((current) =>
                          Math.min(totalPages, current + 1)
                        )
                      }
                      disabled={page >= totalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <section className="dashboard-panel bento-panel customer-panel">
          <PanelHeader
            eyebrow="02 / CUSTOMER INSIGHTS"
            title="Customer analytics"
            subtitle="Understand account growth and customer composition."
          />

          <div className="customer-summary-grid">
            <MetricCard
              label="New customers"
              value={loading ? "—" : formatNumber(newCustomerCount)}
              detail="Registered during selected period"
              accent="blue"
            />
            <MetricCard
              label="Returning customers"
              value="—"
              detail="Requires repeat purchase history"
              accent="gold"
            />
          </div>

          <div className="dashboard-panel analytics-subpanel">
            <PanelHeader
              title="Account distribution"
              subtitle="Registered accounts by access level"
            />
            <AccountDistribution users={users} />
          </div>

          <div className="dashboard-panel analytics-subpanel registration-subpanel">
            <PanelHeader
              title="Registration activity"
              subtitle="New accounts over the last six months"
            />
            <RegistrationChart users={users} />
          </div>

          <p className="analytics-footnote">
            New customer registrations use account creation dates. Returning
            customers require a purchase-history aggregate that is not currently
            returned by the backend.
          </p>
        </section>

        <FinancePanel
          salesReport={salesReport}
          reportLoading={reportLoading}
          reportError={reportError}
        />

        <PurchasePanel
          startDate={startDate}
          endDate={endDate}
          setStartDate={setStartDate}
          setEndDate={setEndDate}
          salesReport={salesReport}
          reportLoading={reportLoading}
          reportError={reportError}
        />
      </div>

      {showCreateForm && (
        <UserForm
          onSubmit={createUser}
          onCancel={() => setShowCreateForm(false)}
          saving={savingUser}
        />
      )}
    </main>
  );
}