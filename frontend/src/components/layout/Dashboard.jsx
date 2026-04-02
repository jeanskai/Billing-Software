import { useEffect, useState } from "react";
import Product from "../modules/Product.jsx";
import Supplier from "../modules/Supplier.jsx";
import Category from "../modules/Category.jsx";
import Billing from "../modules/Billing.jsx";
import Customer from "../modules/Customer.jsx";
import Accounting from "../modules/Accounting.jsx";
import Reports from "../modules/Reports.jsx";

const viewPathMap = {
  category: "/dashboard/category",
  product: "/dashboard/product",
  supplier: "/dashboard/supplier",
  billing: "/dashboard/billing",
  customer: "/dashboard/customer",
  accounting: "/dashboard/accounting",
  reports: "/dashboard/reports",
};

const pathViewMap = Object.entries(viewPathMap).reduce((acc, [viewKey, path]) => {
  acc[path] = viewKey;
  return acc;
}, {});

const resolveViewFromPath = (pathname) => {
  if (pathname === "/dashboard") {
    return "category";
  }
  return pathViewMap[pathname] || "category";
};

export default function Dashboard({ user, onLogout }) {
  const [view, setView] = useState(() => resolveViewFromPath(window.location.pathname));

  const setViewWithUrl = (nextView) => {
    const nextPath = viewPathMap[nextView] || viewPathMap.category;
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
    setView(nextView);
  };

  useEffect(() => {
    const syncViewFromLocation = () => {
      setView(resolveViewFromPath(window.location.pathname));
    };

    const expectedPath = viewPathMap[view] || viewPathMap.category;
    if (window.location.pathname !== expectedPath) {
      window.history.replaceState({}, "", expectedPath);
    }

    window.addEventListener("popstate", syncViewFromLocation);
    return () => {
      window.removeEventListener("popstate", syncViewFromLocation);
    };
  }, [view]);



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
            className={`nav-item ${view === "category" ? "active" : ""}`}
            onClick={() => setViewWithUrl("category")}
            type="button"
          >
            Categories
          </button>
          <button
            className={`nav-item ${view === "product" ? "active" : ""}`}
            onClick={() => setViewWithUrl("product")}
            type="button"
          >
            Products & Stock-In
          </button>
          <button
            className={`nav-item ${view === "supplier" ? "active" : ""}`}
            onClick={() => setViewWithUrl("supplier")}
            type="button"
          >
            Suppliers
          </button>
          <button
            className={`nav-item ${view === "billing" ? "active" : ""}`}
            onClick={() => setViewWithUrl("billing")}
            type="button"
          >
            Sales & Returns
          </button>
          <button
            className={`nav-item ${view === "customer" ? "active" : ""}`}
            onClick={() => setViewWithUrl("customer")}
            type="button"
          >
            Customers
          </button>
          <button
            className={`nav-item ${view === "accounting" ? "active" : ""}`}
            onClick={() => setViewWithUrl("accounting")}
            type="button"
          >
            Accounting
          </button>
          <button
            className={`nav-item ${view === "reports" ? "active" : ""}`}
            onClick={() => setViewWithUrl("reports")}
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