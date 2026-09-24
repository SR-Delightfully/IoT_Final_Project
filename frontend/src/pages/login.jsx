import { useState } from "react";

function Login() {
  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-card-body">
          <h1 className="login-title">
            Login to join the fun
          </h1>

          <p className="login-subtitle">
            <i> start building your decks now!</i>
          </p>

          <form id="customer-login" action="">
            <div className="form-grid">
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

            </div>
            <div className="login-footer">
              <input type="submit" name="login" id="login-btn" value="Start" />
                            <div className="already-logged-in">
        <a href="/">Don't have an account?</a>
      </div>
            </div>
          </form>
          
        </div>

      </div>
    </main>
  );
}

export default Login;
