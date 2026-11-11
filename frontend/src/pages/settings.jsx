import { useEffect, useState } from "react";
import { fetchAccount, getCustomerId } from "../utils/purchases";

async function saveToServer(path, body) {
  const res = await fetch(`http://localhost:5050/customers/${getCustomerId()}/${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not save");
  return data.message;
}

function Message({ status }) {
  if (!status) return null;
  return (
    <p className={`settings-message settings-message-${status.type}`}>
      {status.text}
    </p>
  );
}

function Settings() {
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState(null);
  const [passwords, setPasswords] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [status, setStatus] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAccount()
      .then(({ customer }) => {
        setEmail(customer.user_email);
        setProfile({
          first_name: customer.user_fname || "",
          last_name: customer.user_lname || "",
          phone: customer.customer_phone || "",
          address: customer.customer_address || "",
        });
      })
      .catch((err) => setError(err.message));
  }, []);

  function showStatus(section, type, text) {
    setStatus((s) => ({ ...s, [section]: { type, text } }));
  }

  async function handleProfile(e) {
    e.preventDefault();
    try {
      showStatus("profile", "success", await saveToServer("profile", profile));
    } catch (err) {
      showStatus("profile", "error", err.message);
    }
  }

  async function handlePassword(e) {
    e.preventDefault();
    try {
      const message = await saveToServer("password", passwords);
      setPasswords({ current_password: "", new_password: "", confirm_password: "" });
      showStatus("password", "success", message);
    } catch (err) {
      showStatus("password", "error", err.message);
    }
  }

  const updateProfile = (e) => setProfile({ ...profile, [e.target.name]: e.target.value });
  const updatePasswords = (e) => setPasswords({ ...passwords, [e.target.name]: e.target.value });

  if (error || !profile) {
    return (
      <main className="account-page">
        <div className="account-card">
          <div className="account-card-body">
            <h1 className="account-title">Settings</h1>
            <p className="account-subtitle">
              <i>{error || "loading your settings..."}</i>
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="account-page">
      <div className="account-card">
        <div className="account-card-body">
          <h1 className="account-title">Settings</h1>
          <p className="account-subtitle">
            <i>manage your account details.</i>
          </p>

          <form className="account-section" onSubmit={handleProfile}>
            <h2 className="account-section-title">Profile & Address</h2>
            <div className="settings-grid">
              <label className="settings-field">
                <span className="form-label">First Name</span>
                <input name="first_name" value={profile.first_name} onChange={updateProfile} required />
              </label>
              <label className="settings-field">
                <span className="form-label">Last Name</span>
                <input name="last_name" value={profile.last_name} onChange={updateProfile} required />
              </label>
              <label className="settings-field">
                <span className="form-label">Email</span>
                <input value={email} disabled />
              </label>
              <label className="settings-field">
                <span className="form-label">Phone</span>
                <input name="phone" type="tel" value={profile.phone} onChange={updateProfile} />
              </label>
              <label className="settings-field settings-field-full">
                <span className="form-label">Shipping Address</span>
                <input name="address" value={profile.address} onChange={updateProfile} required />
              </label>
            </div>
            <div className="settings-actions">
              <Message status={status.profile} />
              <button type="submit" className="account-button">Save Profile</button>
            </div>
          </form>

          <form className="account-section" onSubmit={handlePassword}>
            <h2 className="account-section-title">Change Password</h2>
            <div className="settings-grid">
              <label className="settings-field settings-field-full">
                <span className="form-label">Current Password</span>
                <input
                  name="current_password"
                  type="password"
                  autoComplete="current-password"
                  value={passwords.current_password}
                  onChange={updatePasswords}
                  required
                />
              </label>
              <label className="settings-field">
                <span className="form-label">New Password</span>
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
              <label className="settings-field">
                <span className="form-label">Confirm New Password</span>
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
            </div>
            <div className="settings-actions">
              <Message status={status.password} />
              <button type="submit" className="account-button">Update Password</button>
            </div>
          </form>
        </div>
      </div>
      <div className="account-links">
        <a href="/account">Back to account</a>
      </div>
    </main>
  );
}

export default Settings;
