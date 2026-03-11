import { useEffect, useState } from "react";
import Dashboard from "./Dashboard.jsx";
import ChangePassword from "./ChangePassword.jsx";
import Register from "./Register.jsx";
import Product from "./Product.jsx";

const STORAGE_KEY = "billingAuthUser";
const initialForm = {
  email: "",
  password: "",
};

export default function App() {
  const loadStoredUser = () => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  };

  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [user, setUser] = useState(loadStoredUser);
  const [view, setView] = useState(user ? "dashboard" : "login");

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== STORAGE_KEY) {
        return;
      }

      if (!event.newValue) {
        setUser(null);
        setView("login");
        setStatus({ type: "idle", message: "" });
        return;
      }

      try {
        const parsed = JSON.parse(event.newValue);
        setUser(parsed);
        setView("dashboard");
      } catch (error) {
        setUser(null);
        setView("login");
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setStatus({ type: "idle", message: "" });

    try {
      const endpoint = `http://${window.location.hostname}:4000/api/login`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus({ type: "error", message: data.message || "Login failed." });
        return;
      }

      setStatus({
        type: "success",
        message: `Welcome back, ${data.user?.name || "user"}!`,
      });
      setForm(initialForm);
      setShowPassword(false);
      setUser(data.user || null);
      setView("dashboard");
      if (data.user) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
      }
    } catch (error) {
      setStatus({ type: "error", message: "Network error." });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setView("login");
    setStatus({ type: "idle", message: "" });
    window.localStorage.removeItem(STORAGE_KEY);
  };

  if (view === "dashboard") {
    return <Dashboard user={user} onLogout={handleLogout} />;
  }

  if (view === "change-password") {
    return <ChangePassword onBackToLogin={() => setView("login")} />;
  }

  if (view === "register") {
    return <Register onBackToLogin={() => setView("login")} />;
  }

  return (
    <div className="page">
      <main className="shell">
        <section className="hero">
          <p className="eyebrow">InstaBill</p>
          <h1>Login to manage invoices with clarity.</h1>
          <p className="subtitle">
            A clean, focused workspace for billing, receipts, and account
            insights.
          </p>
        </section>

        <section className="panel">
          <div className="panel-inner">
            <h2>Welcome back</h2>
            <p className="panel-copy">
              Login to continue to Billing.
            </p>

            <form className="form" onSubmit={onSubmit}>
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Password</span>

                  </div>
                  <div className="password-row">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="Your password"
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

                <button
                  type="button"
                  style={{
                    textAlign: "right",
                    background: "none",
                    border: "none",
                    color: "#0066cc",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    padding: "0",
                    textDecoration: "underline"
                  }}
                  onClick={() => {
                    setView("change-password");
                    setStatus({ type: "idle", message: "" });
                  }}
                >
                  Change Password?
                </button>

                <button type="submit" className="cta" disabled={loading}>
                  {loading
                    ? "Signing in..."
                    : "Login"}
                </button>

                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setView("register");
                    setStatus({ type: "idle", message: "" });
                  }}
                >
                  Need an account? Register
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
