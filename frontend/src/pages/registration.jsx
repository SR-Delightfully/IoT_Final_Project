import { useState } from "react";

function Registration() {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    address: "",
    phone: "",
    email: "",
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
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Registration failed.");
      }

      setStatus({
        loading: false,
        success: data.message || "Your account has been created successfully.",
        error: "",
      });

      setFormData({
        first_name: "",
        last_name: "",
        address: "",
        phone: "",
        email: "",
        tos: false,
      });
    } catch (error) {
      setStatus({
        loading: false,
        success: "",
        error: error.message || "Something went wrong. Please try again.",
      });
    }
  };

  return (
    <main className="registration-page">
      <div className="registration-card">
        <div className="registration-card-body">
          <h1 className="registration-title">Register an account</h1>

          <p className="registration-subtitle">
            <i>join today to better equip for your journey.</i>
          </p>

          <form id="customer-registration" onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="fname-input" className="form-label">
                  First Name
                </label>

                <input
                  type="text"
                  name="first_name"
                  id="fname-input"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="lname-input" className="form-label">
                  Last Name
                </label>

                <input
                  type="text"
                  name="last_name"
                  id="lname-input"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-field form-field-full">
                <label htmlFor="email-input" className="form-label">
                  Email
                </label>

                <input
                  type="email"
                  name="email"
                  id="email-input"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-field form-field-full">
                <label htmlFor="phone-input" className="form-label">
                  Phone
                </label>

                <input
                  type="tel"
                  name="phone"
                  id="phone-input"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-field form-field-full">
                <label htmlFor="addr-input" className="form-label">
                  Address
                </label>

                <input
                  type="text"
                  name="address"
                  id="addr-input"
                  value={formData.address}
                  onChange={handleChange}
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

                <p className="form-label">I agree to the Terms of Service</p>
              </span>

              {status.error && (
                <p className="registration-error">{status.error}</p>
              )}

              {status.success && (
                <p className="registration-success">{status.success}</p>
              )}

              <input
                type="submit"
                name="register"
                id="register-btn"
                value={status.loading ? "Creating Account..." : "Sign Up"}
                disabled={status.loading}
              />
            </div>
            <div className="already-registered">
              <a href="/login">Already have an account?</a>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

export default Registration;
