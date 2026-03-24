import { useEffect, useMemo, useState } from "react";
import Product from "../modules/Product.jsx";
import Supplier from "../modules/Supplier.jsx";
import Category from "../modules/Category.jsx";
import Billing from "../modules/Billing.jsx";
import Customer from "../modules/Customer.jsx";
import Accounting from "../modules/Accounting.jsx";
import Reports from "../modules/Reports.jsx";

const API_BASE_URL = `http://${window.location.hostname}:4000`;

const emptyData = {
  kpis: {
    totalRevenue: 0,
    outstanding: 0,
    overdueCount: 0,
    paidThisMonth: 0,
  },
  recentInvoices: [],
  recentPayments: [],
  revenueByCategory: [],
};

export default function Dashboard({ user, onLogout }) {
  const [data, setData] = useState(emptyData);
  const [status, setStatus] = useState({ state: "loading", message: "" });
  const [view, setView] = useState("overview");

  const currency = useMemo(
    () =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }),
    []
  );

  useEffect(() => {
    let active = true;

    const load = async () => {
      setStatus({ state: "loading", message: "" });
      try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard`);
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || "Failed to load dashboard.");
        }
        if (active) {
          setData(payload);
          setStatus({ state: "ready", message: "" });
        }
      } catch (error) {
        if (active) {
          setStatus({
            state: "error",
            message: error.message || "Failed to load dashboard.",
          });
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);



  return (
    <div className="dashboard-page">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">IB</div>
          <div>
            <p className="brand-title">InstaBill</p>
            <p className="brand-sub">Admin Panel</p>
          </div>
        </div>

        <nav className="nav">
          <button
            className={`nav-item ${view === "overview" ? "active" : ""}`}
            onClick={() => setView("overview")}
            type="button"
          >
            Dashboard
          </button>
          <button
            className={`nav-item ${view === "category" ? "active" : ""}`}
            onClick={() => setView("category")}
            type="button"
          >
            Categories
          </button>
          <button
            className={`nav-item ${view === "product" ? "active" : ""}`}
            onClick={() => setView("product")}
            type="button"
          >
            Products & Stock-In
          </button>
          <button
            className={`nav-item ${view === "supplier" ? "active" : ""}`}
            onClick={() => setView("supplier")}
            type="button"
          >
            Suppliers
          </button>
          <button
            className={`nav-item ${view === "billing" ? "active" : ""}`}
            onClick={() => setView("billing")}
            type="button"
          >
            Sales & Returns
          </button>
          <button
            className={`nav-item ${view === "customer" ? "active" : ""}`}
            onClick={() => setView("customer")}
            type="button"
          >
            Customers
          </button>
          <button
            className={`nav-item ${view === "accounting" ? "active" : ""}`}
            onClick={() => setView("accounting")}
            type="button"
          >
            Accounting
          </button>
          <button
            className={`nav-item ${view === "reports" ? "active" : ""}`}
            onClick={() => setView("reports")}
            type="button"
          >
            Reports
          </button>
          <button className="nav-item" type="button">
            Settings
          </button>
        </nav>

        <div className="sidebar-foot">
          <p className="foot-label">Current Role</p>
          <p className="foot-value">{user?.role || ""}</p>
          <button className="logout-btn" type="button" onClick={onLogout}>
            Log out
          </button>
        </div>
      </aside>

      <section className={`content ${view === "category" || view === "product" || view === "supplier" || view === "accounting" ? "content-full-canvas" : ""}`.trim()}>
        {view === "overview" && (
          <>
            <header className="topbar">
              <div>
                <p className="eyebrow">Dashboard</p>
                <h1>Billing operations snapshot</h1>
              </div>
              <div className="topbar-actions">
                
              </div>
            </header>

            <section className="stack">
              {status.state === "loading" && (
                <div className="alert">Loading dashboard data...</div>
              )}
              {status.state === "error" && (
                <div className="alert">{status.message}</div>
              )}
              {status.state === "ready" && (
                <div className="card">
                  <p className="card-label">Overview</p>
                  <h3 className="list-title">Welcome back, {user?.name || "Admin"}</h3>
                  <p className="card-sub">
                    Billing operations dashboard for managing invoices and payments.
                  </p>
                </div>
              )}
            </section>
          </>
        )}
        {view === "category" && <Category />}
        {view === "product" && <Product />}
        {view === "supplier" && <Supplier />}
        {view === "billing" && <Billing />}
        {view === "customer" && <Customer />}
        {view === "accounting" && <Accounting />}
        {view === "reports" && <Reports />}

      </section>
    </div>
  );
}