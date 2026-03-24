import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL = `http://${window.location.hostname}:4000`;

const fmt = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const toDateStr = (v) => {
  const d = v ? new Date(v) : new Date();
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
};

const firstDayOfMonth = () => {
  const d = new Date();
  d.setDate(1);
  return toDateStr(d);
};

// ─── SVG Icons ───────────────────────────────────────────────────────────────
const ChevronLeft = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const ChevronRight = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const ArrowLeft = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
);
const IconIncome = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);
const IconExpense = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
    <polyline points="17 18 23 18 23 12" />
  </svg>
);
const IconAccount = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <line x1="2" y1="10" x2="22" y2="10" />
  </svg>
);
const IconCategory = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.59 13.41 11 3H4v7l9.59 9.59a2 2 0 0 0 2.82 0l4.18-4.18a2 2 0 0 0 0-2.82Z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);
const IconExport = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);
const IconReset = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="1 4 1 10 7 10" />
    <polyline points="23 20 23 14 17 14" />
    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
  </svg>
);
const IconEdit = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);
const IconTrash = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const ROWS_PER_PAGE = 20;

// ─── Pagination ───────────────────────────────────────────────────────────────
function Pagination({ page, totalPages, total, perPage, onChange }) {
  if (total === 0) return null;
  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  return (
    <div className="acc-pagination">
      <span className="acc-page-info">Showing {from}–{to} of {total}</span>
      <div className="acc-page-controls">
        <button type="button" className="category-page-btn icon" onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1} aria-label="Previous">
          <ChevronLeft />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button key={p} type="button" className={`category-page-btn ${p === page ? "active" : ""}`.trim()} onClick={() => onChange(p)}>{p}</button>
        ))}
        <button type="button" className="category-page-btn icon" onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} aria-label="Next">
          <ChevronRight />
        </button>
      </div>
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="acc-modal-overlay" onClick={onCancel}>
      <div className="acc-modal acc-modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="acc-modal-head">
          <h3>Confirm Delete</h3>
          <button type="button" className="acc-modal-close" onClick={onCancel} aria-label="Close">✕</button>
        </div>
        <div className="acc-modal-body">
          <p style={{ margin: "0 0 24px", color: "var(--muted)" }}>{message}</p>
          <div className="acc-modal-actions">
            <button type="button" className="acc-btn-secondary" onClick={onCancel}>Cancel</button>
            <button type="button" className="acc-btn-danger" onClick={onConfirm}>Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Entry Modal ──────────────────────────────────────────────────────────────
