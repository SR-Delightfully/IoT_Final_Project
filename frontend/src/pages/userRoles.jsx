import { useEffect, useState } from "react";
import { authHeaders } from "../utils/auth";

const API = import.meta.env.VITE_API_URL;
const ROLES = ["customer", "admin"];

function request(path, method = "GET", body) {
  return fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(data.error || "Request failed");
      error.status = res.status;
      throw error;
    }
    return data;
  });
}

function formatDate(timestamp) {
  return timestamp ? timestamp.split(" ")[0] : "";
}

function UserRoles() {
  const myId = Number(localStorage.getItem("user_id"));
  const [users, setUsers] = useState(null);
  const [denied, setDenied] = useState(!myId);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!myId) return;

    request("/admin/users")
      .then(setUsers)
      .catch((err) => (err.status === 403 ? setDenied(true) : setError(err.message)));
  }, [myId]);

  const changeRole = async (user, role) => {
    if (role === user.user_role) return;

    const name = `${user.user_fname} ${user.user_lname}`;
    if (!window.confirm(`Change ${name}'s role from ${user.user_role} to ${role}?`)) return;

    try {
      const updated = await request(`/admin/users/${user.user_id}/role`, "PUT", { role });
      setUsers((list) => list.map((u) => (u.user_id === updated.user_id ? updated : u)));
      setError("");
      setMessage(`${name} is now ${role === "admin" ? "an admin" : "a customer"}.`);
    } catch (err) {
      if (err.status === 403) setDenied(true);
      setMessage("");
      setError(err.message);
    }
  };

  if (denied) {
    return (
      <main className="products-page">
        <div className="products-card">
          <div className="products-card-body">
            <h1 className="products-title">Access Denied</h1>
            <p className="products-message">Only admins can manage user roles.</p>
          </div>
        </div>
      </main>
    );
  }

  const term = search.trim().toLowerCase();
  const visible = (users || []).filter(
    (u) =>
      !term ||
      `${u.user_fname} ${u.user_lname}`.toLowerCase().includes(term) ||
      u.user_email.toLowerCase().includes(term),
  );

  return (
    <main className="products-page">
      <div className="products-card dashboard-card">
        <div className="products-card-body">
          <h1 className="products-title">User Roles</h1>
          <p className="products-subtitle">
            <i>choose who can manage the store.</i>
          </p>

          {error && <p className="dashboard-error">{error}</p>}
          {message && <p className="dashboard-success">{message}</p>}

          {!users ? (
            <p className="products-message">
              <i>loading users...</i>
            </p>
          ) : (
            <section className="account-section">
              <div className="products-filters">
                <input
                  type="search"
                  placeholder="Search by name or email"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="history-scroll dashboard-scroll">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Joined</th>
                      <th>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((u) => (
                      <tr key={u.user_id}>
                        <td>{u.user_id}</td>
                        <td>
                          {u.user_fname} {u.user_lname}
                          {u.user_id === myId && <span className="nav-badge">you</span>}
                        </td>
                        <td>{u.user_email}</td>
                        <td>{formatDate(u.user_created_at)}</td>
                        <td>
                          <select
                            className="role-select"
                            value={u.user_role}
                            disabled={u.user_id === myId}
                            title={u.user_id === myId ? "You can't change your own role" : ""}
                            onChange={(e) => changeRole(u, e.target.value)}
                          >
                            {[...new Set([...ROLES, u.user_role])].map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

export default UserRoles;
