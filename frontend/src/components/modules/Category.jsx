import { useEffect, useState } from "react";

const API_BASE_URL = `http://${window.location.hostname}:4000`;



const emptyForm = {
    name: "",
    categoryCode: "",
    description: "",
    parent_id: "",
    status: "active",
};



export default function Category() {
    const categoriesPerPage = 20;
    const [categories, setCategories] = useState([]);
    const [categoryForm, setCategoryForm] = useState(emptyForm);
    const [categoryMessage, setCategoryMessage] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [showFormModal, setShowFormModal] = useState(false);
    const [filterStatus, setFilterStatus] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);

    // Load categories on mount
    useEffect(() => {
        let active = true;

        const loadCategories = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`${API_BASE_URL}/api/categories`);
                const payload = await response.json();
                if (!response.ok) {
                    throw new Error(payload.message || "Failed to load categories.");
                }
                if (active) {
                    setCategories(payload.data || []);
                }
            } catch (error) {
                if (active) {
                    setCategoryMessage(error.message || "Failed to load categories.");
                }
            } finally {
                if (active) {
                    setIsLoading(false);
                }
            }
        };

        loadCategories();
        return () => {
            active = false;
        };
    }, []);

    const handleCategoryChange = (event) => {
        const { name, value } = event.target;
        setCategoryForm((prev) => ({ ...prev, [name]: value }));
    };

    const validateForm = () => {
        const name = categoryForm.name.trim();

        if (!name) {
            setCategoryMessage("Category name is required.");
            return false;
        }

        return { name };
    };

    const handleAddCategory = async (event) => {
        event.preventDefault();

        const validated = validateForm();
        if (!validated) return;

        try {
            setCategoryMessage("Saving...");
            const url = editingId
                ? `${API_BASE_URL}/api/categories/${editingId}`
                : `${API_BASE_URL}/api/categories`;
            const method = editingId ? "PUT" : "POST";

            const response = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: validated.name,
                    categoryCode: categoryForm.categoryCode.trim() || null,
                    description: categoryForm.description.trim(),
                    parent_id: categoryForm.parent_id || null,
                    status: categoryForm.status,
                }),
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.message || `Failed to ${editingId ? 'update' : 'add'} category.`);
            }

            if (editingId) {
                setCategories((prev) => prev.map((c) => c.id === editingId ? payload.category : c));
                setCategoryMessage("Category updated successfully!");
                setEditingId(null);
            } else {
                setCategories((prev) => [payload.category, ...prev]);
                setCategoryMessage("Category added successfully!");
            }

            setCategoryForm(emptyForm);
            setShowFormModal(false);
            setTimeout(() => setCategoryMessage(""), 3000);
        } catch (error) {
            setCategoryMessage(error.message || `Failed to ${editingId ? 'update' : 'add'} category.`);
        }
    };

    const handleDeleteCategory = async (id, name) => {
        try {
            setCategoryMessage("Deleting...");
            const response = await fetch(`${API_BASE_URL}/api/categories/${id}`, {
                method: "DELETE",
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.message || "Failed to delete category.");
            }
            setCategories((prev) => prev.filter((cat) => cat.id !== id));
            setCategoryMessage("Category deleted successfully!");
            setTimeout(() => setCategoryMessage(""), 3000);
        } catch (error) {
            setCategoryMessage(error.message || "Failed to delete category.");
        }
    };

    const handleEditCategory = (category) => {
        setEditingId(category.id);
        setCategoryForm({
            name: category.name,
            categoryCode: category.categoryCode || "",
            description: category.description || "",
            parent_id: category.parent_id || "",
            status: category.status,
        });
        setShowFormModal(true);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setCategoryForm(emptyForm);
        setCategoryMessage("");
        setShowFormModal(false);
    };

    const handleSearch = async (query) => {
        setSearchQuery(query);
        if (!query.trim()) {
            // Reload all categories if search is cleared
            try {
                const response = await fetch(`${API_BASE_URL}/api/categories`);
                const payload = await response.json();
                if (response.ok) {
                    setCategories(payload.data || []);
                }
            } catch (error) {
                console.error("Error loading categories:", error);
            }
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/categories/search/${query}`);
            const payload = await response.json();
            if (response.ok) {
                setCategories(payload.data || []);
            }
        } catch (error) {
            console.error("Search error:", error);
        }
    };

    const getParentCategoryName = (parentId) => {
        if (!parentId) return "-";
        const parent = categories.find(cat => cat.id === parentId);
        return parent ? parent.name : "-";
    };

    const filteredCategories = categories
        .filter((category) => {
            const matchesStatus = filterStatus === "all" || category.status === filterStatus;
            return matchesStatus;
        })
        .sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }));

    const totalPages = Math.max(1, Math.ceil(filteredCategories.length / categoriesPerPage));
    const paginatedCategories = filteredCategories.slice(
        (currentPage - 1) * categoriesPerPage,
        currentPage * categoriesPerPage
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, filterStatus]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const activeCount = categories.filter((c) => c.status === "active").length;
    const inactiveCount = categories.filter((c) => c.status === "inactive").length;

    return (
        <div className="product-page category-page">
            <div className="product-content">
                {/* Model Overlay */}
                {showFormModal && (
                    <div className="modal-overlay" onClick={() => !editingId && setShowFormModal(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="card">
                                <div className="card-head">
                                    <div>

                                        <h3>{editingId ? "Update category details" : "Create new category"}</h3>
                                    </div>
                                    <button
                                        className="close-btn"
                                        onClick={handleCancelEdit}
                                        title="Close"
                                    >
                                        ✕
                                    </button>
                                </div>

                                <form className="product-form" onSubmit={handleAddCategory} autoComplete="off">
                                    <div className="form-row">
                                        <label className="product-field">
                                            <span>Category Name *</span>
                                            <input
                                                type="text"
                                                name="name"
                                                placeholder="Enter category name"
                                                value={categoryForm.name}
                                                onChange={handleCategoryChange}
                                                autoComplete="off"
                                                required
                                            />
                                        </label>

                                        <label className="product-field">
                                            <span>Category Code </span>
                                            <input
                                                type="text"
                                                name="categoryCode"
                                                placeholder="auto-generation (CAT001, CAT002...)"
                                                value={categoryForm.categoryCode}
                                                onChange={handleCategoryChange}
                                                autoComplete="off"
                                                style={{ textTransform: "uppercase" }}
                                            />
                                        </label>
                                    </div>

                                    <div className="form-row">
                                        <label className="product-field">
                                            <span>Status</span>
                                            <select
                                                name="status"
                                                value={categoryForm.status}
                                                onChange={handleCategoryChange}
                                            >
                                                <option value="active">Active</option>
                                                <option value="inactive">Inactive</option>
                                            </select>
                                        </label>
                                    </div>

                                    <div className="form-row">
                                        <label className="product-field">
                                            <span>Description</span>
                                            <textarea
                                                name="description"
                                                placeholder="Enter category description"
                                                value={categoryForm.description}
                                                onChange={handleCategoryChange}
                                                autoComplete="off"
                                                rows="3"
                                                style={{ fontFamily: "inherit", padding: "10px", borderRadius: "8px", border: "1px solid var(--border)" }}
                                            />
                                        </label>
                                    </div>

                                    <div className="product-actions">
                                        <button className="cta" type="submit">
                                            {editingId ? "Update Category" : "Add Category"}
                                        </button>
                                        {editingId && (
                                            <button className="btn-secondary" type="button" onClick={handleCancelEdit}>
                                                Cancel Edit
                                            </button>
                                        )}
                                        {categoryMessage && (
                                            <span className="status" role="status">
                                                {categoryMessage}
                                            </span>
                                        )}
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* Categories List */}
                <div className="card">
                    <div className="card-head">
                                <div>
                                    <h3>All Categories ({filteredCategories.length})</h3>
                                </div>

                                <div className="card-head-actions">
                                    
                                    <button
                            className="add-product-btn"
                            onClick={() => {
                                setEditingId(null);
                                setCategoryForm(emptyForm);
                                setCategoryMessage("");
                                setShowFormModal(true);
                            }}
                        >
                            Add Category
                        </button>
                                </div>
                            </div>
                    
                    <div className="product-filters">
                        <input
                            type="search"
                            className="search"
                            placeholder="Search categories..."
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                        />
                        <select
                            className="sort-select"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                        
                    </div>

                    {isLoading ? (
                        <div className="table-row empty">
                            <span>Loading categories...</span>
                        </div>
                    ) : (
                        <div className="table">
                            <div className="table-row header category-row">
                                <span>Name</span>
                                <span>Code</span>
                                <span>Description</span>
                                <span>Added Date</span>
                                <span className="center">Status</span>
                                <span className="right">Actions</span>
                            </div>
                            {filteredCategories.length === 0 ? (
                                <div className="table-row empty">
                                    {categories.length === 0
                                        ? "No categories yet. Create one using the button above!"
                                        : "No categories match your filter."}
                                </div>
                            ) : (
                                paginatedCategories.map((category) => (
                                    <div className="table-row category-row" key={category.id}>
                                        <span className="category-name">{category.name}</span>
                                        <span className="category-code">
                                            {category.categoryCode || "-"}
                                        </span>
                                        <span className="category-desc">
                                            {category.description || "-"}
                                        </span>
                                        <span className="category-date">
                                            {category.createdDate ? new Date(category.createdDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "-"}
                                        </span>
                                        <span className="center">
                                            <span className={`status-badge ${category.status}`}>
                                                {category.status === "active" ? "✓ Active" : "✗ Inactive"}
                                            </span>
                                        </span>
                                        <span className="right action-buttons">
                                            <button
                                                type="button"
                                                className="icon-btn edit"
                                                onClick={() => handleEditCategory(category)}
                                                title="Edit category"
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
                                                    handleDeleteCategory(category.id, category.name)
                                                }
                                                title="Delete category"
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

                    {filteredCategories.length > 0 && (
                        <div className="category-pagination">
                            <span className="tag">
                                Showing {(currentPage - 1) * categoriesPerPage + 1}-
                                {Math.min(currentPage * categoriesPerPage, filteredCategories.length)} of {filteredCategories.length}
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
                                        key={page}
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



