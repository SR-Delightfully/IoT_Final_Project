import { useState } from "react";

function Registration() {

  return (
    <main className="registration-page">
      <div className="registration-card">
        <div className="registration-card-body">
          <h1 className="registration-title">
            Register an account
          </h1>

          <p className="registration-subtitle">
           <i> join today to better equip for your journey.</i>
          </p>

          <form id="customer-registration" action="">
            <div className="form-grid">
              <div className="form-field">
                <label
                  htmlFor="fname-input"
                  className="form-label"
                >
                  First Name
                </label>

                <input
                  type="text"
                  name="first-name"
                  id="fname-input"
                  required
                />
              </div>

              <div className="form-field">
                <label
                  htmlFor="lname-input"
                  className="form-label"
                >
                  Last Name
                </label>

                <input
                  type="text"
                  name="last-name"
                  id="lname-input"
                  required
                />
              </div>

              <div className="form-field form-field-full">
                <label
                  htmlFor="email"
                  className="form-label"
                >
                  Email
                </label>

                <input
                  type="email"
                  name="email"
                  id="email"
                  required
                />
              </div>

              <div className="form-field form-field-full">
                <label
                  htmlFor="phone-input"
                  className="form-label"
                >
                  Phone
                </label>

                <input
                  type="tel"
                  name="phone"
                  id="phone-input"
                  required
                />
              </div>

              <div className="form-field form-field-full">
                <label
                  htmlFor="addr-input"
                  className="form-label"
                >
                  Address
                </label>

                <input
                  type="text"
                  name="addr"
                  id="addr-input"
                  required
                />
              </div>

              <div className="form-field">
                <label
                  htmlFor="password-input"
                  className="form-label"
                >
                  Password
                </label>

                <input
                  type="password"
                  name="password"
                  id="password-input"
                  required
                />
              </div>

              <div className="form-field">
                <label
                  htmlFor="confirm-password-input"
                  className="form-label"
                >
                  Confirm Password
                </label>

                <input
                  type="password"
                  name="confirm-password"
                  id="confirm-password-input"
                  required
                />
              </div>
            </div>

          <div className="registration-footer">
            <span className="terms-field">
              <input type="checkbox" name="tos" id="tos" required />
              <p className="form-label">I agree to the Terms of Service </p>
            </span>

            <input type="submit" name="register" id="register-btn" value="Sign Up" />
          </div>
          </form>
        </div>
      </div>
              <div className="already-registered">
            <a href="/login">Already have an account?</a>
          </div>
    </main>
  );
}

export default Registration;