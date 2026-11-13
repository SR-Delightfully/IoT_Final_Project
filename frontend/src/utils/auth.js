// Login token saved by the login page. The backend reads it from the
// Authorization header to know who is making the request.
export function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const SESSION_KEYS = ["token", "user_id", "user_role", "user_fname", "customer_id"];
