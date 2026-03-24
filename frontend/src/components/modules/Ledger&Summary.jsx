import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = `http://${window.location.hostname}:4000`;

const currency = new Intl.NumberFormat("en-IN", {
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

export default function Accounting() {
  const ledgerRowsPerPage = 20;
  const [fromDate, setFromDate] = useState(firstDayOfMonth());
  const [toDate, setToDate] = useState(toDateInput(new Date()));
  const [cashDate, setCashDate] = useState(toDateInput(new Date()));

  const [summary, setSummary] = useState({
    totalSalesRevenue: 0,
    totalPurchaseCost: 0,
    totalExtraExpenses: 0,
    grossProfit: 0,
  });
  const [cashCount, setCashCount] = useState({
    dailyCashSales: 0,
    cardSales: 0,
    upiSales: 0,
    totalCollection: 0,
  });
  const [ledgerRows, setLedgerRows] = useState([]);

  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [ledgerPage, setLedgerPage] = useState(1);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (fromDate) {
      params.set("fromDate", fromDate);
    }
    if (toDate) {
      params.set("toDate", toDate);
    }
    return params.toString();
  }, [fromDate, toDate]);

  const loadAccounting = async () => {
    setIsLoading(true);
    setStatus({ state: "idle", message: "" });

    try {
      const [summaryRes, ledgerRes, cashRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/accounting/revenue-summary?${query}`),
        fetch(`${API_BASE_URL}/api/accounting/ledger?${query}&limit=300`),
        fetch(`${API_BASE_URL}/api/accounting/cash-count?date=${encodeURIComponent(cashDate)}`),
      ]);

      const summaryPayload = await summaryRes.json();
      const ledgerPayload = await ledgerRes.json();
      const cashPayload = await cashRes.json();

      if (!summaryRes.ok) {
        throw new Error(summaryPayload.message || "Failed to load revenue summary.");
      }
      if (!ledgerRes.ok) {
        throw new Error(ledgerPayload.message || "Failed to load ledger.");
      }
      if (!cashRes.ok) {
        throw new Error(cashPayload.message || "Failed to load cash report.");
      }

      setSummary(summaryPayload.summary || {
        totalSalesRevenue: 0,
        totalPurchaseCost: 0,
        totalExtraExpenses: 0,
        grossProfit: 0,
      });
      setLedgerRows(ledgerPayload.data || []);
      setCashCount(cashPayload.report || {  
        dailyCashSales: 0,
        cardSales: 0,
        upiSales: 0,
        totalCollection: 0,
      });
    } catch (error) {
      setStatus({ state: "error", message: error.message || "Failed to load accounting data." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAccounting();
  }, [query, cashDate]);

  const ledgerTotalPages = Math.max(1, Math.ceil(ledgerRows.length / ledgerRowsPerPage));
  const paginatedLedgerRows = ledgerRows.slice(
    (ledgerPage - 1) * ledgerRowsPerPage,
    ledgerPage * ledgerRowsPerPage
  );

  useEffect(() => {
    setLedgerPage(1);
  }, [query, cashDate]);

  useEffect(() => {
    if (ledgerPage > ledgerTotalPages) {
      setLedgerPage(ledgerTotalPages);
    }
  }, [ledgerPage, ledgerTotalPages]);

  return (
    <div className="product-page accounting-page">
      <div className="product-header">
        

        <div className="accounting-filters card">
          <div className="accounting-filter-row">
            <label className="product-field">
              <span>From Date</span>
              <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </label>
            <label className="product-field">
              <span>To Date</span>
              <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </label>
            <label className="product-field">
              <span>Cash Count Date</span>
              <input type="date" value={cashDate} onChange={(event) => setCashDate(event.target.value)} />
            </label>
          </div>
        </div>

        {status.state !== "idle" && <p className={`status ${status.state}`}>{status.message}</p>}
      </div>

      {isLoading && <div className="alert">Loading accounting data...</div>}

      <div className="stack">
        <section className="kpi-grid">
          <article className="card">
            <p className="card-label">Total Sales Revenue</p>
            <h3>{currency.format(summary.totalSalesRevenue || 0)}</h3>
          </article>
          <article className="card">
            <p className="card-label">Total Purchase Cost</p>
            <h3>{currency.format(summary.totalPurchaseCost || 0)}</h3>
          </article>
          <article className="card">
            <p className="card-label">Total Extra Expenses</p>
            <h3>{currency.format(summary.totalExtraExpenses || 0)}</h3>
          </article>
          <article className="card">
            <p className="card-label">Gross Profit</p>
            <h3>{currency.format(summary.grossProfit || 0)}</h3>
          </article>
        </section>

        <section className="kpi-grid">
          <article className="card">
            <p className="card-label">Daily Cash Sales</p>
            <h3>{currency.format(cashCount.dailyCashSales || 0)}</h3>
          </article>
          <article className="card">
            <p className="card-label">Card Sales</p>
            <h3>{currency.format(cashCount.cardSales || 0)}</h3>
          </article>
          <article className="card">
            <p className="card-label">UPI Sales</p>
            <h3>{currency.format(cashCount.upiSales || 0)}</h3>
          </article>
          <article className="card">
            <p className="card-label">Total Collection</p>
            <h3>{currency.format(cashCount.totalCollection || 0)}</h3>
          </article>
        </section>

        <section className="card">
            <div className="card-head">
              <h3>Ledger</h3>
            </div>
            <div className="table">
              <div className="table-row header ledger-row">
                <span>Date</span>
                <span>Type</span>
                <span>Reference</span>
                <span>Debit</span>
                <span>Credit</span>
                <span>Balance</span>
              </div>

              {ledgerRows.length === 0 ? (
                <div className="table-row empty">
                  <span>No ledger transactions found for selected range.</span>
                </div>
              ) : (
                paginatedLedgerRows.map((entry) => (
                  <div className="table-row ledger-row" key={entry.id || entry.ledger_id}>
                    <span>{toDateInput(entry.date)}</span>
                    <span>{entry.reference_type}</span>
                    <span>{entry.reference_id}</span>
                    <span>{currency.format(entry.debit_amount || 0)}</span>
                    <span>{currency.format(entry.credit_amount || 0)}</span>
                    <span>{currency.format(entry.balance_after || 0)}</span>
                  </div>
                ))
              )}
            </div>

            {ledgerRows.length > 0 && (
              <div className="category-pagination">
                <span className="tag">
                  Showing {(ledgerPage - 1) * ledgerRowsPerPage + 1}-
                  {Math.min(ledgerPage * ledgerRowsPerPage, ledgerRows.length)} of {ledgerRows.length}
                </span>
                <div className="category-pagination-controls">
                  <button
                    type="button"
                    className="category-page-btn icon"
                    onClick={() => setLedgerPage((prev) => Math.max(1, prev - 1))}
                    disabled={ledgerPage === 1}
                    aria-label="Previous page"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                  </button>
                  {Array.from({ length: ledgerTotalPages }, (_, index) => index + 1).map((page) => (
                    <button
                      key={`ledger-page-${page}`}
                      type="button"
                      className={`category-page-btn ${page === ledgerPage ? "active" : ""}`.trim()}
                      onClick={() => setLedgerPage(page)}
                      aria-current={page === ledgerPage ? "page" : undefined}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="category-page-btn icon"
                    onClick={() => setLedgerPage((prev) => Math.min(ledgerTotalPages, prev + 1))}
                    disabled={ledgerPage === ledgerTotalPages}
                    aria-label="Next page"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                </div>
              </div>
            )}
        </section>
      </div>
    </div>
  );
}
