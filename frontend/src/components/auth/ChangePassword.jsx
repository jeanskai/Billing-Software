import { useState } from "react";

const initialChangePasswordForm = {
  email: "",
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function ChangePassword({ onBackToLogin }) {
  const [changePasswordForm, setChangePasswordForm] = useState(initialChangePasswordForm);
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const onChangePasswordChange = (event) => {
    const { name, value } = event.target;
    setChangePasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const onChangePasswordSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setStatus({ type: "idle", message: "" });

    if (changePasswordForm.newPassword !== changePasswordForm.confirmPassword) {
      setStatus({ type: "error", message: "New passwords do not match." });
      setLoading(false);
      return;
    }

    if (changePasswordForm.newPassword.length < 6) {
      setStatus({ type: "error", message: "New password must be at least 6 characters." });
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("http://192.168.1.2:4000/api/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: changePasswordForm.email,
          currentPassword: changePasswordForm.currentPassword,
          newPassword: changePasswordForm.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus({ type: "error", message: data.message || "Failed to change password." });
        return;
      }

      setStatus({
        type: "success",
        message: "Password changed successfully. Redirecting to login...",
      });
      setChangePasswordForm(initialChangePasswordForm);
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setTimeout(() => {
        if (onBackToLogin) {
          onBackToLogin();
        }
      }, 2000);
    } catch (error) {
      setStatus({ type: "error", message: "Network error." });
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setChangePasswordForm(initialChangePasswordForm);
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setStatus({ type: "idle", message: "" });
    if (onBackToLogin) {
      onBackToLogin();
    }
  };

  return (
    <div className="page">
      <main className="shell">
        <section className="hero">
          <p className="eyebrow">InstaBill</p>
          <h1>Change your password securely.</h1>
          <p className="subtitle">
            Update your account password to keep your billing data safe.
          </p>
        </section>

        <section className="panel">
          <div className="panel-inner">
            <h2>Change Password</h2>
            <p className="panel-copy">
              Enter your credentials to set a new password.
            </p>

            <form className="form" onSubmit={onChangePasswordSubmit}>
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  placeholder="name@company.com"
                  value={changePasswordForm.email}
                  onChange={onChangePasswordChange}
                  required
                />
              </label>

              <label className="field">
                <span>Current Password</span>
                <div className="password-row">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    name="currentPassword"
                    placeholder="Your current password"
                    value={changePasswordForm.currentPassword}
                    onChange={onChangePasswordChange}
                    required
                  />
                  <button
                    type="button"
                    className="toggle"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    aria-pressed={showCurrentPassword}
                  >
                    {showCurrentPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              <label className="field">
                <span>New Password</span>
                <div className="password-row">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    name="newPassword"
                    placeholder="Your new password"
                    value={changePasswordForm.newPassword}
                    onChange={onChangePasswordChange}
                    required
                    minLength="6"
                  />
                  <button
                    type="button"
                    className="toggle"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    aria-pressed={showNewPassword}
                  >
                    {showNewPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              <label className="field">
                <span>Confirm New Password</span>
                <div className="password-row">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    placeholder="Confirm your new password"
                    value={changePasswordForm.confirmPassword}
                    onChange={onChangePasswordChange}
                    required
                    minLength="6"
                  />
                  <button
                    type="button"
                    className="toggle"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-pressed={showConfirmPassword}
                  >
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              <button type="submit" className="cta" disabled={loading}>
                {loading ? "Changing password..." : "Change Password"}
              </button>

              <button
                type="button"
                className="ghost"
                onClick={handleBackToLogin}
              >
                Back to Login
              </button>

              <div className={`status ${status.type}`} role="status">
                {status.message}
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
