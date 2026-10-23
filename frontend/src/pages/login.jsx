import { useState } from "react";

function Login() {
const [formData, setFormData] = useState({
email: "",
password: "",
});

const [status, setStatus] = useState({
loading: false,
success: "",
error: "",
});

const handleChange = (e) => {
const { name, value } = e.target;

setFormData((data) => ({
  ...data,
  [name]: value,
}));

};

const handleSubmit = async (e) => {
e.preventDefault();


setStatus({
  loading: true,
  success: "",
  error: "",
});

try {
  const res = await fetch("http://localhost:5000/login", {
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

  setStatus({
    loading: false,
    success: data.message || "Login successful.",
    error: "",
  });

  setFormData({
    email: "",
    password: "",
  });
} catch (error) {
  setStatus({
    loading: false,
    success: "",
    error:
      error.message ||
      "Something went wrong. Please try again.",
  });
}

};

return ( <main className="login-page"> <div className="login-card"> <div className="login-card-body"> <h1 className="login-title">
Login to join the fun </h1>


      <p className="login-subtitle">
        <i>Start building your decks now!</i>
      </p>

      {status.error && (
        <p className="login-error">
          {status.error}
        </p>
      )}

      {status.success && (
        <p className="login-success">
          {status.success}
        </p>
      )}

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
              status.loading
                ? "Logging In..."
                : "Start"
            }
            disabled={status.loading}
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
