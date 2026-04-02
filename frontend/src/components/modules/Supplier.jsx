import { useEffect, useState, useMemo } from "react";

const API_BASE_URL = `http://${window.location.hostname}:4000`;

const emptyForm = {
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    contactPerson: "",
    gstNumber: "",
};

export default function Supplier() {
    const suppliersPerPage = 20;
    const [suppliers, setSuppliers] = useState([]);
    const [supplierForm, setSupplierForm] = useState(emptyForm);
    const [supplierMessage, setSupplierMessage] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [sortBy, setSortBy] = useState("recent");
    const [currentPage, setCurrentPage] = useState(1);
    const [editingId, setEditingId] = useState(null);
    const [showFormModal, setShowFormModal] = useState(false);

    // Load suppliers on mount
    useEffect(() => {
        let active = true;

        const loadSuppliers = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`${API_BASE_URL}/api/suppliers`);
                const payload = await response.json();
                if (!response.ok) {
                    throw new Error(payload.message || "Failed to load suppliers.");
                }
                if (active) {
                    setSuppliers(payload.data || []);
                }
            } catch (error) {
                if (active) {
                    setSupplierMessage(error.message || "Failed to load suppliers.");
                }
            } finally {
                if (active) {
                    setIsLoading(false);
                }
            }
        };

        loadSuppliers();
        return () => {
            active = false;
        };
    }, []);

    const handleSupplierChange = (event) => {
        const { name, value } = event.target;
        setSupplierForm((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const validateForm = () => {
        const name = supplierForm.name.trim();
        const email = supplierForm.email.trim();
        const phone = supplierForm.phone.trim();

        if (!name) {
            setSupplierMessage("Supplier name is required.");
            return false;
        }

        if (!email) {
            setSupplierMessage("Email is required.");
            return false;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setSupplierMessage("Invalid email format.");
            return false;
        }

        if (!phone) {
            setSupplierMessage("Phone number is required.");
            return false;
        }

        return {
            name,
            email,
            phone,
        };
    };

    const handleAddSupplier = async (event) => {
        event.preventDefault();

        const validated = validateForm();
        if (!validated) return;

        try {
            setSupplierMessage("Saving...");
            const url = editingId
                ? `${API_BASE_URL}/api/suppliers/${editingId}`
                : `${API_BASE_URL}/api/suppliers`;
            const method = editingId ? "PUT" : "POST";

            const response = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: validated.name,
                    email: validated.email,
                    phone: validated.phone,
                    address: supplierForm.address.trim(),
                    city: supplierForm.city.trim(),
                    state: supplierForm.state.trim(),
                    pincode: supplierForm.pincode.trim(),
                    contactPerson: supplierForm.contactPerson.trim(),
                    gst_number: supplierForm.gstNumber.trim(),
                }),
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.message || `Failed to ${editingId ? 'update' : 'add'} supplier.`);
            }

            if (editingId) {
                setSuppliers((prev) => prev.map((s) => s.id === editingId ? payload.supplier : s));
                setSupplierMessage("Supplier updated successfully!");
                setEditingId(null);
            } else {
                setSuppliers((prev) => [payload.supplier, ...prev]);
                setSupplierMessage("Supplier added successfully!");
            }

            setSupplierForm(emptyForm);
            setTimeout(() => setSupplierMessage(""), 3000);
        } catch (error) {
            setSupplierMessage(error.message || `Failed to ${editingId ? 'update' : 'add'} supplier.`);
        }
    };

    const handleDeleteSupplier = async (id) => {
        

        try {
            setSupplierMessage("Deleting...");
            const response = await fetch(`${API_BASE_URL}/api/suppliers/${id}`, {
                method: "DELETE",
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.message || "Failed to delete supplier.");
            }
            setSuppliers((prev) => prev.filter((supplier) => supplier.id !== id));
            setSupplierMessage("Supplier removed successfully!");
            setTimeout(() => setSupplierMessage(""), 3000);
        } catch (error) {
            setSupplierMessage(error.message || "Failed to delete supplier.");
        }
    };

    const handleEditSupplier = (supplier) => {
        setEditingId(supplier.id);
        setSupplierForm({
            name: supplier.name,
            email: supplier.email,
            phone: supplier.phone,
            address: supplier.address || "",
            city: supplier.city || "",
            state: supplier.state || "",
            pincode: supplier.pincode || "",
            contactPerson: supplier.contactPerson || "",
            gstNumber: supplier.gst_number || supplier.gstNumber || "",
        });
        setShowFormModal(true);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setSupplierForm(emptyForm);
        setSupplierMessage("");
        setShowFormModal(false);
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

    // Filter and sort suppliers
    let displayedSuppliers = suppliers.filter((supplier) => {
        const matchesSearch = (supplier.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (supplier.email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (supplier.phone || "").includes(searchQuery);
        return matchesSearch;
    });

    if (sortBy === "name") {
        displayedSuppliers = [...displayedSuppliers].sort((a, b) =>
            (a.name || "").localeCompare(b.name || "")
        );
    } else if (sortBy === "city") {
        displayedSuppliers = [...displayedSuppliers].sort((a, b) =>
            (a.city || "").localeCompare(b.city || "")
        );
    }

    const totalPages = Math.max(1, Math.ceil(displayedSuppliers.length / suppliersPerPage));
    const paginatedSuppliers = displayedSuppliers.slice(
        (currentPage - 1) * suppliersPerPage,
        currentPage * suppliersPerPage
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, sortBy]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    return (
        <div className="product-page supplier-page">
            
            <div className="product-content">

                {/* Modal Overlay */}
                {showFormModal && (
                    <div className="modal-overlay" onClick={() => !editingId && setShowFormModal(false)}>
                        <div className="modal-content supplier-modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="card">
                                <div className="card-head">
                                    <div>
                                        <p className="card-label">{editingId ? "Edit Supplier" : "Add Supplier"}</p>
                                        <h3>{editingId ? "Update supplier details" : "Create new supplier"}</h3>
                                    </div>
                                    <button
                                        className="close-btn"
                                        onClick={handleCancelEdit}
                                        title="Close"
                                    >
                                        ✕
                                    </button>
                                </div>

                                <form className="product-form" onSubmit={handleAddSupplier} autoComplete="off">
                        <div className="form-row">
                            <label className="product-field">
                                <span>Supplier Name *</span>
                                <input
                                    type="text"
                                    name="name"
                                    placeholder="Enter supplier company name"
                                    value={supplierForm.name}
                                    onChange={handleSupplierChange}
                                    autoComplete="off"
                                    required
                                />
                            </label>

                            <label className="product-field">
                                <span>Contact Person</span>
                                <input
                                    type="text"
                                    name="contactPerson"
                                    placeholder="Enter contact person's name"
                                    value={supplierForm.contactPerson}
                                    onChange={handleSupplierChange}
                                    autoComplete="off"
                                />
                            </label>
                        </div>

                        <div className="form-row">
                            <label className="product-field">
                                <span>Email *</span>
                                <input
                                    type="email"
                                    name="email"
                                    placeholder="Enter contact email"
                                    value={supplierForm.email}
                                    onChange={handleSupplierChange}
                                    autoComplete="off"
                                    required
                                />
                            </label>

                            <label className="product-field">
                                <span>Phone *</span>
                                <input
                                    type="tel"
                                    name="phone"
                                    placeholder="Enter contact phone number"
                                    value={supplierForm.phone}
                                    onChange={handleSupplierChange}
                                    autoComplete="off"
                                    required
                                />
                            </label>
                        </div>

                        <div className="form-row">
                            <label className="product-field">
                                <span>Address</span>
                                <input
                                    type="text"
                                    name="address"
                                    placeholder="Enter supplier address"
                                    value={supplierForm.address}
                                    onChange={handleSupplierChange}
                                    autoComplete="off"
                                />
                            </label>

                            <label className="product-field">
                                <span>City</span>
                                <input
                                    type="text"
                                    name="city"
                                    placeholder="Enter city"
                                    value={supplierForm.city}
                                    onChange={handleSupplierChange}
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
                                    value={supplierForm.state}
                                    onChange={handleSupplierChange}
                                    autoComplete="off"
                                />
                            </label>

                            <label className="product-field">
                                <span>Pincode</span>
                                <input
                                    type="text"
                                    name="pincode"
                                    placeholder="Enter pincode"
                                    value={supplierForm.pincode}
                                    onChange={handleSupplierChange}
                                    autoComplete="off"
                                />
                            </label>
                        </div>

                        <div className="form-row">
                            <label className="product-field">
                                <span>GST Number</span>
                                <input
                                    type="text"
                                    name="gstNumber"
                                    placeholder="Enter GST number"
                                    value={supplierForm.gstNumber}
                                    onChange={handleSupplierChange}
                                    autoComplete="off"
                                />
                            </label>
                        </div>

                        <div className="product-actions">
                            <button className="cta" type="submit">
                                {editingId ? "Update Supplier" : "Add Supplier"}
                            </button>
                            {editingId && (
                                <button className="btn-secondary" type="button" onClick={handleCancelEdit}>
                                    Cancel Edit
                                </button>
                            )}
                            {supplierMessage && (
                                <span className="status" role="status">
                                    {supplierMessage}
                                </span>
                            )}
                        </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* Supplier List */}
                <div className="card">
                    <div className="card-head">
                        <div>
                            <p className="card-label">Directory</p>
                            <h3>All suppliers ({displayedSuppliers.length})</h3>
                        </div>

                        <div className="card-head-actions">
                            
                            <button
                                className="add-product-btn"
                                onClick={() => {
                                    setEditingId(null);
                                    setSupplierForm(emptyForm);
                                    setSupplierMessage("");
                                    setShowFormModal(true);
                                }}
                            >
                                Add Supplier
                            </button>
                        </div>
                    </div>

                    <div className="product-filters">
                        <input
                            type="search"
                            className="search"
                            placeholder="Search by name, email, or phone..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <select
                            className="sort-select"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                        >
                            <option value="recent">Most Recent</option>
                            <option value="name">Name (A-Z)</option>
                            <option value="city">City (A-Z)</option>
                        </select>
                    </div>

                    {isLoading ? (
                        <div className="table-row empty">
                            <span>Loading suppliers...</span>
                        </div>
                    ) : (
                        <div className="table">
                            <div className="table-row header supplier-row">
                                <span>Name</span>
                                <span>Contact Person</span>
                                <span>Email</span>
                                <span>Phone</span>
                                <span>GST Number</span>
                                <span className="right">Added</span>
                                <span className="right">Actions</span>
                            </div>
                            {displayedSuppliers.length === 0 ? (
                                <div className="table-row empty">
                                    {suppliers.length === 0
                                        ? "No suppliers yet. Create one using the form above!"
                                        : "No suppliers match your search criteria."}
                                </div>
                            ) : (
                                paginatedSuppliers.map((supplier) => (
                                    <div
                                        className="table-row supplier-row"
                                        key={supplier.id}
                                    >
                                        <span className="product-name">
                                            {supplier.name || "Unnamed Supplier"}
                                        </span>
                                        <span className="product-sku">
                                            {supplier.contactPerson || "-"}
                                        </span>
                                        <span className="product-sku">
                                            {supplier.email || "-"}
                                        </span>
                                        <span className="product-sku">
                                            {supplier.phone || "-"}
                                        </span>
                                        <span className="product-sku">
                                            {supplier.gst_number || supplier.gstNumber || "-"}
                                        </span>
                                        <span className="right">{formatDate(supplier.createdAt)}</span>
                                        <span className="right action-buttons">
                                            <button
                                                type="button"
                                                className="icon-btn edit"
                                                onClick={() => handleEditSupplier(supplier)}
                                                title="Edit supplier"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                </svg>
                                            </button>
                                            <button
                                                type="button"
                                                className="icon-btn danger"
                                                onClick={() =>
                                                    handleDeleteSupplier(supplier.id)
                                                }
                                                title="Delete supplier"
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

                    {displayedSuppliers.length > 0 && (
                        <div className="category-pagination">
                            <span className="tag">
                                Showing {(currentPage - 1) * suppliersPerPage + 1}-
                                {Math.min(currentPage * suppliersPerPage, displayedSuppliers.length)} of {displayedSuppliers.length}
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
                                        key={`supplier-page-${page}`}
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
                </div>
            </div>
        </div>
    );
}
