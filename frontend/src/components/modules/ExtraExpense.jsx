import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = `http://${window.location.hostname}:4000`;
const PAYMENT_MODES = ["cash", "card", "upi", "bank", "other"];

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

const emptyForm = {
    date: toDateInput(new Date()),
    category: "",
    description: "",
    amount: "",
    payment_mode: "cash",
    created_by: "",
};

const buildDateWiseReportFromExpenses = (rows) => {
    const grouped = new Map();

    (rows || []).forEach((entry) => {
        const dateKey = toDateInput(entry?.date);
        const current = grouped.get(dateKey) || { date: dateKey, totalAmount: 0, expenseCount: 0 };
        current.totalAmount += Number(entry?.amount || 0);
        current.expenseCount += 1;
        grouped.set(dateKey, current);
    });

    return [...grouped.values()]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((row) => ({
            ...row,
            totalAmount: Number((row.totalAmount || 0).toFixed(2)),
        }));
};

export default function ExtraExpense({ user }) {
    const expensesPerPage = 20;
    const [fromDate, setFromDate] = useState(firstDayOfMonth());
    const [toDate, setToDate] = useState(toDateInput(new Date()));
    const [categoryFilter, setCategoryFilter] = useState("");

    const [expenses, setExpenses] = useState([]);
    const [dateWiseReport, setDateWiseReport] = useState([]);
    const [status, setStatus] = useState({ state: "idle", message: "" });

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState("");
    const [form, setForm] = useState(emptyForm);

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [deletingId, setDeletingId] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const query = useMemo(() => {
        const params = new URLSearchParams();
        if (fromDate) {
            params.set("fromDate", fromDate);
        }
        if (toDate) {
            params.set("toDate", toDate);
        }
        if (categoryFilter.trim()) {
            params.set("category", categoryFilter.trim());
        }
        return params.toString();
    }, [fromDate, toDate, categoryFilter]);

    const categoryOptions = useMemo(() => {
        const set = new Set();
        expenses.forEach((item) => {
            if (item.category) {
                set.add(item.category);
            }
        });
        return [...set].sort((a, b) => a.localeCompare(b));
    }, [expenses]);

    const loadData = async () => {
        setIsLoading(true);
        setStatus({ state: "idle", message: "" });

        try {
            const expensesRes = await fetch(`${API_BASE_URL}/api/accounting/expenses?${query}`);
            const reportRes = await fetch(`${API_BASE_URL}/api/accounting/expenses/report/date-wise?${query}`);

            const expensesPayload = await expensesRes.json();
            let reportPayload = { data: [] };

            try {
                reportPayload = await reportRes.json();
            } catch {
                reportPayload = { data: [] };
            }

            if (!expensesRes.ok) {
                throw new Error(expensesPayload.message || "Failed to load expenses.");
            }

            const expenseRows = expensesPayload.data || [];
            setExpenses(expenseRows);

            if (reportRes.ok) {
                setDateWiseReport(reportPayload.data || []);
            } else {
                setDateWiseReport(buildDateWiseReportFromExpenses(expenseRows));
                if (reportRes.status !== 404) {
                    setStatus({ state: "error", message: reportPayload.message || "Date-wise report endpoint failed." });
                }
            }
        } catch (error) {
            setStatus({ state: "error", message: error.message || "Failed to load expenses." });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [query]);

    const totalPages = Math.max(1, Math.ceil(expenses.length / expensesPerPage));
    const paginatedExpenses = expenses.slice(
        (currentPage - 1) * expensesPerPage,
        currentPage * expensesPerPage
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [query]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const resetForm = () => {
        setForm({
            ...emptyForm,
            created_by: user?.name || user?.username || "Admin",
        });
    };

    const openCreate = () => {
        setEditingId("");
        resetForm();
        setShowModal(true);
    };

    const openEdit = (entry) => {
        setEditingId(entry.id || "");
        setForm({
            date: toDateInput(entry.date),
            category: entry.category || "",
            description: entry.description || "",
            amount: String(entry.amount || ""),
            payment_mode: entry.payment_mode || "cash",
            created_by: entry.created_by || user?.name || user?.username || "Admin",
        });
        setShowModal(true);
    };

    const closeModal = () => {
        if (isSaving) {
            return;
        }
        setShowModal(false);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        const amount = Number(form.amount);

        if (!form.description.trim()) {
            setStatus({ state: "error", message: "Description is required." });
            return;
        }

        if (Number.isNaN(amount) || amount <= 0) {
            setStatus({ state: "error", message: "Amount must be greater than zero." });
            return;
        }

        setIsSaving(true);

        try {
            const endpoint = editingId
                ? `${API_BASE_URL}/api/accounting/expenses/${editingId}`
                : `${API_BASE_URL}/api/accounting/expenses`;
            const method = editingId ? "PUT" : "POST";

            const response = await fetch(endpoint, {
                method,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    date: form.date,
                    category: form.category.trim(),
                    description: form.description.trim(),
                    amount,
                    payment_mode: form.payment_mode,
                    created_by: form.created_by.trim() || user?.name || user?.username || "Admin",
                }),
            });

            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.message || "Failed to save expense.");
            }

            setStatus({ state: "success", message: editingId ? "Expense updated successfully." : "Expense added successfully." });
            setShowModal(false);
            await loadData();
            setTimeout(() => setStatus({ state: "idle", message: "" }), 2400);
        } catch (error) {
            setStatus({ state: "error", message: error.message || "Failed to save expense." });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (entry) => {
        const id = entry?.id;
        if (!id) {
            return;
        }

        const ok = window.confirm(`Delete expense ${entry.expense_id || ""}?`);
        if (!ok) {
            return;
        }

        setDeletingId(id);

        try {
            const response = await fetch(`${API_BASE_URL}/api/accounting/expenses/${id}`, {
                method: "DELETE",
            });
            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.message || "Failed to delete expense.");
            }

            setStatus({ state: "success", message: "Expense deleted successfully." });
            await loadData();
            setTimeout(() => setStatus({ state: "idle", message: "" }), 2400);
        } catch (error) {
            setStatus({ state: "error", message: error.message || "Failed to delete expense." });
        } finally {
            setDeletingId("");
        }
    };

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
                            <span>Category (Optional)</span>
                            <input
                                type="text"
                                value={categoryFilter}
                                onChange={(event) => setCategoryFilter(event.target.value)}
                                list="extra-expense-categories"
                                placeholder="All categories"
                            />
                            <datalist id="extra-expense-categories">
                                {categoryOptions.map((category) => (
                                    <option key={category} value={category} />
                                ))}
                            </datalist>
                        </label>
                    </div>
                </div>

                {status.state !== "idle" && <p className={`status ${status.state}`}>{status.message}</p>}
            </div>

            {isLoading && <div className="alert">Loading extra expenses...</div>}

            <div className="stack">
                <section className="card">
                    <div className="card-head">
                        <h3>Expense List</h3>
                        <button type="button" className="add-product-btn" onClick={openCreate}>
                            Add Expense
                        </button>
                    </div>

                    <div className="table">
                        <div className="table-row header extra-expense-row">
                            <span>Date</span>
                            <span>Category</span>
                            <span>Description</span>
                            <span>Amount</span>
                            <span>Payment</span>
                            <span>Created By</span>
                            <span>Action</span>
                        </div>

                        {expenses.length === 0 ? (
                            <div className="table-row empty">
                                <span>No expenses found for selected filters.</span>
                            </div>
                        ) : (
                            paginatedExpenses.map((entry) => (
                                <div className="table-row extra-expense-row" key={entry.id}>
                                    <span>{toDateInput(entry.date)}</span>
                                    <span>{entry.category || "General"}</span>
                                    <span>{entry.description || "-"}</span>
                                    <span>{formatInr.format(entry.amount || 0)}</span>
                                    <span>{String(entry.payment_mode || "cash").toUpperCase()}</span>
                                    <span>{entry.created_by || "System"}</span>
                                    <span className="right action-buttons">
                                        <button
                                            type="button"
                                            className="icon-btn edit"
                                            onClick={() => openEdit(entry)}
                                            title="Edit expense"
                                            aria-label="Edit expense"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                            </svg>
                                        </button>
                                        <button
                                            type="button"
                                            className="icon-btn danger"
                                            onClick={() => handleDelete(entry)}
                                            title="Delete expense"
                                            aria-label="Delete expense"
                                            disabled={deletingId === entry.id}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                                <line x1="14" y1="11" x2="14" y2="17"></line>
                                            </svg>
                                        </button>
                                    </span>
                                </div>
                            ))
                        )}
                    </div>

                    {expenses.length > 0 && (
                        <div className="category-pagination">
                            <span className="tag">
                                Showing {(currentPage - 1) * expensesPerPage + 1}-
                                {Math.min(currentPage * expensesPerPage, expenses.length)} of {expenses.length}
                            </span>
                            <div className="category-pagination-controls">
                                <button
                                    type="button"
                                    className="category-page-btn icon"
                                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    aria-label="Previous page"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <polyline points="15 18 9 12 15 6"></polyline>
                                    </svg>
                                </button>
                                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                                    <button
                                        key={`expense-page-${page}`}
                                        type="button"
                                        className={`category-page-btn ${page === currentPage ? "active" : ""}`.trim()}
                                        onClick={() => setCurrentPage(page)}
                                        aria-current={page === currentPage ? "page" : undefined}
                                    >
                                        {page}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    className="category-page-btn icon"
                                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
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

            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" onClick={(event) => event.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingId ? "Edit Expense" : "Add Expense"}</h2>
                            <button type="button" className="modal-close" onClick={closeModal} aria-label="Close">
                                ×
                            </button>
                        </div>

                        <div className="modal-body">
                            <form className="product-form" onSubmit={handleSubmit}>
                                <label className="product-field">
                                    <span>Date</span>
                                    <input
                                        type="date"
                                        value={form.date}
                                        onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                                    />
                                </label>

                                <label className="product-field">
                                    <span>Category (Optional)</span>
                                    <input
                                        type="text"
                                        value={form.category}
                                        onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                                        placeholder="Rent, Salary, Electricity"
                                    />
                                </label>

                                <label className="product-field">
                                    <span>Description</span>
                                    <input
                                        type="text"
                                        value={form.description}
                                        onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                                        placeholder="Expense description"
                                    />
                                </label>

                                <label className="product-field">
                                    <span>Amount</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={form.amount}
                                        onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                                        placeholder="0.00"
                                    />
                                </label>

                                <label className="product-field">
                                    <span>Payment Mode</span>
                                    <select
                                        value={form.payment_mode}
                                        onChange={(event) => setForm((prev) => ({ ...prev, payment_mode: event.target.value }))}
                                    >
                                        {PAYMENT_MODES.map((mode) => (
                                            <option key={mode} value={mode}>
                                                {mode.toUpperCase()}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="product-field">
                                    <span>Created By</span>
                                    <input
                                        type="text"
                                        value={form.created_by}
                                        onChange={(event) => setForm((prev) => ({ ...prev, created_by: event.target.value }))}
                                        placeholder="Admin"
                                    />
                                </label>

                                <div className="stock-modal-actions">
                                    <button type="button" className="btn-secondary" onClick={closeModal} disabled={isSaving}>
                                        Cancel
                                    </button>
                                    <button className="cta" type="submit" disabled={isSaving}>
                                        {isSaving ? "Saving..." : editingId ? "Update Expense" : "Add Expense"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
