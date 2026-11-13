import { useState } from "react";
import { flashToast, useToast } from "../components/Toaster";

function Login() {
const toast = useToast();
const [formData, setFormData] = useState({
email: "",
password: "",
});

const [loading, setLoading] = useState(false);

const handleChange = (e) => {
const { name, value } = e.target;

setFormData((data) => ({
  ...data,
  [name]: value,
}));

};

const handleSubmit = async (e) => {
e.preventDefault();


setLoading(true);

try {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: formData.email,
      password: formData.password,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Login failed.");
  }

  // remember who is logged in (the account page and admin dashboard read these)
  const user = data.user;
  localStorage.setItem("token", data.token);
  localStorage.setItem("user_id", user.user_id);
  localStorage.setItem("user_role", user.user_role);
  localStorage.setItem("user_fname", user.user_fname || "");
  if (user.user_role === "customer") {
    localStorage.setItem("customer_id", user.user_id);
  } else {
    localStorage.removeItem("customer_id");
  }

  flashToast("success", `Welcome back${user.user_fname ? `, ${user.user_fname}` : ""}!`);
  window.location.href = user.user_role === "admin" ? "/dashboard/inventory" : "/account";
} catch (error) {
  setLoading(false);
  toast.error(error.message || "Something went wrong. Please try again.");
}

};

return ( <main className="login-page"> <div className="login-card"> <div className="login-card-body"> <h1 className="login-title">
Login to join the fun </h1>


      <p className="login-subtitle">
        <i>Start building your decks now!</i>
      </p>

      <form
        id="customer-login"
        onSubmit={handleSubmit}
      >
        <div className="form-grid login-form-grid">
          <div className="form-field form-field-full">
            <label
              htmlFor="login-email-input"
              className="form-label"
            >
              <h2>Email</h2>
              <h5>Enter the email associated with your account.</h5>
            </label>

            <input
              type="email"
              name="email"
              id="login-email-input"
              value={formData.email}
              onChange={handleChange}
              placeholder="example@google.ca"
              autoComplete="email"
              required
            />
          </div>

          <div className="form-field form-field-full">
            <label
              htmlFor="login-password-input"
              className="form-label"
            >
              <h2>Password</h2>
              <h5>Enter your account password.</h5>
            </label>

            <input
              type="password"
              name="password"
              id="login-password-input"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter password"
              autoComplete="current-password"
              required
            />
          </div>
        </div>

        <div className="login-footer">
          <input
            type="submit"
            name="login"
            id="login-btn"
            value={
              loading
                ? "Logging In..."
                : "Start"
            }
            disabled={loading}
          />

          <div className="already-logged-in">
            <a href="/register">
              Don't have an account?
            </a>
          </div>
        </div>
      </form>
    </div>
  </div>
</main>

);
}

export default Login;
