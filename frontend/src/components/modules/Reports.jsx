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
  const reportRowsPerPage = 20;
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
  const [accounts, setAccounts] = useState([]);
  const [accountingCategories, setAccountingCategories] = useState([]);
  const [accountingEntries, setAccountingEntries] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [accountDetail, setAccountDetail] = useState(null);
  const [isAccountDrilldownModalOpen, setIsAccountDrilldownModalOpen] = useState(false);
  const [revenueSummary, setRevenueSummary] = useState({
    totalSalesRevenue: 0,
    totalPurchaseCost: 0,
    totalExtraExpenses: 0,
    grossProfit: 0,
  });

  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [reportPages, setReportPages] = useState({
    salesDaily: 1,
    salesDateRange: 1,
    salesPaymentMode: 1,
    stockCurrent: 1,
    stockLow: 1,
    stockInSupplier: 1,
    stockInDate: 1,
    accountingLedger: 1,
    accountingAccountWise: 1,
    accountingCategoryWise: 1,
    accountingEntryLevel: 1,
    accountingAccountDrilldown: 1,
  });

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
          accountsRes,
          accountingCategoriesRes,
          accountingEntriesRes,
          revenueSummaryRes,
        ] = await Promise.all([
          fetch(`${API_BASE_URL}/api/billing/sales`),
          fetch(`${API_BASE_URL}/api/products`),
          fetch(`${API_BASE_URL}/api/stock-in`),
          fetch(`${API_BASE_URL}/api/accounting/ledger?${rangeQuery}&limit=300`),
          fetch(`${API_BASE_URL}/api/acct/accounts`),
          fetch(`${API_BASE_URL}/api/acct/categories`),
          fetch(`${API_BASE_URL}/api/acct/entries?${rangeQuery}`),
          fetch(`${API_BASE_URL}/api/accounting/revenue-summary?${rangeQuery}`),
        ]);

        const salesPayload = await salesRes.json();
        const productsPayload = await productsRes.json();
        const stockInPayload = await stockInRes.json();
        const ledgerPayload = await ledgerRes.json();
        const accountsPayload = await accountsRes.json();
        const accountingCategoriesPayload = await accountingCategoriesRes.json();
        const accountingEntriesPayload = await accountingEntriesRes.json();
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
        if (!accountsRes.ok) {
          throw new Error(accountsPayload.message || "Failed to load account-wise report.");
        }
        if (!accountingCategoriesRes.ok) {
          throw new Error(accountingCategoriesPayload.message || "Failed to load category report.");
        }
        if (!accountingEntriesRes.ok) {
          throw new Error(accountingEntriesPayload.message || "Failed to load entry-level report.");
        }
        if (!revenueSummaryRes.ok) {
          throw new Error(revenueSummaryPayload.message || "Failed to load revenue summary.");
        }

        setSales(salesPayload.data || []);
        setProducts(productsPayload.data || []);
        setStockIn(stockInPayload.data || []);
        setLedgerRows(ledgerPayload.data || []);
        setAccounts(accountsPayload.data || []);
        setAccountingCategories(accountingCategoriesPayload.data || []);
        setAccountingEntries(accountingEntriesPayload.data || []);
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

  const accountWiseReport = useMemo(
    () =>
      [...accounts]
        .sort((a, b) => Number(b.currentBalance || 0) - Number(a.currentBalance || 0))
        .map((account) => ({
          id: account.id,
          name: account.name || "-",
          openingBalance: Number(account.openingBalance || 0),
          totalIn: Number(account.totalIn || 0),
          totalOut: Number(account.totalOut || 0),
          currentBalance: Number(account.currentBalance || 0),
          status: account.status || "active",
        })),
    [accounts]
  );

  const categoryWiseIncomeExpenseReport = useMemo(() => {
    const categoryMap = new Map(
      accountingCategories.map((category) => [category.id, { name: category.name, type: category.type }])
    );
    const grouped = new Map();

    accountingEntries.forEach((entry) => {
      const categoryId = entry.categoryId || "uncategorized";
      const fallback = categoryMap.get(categoryId) || {
        name: entry.categoryName || "Uncategorized",
        type: entry.type || "expense",
      };
      const key = `${fallback.type}-${categoryId}`;
      const current = grouped.get(key) || {
        key,
        categoryName: fallback.name,
        type: fallback.type,
        entryCount: 0,
        totalAmount: 0,
      };
      current.entryCount += 1;
      current.totalAmount += Number(entry.amount || 0);
      grouped.set(key, current);
    });

    return [...grouped.values()]
      .sort((a, b) => {
        if (a.type === b.type) {
          return b.totalAmount - a.totalAmount;
        }
        return a.type.localeCompare(b.type);
      })
      .map((entry) => ({
        ...entry,
        totalAmount: Number(entry.totalAmount.toFixed(2)),
      }));
  }, [accountingEntries, accountingCategories]);

  const entryLevelAccountingReport = useMemo(
    () =>
      [...accountingEntries]
        .sort((a, b) => {
          const aTime = new Date(a.createdAt || a.date || 0).getTime();
          const bTime = new Date(b.createdAt || b.date || 0).getTime();
          return bTime - aTime;
        })
        .map((entry) => ({
          id: entry.id,
          date: entry.date,
          type: entry.type,
          accountName: entry.accountName || "-",
          categoryName: entry.categoryName || "-",
          amount: Number(entry.amount || 0),
          remarks: entry.remarks || "",
        })),
    [accountingEntries]
  );

  useEffect(() => {
    if (!selectedAccountId && accounts.length > 0) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  useEffect(() => {
    const loadAccountDrilldown = async () => {
      if (!selectedAccountId) {
        setAccountDetail(null);
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/acct/accounts/${selectedAccountId}/detail?${rangeQuery}`
        );
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.message || "Failed to load account drill-down report.");
        }
        setAccountDetail({
          account: payload.account || null,
          entries: payload.entries || [],
        });
      } catch (error) {
        setStatus({ state: "error", message: error.message || "Failed to load account drill-down report." });
        setAccountDetail(null);
      }
    };

    loadAccountDrilldown();
  }, [selectedAccountId, rangeQuery]);

  const dailySalesTotal = dailySales.reduce((sum, entry) => sum + Number(entry.grandTotal || 0), 0);

  const paginateRows = (rows, key) => {
    const totalRows = rows.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / reportRowsPerPage));
    const currentPage = Math.min(reportPages[key] || 1, totalPages);
    const startIndex = (currentPage - 1) * reportRowsPerPage;
    const pageRows = rows.slice(startIndex, startIndex + reportRowsPerPage);

    return {
      rows: pageRows,
      currentPage,
      totalPages,
      totalRows,
      start: totalRows === 0 ? 0 : startIndex + 1,
      end: Math.min(startIndex + reportRowsPerPage, totalRows),
    };
  };

  const updateReportPage = (key, page) => {
    setReportPages((prev) => ({ ...prev, [key]: page }));
  };

  const openAccountDrilldown = (accountId) => {
    setSelectedAccountId(accountId);
    setIsAccountDrilldownModalOpen(true);
  };

  const closeAccountDrilldownModal = () => {
    setIsAccountDrilldownModalOpen(false);
  };

  const renderReportPagination = (key, meta) => {
    if (meta.totalRows === 0) {
      return null;
    }

    return (
      <div className="category-pagination">
        <span className="tag">
          Showing {meta.start}-{meta.end} of {meta.totalRows}
        </span>
        <div className="category-pagination-controls">
          <button
            type="button"
            className="category-page-btn icon"
            onClick={() => updateReportPage(key, Math.max(1, meta.currentPage - 1))}
            disabled={meta.currentPage === 1}
            aria-label="Previous page"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          {Array.from({ length: meta.totalPages }, (_, index) => index + 1).map((page) => (
            <button
              key={`${key}-page-${page}`}
              type="button"
              className={`category-page-btn ${page === meta.currentPage ? "active" : ""}`.trim()}
              onClick={() => updateReportPage(key, page)}
              aria-current={page === meta.currentPage ? "page" : undefined}
            >
              {page}
            </button>
          ))}
          <button
            type="button"
            className="category-page-btn icon"
            onClick={() => updateReportPage(key, Math.min(meta.totalPages, meta.currentPage + 1))}
            disabled={meta.currentPage === meta.totalPages}
            aria-label="Next page"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      </div>
    );
  };

  const salesDailyPage = paginateRows(dailySales, "salesDaily");
  const salesDateRangePage = paginateRows(dateRangeSalesReport, "salesDateRange");
  const salesPaymentModePage = paginateRows(paymentModeReport, "salesPaymentMode");
  const stockCurrentPage = paginateRows(currentStockReport, "stockCurrent");
  const stockLowPage = paginateRows(lowStockReport, "stockLow");
  const stockInSupplierPage = paginateRows(supplierWisePurchase, "stockInSupplier");
  const stockInDatePage = paginateRows(dateWisePurchase, "stockInDate");
  const accountingLedgerPage = paginateRows(ledgerRows, "accountingLedger");
  const accountingAccountWisePage = paginateRows(accountWiseReport, "accountingAccountWise");
  const accountingCategoryWisePage = paginateRows(
    categoryWiseIncomeExpenseReport,
    "accountingCategoryWise"
  );
  const accountingEntryLevelPage = paginateRows(entryLevelAccountingReport, "accountingEntryLevel");
  const accountingAccountDrilldownPage = paginateRows(
    accountDetail?.entries || [],
    "accountingAccountDrilldown"
  );

  useEffect(() => {
    setReportPages((prev) => ({
      ...prev,
      salesDaily: Math.min(prev.salesDaily, Math.max(1, Math.ceil(dailySales.length / reportRowsPerPage))),
      salesDateRange: Math.min(prev.salesDateRange, Math.max(1, Math.ceil(dateRangeSalesReport.length / reportRowsPerPage))),
      salesPaymentMode: Math.min(prev.salesPaymentMode, Math.max(1, Math.ceil(paymentModeReport.length / reportRowsPerPage))),
      stockCurrent: Math.min(prev.stockCurrent, Math.max(1, Math.ceil(currentStockReport.length / reportRowsPerPage))),
      stockLow: Math.min(prev.stockLow, Math.max(1, Math.ceil(lowStockReport.length / reportRowsPerPage))),
      stockInSupplier: Math.min(prev.stockInSupplier, Math.max(1, Math.ceil(supplierWisePurchase.length / reportRowsPerPage))),
      stockInDate: Math.min(prev.stockInDate, Math.max(1, Math.ceil(dateWisePurchase.length / reportRowsPerPage))),
      accountingLedger: Math.min(prev.accountingLedger, Math.max(1, Math.ceil(ledgerRows.length / reportRowsPerPage))),
      accountingAccountWise: Math.min(
        prev.accountingAccountWise,
        Math.max(1, Math.ceil(accountWiseReport.length / reportRowsPerPage))
      ),
      accountingCategoryWise: Math.min(
        prev.accountingCategoryWise,
        Math.max(1, Math.ceil(categoryWiseIncomeExpenseReport.length / reportRowsPerPage))
      ),
      accountingEntryLevel: Math.min(
        prev.accountingEntryLevel,
        Math.max(1, Math.ceil(entryLevelAccountingReport.length / reportRowsPerPage))
      ),
      accountingAccountDrilldown: Math.min(
        prev.accountingAccountDrilldown,
        Math.max(1, Math.ceil((accountDetail?.entries || []).length / reportRowsPerPage))
      ),
    }));
  }, [
    dailySales.length,
    dateRangeSalesReport.length,
    paymentModeReport.length,
    currentStockReport.length,
    lowStockReport.length,
    supplierWisePurchase.length,
    dateWisePurchase.length,
    ledgerRows.length,
    accountWiseReport.length,
    categoryWiseIncomeExpenseReport.length,
    entryLevelAccountingReport.length,
    accountDetail?.entries?.length,
  ]);

  return (
    <div className="product-page accounting-page reports-page">
      <div className="product-header">


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
                  {salesDailyPage.totalRows === 0 ? (
                    <div className="table-row empty">
                      <span>No sales found for selected day.</span>
                    </div>
                  ) : (
                    salesDailyPage.rows.map((entry) => (
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
                {renderReportPagination("salesDaily", salesDailyPage)}
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
                  {salesDateRangePage.totalRows === 0 ? (
                    <div className="table-row empty">
                      <span>No sales found in selected range.</span>
                    </div>
                  ) : (
                    salesDateRangePage.rows.map((entry) => (
                      <div className="table-row report-date-sales-row" key={entry.date}>
                        <span>{entry.date}</span>
                        <span>{formatCount(entry.invoiceCount)}</span>
                        <span>{formatCount(entry.itemCount)}</span>
                        <span>{formatInr.format(entry.totalSales || 0)}</span>
                      </div>
                    ))
                  )}
                </div>
                {renderReportPagination("salesDateRange", salesDateRangePage)}
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
                  {salesPaymentModePage.totalRows === 0 ? (
                    <div className="table-row empty">
                      <span>No payment mode data found.</span>
                    </div>
                  ) : (
                    salesPaymentModePage.rows.map((entry) => (
                      <div className="table-row report-mode-row" key={entry.method}>
                        <span>{formatMethod(entry.method)}</span>
                        <span>{formatCount(entry.invoiceCount)}</span>
                        <span>{formatInr.format(entry.totalSales || 0)}</span>
                      </div>
                    ))
                  )}
                </div>
                {renderReportPagination("salesPaymentMode", salesPaymentModePage)}
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
                  {stockCurrentPage.totalRows === 0 ? (
                    <div className="table-row empty">
                      <span>No stock records found.</span>
                    </div>
                  ) : (
                    stockCurrentPage.rows.map((entry) => (
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
                {renderReportPagination("stockCurrent", stockCurrentPage)}
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
                  {stockLowPage.totalRows === 0 ? (
                    <div className="table-row empty">
                      <span>No low stock products found.</span>
                    </div>
                  ) : (
                    stockLowPage.rows.map((entry) => (
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
                {renderReportPagination("stockLow", stockLowPage)}
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
                  {stockInSupplierPage.totalRows === 0 ? (
                    <div className="table-row empty">
                      <span>No supplier purchase data found.</span>
                    </div>
                  ) : (
                    stockInSupplierPage.rows.map((entry) => (
                      <div className="table-row report-purchase-row" key={entry.supplierName}>
                        <span>{entry.supplierName}</span>
                        <span>{formatCount(entry.entries)}</span>
                        <span>{formatInr.format(entry.totalPurchase || 0)}</span>
                      </div>
                    ))
                  )}
                </div>
                {renderReportPagination("stockInSupplier", stockInSupplierPage)}
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
                  {stockInDatePage.totalRows === 0 ? (
                    <div className="table-row empty">
                      <span>No date-wise purchase data found.</span>
                    </div>
                  ) : (
                    stockInDatePage.rows.map((entry) => (
                      <div className="table-row report-purchase-row" key={entry.date}>
                        <span>{entry.date}</span>
                        <span>{formatCount(entry.entries)}</span>
                        <span>{formatInr.format(entry.totalPurchase || 0)}</span>
                      </div>
                    ))
                  )}
                </div>
                {renderReportPagination("stockInDate", stockInDatePage)}
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
                className={`tab-btn ${accountingReportTab === "entry-level" ? "active" : ""}`}
                onClick={() => setAccountingReportTab("entry-level")}
              >
                Entry-level Detail
              </button>
              <button
                type="button"
                className={`tab-btn ${accountingReportTab === "account-wise" ? "active" : ""}`}
                onClick={() => setAccountingReportTab("account-wise")}
              >
                Account-wise Report
              </button>
              <button
                type="button"
                className={`tab-btn ${accountingReportTab === "category-wise" ? "active" : ""}`}
                onClick={() => setAccountingReportTab("category-wise")}
              >
                Category-wise I/E
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
                  {accountingLedgerPage.totalRows === 0 ? (
                    <div className="table-row empty">
                      <span>No ledger records found.</span>
                    </div>
                  ) : (
                    accountingLedgerPage.rows.map((entry) => (
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
                {renderReportPagination("accountingLedger", accountingLedgerPage)}
              </>
            )}

            {accountingReportTab === "account-wise" && (
              <>
                <p className="card-label">Account-wise Detailed Report</p>
                <div className="table">
                  <div className="table-row header report-account-wise-row">
                    <span>Account</span>
                    <span>Opening</span>
                    <span>Total In</span>
                    <span>Total Out</span>
                    <span>Current Balance</span>
                    <span>Status</span>
                  </div>
                  {accountingAccountWisePage.totalRows === 0 ? (
                    <div className="table-row empty">
                      <span>No account records found.</span>
                    </div>
                  ) : (
                    accountingAccountWisePage.rows.map((entry) => (
                      <div className="table-row report-account-wise-row" key={entry.id}>
                        <span>
                          <button
                            type="button"
                            className="report-account-link-btn"
                            onClick={() => openAccountDrilldown(entry.id)}
                          >
                            {entry.name}
                          </button>
                        </span>
                        <span>{formatInr.format(entry.openingBalance || 0)}</span>
                        <span>{formatInr.format(entry.totalIn || 0)}</span>
                        <span>{formatInr.format(entry.totalOut || 0)}</span>
                        <span>{formatInr.format(entry.currentBalance || 0)}</span>
                        <span>{entry.status}</span>
                      </div>
                    ))
                  )}
                </div>
                {renderReportPagination("accountingAccountWise", accountingAccountWisePage)}
              </>
            )}

            {accountingReportTab === "category-wise" && (
              <>
                <p className="card-label">Category-wise Income / Expense Report</p>
                <div className="table">
                  <div className="table-row header report-category-wise-row">
                    <span>Category</span>
                    <span>Type</span>
                    <span>Entries</span>
                    <span>Total Amount</span>
                  </div>
                  {accountingCategoryWisePage.totalRows === 0 ? (
                    <div className="table-row empty">
                      <span>No category-wise data found.</span>
                    </div>
                  ) : (
                    accountingCategoryWisePage.rows.map((entry) => (
                      <div className="table-row report-category-wise-row" key={entry.key}>
                        <span>{entry.categoryName}</span>
                        <span>{formatMethod(entry.type)}</span>
                        <span>{formatCount(entry.entryCount)}</span>
                        <span>{formatInr.format(entry.totalAmount || 0)}</span>
                      </div>
                    ))
                  )}
                </div>
                {renderReportPagination("accountingCategoryWise", accountingCategoryWisePage)}
              </>
            )}

            {accountingReportTab === "entry-level" && (
              <>
                <p className="card-label">Entry-level Detailed Report</p>
                <div className="table">
                  <div className="table-row header report-entry-level-row">
                    <span>Date</span>
                    <span>Type</span>
                    <span>Account</span>
                    <span>Category</span>
                    <span>Amount</span>
                  </div>
                  {accountingEntryLevelPage.totalRows === 0 ? (
                    <div className="table-row empty">
                      <span>No accounting entries found.</span>
                    </div>
                  ) : (
                    accountingEntryLevelPage.rows.map((entry) => (
                      <div className="table-row report-entry-level-row" key={entry.id}>
                        <span>{toDateInput(entry.date)}</span>
                        <span>{formatMethod(entry.type)}</span>
                        <span>{entry.accountName}</span>
                        <span>{entry.categoryName}</span>
                        <span>{formatInr.format(entry.amount || 0)}</span>
                      </div>
                    ))
                  )}
                </div>
                {renderReportPagination("accountingEntryLevel", accountingEntryLevelPage)}
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

          </section>
        )}
      </div>

      {isAccountDrilldownModalOpen && (
        <div className="acc-modal-overlay" onClick={closeAccountDrilldownModal}>
          <div className="acc-modal report-drilldown-modal" onClick={(event) => event.stopPropagation()}>
            <div className="acc-modal-head">
              <div className="report-drilldown-title">
                <h3>Account Detail Drill-down</h3>
                <p>Detailed movement summary for the selected account</p>
              </div>
              <button
                type="button"
                className="acc-modal-close"
                onClick={closeAccountDrilldownModal}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="acc-modal-body report-drilldown-body">
              {accountDetail?.account && (
                <section className="kpi-grid report-drilldown-summary">
                  <article className="card">
                    <p className="card-label">Opening Balance</p>
                    <h3>{formatInr.format(accountDetail.account.openingBalance || 0)}</h3>
                  </article>
                  <article className="card">
                    <p className="card-label">Total In</p>
                    <h3>{formatInr.format(accountDetail.account.totalIn || 0)}</h3>
                  </article>
                  <article className="card">
                    <p className="card-label">Total Out</p>
                    <h3>{formatInr.format(accountDetail.account.totalOut || 0)}</h3>
                  </article>
                  <article className="card">
                    <p className="card-label">Current Balance</p>
                    <h3>{formatInr.format(accountDetail.account.currentBalance || 0)}</h3>
                  </article>
                </section>
              )}

              <div className="table report-drilldown-table">
                <div className="table-row header report-account-drill-row">
                  <span>Date</span>
                  <span>Type</span>
                  <span>Category</span>
                  <span>Amount</span>
                  <span>Created</span>
                </div>
                {accountingAccountDrilldownPage.totalRows === 0 ? (
                  <div className="table-row empty">
                    <span>No account drill-down entries found.</span>
                  </div>
                ) : (
                  accountingAccountDrilldownPage.rows.map((entry) => (
                    <div className="table-row report-account-drill-row" key={entry.id}>
                      <span>{toDateInput(entry.date)}</span>
                      <span>{formatMethod(entry.type)}</span>
                      <span>{entry.categoryName || "-"}</span>
                      <span>{formatInr.format(entry.amount || 0)}</span>
                      <span>{toDateInput(entry.createdAt)}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="report-drilldown-pagination">
                {renderReportPagination("accountingAccountDrilldown", accountingAccountDrilldownPage)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
