import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = `http://${window.location.hostname}:4000`;

const emptyForm = {
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    gstNumber: "",
    allowCredit: false,
    creditLimit: "0",
};

export default function Customer() {
    const customersPerPage = 20;
    const [customers, setCustomers] = useState([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState("");
    const [purchaseHistory, setPurchaseHistory] = useState([]);
    const [historySummary, setHistorySummary] = useState({
        invoicesCount: 0,
        totalPurchases: 0,
        totalPaid: 0,
        outstanding: 0,
    });
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState("recent");
    const [message, setMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [showFormModal, setShowFormModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [currentPage, setCurrentPage] = useState(1);

    const currency = useMemo(
        () =>
            new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 2,
            }),
        []
    );

    const loadCustomers = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/customers`);
            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.message || "Failed to load customers.");
            }

            setCustomers(payload.data || []);
        } catch (error) {
            setMessage(error.message || "Failed to load customers.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadCustomers();
    }, []);

    useEffect(() => {
        if (!selectedCustomerId) {
            setPurchaseHistory([]);
            setHistorySummary({
                invoicesCount: 0,
                totalPurchases: 0,
                totalPaid: 0,
                outstanding: 0,
            });
            return;
        }

        const loadHistory = async () => {
            setIsHistoryLoading(true);
            try {
                const response = await fetch(`${API_BASE_URL}/api/customers/${selectedCustomerId}/purchase-history`);
                const payload = await response.json();

                if (!response.ok) {
                    throw new Error(payload.message || "Failed to load purchase history.");
                }

                setPurchaseHistory(payload.purchases || []);
                setHistorySummary(
                    payload.summary || {
                        invoicesCount: 0,
                        totalPurchases: 0,
                        totalPaid: 0,
                        outstanding: 0,
                    }
                );
            } catch (error) {
                setMessage(error.message || "Failed to load purchase history.");
            } finally {
                setIsHistoryLoading(false);
            }
        };

        loadHistory();
    }, [selectedCustomerId]);

    const displayedCustomers = useMemo(() => {
        const normalized = searchQuery.trim().toLowerCase();

        let rows = customers.filter((customer) => {
            if (!normalized) {
                return true;
            }

            return (
                (customer.name || "").toLowerCase().includes(normalized) ||
                (customer.email || "").toLowerCase().includes(normalized) ||
                (customer.phone || "").toLowerCase().includes(normalized)
            );
        });

        if (sortBy === "outstanding") {
            rows = [...rows].sort(
                (a, b) =>
                    Number((b.outstanding_amount ?? b.outstanding) || 0) -
                    Number((a.outstanding_amount ?? a.outstanding) || 0)
            );
        } else if (sortBy === "recent") {
            rows = [...rows].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        } else {
            rows = [...rows].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        }

        return rows;
    }, [customers, searchQuery, sortBy]);

    const totalPages = Math.max(1, Math.ceil(displayedCustomers.length / customersPerPage));
    const paginatedCustomers = displayedCustomers.slice(
        (currentPage - 1) * customersPerPage,
        currentPage * customersPerPage
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, sortBy]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const summaryCards = useMemo(() => {
        const creditCustomers = customers.filter((item) => item.allowCredit).length;
        const outstandingTotal = customers.reduce(
            (sum, item) => sum + Number((item.outstanding_amount ?? item.outstanding) || 0),
            0
        );

        return {
            totalCustomers: customers.length,
            creditCustomers,
            outstandingTotal,
        };
    }, [customers]);

    const resetForm = () => {
        setEditingId(null);
        setForm(emptyForm);
        setShowFormModal(false);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setForm(emptyForm);
        setMessage("");
        setShowFormModal(false);
    };

    const onFormChange = (event) => {
        const { name, value, type, checked } = event.target;
        setForm((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
            ...(name === "allowCredit" && !checked ? { creditLimit: "0" } : {}),
        }));
    };

    const submitForm = async (event) => {
        event.preventDefault();

        const name = form.name.trim();
        const email = form.email.trim();
        const creditLimit = Number(form.creditLimit || 0);

        if (!name) {
            setMessage("Customer name is required.");
            return;
        }

        if (!email) {
            setMessage("Customer email is required.");
            return;
        }

        if (Number.isNaN(creditLimit) || creditLimit < 0) {
            setMessage("Please enter a valid credit limit.");
            return;
        }

        try {
            setMessage("Saving customer...");

            const response = await fetch(
                editingId ? `${API_BASE_URL}/api/customers/${editingId}` : `${API_BASE_URL}/api/customers`,
                {
                    method: editingId ? "PUT" : "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        name,
                        email,
                        phone: form.phone.trim(),
                        address: form.address.trim(),
                        city: form.city.trim(),
                        state: form.state.trim(),
                        pincode: form.pincode.trim(),
                        gstNumber: form.gstNumber.trim(),
                        allowCredit: Boolean(form.allowCredit),
                        creditLimit: form.allowCredit ? creditLimit : 0,
                    }),
                }
            );

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.message || "Failed to save customer.");
            }

            if (editingId) {
                setCustomers((prev) => prev.map((item) => (item.id === editingId ? payload.customer : item)));
                setMessage("Customer updated successfully.");
            } else {
                setCustomers((prev) => [payload.customer, ...prev]);
                setMessage("Customer added successfully.");
            }

            resetForm();
            setTimeout(() => setMessage(""), 2400);
        } catch (error) {
            setMessage(error.message || "Failed to save customer.");
        }
    };

    const handleEdit = (customer) => {
        setEditingId(customer.id);
        setForm({
            name: customer.name || "",
            email: customer.email || "",
            phone: customer.phone || "",
            address: customer.address || "",
            city: customer.city || "",
            state: customer.state || "",
            pincode: customer.pincode || "",
            gstNumber: customer.gstNumber || customer.gst_number || "",
            allowCredit: Boolean(customer.allowCredit),
            creditLimit: String(customer.creditLimit || 0),
        });
        setShowFormModal(true);
    };

    const handleDelete = async (customer) => {
        try {
            setMessage("Deleting customer...");
            const response = await fetch(`${API_BASE_URL}/api/customers/${customer.id}`, {
                method: "DELETE",
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.message || "Failed to delete customer.");
            }

            setCustomers((prev) => prev.filter((item) => item.id !== customer.id));
            if (selectedCustomerId === customer.id) {
                setSelectedCustomerId("");
                setShowHistoryModal(false);
            }
            setMessage("Customer deleted successfully.");
            setTimeout(() => setMessage(""), 2400);
        } catch (error) {
            setMessage(error.message || "Failed to delete customer.");
        }
    };

    const handleOpenHistory = (customer) => {
        setSelectedCustomerId(customer.id);
        setShowHistoryModal(true);
    };

    const formatDate = (value) => {
        if (!value) return "-";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "-";
        return date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "2-digit",
        });
    };

    const selectedCustomer = customers.find((item) => item.id === selectedCustomerId) || null;

    return (
        <div className="product-page customer-page">
            <div className="product-header">
                

                <div className="product-stats">
                    <div className="stat-card">
                        <div className="stat-value">{summaryCards.totalCustomers}</div>
                        <div className="stat-label">Total Customers</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">{summaryCards.creditCustomers}</div>
                        <div className="stat-label">Credit Enabled</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">{currency.format(summaryCards.outstandingTotal)}</div>
                        <div className="stat-label">Outstanding Amount</div>
                    </div>
                </div>
            </div>

            {message && <div className="status success">{message}</div>}

            <section className="card">
                <div className="card-head">
                    <div>
                        
                        <h3>All customers ({displayedCustomers.length})</h3>
                    </div>

                    <div className="card-head-actions">
                        
                        <button
                            type="button"
                            className="add-product-btn"
                            onClick={() => {
                                setEditingId(null);
                                setForm(emptyForm);
                                setMessage("");
                                setShowFormModal(true);
                            }}
                        >
                            Add Customer
                        </button>
                    </div>
                </div>

                <div className="product-filters">
                    <input
                        type="search"
                        className="search"
                        placeholder="Search by name, email, or phone..."
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                    />
                    <select className="sort-select" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                        <option value="recent">Most Recent</option>
                        <option value="name">Name (A-Z)</option>
                        <option value="outstanding">Outstanding (High-Low)</option>
                    </select>
                </div>

                {isLoading ? (
                    <div className="table-row empty">
                        <span>Loading customers...</span>
                    </div>
                ) : (
                    <div className="table customer-table">
                        <div className="table-row header customer-row">
                            <span>Name</span>
                            <span>Email</span>
                            <span>Phone</span>
                            <span>GST Number</span>
                            <span>Credit Limit</span>
                            <span>Outstanding</span>
                            <span className="right">Added</span>
                            <span className="right">Actions</span>
                        </div>

                        {displayedCustomers.length === 0 ? (
                            <div className="table-row empty">
                                {customers.length === 0
                                    ? "No customers yet. Create one using the form above!"
                                    : "No customers match your search criteria."}
                            </div>
                        ) : (
                            paginatedCustomers.map((customer) => (
                                <div className="table-row customer-row" key={customer.id}>
                                    <span className="product-name " >
                                        {customer.name || "Unnamed Customer"}
                                    </span>
                                    <span className="product-sku">{customer.email || "-"}</span>
                                    <span className="product-sku">{customer.phone || "-"}</span>
                                    <span className="product-sku">{customer.gstNumber || customer.gst_number || "-"}</span>
                                    <span className="product-sku">{currency.format(customer.creditLimit || 0)}</span>
                                    <span className="product-sku">{currency.format((customer.outstanding_amount ?? customer.outstanding) || 0)}</span>
                                    <span className="right">{formatDate(customer.createdAt)}</span>
                                    <span className="right action-buttons">
                                        <button
                                            type="button"
                                            className="icon-btn history"
                                            onClick={() => handleOpenHistory(customer)}
                                            title="View purchase history"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M3 3v5h5"></path>
                                                <path d="M3.05 13a9 9 0 1 0 3.39-6.88L3 8"></path>
                                                <path d="M12 7v5l3 3"></path>
                                            </svg>
                                        </button>
                                        <button
                                            type="button"
                                            className="icon-btn edit"
                                            onClick={() => handleEdit(customer)}
                                            title="Edit customer"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                            </svg>
                                        </button>
                                        <button
                                            type="button"
                                            className="icon-btn danger"
                                            onClick={() => handleDelete(customer)}
                                            title="Delete customer"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="3 6 5 6 21 6"></polyline>
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
                )}

                {displayedCustomers.length > 0 && (
                    <div className="category-pagination">
                        <span className="tag">
                            Showing {(currentPage - 1) * customersPerPage + 1}-
                            {Math.min(currentPage * customersPerPage, displayedCustomers.length)} of {displayedCustomers.length}
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
                                    key={`customer-page-${page}`}
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

            {showHistoryModal && (
                <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
                    <div className="modal-content customer-history-modal-content" onClick={(event) => event.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{selectedCustomer ? `${selectedCustomer.name} • Purchase History` : "Purchase History"}</h2>
                            <button type="button" className="modal-close" onClick={() => setShowHistoryModal(false)}>
                                ×
                            </button>
                        </div>

                        <div className="modal-body">
                            {isHistoryLoading ? (
                                <div className="table-row empty">
                                    <span>Loading purchase history...</span>
                                </div>
                            ) : (
                                <>
                                    <div className="customer-history-summary">
                                        <span className="tag">Bills: {historySummary.invoicesCount || 0}</span>
                                        <span className="tag">Total Purchase: {currency.format(historySummary.totalPurchases || 0)}</span>
                                        <span className="tag">Total Paid: {currency.format(historySummary.totalPaid || 0)}</span>
                                        <span className="tag">Outstanding: {currency.format(historySummary.outstanding || 0)}</span>
                                    </div>

                                    <div className="table customer-table">
                                        <div className="table-row header customer-history-row">
                                            <span>Invoice No</span>
                                            <span>Issue Date</span>
                                            <span>Due Date</span>
                                            <span>Status</span>
                                            <span>Total</span>
                                            <span>Paid Amount</span>
                                            <span>Outstanding</span>
                                            <span>Payments</span>
                                        </div>

                                        {purchaseHistory.length === 0 ? (
                                            <div className="table-row empty">
                                                <span>No purchase bills found for this customer.</span>
                                            </div>
                                        ) : (
                                            purchaseHistory.map((bill) => {
                                                const paidAmount = Number(
                                                    bill.paidAmount ??
                                                    (bill.payments || []).reduce(
                                                        (sum, payment) => sum + Number(payment.amount || 0),
                                                        0
                                                    )
                                                );
                                                const outstandingAmount = Number(
                                                    bill.outstandingAmount ?? Math.max(Number(bill.total || 0) - paidAmount, 0)
                                                );

                                                return (
                                                    <div className="table-row customer-history-row" key={bill.id}>
                                                        <span>{bill.invoiceNo || "-"}</span>
                                                        <span>{formatDate(bill.issueDate)}</span>
                                                        <span>{formatDate(bill.dueDate)}</span>
                                                        <span>{bill.status || "-"}</span>
                                                        <span>{currency.format(bill.total || 0)}</span>
                                                        <span>{currency.format(paidAmount)}</span>
                                                        <span>{currency.format(outstandingAmount)}</span>
                                                        <span>{(bill.payments || []).length}</span>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showFormModal && (
                <div className="modal-overlay" onClick={() => !editingId && setShowFormModal(false)}>
                    <div className="modal-content customer-modal-content" onClick={(event) => event.stopPropagation()}>
                        <div className="card">
                            <div className="card-head">
                                <div>
                                    <p className="card-label">{editingId ? "Edit Customer" : "Add Customer"}</p>
                                    <h3>{editingId ? "Update customer details" : "Create new customer"}</h3>
                                </div>
                                <button className="close-btn" onClick={handleCancelEdit} title="Close">
                                    ✕
                                </button>
                            </div>

                            <form className="product-form" onSubmit={submitForm} autoComplete="off">
                                <div className="form-row">
                                    <label className="product-field">
                                        <span>Name *</span>
                                        <input
                                            type="text"
                                            name="name"
                                            placeholder="Enter customer name"
                                            value={form.name}
                                            onChange={onFormChange}
                                            autoComplete="off"
                                            required
                                        />
                                    </label>

                                    <label className="product-field">
                                        <span>Phone *</span>
                                        <input
                                            type="tel"
                                            name="phone"
                                            placeholder="Enter customer phone number"
                                            value={form.phone}
                                            onChange={onFormChange}
                                            autoComplete="off"
                                            required
                                        />
                                    </label>
                                </div>

                                <div className="form-row">
                                    <label className="product-field">
                                        <span>Email *</span>
                                        <input
                                            type="email"
                                            name="email"
                                            placeholder="Enter customer email"
                                            value={form.email}
                                            onChange={onFormChange}
                                            autoComplete="off"
                                            required
                                        />
                                    </label>

                                    <label className="product-field">
                                        <span>GST Number</span>
                                        <input
                                            type="text"
                                            name="gstNumber"
                                            placeholder="Enter GST number"
                                            onChange={onFormChange}
                                            value={form.gstNumber}
                                            autoComplete="off"
                                        />
                                    </label>
                                </div>

                                <div className="form-row">
                                    <label className="product-field">
                                        <span>Address</span>
                                        <input
                                            type="text"
                                            name="address"
                                            placeholder="Enter customer address"
                                            value={form.address}
                                            onChange={onFormChange}
                                            autoComplete="off"
                                        />
                                    </label>

                                    <label className="product-field">
                                        <span>City</span>
                                        <input
                                            type="text"
                                            name="city"
                                            placeholder="Enter city"
                                            value={form.city}
                                            onChange={onFormChange}
                                            autoComplete="off"
                                        />
                                    </label>
                                </div>

                                <div className="form-row">
                                    <label className="product-field">
                                        <span>State</span>
                                        <input
                                            type="text"
                                            name="state"
                                            placeholder="Enter state"
                                            value={form.state}
                                            onChange={onFormChange}
                                            autoComplete="off"
                                        />
                                    </label>

                                    <label className="product-field">
                                        <span>Pincode</span>
                                        <input
                                            type="text"
                                            name="pincode"
                                            placeholder="Enter pincode"
                                            value={form.pincode}
                                            onChange={onFormChange}
                                            autoComplete="off"
                                        />
                                    </label>
                                </div>

                                <div className="form-row customer-credit-row">
                                    <label className="product-field">
                                        <span className="credit-limit-head">
                                            <span className="credit-toggle">
                                                <span>Credit Limit <input type="checkbox" name="allowCredit" checked={Boolean(form.allowCredit)} onChange={onFormChange} /></span>
                                                
                                            </span>
                                        </span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            name="creditLimit"
                                            value={form.creditLimit}
                                            onChange={onFormChange}
                                            autoComplete="off"
                                            disabled={!form.allowCredit}
                                        />
                                    </label>
                                </div>

                                <div className="product-actions">
                                    <button type="submit" className="cta">
                                        {editingId ? "Update Customer" : "Add Customer"}
                                    </button>
                                    {editingId && (
                                        <button type="button" className="btn-secondary" onClick={handleCancelEdit}>
                                            Cancel Edit
                                        </button>
                                    )}
                                    {message && (
                                        <span className="status" role="status">
                                            {message}
                                        </span>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
