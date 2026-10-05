import { useState } from "react";

function Registration() {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    address: "",
    phone: "",
    email: "",
    password: "",
    confirm_password: "",
    tos: false,
  });

  const [status, setStatus] = useState({
    loading: false,
    success: "",
    error: "",
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((data) => ({
      ...data,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setStatus({
      loading: false,
      success: "",
      error: "",
    });

    if (!formData.tos) {
      setStatus({
        loading: false,
        success: "",
        error: "[ERROR] You must agree to the Terms of Service!",
      });

      return;
    }

    try {
      setStatus({
        loading: true,
        success: "",
        error: "",
      });

      const res = await fetch("http://localhost:5000/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: formData.first_name,
          last_name: formData.last_name,
          address: formData.address,
          phone: formData.phone,
          email: formData.email,
          password: formData.password,
          confirm_password: formData.confirm_password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Registration failed.");
      }

      setStatus({
        loading: false,
        success:
          data.message ||
          "Your account has been created successfully.",
        error: "",
      });

      setFormData({
        first_name: "",
        last_name: "",
        address: "",
        phone: "",
        email: "",
        password: "",
        confirm_password: "",
        tos: false,
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

  return (
    <main className="registration-page">
      <div className="registration-card">
        <div className="registration-card-body">
          <h1 className="registration-title">
            Register an Account
          </h1>

          <p className="registration-subtitle">
            <i>
              Join today to better equip yourself for your journey.
            </i>
          </p>

          {status.error && (
            <p className="registration-error">
              {status.error}
            </p>
          )}

          {status.success && (
            <p className="registration-success">
              {status.success}
            </p>
          )}

          <form
            id="customer-registration"
            onSubmit={handleSubmit}
          >
            <div className="form-grid">
              <div className="form-field">
                <label
                  htmlFor="fname-input"
                  className="form-label"
                >
                  <h2>First Name</h2>
                  <h5>What is your given name?</h5>
                </label>

                <input
                  type="text"
                  name="first_name"
                  id="fname-input"
                  value={formData.first_name}
                  onChange={handleChange}
                  placeholder="Ex. John, Jane, Jordan"
                  required
                />
              </div>

              <div className="form-field">
                <label
                  htmlFor="lname-input"
                  className="form-label"
                >
                  <h2>Last Name</h2>
                  <h5>What is your family name?</h5>
                </label>

                <input
                  type="text"
                  name="last_name"
                  id="lname-input"
                  value={formData.last_name}
                  onChange={handleChange}
                  placeholder="Ex. Doe, Dixon, Davis"
                  required
                />
              </div>

              <div className="form-field form-field-full">
                <label
                  htmlFor="email-input"
                  className="form-label"
                >
                  <h2>Email</h2>
                  <h5>What is your personal email address?</h5>
                </label>

                <input
                  type="email"
                  name="email"
                  id="email-input"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="example@google.ca"
                  required
                />
              </div>

              <div className="form-field form-field-full">
                <label
                  htmlFor="phone-input"
                  className="form-label"
                >
                  <h2>Phone</h2>
                  <h5>Please enter your personal phone number.</h5>
                </label>

                <input
                  type="tel"
                  name="phone"
                  id="phone-input"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="XXX-XXX-XXXX"
                  required
                />
              </div>

              <div className="form-field form-field-full">
                <label
                  htmlFor="addr-input"
                  className="form-label"
                >
                  <h2>Address</h2>
                  <h5>What is your home address?</h5>
                </label>

                <input
                  type="text"
                  name="address"
                  id="addr-input"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Enter your home address"
                  required
                />
              </div>

              <div className="form-field">
                <label
                  htmlFor="password-input"
                  className="form-label"
                >
                  <h2>Password</h2>
                  <h5>At least 8 characters.</h5>
                </label>

                <input
                  type="password"
                  name="password"
                  id="password-input"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter password"
                  required
                />
              </div>

              <div className="form-field">
                <label
                  htmlFor="confirm-password-input"
                  className="form-label"
                >
                  <h2>Confirm Password</h2>
                  <h5>Enter it again to confirm.</h5>
                </label>

                <input
                  type="password"
                  name="confirm_password"
                  id="confirm-password-input"
                  value={formData.confirm_password}
                  onChange={handleChange}
                  placeholder="Confirm password"
                  required
                />
              </div>
            </div>

            <div className="registration-footer">
              <span className="terms-field">
                <input
                  type="checkbox"
                  name="tos"
                  id="tos"
                  checked={formData.tos}
                  onChange={handleChange}
                  required
                />

                <p>
                  I agree to the Terms of Service
                </p>
              </span>

              <input
                type="submit"
                name="register"
                id="register-btn"
                value={
                  status.loading
                    ? "Creating Account..."
                    : "Sign Up"
                }
                disabled={status.loading}
              />
            </div>

            <div className="already-registered">
              <a href="/login">
                Already have an account?
              </a>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

export default Registration;