import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = `http://${window.location.hostname}:4000`;

const formatInr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const toDateInput = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
};

const firstDayOfMonth = () => {
  const date = new Date();
  date.setDate(1);
  return toDateInput(date);
};

const inDateRange = (rawDate, fromDate, toDate) => {
  const value = toDateInput(rawDate);
  return value >= fromDate && value <= toDate;
};

const formatMethod = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "Unknown";
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const formatCount = (value) => new Intl.NumberFormat("en-IN").format(Number(value || 0));

export default function Reports() {
  const [activeTab, setActiveTab] = useState("sales");
  const [salesReportTab, setSalesReportTab] = useState("daily");
  const [stockReportTab, setStockReportTab] = useState("current-stock");
  const [stockInReportTab, setStockInReportTab] = useState("supplier-wise");
  const [accountingReportTab, setAccountingReportTab] = useState("ledger");
  const [dailyDate, setDailyDate] = useState(toDateInput(new Date()));
  const [fromDate, setFromDate] = useState(firstDayOfMonth());
  const [toDate, setToDate] = useState(toDateInput(new Date()));

  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [stockIn, setStockIn] = useState([]);
  const [ledgerRows, setLedgerRows] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [revenueSummary, setRevenueSummary] = useState({
    totalSalesRevenue: 0,
    totalPurchaseCost: 0,
    totalExtraExpenses: 0,
    grossProfit: 0,
  });

  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [isLoading, setIsLoading] = useState(false);

  const rangeQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set("fromDate", fromDate);
    params.set("toDate", toDate);
    return params.toString();
  }, [fromDate, toDate]);

  useEffect(() => {
    const loadReports = async () => {
      setIsLoading(true);
      setStatus({ state: "idle", message: "" });

      try {
        const [
          salesRes,
          productsRes,
          stockInRes,
          ledgerRes,
          expensesRes,
          revenueSummaryRes,
        ] = await Promise.all([
          fetch(`${API_BASE_URL}/api/billing/sales`),
          fetch(`${API_BASE_URL}/api/products`),
          fetch(`${API_BASE_URL}/api/stock-in`),
          fetch(`${API_BASE_URL}/api/accounting/ledger?${rangeQuery}&limit=300`),
          fetch(`${API_BASE_URL}/api/accounting/expenses?${rangeQuery}`),
          fetch(`${API_BASE_URL}/api/accounting/revenue-summary?${rangeQuery}`),
        ]);

        const salesPayload = await salesRes.json();
        const productsPayload = await productsRes.json();
        const stockInPayload = await stockInRes.json();
        const ledgerPayload = await ledgerRes.json();
        const expensesPayload = await expensesRes.json();
        const revenueSummaryPayload = await revenueSummaryRes.json();

        if (!salesRes.ok) {
          throw new Error(salesPayload.message || "Failed to load sales reports.");
        }
        if (!productsRes.ok) {
          throw new Error(productsPayload.message || "Failed to load stock reports.");
        }
        if (!stockInRes.ok) {
          throw new Error(stockInPayload.message || "Failed to load stock-in reports.");
        }
        if (!ledgerRes.ok) {
          throw new Error(ledgerPayload.message || "Failed to load ledger report.");
        }
        if (!expensesRes.ok) {
          throw new Error(expensesPayload.message || "Failed to load expense report.");
        }
        if (!revenueSummaryRes.ok) {
          throw new Error(revenueSummaryPayload.message || "Failed to load revenue summary.");
        }

        setSales(salesPayload.data || []);
        setProducts(productsPayload.data || []);
        setStockIn(stockInPayload.data || []);
        setLedgerRows(ledgerPayload.data || []);
        setExpenses(expensesPayload.data || []);
        setRevenueSummary(
          revenueSummaryPayload.summary || {
            totalSalesRevenue: 0,
            totalPurchaseCost: 0,
            totalExtraExpenses: 0,
            grossProfit: 0,
          }
        );
      } catch (error) {
        setStatus({ state: "error", message: error.message || "Failed to load reports." });
      } finally {
        setIsLoading(false);
      }
    };

    loadReports();
  }, [rangeQuery]);

  const dailySales = useMemo(
    () => sales.filter((entry) => toDateInput(entry.created_at) === dailyDate),
    [sales, dailyDate]
  );

  const rangeSales = useMemo(
    () => sales.filter((entry) => inDateRange(entry.created_at, fromDate, toDate)),
    [sales, fromDate, toDate]
  );

  const dateRangeSalesReport = useMemo(() => {
    const grouped = new Map();

    rangeSales.forEach((entry) => {
      const key = toDateInput(entry.created_at);
      const current = grouped.get(key) || {
        date: key,
        invoiceCount: 0,
        itemCount: 0,
        totalSales: 0,
      };
      current.invoiceCount += 1;
      current.itemCount += Number(entry.itemCount || 0);
      current.totalSales += Number(entry.grandTotal || 0);
      grouped.set(key, current);
    });

    return [...grouped.values()]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((entry) => ({
        ...entry,
        totalSales: Number(entry.totalSales.toFixed(2)),
      }));
  }, [rangeSales]);

  const paymentModeReport = useMemo(() => {
    const grouped = new Map();

    rangeSales.forEach((entry) => {
      const method = String(entry.paymentMethod || "unknown").toLowerCase();
      const current = grouped.get(method) || { method, invoiceCount: 0, totalSales: 0 };
      current.invoiceCount += 1;
      current.totalSales += Number(entry.grandTotal || 0);
      grouped.set(method, current);
    });

    return [...grouped.values()]
      .sort((a, b) => b.totalSales - a.totalSales)
      .map((entry) => ({
        ...entry,
        totalSales: Number(entry.totalSales.toFixed(2)),
      }));
  }, [rangeSales]);

  const currentStockReport = useMemo(
    () =>
      [...products]
        .sort((a, b) => Number(b.current_stock || b.stock || 0) - Number(a.current_stock || a.stock || 0))
        .map((entry) => ({
          id: entry.id,
          productName: entry.product_name || entry.name || "-",
          category: entry.category_id || entry.category || "Uncategorized",
          stock: Number(entry.current_stock ?? entry.stock ?? 0),
          threshold: Number(entry.lowStockThreshold || 0),
          status: entry.status || "active",
        })),
    [products]
  );

  const lowStockReport = useMemo(
    () =>
      currentStockReport
        .filter((entry) => entry.threshold > 0 && entry.stock <= entry.threshold)
        .sort((a, b) => a.stock - b.stock),
    [currentStockReport]
  );

  const rangeStockIn = useMemo(
    () => stockIn.filter((entry) => inDateRange(entry.created_at || entry.date, fromDate, toDate)),
    [stockIn, fromDate, toDate]
  );

  const supplierWisePurchase = useMemo(() => {
    const grouped = new Map();

    rangeStockIn.forEach((entry) => {
      const key = entry.supplierName || "Unknown Supplier";
      const current = grouped.get(key) || { supplierName: key, entries: 0, totalPurchase: 0 };
      current.entries += 1;
      current.totalPurchase += Number(entry.totalAmount || 0);
      grouped.set(key, current);
    });

    return [...grouped.values()]
      .sort((a, b) => b.totalPurchase - a.totalPurchase)
      .map((entry) => ({
        ...entry,
        totalPurchase: Number(entry.totalPurchase.toFixed(2)),
      }));
  }, [rangeStockIn]);

  const dateWisePurchase = useMemo(() => {
    const grouped = new Map();

    rangeStockIn.forEach((entry) => {
      const key = toDateInput(entry.created_at || entry.date);
      const current = grouped.get(key) || { date: key, entries: 0, totalPurchase: 0 };
      current.entries += 1;
      current.totalPurchase += Number(entry.totalAmount || 0);
      grouped.set(key, current);
    });

    return [...grouped.values()]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((entry) => ({
        ...entry,
        totalPurchase: Number(entry.totalPurchase.toFixed(2)),
      }));
  }, [rangeStockIn]);

  const expenseModeReport = useMemo(() => {
    const grouped = new Map();

    expenses.forEach((entry) => {
      const key = String(entry.payment_mode || "unknown").toLowerCase();
      const current = grouped.get(key) || { paymentMode: key, count: 0, totalAmount: 0 };
      current.count += 1;
      current.totalAmount += Number(entry.amount || 0);
      grouped.set(key, current);
    });

    return [...grouped.values()]
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .map((entry) => ({
        ...entry,
        totalAmount: Number(entry.totalAmount.toFixed(2)),
      }));
  }, [expenses]);

  const dailySalesTotal = dailySales.reduce((sum, entry) => sum + Number(entry.grandTotal || 0), 0);

  return (
    <div className="product-page accounting-page reports-page">
      <div className="product-header">
        <div className="product-title-bar">
          <h1>Reports Module</h1>
        </div>
        <p className="product-subtitle">Sales, stock, purchase, and accounting reports in one place.</p>

        <div className="accounting-filters card">
          <div className="accounting-filter-row">
            <label className="product-field">
              <span>Daily Sales Date</span>
              <input type="date" value={dailyDate} onChange={(event) => setDailyDate(event.target.value)} />
            </label>
            <label className="product-field">
              <span>Range From</span>
              <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </label>
            <label className="product-field">
              <span>Range To</span>
              <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </label>
          </div>
        </div>

        {status.state === "error" && <p className="status error">{status.message}</p>}
      </div>

      {isLoading && <div className="alert">Loading reports...</div>}

      <div className="tab-nav">
        <button
          type="button"
          className={`tab-btn ${activeTab === "sales" ? "active" : ""}`}
          onClick={() => setActiveTab("sales")}
        >
          Sales Reports
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "stock" ? "active" : ""}`}
          onClick={() => setActiveTab("stock")}
        >
          Stock Reports
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "stock-in" ? "active" : ""}`}
          onClick={() => setActiveTab("stock-in")}
        >
          Stock-In Reports
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "accounting" ? "active" : ""}`}
          onClick={() => setActiveTab("accounting")}
        >
          Accounting Reports
        </button>
      </div>

      <div className="stack">
        {activeTab === "sales" && (
          <section className="card">
            <div className="card-head">
              <h3>Sales Reports</h3>
            </div>

            <div className="tab-nav reports-sub-tabs">
              <button
                type="button"
                className={`tab-btn ${salesReportTab === "daily" ? "active" : ""}`}
                onClick={() => setSalesReportTab("daily")}
              >
                Daily Sales Report
              </button>
              <button
                type="button"
                className={`tab-btn ${salesReportTab === "date-range" ? "active" : ""}`}
                onClick={() => setSalesReportTab("date-range")}
              >
                Date Range Sales Report
              </button>
              <button
                type="button"
                className={`tab-btn ${salesReportTab === "payment-mode" ? "active" : ""}`}
                onClick={() => setSalesReportTab("payment-mode")}
              >
                Payment Mode Report
              </button>
            </div>

            {salesReportTab === "daily" && (
              <>
                <p className="card-label">Daily Sales Report</p>
                <div className="table">
                  <div className="table-row header report-sale-daily-row">
                    <span>Date</span>
                    <span>Sale No</span>
                    <span>Invoice No</span>
                    <span>Payment</span>
                    <span>Items</span>
                    <span>Total</span>
                  </div>
                  {dailySales.length === 0 ? (
                    <div className="table-row empty">
                      <span>No sales found for selected day.</span>
                    </div>
                  ) : (
                    dailySales.map((entry) => (
                      <div className="table-row report-sale-daily-row" key={entry.id}>
                        <span>{toDateInput(entry.created_at)}</span>
                        <span>{entry.saleNo}</span>
                        <span>{entry.invoiceNo}</span>
                        <span>{formatMethod(entry.paymentMethod)}</span>
                        <span>{formatCount(entry.itemCount)}</span>
                        <span>{formatInr.format(entry.grandTotal || 0)}</span>
                      </div>
                    ))
                  )}
                </div>
                <p className="card-sub">Total: {formatInr.format(dailySalesTotal)}</p>
              </>
            )}

            {salesReportTab === "date-range" && (
              <>
                <p className="card-label">Date Range Sales Report</p>
                <div className="table">
                  <div className="table-row header report-date-sales-row">
                    <span>Date</span>
                    <span>Invoices</span>
                    <span>Items</span>
                    <span>Total Sales</span>
                  </div>
                  {dateRangeSalesReport.length === 0 ? (
                    <div className="table-row empty">
                      <span>No sales found in selected range.</span>
                    </div>
                  ) : (
                    dateRangeSalesReport.map((entry) => (
                      <div className="table-row report-date-sales-row" key={entry.date}>
                        <span>{entry.date}</span>
                        <span>{formatCount(entry.invoiceCount)}</span>
                        <span>{formatCount(entry.itemCount)}</span>
                        <span>{formatInr.format(entry.totalSales || 0)}</span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {salesReportTab === "payment-mode" && (
              <>
                <p className="card-label">Payment Mode Report</p>
                <div className="table">
                  <div className="table-row header report-mode-row">
                    <span>Payment Mode</span>
                    <span>Invoices</span>
                    <span>Total Sales</span>
                  </div>
                  {paymentModeReport.length === 0 ? (
                    <div className="table-row empty">
                      <span>No payment mode data found.</span>
                    </div>
                  ) : (
                    paymentModeReport.map((entry) => (
                      <div className="table-row report-mode-row" key={entry.method}>
                        <span>{formatMethod(entry.method)}</span>
                        <span>{formatCount(entry.invoiceCount)}</span>
                        <span>{formatInr.format(entry.totalSales || 0)}</span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </section>
        )}

        {activeTab === "stock" && (
          <section className="card">
            <div className="card-head">
              <h3>Stock Reports</h3>
            </div>

            <div className="tab-nav reports-sub-tabs">
              <button
                type="button"
                className={`tab-btn ${stockReportTab === "current-stock" ? "active" : ""}`}
                onClick={() => setStockReportTab("current-stock")}
              >
                Current Stock Report
              </button>
              <button
                type="button"
                className={`tab-btn ${stockReportTab === "low-stock" ? "active" : ""}`}
                onClick={() => setStockReportTab("low-stock")}
              >
                Low Stock Report
              </button>
            </div>

            {stockReportTab === "current-stock" && (
              <>
                <p className="card-label">Current Stock Report</p>
                <div className="table">
                  <div className="table-row header report-stock-row">
                    <span>Product</span>
                    <span>Category</span>
                    <span>Stock</span>
                    <span>Threshold</span>
                    <span>Status</span>
                  </div>
                  {currentStockReport.length === 0 ? (
                    <div className="table-row empty">
                      <span>No stock records found.</span>
                    </div>
                  ) : (
                    currentStockReport.map((entry) => (
                      <div className="table-row report-stock-row" key={entry.id}>
                        <span>{entry.productName}</span>
                        <span>{entry.category}</span>
                        <span>{formatCount(entry.stock)}</span>
                        <span>{formatCount(entry.threshold)}</span>
                        <span>{entry.status}</span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {stockReportTab === "low-stock" && (
              <>
                <p className="card-label">Low Stock Report</p>
                <div className="table">
                  <div className="table-row header report-stock-row">
                    <span>Product</span>
                    <span>Category</span>
                    <span>Stock</span>
                    <span>Threshold</span>
                    <span>Status</span>
                  </div>
                  {lowStockReport.length === 0 ? (
                    <div className="table-row empty">
                      <span>No low stock products found.</span>
                    </div>
                  ) : (
                    lowStockReport.map((entry) => (
                      <div className="table-row report-stock-row" key={`low-${entry.id}`}>
                        <span>{entry.productName}</span>
                        <span>{entry.category}</span>
                        <span>{formatCount(entry.stock)}</span>
                        <span>{formatCount(entry.threshold)}</span>
                        <span>{entry.status}</span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </section>
        )}

        {activeTab === "stock-in" && (
          <section className="card">
            <div className="card-head">
              <h3>Stock-In Reports</h3>
            </div>

            <div className="tab-nav reports-sub-tabs">
              <button
                type="button"
                className={`tab-btn ${stockInReportTab === "supplier-wise" ? "active" : ""}`}
                onClick={() => setStockInReportTab("supplier-wise")}
              >
                Supplier-wise Purchase
              </button>
              <button
                type="button"
                className={`tab-btn ${stockInReportTab === "date-wise" ? "active" : ""}`}
                onClick={() => setStockInReportTab("date-wise")}
              >
                Date-wise Purchase
              </button>
            </div>

            {stockInReportTab === "supplier-wise" && (
              <>
                <p className="card-label">Supplier-wise Purchase</p>
                <div className="table">
                  <div className="table-row header report-purchase-row">
                    <span>Supplier</span>
                    <span>Entries</span>
                    <span>Total Purchase</span>
                  </div>
                  {supplierWisePurchase.length === 0 ? (
                    <div className="table-row empty">
                      <span>No supplier purchase data found.</span>
                    </div>
                  ) : (
                    supplierWisePurchase.map((entry) => (
                      <div className="table-row report-purchase-row" key={entry.supplierName}>
                        <span>{entry.supplierName}</span>
                        <span>{formatCount(entry.entries)}</span>
                        <span>{formatInr.format(entry.totalPurchase || 0)}</span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {stockInReportTab === "date-wise" && (
              <>
                <p className="card-label">Date-wise Purchase</p>
                <div className="table">
                  <div className="table-row header report-purchase-row">
                    <span>Date</span>
                    <span>Entries</span>
                    <span>Total Purchase</span>
                  </div>
                  {dateWisePurchase.length === 0 ? (
                    <div className="table-row empty">
                      <span>No date-wise purchase data found.</span>
                    </div>
                  ) : (
                    dateWisePurchase.map((entry) => (
                      <div className="table-row report-purchase-row" key={entry.date}>
                        <span>{entry.date}</span>
                        <span>{formatCount(entry.entries)}</span>
                        <span>{formatInr.format(entry.totalPurchase || 0)}</span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </section>
        )}

        {activeTab === "accounting" && (
          <section className="card">
            <div className="card-head">
              <h3>Accounting Reports</h3>
            </div>

            <div className="tab-nav reports-sub-tabs">
              <button
                type="button"
                className={`tab-btn ${accountingReportTab === "ledger" ? "active" : ""}`}
                onClick={() => setAccountingReportTab("ledger")}
              >
                Ledger Report
              </button>
              <button
                type="button"
                className={`tab-btn ${accountingReportTab === "expense" ? "active" : ""}`}
                onClick={() => setAccountingReportTab("expense")}
              >
                Expense Report
              </button>
              <button
                type="button"
                className={`tab-btn ${accountingReportTab === "revenue" ? "active" : ""}`}
                onClick={() => setAccountingReportTab("revenue")}
              >
                Revenue & Profit Summary
              </button>
            </div>

            {accountingReportTab === "ledger" && (
              <>
                <p className="card-label">Ledger Report</p>
                <div className="table">
                  <div className="table-row header report-ledger-row">
                    <span>Date</span>
                    <span>Type</span>
                    <span>Reference</span>
                    <span>Debit</span>
                    <span>Credit</span>
                    <span>Balance</span>
                  </div>
                  {ledgerRows.length === 0 ? (
                    <div className="table-row empty">
                      <span>No ledger records found.</span>
                    </div>
                  ) : (
                    ledgerRows.map((entry) => (
                      <div className="table-row report-ledger-row" key={entry.id || entry.ledger_id}>
                        <span>{toDateInput(entry.date)}</span>
                        <span>{entry.reference_type}</span>
                        <span>{entry.reference_id}</span>
                        <span>{formatInr.format(entry.debit_amount || 0)}</span>
                        <span>{formatInr.format(entry.credit_amount || 0)}</span>
                        <span>{formatInr.format(entry.balance_after || 0)}</span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {accountingReportTab === "revenue" && (
              <>
                <p className="card-label">Revenue Summary</p>
                <section className="kpi-grid">
                  <article className="card">
                    <p className="card-label">Total Sales Revenue</p>
                    <h3>{formatInr.format(revenueSummary.totalSalesRevenue || 0)}</h3>
                  </article>
                  <article className="card">
                    <p className="card-label">Total Purchase Cost</p>
                    <h3>{formatInr.format(revenueSummary.totalPurchaseCost || 0)}</h3>
                  </article>
                </section>

                <p className="card-label">Profit Summary</p>
                <section className="kpi-grid">
                  <article className="card">
                    <p className="card-label">Total Extra Expenses</p>
                    <h3>{formatInr.format(revenueSummary.totalExtraExpenses || 0)}</h3>
                  </article>
                  <article className="card">
                    <p className="card-label">Gross Profit</p>
                    <h3>{formatInr.format(revenueSummary.grossProfit || 0)}</h3>
                  </article>
                </section>
              </>
            )}

            {accountingReportTab === "expense" && (
              <>
                <p className="card-label">Expense Report</p>
                <div className="table">
                  <div className="table-row header report-expense-row">
                    <span>Payment Mode</span>
                    <span>Expense Count</span>
                    <span>Total Amount</span>
                  </div>
                  {expenseModeReport.length === 0 ? (
                    <div className="table-row empty">
                      <span>No expense data found.</span>
                    </div>
                  ) : (
                    expenseModeReport.map((entry) => (
                      <div className="table-row report-expense-row" key={entry.paymentMode}>
                        <span>{formatMethod(entry.paymentMode)}</span>
                        <span>{formatCount(entry.count)}</span>
                        <span>{formatInr.format(entry.totalAmount || 0)}</span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

          </section>
        )}
      </div>
    </div>
  );
}
