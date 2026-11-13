import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL;

function request(path, method = "GET", body) {
  return fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": localStorage.getItem("user_id") || "",
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

const EMPTY_PASSWORDS = { current_password: "", new_password: "", confirm_password: "" };

function Settings() {
  const loggedIn = Boolean(localStorage.getItem("user_id"));
  const [me, setMe] = useState(null);
  const [profile, setProfile] = useState(null);
  const [passwords, setPasswords] = useState(EMPTY_PASSWORDS);
  const [profileStatus, setProfileStatus] = useState({ error: "", success: "" });
  const [passwordStatus, setPasswordStatus] = useState({ error: "", success: "" });
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!loggedIn) return;

    request("/me")
      .then((data) => {
        setMe(data);
        setProfile({
          first_name: data.user_fname,
          last_name: data.user_lname,
          phone: data.customer_phone || "",
          address: data.customer_address || "",
        });
      })
      .catch((err) => setLoadError(err.message));
  }, [loggedIn]);

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      const updated = await request("/me", "PUT", profile);
      setMe(updated);
      localStorage.setItem("user_fname", updated.user_fname);
      setProfileStatus({ error: "", success: "Your details were saved." });
    } catch (err) {
      setProfileStatus({ error: err.message, success: "" });
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();

    if (passwords.new_password.length < 8) {
      setPasswordStatus({ error: "New password must be at least 8 characters.", success: "" });
      return;
    }
    if (passwords.new_password !== passwords.confirm_password) {
      setPasswordStatus({ error: "New passwords do not match.", success: "" });
      return;
    }

    try {
      await request("/me/password", "PUT", {
        current_password: passwords.current_password,
        new_password: passwords.new_password,
      });
      setPasswords(EMPTY_PASSWORDS);
      setPasswordStatus({ error: "", success: "Your password was changed." });
    } catch (err) {
      setPasswordStatus({ error: err.message, success: "" });
    }
  };

  const updateProfile = (e) => setProfile({ ...profile, [e.target.name]: e.target.value });
  const updatePasswords = (e) => setPasswords({ ...passwords, [e.target.name]: e.target.value });

  if (!loggedIn || loadError) {
    return (
      <main className="account-page">
        <div className="account-card">
          <div className="account-card-body">
            <h1 className="account-title">Settings</h1>
            <p className="account-subtitle">
              <i>{loadError || "log in to change your settings."}</i>
            </p>
          </div>
        </div>
        <div className="account-links">
          <a href="/login">Log in</a>
        </div>
      </main>
    );
  }

  if (!me || !profile) {
    return (
      <main className="account-page">
        <p className="products-message">
          <i>loading your settings...</i>
        </p>
      </main>
    );
  }

  return (
    <main className="account-page">
      <div className="account-card">
        <div className="account-card-body">
          <h1 className="account-title">Settings</h1>
          <p className="account-subtitle">
            <i>{me.user_email}</i>
          </p>

          <section className="account-section">
            <h2 className="account-section-title">Your Details</h2>

            {profileStatus.error && <p className="dashboard-error">{profileStatus.error}</p>}
            {profileStatus.success && <p className="dashboard-success">{profileStatus.success}</p>}

            <form className="settings-form" onSubmit={saveProfile}>
              <label>
                <span className="form-label">First name</span>
                <input name="first_name" value={profile.first_name} onChange={updateProfile} required />
              </label>
              <label>
                <span className="form-label">Last name</span>
                <input name="last_name" value={profile.last_name} onChange={updateProfile} required />
              </label>

              {me.is_customer && (
                <>
                  <label>
                    <span className="form-label">Phone</span>
                    <input name="phone" type="tel" value={profile.phone} onChange={updateProfile} required />
                  </label>
                  <label className="settings-full">
                    <span className="form-label">Address</span>
                    <input name="address" value={profile.address} onChange={updateProfile} required />
                  </label>
                </>
              )}

              <div className="dashboard-form-actions">
                <button type="submit">Save details</button>
              </div>
            </form>
          </section>

          <section className="account-section">
            <h2 className="account-section-title">Change Password</h2>

            {passwordStatus.error && <p className="dashboard-error">{passwordStatus.error}</p>}
            {passwordStatus.success && <p className="dashboard-success">{passwordStatus.success}</p>}

            <form className="settings-form" onSubmit={savePassword}>
              <label className="settings-full">
                <span className="form-label">Current password</span>
                <input
                  name="current_password"
                  type="password"
                  autoComplete="current-password"
                  value={passwords.current_password}
                  onChange={updatePasswords}
                  required
                />
              </label>
              <label>
                <span className="form-label">New password</span>
                <input
                  name="new_password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={passwords.new_password}
                  onChange={updatePasswords}
                  required
                />
              </label>
              <label>
                <span className="form-label">Confirm new password</span>
                <input
                  name="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={passwords.confirm_password}
                  onChange={updatePasswords}
                  required
                />
              </label>

              <div className="dashboard-form-actions">
                <button type="submit">Change password</button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

export default Settings;