function EntryModal({ entry, accounts, categories, initialType = "income", onClose, onSave }) {
  const [form, setForm] = useState({
    type: entry?.type || initialType,
    accountId: entry?.accountId || "",
    categoryId: entry?.categoryId || "",
    amount: entry?.amount ?? "",
    date: entry ? toDateStr(entry.date) : toDateStr(new Date()),
    remarks: entry?.remarks || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === form.type && c.status === "active"),
    [categories, form.type]
  );
  const activeAccounts = useMemo(() => accounts.filter((a) => a.status === "active"), [accounts]);

  const switchType = (t) => {
    setForm((prev) => ({ ...prev, type: t, categoryId: "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const effectiveDate = entry ? toDateStr(entry.date) : form.date;
    if (!form.accountId) { setError("Account is required."); return; }
    if (!form.categoryId) { setError("Category is required."); return; }
    const amount = Number(form.amount);
    if (!amount || amount <= 0) { setError("Amount must be greater than zero."); return; }
    if (!effectiveDate) { setError("Date is required."); return; }

    setSaving(true);
    try {
      const url = entry
        ? `${API_BASE_URL}/api/acct/entries/${entry.id}`
        : `${API_BASE_URL}/api/acct/entries`;
      const res = await fetch(url, {
        method: entry ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, date: effectiveDate, amount }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Failed to save entry."); return; }
      onSave();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const title = entry ? "Edit Entry" : form.type === "income" ? "Add Income" : "Add Expense";

  return (
    <div className="acc-modal-overlay" onClick={onClose}>
      <div className="acc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="acc-modal-head">
          <h3>{title}</h3>
          <button type="button" className="acc-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="acc-modal-body">
          {!entry && (
            <div className="acc-type-toggle">
              <button type="button" className={`acc-type-btn ${form.type === "income" ? "income active" : ""}`.trim()} onClick={() => switchType("income")}>
                Income
              </button>
              <button type="button" className={`acc-type-btn ${form.type === "expense" ? "expense active" : ""}`.trim()} onClick={() => switchType("expense")}>
                Expense
              </button>
            </div>
          )}
          <div className="acc-form-grid">
            <label className="acc-field">
              <span>Account *</span>
              <select value={form.accountId} onChange={set("accountId")} required>
                <option value="">— Select Account —</option>
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
            <label className="acc-field">
              <span>Category *</span>
              <select value={form.categoryId} onChange={set("categoryId")} required>
                <option value="">— Select Category —</option>
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="acc-field">
              <span>Amount (₹) *</span>
              <input type="number" step="0.01" min="0.01" value={form.amount} onChange={set("amount")} placeholder="0.00" required />
            </label>
            <label className="acc-field">
              <span>Date *</span>
              <input type="date" value={form.date} onChange={set("date")} required disabled={Boolean(entry)} />
            </label>
            <label className="acc-field acc-field-full">
              <span>Remarks</span>
              <input type="text" value={form.remarks} onChange={set("remarks")} placeholder="Optional notes…" maxLength={200} />
            </label>
          </div>
          {error && <p className="acc-form-error">{error}</p>}
          <div className="acc-modal-actions">
            <button type="button" className="acc-btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className={`acc-btn-primary ${form.type}`} disabled={saving}>
              {saving ? "Saving…" : entry ? "Update Entry" : "Save Entry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Account Modal ────────────────────────────────────────────────────────────
function AccountModal({ account, onClose, onSave }) {
  const [form, setForm] = useState({
    name: account?.name || "",
    openingBalance: account?.openingBalance ?? "",
    status: account?.status || "active",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) { setError("Account name is required."); return; }
    setSaving(true);
    try {
      const url = account
        ? `${API_BASE_URL}/api/acct/accounts/${account.id}`
        : `${API_BASE_URL}/api/acct/accounts`;
      const res = await fetch(url, {
        method: account ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, openingBalance: Number(form.openingBalance) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Failed to save account."); return; }
      onSave();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="acc-modal-overlay" onClick={onClose}>
      <div className="acc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="acc-modal-head">
          <h3>{account ? "Edit Account" : "Add Account"}</h3>
          <button type="button" className="acc-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="acc-modal-body">
          <div className="acc-form-grid">
            <label className="acc-field acc-field-full">
              <span>Account Name *</span>
              <input type="text" value={form.name} onChange={set("name")} placeholder="e.g. Cash, Bank, Petty Cash" required />
            </label>
            <label className="acc-field">
              <span>Opening Balance (₹)</span>
              <input type="number" step="0.01" min="0" value={form.openingBalance} onChange={set("openingBalance")} placeholder="0.00" />
            </label>
            <label className="acc-field">
              <span>Status</span>
              <select value={form.status} onChange={set("status")}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>
          {error && <p className="acc-form-error">{error}</p>}
          <div className="acc-modal-actions">
            <button type="button" className="acc-btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="acc-btn-primary" disabled={saving}>
              {saving ? "Saving…" : account ? "Update Account" : "Save Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Category Modal ───────────────────────────────────────────────────────────
function CategoryModal({ category, onClose, onSave }) {
  const [form, setForm] = useState({
    name: category?.name || "",
    type: category?.type || "income",
    status: category?.status || "active",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) { setError("Category name is required."); return; }
    setSaving(true);
    try {
      const url = category
        ? `${API_BASE_URL}/api/acct/categories/${category.id}`
        : `${API_BASE_URL}/api/acct/categories`;
      const res = await fetch(url, {
        method: category ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Failed to save category."); return; }
      onSave();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="acc-modal-overlay" onClick={onClose}>
      <div className="acc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="acc-modal-head">
          <h3>{category ? "Edit Category" : "Add Category"}</h3>
          <button type="button" className="acc-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="acc-modal-body">
          <div className="acc-form-grid">
            <label className="acc-field acc-field-full">
              <span>Category Name *</span>
              <input type="text" value={form.name} onChange={set("name")} placeholder="e.g. Salary, Rent, Utilities" required />
            </label>
            <label className="acc-field">
              <span>Type *</span>
              <select value={form.type} onChange={set("type")} disabled={!!category}>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </label>
            <label className="acc-field">
              <span>Status</span>
              <select value={form.status} onChange={set("status")}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>
          {error && <p className="acc-form-error">{error}</p>}
          <div className="acc-modal-actions">
            <button type="button" className="acc-btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="acc-btn-primary" disabled={saving}>
              {saving ? "Saving…" : category ? "Update Category" : "Save Category"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Account Detail View ──────────────────────────────────────────────────────
function AccountDetail({ accountId, allCategories, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const [fromDate, setFromDate] = useState(firstDayOfMonth());
  const [toDate, setToDate] = useState(toDateStr(new Date()));
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("");

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (fromDate) p.set("fromDate", fromDate);
    if (toDate) p.set("toDate", toDate);
    if (typeFilter !== "all") p.set("type", typeFilter);
    if (categoryFilter) p.set("categoryId", categoryFilter);
    return p.toString();
  }, [fromDate, toDate, typeFilter, categoryFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/acct/accounts/${accountId}/detail?${query}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to load account detail.");
      setData(json);
      setPage(1);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [accountId, query]);

  useEffect(() => { load(); }, [load]);

  const entries = data?.entries || [];
  const account = data?.account || {};
  const totalPages = Math.max(1, Math.ceil(entries.length / ROWS_PER_PAGE));
  const pageEntries = entries.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const resetFilters = () => {
    setFromDate(firstDayOfMonth());
    setToDate(toDateStr(new Date()));
    setTypeFilter("all");
    setCategoryFilter("");
  };

  return (
    <div className="acc-tab-content acc-account-scroll">
      {/* Back + Title */}
      <div className="acc-detail-header">
        <button type="button" className="acc-back-btn" onClick={onBack}>
          <ArrowLeft /> Back to Accounts
        </button>
        <div className="acc-detail-title">
          <h2>{account.name || "Account Detail"}</h2>
          <span className={`acc-status-badge ${account.status}`}>{account.status}</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="acc-summary-grid acc-summary-grid-5">
        <div className="acc-summary-card">
          <span className="acc-summary-label">Opening Balance</span>
          <span className="acc-summary-value plain">{fmt.format(account.openingBalance || 0)}</span>
        </div>
        <div className="acc-summary-card income">
          <span className="acc-summary-label">Total In</span>
          <span className="acc-summary-value">{fmt.format(account.totalIn || 0)}</span>
        </div>
        <div className="acc-summary-card expense">
          <span className="acc-summary-label">Total Out</span>
          <span className="acc-summary-value">{fmt.format(account.totalOut || 0)}</span>
        </div>
        <div className="acc-summary-card net">
          <span className="acc-summary-label">Current Balance</span>
          <span className={`acc-summary-value ${(account.currentBalance || 0) >= 0 ? "income" : "expense"}`}>
            {fmt.format(account.currentBalance || 0)}
          </span>
        </div>
        <div className="acc-summary-card">
          <span className="acc-summary-label">Total Entries</span>
          <span className="acc-summary-value plain">{account.totalEntryCount || 0}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="acc-action-bar acc-action-bar-filters-only">
        <div className="acc-filter-group">
          <input type="date" className="acc-date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} title="From Date" />
          <input type="date" className="acc-date" value={toDate} onChange={(e) => setToDate(e.target.value)} title="To Date" />
          <select className="acc-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <select className="acc-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All Categories</option>
            {allCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
            ))}
          </select>
          <button type="button" className="btn-secondary acc-icon-only-btn acc-reset-btn" onClick={resetFilters} aria-label="Reset filters" title="Reset filters">
            <span className="acc-btn-icon"><IconReset /></span>
          </button>
        </div>
      </div>

      {error && <p className="acc-error">{error}</p>}
      {loading && <div className="acc-loading">Loading entries…</div>}

      {!loading && (
        <div className="acc-table-card">
          <div className="acc-table acc-table-detail">
            <div className="acc-table-head">
              <span>Date</span>
              <span>Type</span>
              <span>Category</span>
              <span>Amount</span>
            </div>
            {pageEntries.length === 0 ? (
              <div className="acc-table-empty">No entries found for the selected filters.</div>
            ) : pageEntries.map((e) => (
              <div className="acc-table-row" key={e.id}>
                <span>{toDateStr(e.date)}</span>
                <span><span className={`acc-badge ${e.type}`}>{e.type === "income" ? "Income" : "Expense"}</span></span>
                <span>{e.categoryName}</span>
                <span className={`acc-amount ${e.type}`}>{e.type === "income" ? "+" : "-"}{fmt.format(e.amount)}</span>
              </div>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} total={entries.length} perPage={ROWS_PER_PAGE} onChange={setPage} />
        </div>
      )}
    </div>
  );
}

// ─── Entries Tab ──────────────────────────────────────────────────────────────
function EntriesTab({ accounts, categories, onDataChange }) {
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState({ totalIncome: 0, totalExpense: 0, net: 0, count: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const [fromDate, setFromDate] = useState(firstDayOfMonth());
  const [toDate, setToDate] = useState(toDateStr(new Date()));
  const [typeFilter, setTypeFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");

  const [modal, setModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (fromDate) p.set("fromDate", fromDate);
    if (toDate) p.set("toDate", toDate);
    if (typeFilter !== "all") p.set("type", typeFilter);
    if (accountFilter) p.set("accountId", accountFilter);
    if (categoryFilter) p.set("categoryId", categoryFilter);
    if (search.trim()) p.set("search", search.trim());
    return p.toString();
  }, [fromDate, toDate, typeFilter, accountFilter, categoryFilter, search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/acct/entries?${query}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to load entries.");
      const sortedEntries = [...(json.data || [])].sort((a, b) => {
        const aTime = new Date(a.createdAt || a.date || 0).getTime();
        const bTime = new Date(b.createdAt || b.date || 0).getTime();
        return bTime - aTime;
      });
      setEntries(sortedEntries);
      setSummary(json.summary || { totalIncome: 0, totalExpense: 0, net: 0, count: 0 });
      setPage(1);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(entries.length / ROWS_PER_PAGE));
  const pageEntries = entries.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/acct/entries/${confirmDelete}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) { setError(json.message || "Failed to delete entry."); setConfirmDelete(null); return; }
      setConfirmDelete(null);
      load();
      onDataChange();
    } catch {
      setError("Network error.");
      setConfirmDelete(null);
    }
  };

  const resetFilters = () => {
    setFromDate(firstDayOfMonth());
    setToDate(toDateStr(new Date()));
    setTypeFilter("all");
    setAccountFilter("");
    setCategoryFilter("");
    setSearch("");
  };

  const exportCSV = () => {
    const headers = ["Date", "Type", "Account", "Category", "Amount", "Remarks"];
    const rows = entries.map((e) => [
      toDateStr(e.date), e.type, e.accountName, e.categoryName, e.amount, e.remarks || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `entries_${fromDate}_${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const afterSave = () => {
    setModal(null);
    load();
    onDataChange();
  };

  return (
    <div className="acc-tab-content acc-account-scroll">
      {/* Action & Filter Bar */}
      <section className="card">
        <div className="product-filters acc-entries-toolbar">
          <input
            type="text"
            className="search"
            placeholder="Search remarks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <input type="date" className="sort-select" value={fromDate} onChange={(e) => setFromDate(e.target.value)} title="From Date" />
          <input type="date" className="sort-select" value={toDate} onChange={(e) => setToDate(e.target.value)} title="To Date" />
          <select className="sort-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <select className="sort-select" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
            <option value="">All Accounts</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select className="sort-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
          </select>
          <button type="button" className="btn-secondary acc-icon-only-btn acc-export-btn" onClick={exportCSV} aria-label="Export" title="Export">
            <span className="acc-btn-icon"><IconExport /></span>
          </button>
          <button type="button" className="btn-secondary acc-icon-only-btn acc-reset-btn" onClick={resetFilters} aria-label="Reset filters" title="Reset filters">
            <span className="acc-btn-icon"><IconReset /></span>
          </button>
          <button type="button" className="add-product-btn acc-entries-add-income" onClick={() => setModal({ mode: "income" })}>
            <span className="acc-btn-icon"><IconIncome /></span>
            <span className="acc-btn-text">Add Income</span>
          </button>
          <button type="button" className="add-product-btn" onClick={() => setModal({ mode: "expense" })}>
            <span className="acc-btn-icon"><IconExpense /></span>
            <span className="acc-btn-text">Add Expense</span>
          </button>
        </div>
      </section>

      {/* Summary Cards */}
      <div className="acc-summary-grid">
        <div className="acc-summary-card income">
          <span className="acc-summary-label">Total Income</span>
          <span className="acc-summary-value">{fmt.format(summary.totalIncome)}</span>
        </div>
        <div className="acc-summary-card expense">
          <span className="acc-summary-label">Total Expense</span>
          <span className="acc-summary-value">{fmt.format(summary.totalExpense)}</span>
        </div>
        <div className="acc-summary-card net">
          <span className="acc-summary-label">Net Amount</span>
          <span className={`acc-summary-value ${summary.net >= 0 ? "income" : "expense"}`}>
            {fmt.format(summary.net)}
          </span>
        </div>
        <div className="acc-summary-card">
          <span className="acc-summary-label">Total Transactions</span>
          <span className="acc-summary-value plain">{summary.count}</span>
        </div>
      </div>

      {error && <p className="acc-error">{error}</p>}
      {loading && <div className="acc-loading">Loading entries…</div>}

      {!loading && (
        <div className="acc-table-card">
          <div className="acc-table">
            <div className="acc-table-head">
              <span>Date</span>
              <span>Type</span>
              <span>Account</span>
              <span>Category</span>
              <span>Amount</span>
              <span>Actions</span>
            </div>
            {pageEntries.length === 0 ? (
              <div className="acc-table-empty">No entries found for the selected filters.</div>
            ) : pageEntries.map((e) => (
              <div className="acc-table-row" key={e.id}>
                <span>{toDateStr(e.date)}</span>
                <span><span className={`acc-badge ${e.type}`}>{e.type === "income" ? "Income" : "Expense"}</span></span>
                <span>{e.accountName}</span>
                <span>{e.categoryName}</span>
                <span className={`acc-amount ${e.type}`}>{e.type === "income" ? "+" : "-"}{fmt.format(e.amount)}</span>
                <span className="right action-buttons">
                  <button type="button" className="icon-btn edit" onClick={() => setModal({ mode: "edit", entry: e })} aria-label="Edit entry" title="Edit entry"><IconEdit /></button>
                  <button type="button" className="icon-btn danger" onClick={() => setConfirmDelete(e.id)} aria-label="Delete entry" title="Delete entry"><IconTrash /></button>
                </span>
              </div>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} total={entries.length} perPage={ROWS_PER_PAGE} onChange={setPage} />
        </div>
      )}

      {modal && (
        <EntryModal
          entry={modal.mode === "edit" ? modal.entry : null}
          initialType={modal.mode === "edit" ? undefined : modal.mode}
          accounts={accounts}
          categories={categories}
          onClose={() => setModal(null)}
          onSave={afterSave}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          message="Are you sure you want to delete this entry? This action cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

// ─── Accounts Tab ─────────────────────────────────────────────────────────────
function AccountsTab({ accounts, allCategories, loading, error, onReload }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modal, setModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [detailAccountId, setDetailAccountId] = useState(null);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let list = accounts;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") {
      list = list.filter((a) => a.status === statusFilter);
    }
    return list;
  }, [accounts, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const pageRows = filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  useEffect(() => { setPage(1); }, [search, statusFilter]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleteError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/acct/accounts/${confirmDelete}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) { setDeleteError(json.message || "Failed to delete account."); setConfirmDelete(null); return; }
      setConfirmDelete(null);
      onReload();
    } catch {
      setDeleteError("Network error.");
      setConfirmDelete(null);
    }
  };

  const exportCSV = () => {
    const headers = ["Account Name", "Opening Balance", "Total In", "Total Out", "Current Balance", "Status"];
    const rows = filtered.map((a) => [a.name, a.openingBalance, a.totalIn, a.totalOut, a.currentBalance, a.status]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `accounts_${toDateStr(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (detailAccountId) {
    return (
      <AccountDetail
        accountId={detailAccountId}
        allCategories={allCategories}
        onBack={() => setDetailAccountId(null)}
      />
    );
  }

  return (
    <div className="acc-tab-content">
      {/* Action & Filter Bar */}
      <section className="card">
        <div className="product-filters acc-account-toolbar">
          <input
            type="text"
            className="search"
            placeholder="Search accounts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="sort-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button type="button" className="btn-secondary acc-icon-only-btn acc-export-btn" onClick={exportCSV} aria-label="Export" title="Export">
            <span className="acc-btn-icon"><IconExport /></span>
          </button>
          <button type="button" className="btn-secondary acc-icon-only-btn acc-reset-btn" onClick={() => { setSearch(""); setStatusFilter("all"); }} aria-label="Reset filters" title="Reset filters">
            <span className="acc-btn-icon"><IconReset /></span>
          </button>
          <button type="button" className="add-product-btn" onClick={() => setModal({ mode: "add" })}>
            <span className="acc-btn-icon"><IconAccount /></span>
            <span className="acc-btn-text">Add Account</span>
          </button>
        </div>
      </section>

      {(error || deleteError) && <p className="acc-error">{error || deleteError}</p>}
      {loading && <div className="acc-loading">Loading accounts…</div>}

      {!loading && (
        <div className="acc-table-card">
          <div className="acc-table acc-table-accounts">
            <div className="acc-table-head">
              <span>Account Name</span>
              <span>Opening Balance</span>
              <span>Total In</span>
              <span>Total Out</span>
              <span>Current Balance</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {pageRows.length === 0 ? (
              <div className="acc-table-empty">No accounts found.</div>
            ) : pageRows.map((a) => (
              <div className="acc-table-row acc-table-row-clickable" key={a.id} onClick={() => setDetailAccountId(a.id)}>
                <span className="acc-account-name">{a.name}</span>
                <span>{fmt.format(a.openingBalance)}</span>
                <span className="acc-amount income">+{fmt.format(a.totalIn)}</span>
                <span className="acc-amount expense">-{fmt.format(a.totalOut)}</span>
                <span className={`acc-amount ${a.currentBalance >= 0 ? "income" : "expense"}`}>
                  {fmt.format(a.currentBalance)}
                </span>
                <span><span className={`acc-status-badge ${a.status}`}>{a.status}</span></span>
                <span className="right action-buttons" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="icon-btn edit" onClick={() => setModal({ mode: "edit", account: a })} aria-label="Edit account" title="Edit account"><IconEdit /></button>
                  <button type="button" className="icon-btn danger" onClick={() => setConfirmDelete(a.id)} aria-label="Delete account" title="Delete account"><IconTrash /></button>
                </span>
              </div>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} total={filtered.length} perPage={ROWS_PER_PAGE} onChange={setPage} />
        </div>
      )}

      {modal && (
        <AccountModal
          account={modal.mode === "edit" ? modal.account : null}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); onReload(); }}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          message="Are you sure you want to delete this account? This action cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

// ─── Categories Tab ───────────────────────────────────────────────────────────
function CategoriesTab({ categories, loading, error, onReload }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modal, setModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let list = categories;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (typeFilter !== "all") list = list.filter((c) => c.type === typeFilter);
    if (statusFilter !== "all") list = list.filter((c) => c.status === statusFilter);
    return list;
  }, [categories, search, typeFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const pageRows = filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  useEffect(() => { setPage(1); }, [search, typeFilter, statusFilter]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleteError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/acct/categories/${confirmDelete}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) { setDeleteError(json.message || "Failed to delete category."); setConfirmDelete(null); return; }
      setConfirmDelete(null);
      onReload();
    } catch {
      setDeleteError("Network error.");
      setConfirmDelete(null);
    }
  };

  const exportCSV = () => {
    const headers = ["Category Name", "Type", "Status"];
    const rows = filtered.map((c) => [c.name, c.type, c.status]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `categories_${toDateStr(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="acc-tab-content">
      {/* Action & Filter Bar */}
      <section className="card">
        <div className="product-filters acc-category-toolbar">
          <input
            type="text"
            className="search"
            placeholder="Search categories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="sort-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <select className="sort-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button type="button" className="btn-secondary acc-icon-only-btn acc-export-btn" onClick={exportCSV} aria-label="Export" title="Export">
            <span className="acc-btn-icon"><IconExport /></span>
          </button>
          <button type="button" className="btn-secondary acc-icon-only-btn acc-reset-btn" onClick={() => { setSearch(""); setTypeFilter("all"); setStatusFilter("all"); }} aria-label="Reset filters" title="Reset filters">
            <span className="acc-btn-icon"><IconReset /></span>
          </button>
          <button type="button" className="add-product-btn" onClick={() => setModal({ mode: "add" })}>
            <span className="acc-btn-icon"><IconCategory /></span>
            <span className="acc-btn-text">Add Category</span>
          </button>
        </div>
      </section>

      {(error || deleteError) && <p className="acc-error">{error || deleteError}</p>}
      {loading && <div className="acc-loading">Loading categories…</div>}

      {!loading && (
        <div className="acc-table-card">
          <div className="acc-table acc-table-categories">
            <div className="acc-table-head">
              <span>Category Name</span>
              <span>Type</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {pageRows.length === 0 ? (
              <div className="acc-table-empty">No categories found.</div>
            ) : pageRows.map((c) => (
              <div className="acc-table-row" key={c.id}>
                <span>{c.name}</span>
                <span><span className={`acc-badge ${c.type}`}>{c.type === "income" ? "Income" : "Expense"}</span></span>
                <span><span className={`acc-status-badge ${c.status}`}>{c.status}</span></span>
                <span className="right action-buttons">
                  <button type="button" className="icon-btn edit" onClick={() => setModal({ mode: "edit", category: c })} aria-label="Edit category" title="Edit category"><IconEdit /></button>
                  <button type="button" className="icon-btn danger" onClick={() => setConfirmDelete(c.id)} aria-label="Delete category" title="Delete category"><IconTrash /></button>
                </span>
              </div>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} total={filtered.length} perPage={ROWS_PER_PAGE} onChange={setPage} />
        </div>
      )}

      {modal && (
        <CategoryModal
          category={modal.mode === "edit" ? modal.category : null}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); onReload(); }}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          message="Are you sure you want to delete this category? This action cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

// ─── Main Accounting Component ────────────────────────────────────────────────
export default function Accounting() {
  const [activeTab, setActiveTab] = useState("entries");
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [accountsError, setAccountsError] = useState("");
  const [categoriesError, setCategoriesError] = useState("");

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    setAccountsError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/acct/accounts`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to load accounts.");
      setAccounts(json.data || []);
    } catch (e) {
      setAccountsError(e.message);
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    setCategoriesError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/acct/categories`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to load categories.");
      setCategories(json.data || []);
    } catch (e) {
      setCategoriesError(e.message);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
    loadCategories();
  }, [loadAccounts, loadCategories]);

  const TABS = [
    { key: "entries", label: "Entries" },
    { key: "account", label: "Account" },
    { key: "categories", label: "Categories" },
  ];

  return (
    <div className="acc-module">
      {/* Tab Bar */}
      <div className="acc-tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`acc-tab-btn ${activeTab === tab.key ? "active" : ""}`.trim()}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "entries" && (
        <EntriesTab
          accounts={accounts}
          categories={categories}
          onDataChange={loadAccounts}
        />
      )}
      {activeTab === "account" && (
        <AccountsTab
          accounts={accounts}
          allCategories={categories}
          loading={accountsLoading}
          error={accountsError}
          onReload={loadAccounts}
        />
      )}
      {activeTab === "categories" && (
        <CategoriesTab
          categories={categories}
          loading={categoriesLoading}
          error={categoriesError}
          onReload={loadCategories}
        />
      )}
    </div>
  );
}
