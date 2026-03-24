import { useState } from "react";

const initialRegisterForm = {
  username: "",
  email: "",
  password: "",
  role: "admin",
};

export default function Register({ onBackToLogin }) {
  const [form, setForm] = useState(initialRegisterForm);
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setStatus({ type: "idle", message: "" });

    try {
      const response = await fetch("http://192.168.1.2:4000/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus({ type: "error", message: data.message || "Registration failed." });
        return;
      }

      setStatus({
        type: "success",
        message: "Account created. Redirecting to login...",
      });
      setForm(initialRegisterForm);
      setShowPassword(false);
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
    setForm(initialRegisterForm);
    setShowPassword(false);
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
          <h1>Create a new account.</h1>
          <p className="subtitle">
            Register to start managing invoices and billing workflows.
          </p>
        </section>

        <section className="panel">
          <div className="panel-inner">
            <h2>Create account</h2>
            <p className="panel-copy">
              Choose your role and set a password.
            </p>

            <form className="form" onSubmit={onSubmit}>
              <label className="field">
                <span>Username</span>
                <input
                  type="text"
                  name="username"
                  placeholder="Choose a username"
                  value={form.username}
                  onChange={onChange}
                  required
                />
              </label>

              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  placeholder="name@company.com"
                  value={form.email}
                  onChange={onChange}
                  required
                />
              </label>

              <label className="field">
                <span>Role</span>
                <select
                  name="role"
                  value={form.role}
                  onChange={onChange}
                  required
                >
                  <option value="admin">Admin</option>
                  <option value="cashier">Cashier</option>
                </select>
              </label>

              <label className="field">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Password</span>
                </div>
                <div className="password-row">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Create a password"
                    value={form.password}
                    onChange={onChange}
                    required
                  />
                  <button
                    type="button"
                    className="toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              <button type="submit" className="cta" disabled={loading}>
                {loading ? "Creating account..." : "Create account"}
              </button>

              <button
                type="button"
                className="ghost"
                onClick={handleBackToLogin}
              >
                Already have an account? Log in
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
