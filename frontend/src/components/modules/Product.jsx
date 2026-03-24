import { useEffect, useState, useMemo } from "react";

const API_BASE_URL = `http://${window.location.hostname}:4000`;

const emptyForm = {
    name: "",
    sku: "",
    barcode: "",
    category: "",
    price: "",
    stock: "",
    lowStockThreshold: "0",
};

const emptyStockInLine = {
    productId: "",
    quantity: "1",
    purchasePrice: "",
};

const stockInPaymentOptions = [
    { value: "paid", label: "Paid" },
    { value: "unpaid", label: "Unpaid" },
    { value: "partial", label: "Partial" },
];



export default function Product() {
    const productRowsPerPage = 20;
    const stockHistoryRowsPerPage = 20;
    const [products, setProducts] = useState([]);
    const [productForm, setProductForm] = useState(emptyForm);
    const [productMessage, setProductMessage] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [sortBy, setSortBy] = useState("recent");
    const [editingId, setEditingId] = useState(null);
    const [filterCategory, setFilterCategory] = useState("all");
    const [stockFilter, setStockFilter] = useState("all");
    const [showFormModal, setShowFormModal] = useState(false);
    const [showStockInModal, setShowStockInModal] = useState(false);
    const [barcodeScanner, setBarcodeScanner] = useState("");
    const [scanMessage, setScanMessage] = useState("");

    // Stock-In state
    const [activeTab, setActiveTab] = useState("products");
    const [suppliers, setSuppliers] = useState([]);
    const [stockInLines, setStockInLines] = useState([emptyStockInLine]);
    const [selectedSupplierId, setSelectedSupplierId] = useState("");
    const [stockInPaymentStatus, setStockInPaymentStatus] = useState("unpaid");
    const [stockInHistory, setStockInHistory] = useState([]);
    const [stockInMessage, setStockInMessage] = useState("");
    const [isSavingStockIn, setIsSavingStockIn] = useState(false);
    const [updatingStockInPaymentId, setUpdatingStockInPaymentId] = useState("");
    const [selectedStockInEntry, setSelectedStockInEntry] = useState(null);
    const [productPage, setProductPage] = useState(1);
    const [stockHistoryPage, setStockHistoryPage] = useState(1);
    const [categoriesList, setCategoriesList] = useState([]);

    const currency = useMemo(
        () =>
            new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 2,
            }),
        []
    );

    // Load products, suppliers, and stock-in history on mount
    useEffect(() => {
        let active = true;

        const loadData = async () => {
            setIsLoading(true);
            try {
                const [productRes, supplierRes, stockInRes, categoryRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/products`),
                    fetch(`${API_BASE_URL}/api/suppliers`),
                    fetch(`${API_BASE_URL}/api/stock-in`),
                    fetch(`${API_BASE_URL}/api/categories`),
                ]);

                const productPayload = await productRes.json();
                const supplierPayload = await supplierRes.json();
                const stockInPayload = await stockInRes.json();
                const categoryPayload = await categoryRes.json();

                if (!productRes.ok) {
                    throw new Error(productPayload.message || "Failed to load products.");
                }

                if (active) {
                    setProducts(productPayload.data || []);
                    setSuppliers(supplierPayload.data || []);
                    setStockInHistory(stockInPayload.data || []);
                    setCategoriesList(categoryRes.ok ? (categoryPayload.data || []) : []);
                }
            } catch (error) {
                if (active) {
                    setProductMessage(error.message || "Failed to load products.");
                }
            } finally {
                if (active) {
                    setIsLoading(false);
                }
            }
        };

        loadData();
        return () => {
            active = false;
        };
    }, []);

    const refreshProducts = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/products`);
            const payload = await response.json();
            if (response.ok) {
                setProducts(payload.data || []);
            }
        } catch (error) {
            // Silent refresh to avoid interrupting the flow.
        }
    };

    const handleProductChange = (event) => {
        const { name, value } = event.target;
        setProductForm((prev) => ({ ...prev, [name]: value }));
    };

    const validateForm = () => {
        const name = productForm.name.trim();
        const price = Number(productForm.price);
        const stockValue = productForm.stock === "" ? 0 : Number(productForm.stock);
        const threshold = productForm.lowStockThreshold === "" ? 0 : Number(productForm.lowStockThreshold);

        if (!name) {
            setProductMessage("Product name is required.");
            return false;
        }

        if (Number.isNaN(price) || price < 0) {
            setProductMessage("Please enter a valid price.");
            return false;
        }

        if (Number.isNaN(stockValue) || stockValue < 0) {
            setProductMessage("Please enter a valid stock count.");
            return false;
        }

        if (Number.isNaN(threshold) || threshold < 0) {
            setProductMessage("Please enter a valid low stock threshold.");
            return false;
        }

        return { name, price, stockValue, threshold };
    };

    const handleAddProduct = async (event) => {
        event.preventDefault();

        const validated = validateForm();
        if (!validated) return;

        try {
            setProductMessage("Saving...");

            const barcode = productForm.barcode.trim();

            const url = editingId
                ? `${API_BASE_URL}/api/products/${editingId}`
                : `${API_BASE_URL}/api/products`;
            const method = editingId ? "PUT" : "POST";

            const response = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: validated.name,
                    sku: productForm.sku.trim(),
                    ...(barcode ? { barcode } : {}),
                    category: productForm.category.trim() || "Uncategorized",
                    selling_price: validated.price,
                    stock: validated.stockValue,
                    lowStockThreshold: validated.threshold,
                }),
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.message || `Failed to ${editingId ? 'update' : 'add'} product.`);
            }

            if (editingId) {
                setProducts((prev) => prev.map((p) => p.id === editingId ? payload.product : p));
                setProductMessage("Product updated successfully!");
                setEditingId(null);
            } else {
                setProducts((prev) => [payload.product, ...prev]);
                setProductMessage("Product added successfully!");
            }

            setProductForm(emptyForm);
            setShowFormModal(false);
            setTimeout(() => setProductMessage(""), 3000);
        } catch (error) {
            setProductMessage(error.message || `Failed to ${editingId ? 'update' : 'add'} product.`);
        }
    };

    const handleDeleteProduct = async (id, name) => {


        try {
            setProductMessage("Deleting...");
            const response = await fetch(`${API_BASE_URL}/api/products/${id}`, {
                method: "DELETE",
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.message || "Failed to delete product.");
            }
            setProducts((prev) => prev.filter((product) => product.id !== id));
            setProductMessage("Product removed successfully!");
            setTimeout(() => setProductMessage(""), 3000);
        } catch (error) {
            setProductMessage(error.message || "Failed to delete product.");
        }
    };

    const handleEditProduct = (product) => {
        setEditingId(product.id);
        setProductForm({
            name: product.name,
            sku: product.sku === "-" ? "" : product.sku,
            barcode: product.barcode || "",
            category: product.category || "",
            price: product.price.toString(),
            stock: product.stock.toString(),
            lowStockThreshold: (product.lowStockThreshold ?? 0).toString(),
        });
        setShowFormModal(true);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setProductForm(emptyForm);
        setProductMessage("");
        setShowFormModal(false);
    };

    const handleBarcodeSearch = async (barcode) => {
        if (!barcode || barcode.trim().length === 0) {
            setScanMessage("");
            return;
        }

        try {
            setScanMessage("Searching...");
            const response = await fetch(`${API_BASE_URL}/api/products/search/barcode/${barcode.trim()}`);
            const payload = await response.json();

            if (!response.ok) {
                setScanMessage("Product not found for this barcode.");
                setTimeout(() => setScanMessage(""), 3000);
                setBarcodeScanner("");
                return;
            }

            // Product found - load it into edit form
            const product = payload.product;
            setEditingId(product.id);
            setProductForm({
                name: product.name,
                sku: product.sku === "-" ? "" : product.sku,
                barcode: product.barcode || "",
                category: product.category || "",
                price: product.price.toString(),
                stock: product.stock.toString(),
                lowStockThreshold: (product.lowStockThreshold ?? 0).toString(),
            });
            setShowFormModal(true);
            setScanMessage(`Product found: ${product.name}`);
            setTimeout(() => setScanMessage(""), 2000);
            setBarcodeScanner("");
        } catch (error) {
            setScanMessage("Error searching for product.");
            setTimeout(() => setScanMessage(""), 3000);
            setBarcodeScanner("");
        }
    };

    const handleBulkUpdateThreshold = async () => {
        if (!window.confirm("Update all products' low stock threshold to 50?")) {
            return;
        }

        try {
            setProductMessage("Updating all products...");
            const response = await fetch(`${API_BASE_URL}/api/products/bulk/update-threshold`, {
                method: "PATCH",
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.message || "Failed to update products.");
            }

            // Reload products to get updated data
            const reloadResponse = await fetch(`${API_BASE_URL}/api/products`);
            const reloadPayload = await reloadResponse.json();
            if (reloadResponse.ok) {
                setProducts(reloadPayload.data || []);
            }

            setProductMessage(`Successfully updated ${payload.modifiedCount} products!`);
            setTimeout(() => setProductMessage(""), 3000);
        } catch (error) {
            setProductMessage(error.message || "Failed to update products.");
        }
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

    // Stock-In handlers
    const handleStockInLineChange = (index, field, value) => {
        setStockInLines((prev) =>
            prev.map((line, idx) => {
                if (idx !== index) return line;
                return { ...line, [field]: value };
            })
        );
    };

    const addStockInLine = () => {
        setStockInLines((prev) => [...prev, emptyStockInLine]);
    };

    const removeStockInLine = (index) => {
        setStockInLines((prev) => prev.filter((_, idx) => idx !== index));
    };

    const calculateStockInTotal = () => {
        return stockInLines.reduce((sum, line) => {
            const quantity = Number(line.quantity) || 0;
            const price = Number(line.purchasePrice) || 0;
            return sum + (quantity * price);
        }, 0);
    };

    const handleStockInSubmit = async (event) => {
        event.preventDefault();

        if (!selectedSupplierId) {
            setStockInMessage("Please select a supplier.");
            return;
        }

        const preparedLines = stockInLines
            .map((line) => ({
                productId: line.productId,
                quantity: Number(line.quantity),
                purchasePrice: Number(line.purchasePrice),
            }))
            .filter((line) => line.productId);

        if (!preparedLines.length) {
            setStockInMessage("Please add at least one product.");
            return;
        }

        const invalidLine = preparedLines.find(
            (line) =>
                !line.productId ||
                Number.isNaN(line.quantity) ||
                line.quantity <= 0 ||
                Number.isNaN(line.purchasePrice) ||
                line.purchasePrice < 0
        );

        if (invalidLine) {
            setStockInMessage("Please check quantity and price for all products.");
            return;
        }

        setIsSavingStockIn(true);
        setStockInMessage("");

        try {
            const response = await fetch(`${API_BASE_URL}/api/stock-in`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    supplierId: selectedSupplierId,
                    items: preparedLines,
                    paymentStatus: stockInPaymentStatus,
                }),
            });

            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.message || "Failed to create stock-in entry.");
            }

            setStockInMessage("Stock-in entry created successfully.");
            setStockInLines([emptyStockInLine]);
            setSelectedSupplierId("");
            setStockInPaymentStatus("unpaid");
            setStockInHistory((prev) => [payload.entry, ...prev]);
            setShowStockInModal(false);
            await refreshProducts();
            setTimeout(() => setStockInMessage(""), 2500);
        } catch (error) {
            setStockInMessage(error.message || "Failed to create stock-in entry.");
        } finally {
            setIsSavingStockIn(false);
        }
    };

    const handleStockInPaymentStatusChange = async (entryId, nextStatus) => {
        if (!entryId || !["paid", "unpaid", "partial"].includes(nextStatus)) {
            return;
        }

        setUpdatingStockInPaymentId(entryId);

        try {
            const response = await fetch(`${API_BASE_URL}/api/stock-in/${entryId}/payment-status`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ paymentStatus: nextStatus }),
            });

            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.message || "Failed to update payment status.");
            }

            setStockInHistory((prev) =>
                prev.map((entry) =>
                    (entry.id || entry.stockInId) === entryId
                        ? { ...entry, paymentStatus: payload.entry?.paymentStatus || nextStatus }
                        : entry
                )
            );
            setStockInMessage("Payment status updated successfully.");
            setTimeout(() => setStockInMessage(""), 2200);
        } catch (error) {
            setStockInMessage(error.message || "Failed to update payment status.");
        } finally {
            setUpdatingStockInPaymentId("");
        }
    };

    const openStockInDetails = (entry) => {
        setSelectedStockInEntry(entry);
    };

    const closeStockInDetails = () => {
        setSelectedStockInEntry(null);
    };

    useEffect(() => {
        setProductPage(1);
    }, [searchQuery, filterCategory, sortBy, stockFilter]);

    useEffect(() => {
        setStockHistoryPage(1);
    }, [stockInHistory.length]);

    // Use only categories from API
    let displayedProducts = products.filter((product) => {
        const matchesSearch = (product.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (product.sku || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (product.barcode || "").toLowerCase().includes(searchQuery.toLowerCase());

        const matchesCategory = filterCategory === "all" || product.category === filterCategory;

        const stock = product.stock ?? 0;
        const threshold = product.lowStockThreshold ?? 0;
        const matchesStockFilter =
            stockFilter === "all" ||
            (stockFilter === "in" && stock > 0) ||
            (stockFilter === "out" && stock === 0) ||
            (stockFilter === "low" && stock > 0 && stock < threshold);

        return matchesSearch && matchesCategory && matchesStockFilter;
    });

    if (sortBy === "price-low") {
        displayedProducts = [...displayedProducts].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    } else if (sortBy === "price-high") {
        displayedProducts = [...displayedProducts].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    } else if (sortBy === "stock") {
        displayedProducts = [...displayedProducts].sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));
    } else if (sortBy === "name") {
        displayedProducts = [...displayedProducts].sort((a, b) =>
            (a.name || "").localeCompare(b.name || "")
        );
    }

    const productTotalPages = Math.max(1, Math.ceil(displayedProducts.length / productRowsPerPage));
    const paginatedProducts = displayedProducts.slice(
        (productPage - 1) * productRowsPerPage,
        productPage * productRowsPerPage
    );

    const stockHistoryTotalPages = Math.max(1, Math.ceil(stockInHistory.length / stockHistoryRowsPerPage));
    const paginatedStockHistory = stockInHistory.slice(
        (stockHistoryPage - 1) * stockHistoryRowsPerPage,
        stockHistoryPage * stockHistoryRowsPerPage
    );

    useEffect(() => {
        if (productPage > productTotalPages) {
            setProductPage(productTotalPages);
        }
    }, [productPage, productTotalPages]);

    useEffect(() => {
        if (stockHistoryPage > stockHistoryTotalPages) {
            setStockHistoryPage(stockHistoryTotalPages);
        }
    }, [stockHistoryPage, stockHistoryTotalPages]);

    const lowStockProducts = products.filter((p) => {
        const stock = p.stock ?? 0;
        const threshold = p.lowStockThreshold ?? 0;
        return stock > 0 && stock < threshold;
    }).length;
    const totalValue = products.reduce((sum, p) => sum + (p.price ?? 0) * (p.stock ?? 0), 0);
    const outOfStockCount = products.filter((p) => (p.stock ?? 0) === 0).length;

    return (
        <div className="product-page inventory-page">
            <div className="product-header">
                

                <div className="product-stats">
                    <div className="stat-card">
                        <div className="stat-value">{products.length}</div>
                        <div className="stat-label">Total Products</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value" style={{ color: lowStockProducts > 0 ? "#f59e0b" : "#16a34a" }}>
                            {lowStockProducts}
                        </div>
                        <div className="stat-label">Low Stock Alert</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value" style={{ color: outOfStockCount > 0 ? "#dc2626" : "#16a34a" }}>
                            {outOfStockCount}
                        </div>
                        <div className="stat-label">Out of Stock</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">{currency.format(totalValue)}</div>
                        <div className="stat-label">Inventory Value</div>
                    </div>
                </div>

                <div className="tab-nav">
                    <button
                        className={`tab-btn ${activeTab === "products" ? "active" : ""}`}
                        onClick={() => setActiveTab("products")}
                    >
                        Products
                    </button>
                    <button
                        className={`tab-btn ${activeTab === "stock-in" ? "active" : ""}`}
                        onClick={() => setActiveTab("stock-in")}
                    >
                        Stock-In
                    </button>
                </div>
            </div>

            <div className="product-content">
                {activeTab === "products" && (
                    <>
                        {/* Modal Overlay */}
                        {showFormModal && (
                            <div className="modal-overlay" onClick={() => !editingId && setShowFormModal(false)}>
                                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                                    <div className="card">
                                        <div className="card-head">
                                            <div>
                                                
                                                <h3>{editingId ? "Update product details" : "Create new product"}</h3>
                                            </div>
                                            <button
                                                className="close-btn"
                                                onClick={handleCancelEdit}
                                                title="Close"
                                            >
                                                ✕
                                            </button>
                                        </div>

                                        <form className="product-form" onSubmit={handleAddProduct}>
                                            <div className="form-row">
                                                <label className="product-field">
                                                    <span>Product Name *</span>
                                                    <input
                                                        type="text"
                                                        name="name"
                                                        placeholder="Enter product name"
                                                        value={productForm.name}
                                                        onChange={handleProductChange}
                                                        required
                                                    />
                                                </label>

                                                <label className="product-field">
                                                    <span>Category *</span>
                                                    <select
                                                        name="category"
                                                        value={productForm.category}
                                                        onChange={handleProductChange}
                                                        required
                                                    >
                                                        <option value="">Select category</option>
                                                        {categoriesList.map((cat) => (
                                                            <option key={cat.id} value={cat.name}>
                                                                {cat.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>
                                            </div>

                                            <div className="form-row">
                                                <label className="product-field">
                                                    <span>Barcode</span>
                                                    <input
                                                        type="text"
                                                        name="barcode"
                                                        placeholder="Enter barcode (optional)"
                                                        value={productForm.barcode}
                                                        onChange={handleProductChange}
                                                    />
                                                </label>

                                                <label className="product-field">
                                                    <span>Low Stock Threshold *</span>
                                                    <input
                                                        type="number"
                                                        name="lowStockThreshold"
                                                        placeholder="0"
                                                        value={productForm.lowStockThreshold}
                                                        onChange={handleProductChange}
                                                        min="0"
                                                        step="1"
                                                        required
                                                    />
                                                </label>
                                            </div>

                                            <div className="form-row">
                                                <label className="product-field">
                                                    <span>Price (₹) *</span>
                                                    <input
                                                        type="number"
                                                        name="price"
                                                        placeholder="0.00"
                                                        value={productForm.price}
                                                        onChange={handleProductChange}
                                                        min="0"
                                                        step="0.01"
                                                        required
                                                    />
                                                </label>

                                                <label className="product-field">
                                                    <span>Initial Quantity *</span>
                                                    <input
                                                        type="number"
                                                        name="stock"
                                                        placeholder="0"
                                                        value={productForm.stock}
                                                        onChange={handleProductChange}
                                                        min="0"
                                                        step="1"
                                                        required
                                                    />
                                                </label>
                                            </div>

                                            <div className="product-actions">
                                                <button className="cta" type="submit">
                                                    {editingId ? "Update Product" : "Add Product"}
                                                </button>
                                                {editingId && (
                                                    <button className="btn-secondary" type="button" onClick={handleCancelEdit}>
                                                        Cancel Edit
                                                    </button>
                                                )}
                                                {productMessage && (
                                                    <span className="status" role="status">
                                                        {productMessage}
                                                    </span>
                                                )}
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Product List */}
                        <div className="card">
                            <div className="card-head">
                                <div>
                                    
                                    <h3>All Products ({displayedProducts.length})</h3>
                                </div>

                                <div className="card-head-actions">
                                    
                                    <button
                                        className="add-product-btn"
                                        onClick={() => {
                                            setEditingId(null);
                                            setProductForm(emptyForm);
                                            setProductMessage("");
                                            setShowFormModal(true);
                                        }}
                                    >
                                        Add Product
                                    </button>
                                </div>
                            </div>

                            <div className="product-filters">
                                <input
                                    type="text"
                                    className="search"
                                    placeholder="Scan barcode here..."
                                    value={barcodeScanner}
                                    onChange={(e) => setBarcodeScanner(e.target.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === "Enter") {
                                            handleBarcodeSearch(barcodeScanner);
                                        }
                                    }}
                                    autoFocus
                                />
                                {scanMessage && (
                                    <span className="scan-status" style={{ color: scanMessage.includes("not found") ? "#dc2626" : "#16a34a" }}>
                                        {scanMessage}
                                    </span>
                                )}
                                <input
                                    type="search"
                                    className="search"
                                    placeholder="Search by name, SKU, or barcode..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                <select
                                    className="sort-select"
                                    value={filterCategory}
                                    onChange={(e) => setFilterCategory(e.target.value)}
                                >
                                    <option value="all">All Categories</option>
                                    {categoriesList.map((cat) => (
                                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                                    ))}
                                </select>
                                <select
                                    className="sort-select"
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                >
                                    <option value="recent">Most Recent</option>
                                    <option value="name">Name (A-Z)</option>
                                    <option value="price-low">Price: Low to High</option>
                                    <option value="price-high">Price: High to Low</option>
                                    <option value="stock">Stock: Low to High</option>
                                </select>
                                <select
                                    className="sort-select"
                                    value={stockFilter}
                                    onChange={(e) => setStockFilter(e.target.value)}
                                >
                                    <option value="all">All Stock</option>
                                    <option value="in">In Stock</option>
                                    <option value="out">Out Stock</option>
                                    <option value="low">Low Stock</option>
                                </select>
                            </div>

                            {isLoading ? (
                                <div className="table-row empty">
                                    <span>Loading products...</span>
                                </div>
                            ) : (
                                <div className="table">
                                    <div className="table-row header product-row">
                                        <span>Name</span>
                                        <span>Category</span>
                                        <span>Barcode</span>
                                        <span className="right">Purchase Price</span>
                                        <span className="right">Selling Price</span>
                                        <span className="right">Stock</span>
                                        <span className="right">Added</span>
                                        <span className="right">Actions</span>
                                    </div>
                                    {displayedProducts.length === 0 ? (
                                        <div className="table-row empty">
                                            {products.length === 0
                                                ? "No products yet. Create one using the form above!"
                                                : "No products match your search criteria."}
                                        </div>
                                    ) : (
                                        paginatedProducts.map((product) => (
                                            <div
                                                className={`table-row product-row ${(product.stock ?? 0) > 0 && (product.stock ?? 0) < (product.lowStockThreshold ?? 0) ? "low-stock" : ""
                                                    } ${(product.stock ?? 0) === 0 ? "out-of-stock" : ""}`}
                                                key={product.id}
                                            >
                                                <span className="product-name">
                                                    {product.name || "Unnamed Product"}
                                                    {(product.stock ?? 0) === 0 && <span className="out-badge">OUT</span>}
                                                </span>
                                                <span className="product-category">{product.category || "Uncategorized"}</span>
                                                <span className="product-sku">{product.barcode || "-"}</span>
                                                <span className="right price">
                                                    {currency.format(product.purchasePrice ?? product.purchase_price ?? 0)}
                                                </span>
                                                <span className="right price">
                                                    {currency.format(product.price ?? 0)}
                                                </span>
                                                <span className="right">
                                                    <span
                                                        className={`stock-badge ${(product.stock ?? 0) === 0 ? "out" : (product.stock ?? 0) < (product.lowStockThreshold ?? 0) ? "critical" : ""
                                                            }`}
                                                    >
                                                        {product.stock ?? 0}
                                                    </span>
                                                </span>
                                                <span className="right">{formatDate(product.addedAt)}</span>
                                                <span className="right action-buttons">
                                                    <button
                                                        type="button"
                                                        className="icon-btn edit"
                                                        onClick={() => handleEditProduct(product)}
                                                        title="Edit product"
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
                                                            handleDeleteProduct(product.id, product.name || "this product")
                                                        }
                                                        title="Delete product"
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

                            {displayedProducts.length > 0 && (
                                <div className="category-pagination">
                                    <span className="tag">
                                        Showing {(productPage - 1) * productRowsPerPage + 1}-
                                        {Math.min(productPage * productRowsPerPage, displayedProducts.length)} of {displayedProducts.length}
                                    </span>
                                    <div className="category-pagination-controls">
                                        <button
                                            type="button"
                                            className="category-page-btn icon"
                                            onClick={() => setProductPage((prev) => Math.max(1, prev - 1))}
                                            disabled={productPage === 1}
                                            aria-label="Previous page"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <polyline points="15 18 9 12 15 6"></polyline>
                                            </svg>
                                        </button>
                                        {Array.from({ length: productTotalPages }, (_, index) => index + 1).map((page) => (
                                            <button
                                                key={`product-page-${page}`}
                                                type="button"
                                                className={`category-page-btn ${page === productPage ? "active" : ""}`.trim()}
                                                onClick={() => setProductPage(page)}
                                                aria-current={page === productPage ? "page" : undefined}
                                            >
                                                {page}
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            className="category-page-btn icon"
                                            onClick={() => setProductPage((prev) => Math.min(productTotalPages, prev + 1))}
                                            disabled={productPage === productTotalPages}
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
                    </>
                )}

                {activeTab === "stock-in" && (
                    <>


                        {/* Stock-In History Card */}
                        <div className="card">
                            <div className="card-head">
                                <div>
                                    
                                    <h3>Recent entries ({stockInHistory.length})</h3>
                                </div>
                                <button
                                    type="button"
                                    className="add-product-btn"
                                    onClick={() => setShowStockInModal(true)}
                                >
                                    Create Stock-In Entry
                                </button>
                            </div>

                            {isLoading ? (
                                <div className="alert">Loading stock-in data...</div>
                            ) : (
                                <div className="table stock-history-table">
                                    <div className="table-row header stock-history-row">
                                        <span>Date & Time</span>
                                        <span>Supplier</span>
                                        <span>Total</span>
                                        <span>Payment</span>
                                        <span>Actions</span>
                                    </div>
                                    {stockInHistory.length === 0 ? (
                                        <div className="table-row empty">
                                            <span>No stock-in entries yet.</span>
                                        </div>
                                    ) : (
                                        paginatedStockHistory.map((entry) => {
                                            const entryId = entry.id || entry.stockInId;
                                            const items = entry.items || [];
                                            const createdAt = entry.created_at ? new Date(entry.created_at) : null;
                                            const isValidDate = createdAt && !Number.isNaN(createdAt.getTime());

                                            return (
                                                <div className="table-row stock-history-row" key={entryId}>
                                                    <span className="history-date">
                                                        <span className="history-date-main">
                                                            {isValidDate
                                                                ? createdAt.toLocaleDateString("en-IN", {
                                                                    day: "2-digit",
                                                                    month: "short",
                                                                    year: "2-digit",
                                                                })
                                                                : "-"}
                                                        </span>
                                                        <span className="history-date-sub">
                                                            {isValidDate
                                                                ? createdAt.toLocaleTimeString("en-IN", {
                                                                    hour: "2-digit",
                                                                    minute: "2-digit",
                                                                    hour12: true,
                                                                })
                                                                : ""}
                                                        </span>
                                                    </span>
                                                    <span className="history-supplier">
                                                        <span className="history-supplier-name">{entry.supplierName || "-"}</span>
                                                        <span className="history-supplier-meta">{items.length} items</span>
                                                    </span>
                                                    <span className="history-amount">
                                                        <span className="price">{currency.format(entry.totalAmount || 0)}</span>
                                                        <span className="history-amount-label">Stock Value</span>
                                                    </span>
                                                    <span>
                                                        <select
                                                            className={`stock-status-select ${entry.paymentStatus}`}
                                                            value={entry.paymentStatus || "unpaid"}
                                                            onChange={(event) => handleStockInPaymentStatusChange(entryId, event.target.value)}
                                                            disabled={updatingStockInPaymentId === entryId}
                                                        >
                                                            {stockInPaymentOptions.map((option) => (
                                                                <option key={option.value} value={option.value}>
                                                                    {option.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </span>
                                                    <span className="right action-buttons">
                                                        <button
                                                            type="button"
                                                            className="icon-btn history"
                                                            title="View stock-in details"
                                                            onClick={() => openStockInDetails(entry)}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"></path>
                                                                <circle cx="12" cy="12" r="3"></circle>
                                                            </svg>
                                                        </button>
                                                    </span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}

                            {stockInHistory.length > 0 && (
                                <div className="category-pagination">
                                    <span className="tag">
                                        Showing {(stockHistoryPage - 1) * stockHistoryRowsPerPage + 1}-
                                        {Math.min(stockHistoryPage * stockHistoryRowsPerPage, stockInHistory.length)} of {stockInHistory.length}
                                    </span>
                                    <div className="category-pagination-controls">
                                        <button
                                            type="button"
                                            className="category-page-btn icon"
                                            onClick={() => setStockHistoryPage((prev) => Math.max(1, prev - 1))}
                                            disabled={stockHistoryPage === 1}
                                            aria-label="Previous page"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <polyline points="15 18 9 12 15 6"></polyline>
                                            </svg>
                                        </button>
                                        {Array.from({ length: stockHistoryTotalPages }, (_, index) => index + 1).map((page) => (
                                            <button
                                                key={`history-page-${page}`}
                                                type="button"
                                                className={`category-page-btn ${page === stockHistoryPage ? "active" : ""}`.trim()}
                                                onClick={() => setStockHistoryPage(page)}
                                                aria-current={page === stockHistoryPage ? "page" : undefined}
                                            >
                                                {page}
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            className="category-page-btn icon"
                                            onClick={() => setStockHistoryPage((prev) => Math.min(stockHistoryTotalPages, prev + 1))}
                                            disabled={stockHistoryPage === stockHistoryTotalPages}
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

                        {selectedStockInEntry && (
                            <div className="modal-overlay" onClick={closeStockInDetails}>
                                <div className="modal-content stock-modal-content" onClick={(e) => e.stopPropagation()}>
                                    <div className="card">
                                        <div className="card-head">
                                            <div>
                                                <p className="card-label">Stock-In History</p>
                                                <h3>Entry Details</h3>
                                            </div>
                                            <button
                                                className="close-btn"
                                                onClick={closeStockInDetails}
                                                title="Close"
                                            >
                                                ✕
                                            </button>
                                        </div>

                                        <div className="stock-detail-meta">
                                            <div>
                                                <p className="card-label">Supplier</p>
                                                <strong>{selectedStockInEntry.supplierName || "-"}</strong>
                                            </div>
                                            <div>
                                                <p className="card-label">Date & Time</p>
                                                <strong>
                                                    {selectedStockInEntry.created_at
                                                        ? new Date(selectedStockInEntry.created_at).toLocaleString("en-IN", {
                                                            day: "2-digit",
                                                            month: "short",
                                                            year: "2-digit",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                            hour12: true,
                                                        })
                                                        : "-"}
                                                </strong>
                                            </div>
                                            <div>
                                                <p className="card-label">Total Amount</p>
                                                <strong className="price">{currency.format(selectedStockInEntry.totalAmount || 0)}</strong>
                                            </div>
                                        </div>

                                        <div className="table">
                                            <div className="table-row header stock-detail-row">
                                                <span>Product</span>
                                                <span>Quantity</span>
                                                <span>Purchase Price</span>
                                                <span>Total</span>
                                            </div>
                                            {(selectedStockInEntry.items || []).length === 0 ? (
                                                <div className="table-row empty">
                                                    <span>No items found for this entry.</span>
                                                </div>
                                            ) : (
                                                (selectedStockInEntry.items || []).map((item, index) => (
                                                    <div className="table-row stock-detail-row" key={`${selectedStockInEntry.id || selectedStockInEntry.stockInId}-detail-${index}`}>
                                                        <span>{item.productName || item.productId || "-"}</span>
                                                        <span>{item.quantity ?? "-"}</span>
                                                        <span>{currency.format(item.purchasePrice || 0)}</span>
                                                        <span>{currency.format(item.lineTotal || ((item.quantity || 0) * (item.purchasePrice || 0)))}</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {showStockInModal && (
                            <div className="modal-overlay" onClick={() => !isSavingStockIn && setShowStockInModal(false)}>
                                <div className="modal-content stock-modal-content" onClick={(e) => e.stopPropagation()}>
                                    <div className="card">
                                        <div className="card-head">
                                            <div>
                                                
                                                <h3>Add purchase details and update inventory</h3>
                                            </div>
                                            <button
                                                className="close-btn"
                                                onClick={() => !isSavingStockIn && setShowStockInModal(false)}
                                                title="Close"
                                            >
                                                ✕
                                            </button>
                                        </div>

                                        <form onSubmit={handleStockInSubmit}>
                                            <div className="form-row">
                                                <label className="product-field">
                                                    <span>Select Supplier *</span>
                                                    <select
                                                        value={selectedSupplierId}
                                                        onChange={(e) => setSelectedSupplierId(e.target.value)}
                                                        required
                                                    >
                                                        <option value="">Choose supplier</option>
                                                        {suppliers.map((supplier) => (
                                                            <option key={supplier.id} value={supplier.id}>
                                                                {supplier.name || supplier.supplier_name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>
                                            </div>

                                            <div className="stock-lines">
                                                <div className="table">
                                                    <div className="table-row header stock-line-row">
                                                        <span>Product</span>
                                                        <span>Quantity</span>
                                                        <span>Purchase Price</span>
                                                        <span>Total</span>
                                                        <span></span>
                                                    </div>
                                                    <div className="stock-lines-scroll">
                                                        {stockInLines.map((line, index) => (
                                                            <div className="table-row stock-line-row" key={`stock-line-${index}`}>
                                                                <select
                                                                    value={line.productId}
                                                                    onChange={(e) => handleStockInLineChange(index, "productId", e.target.value)}
                                                                >
                                                                    <option value="">Select product</option>
                                                                    {products.map((product) => (
                                                                        <option key={product.id} value={product.id}>
                                                                            {product.name || product.product_name}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    value={line.quantity}
                                                                    onChange={(e) => handleStockInLineChange(index, "quantity", e.target.value)}
                                                                />
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    value={line.purchasePrice}
                                                                    onChange={(e) => handleStockInLineChange(index, "purchasePrice", e.target.value)}
                                                                />
                                                                <div className="stock-total">
                                                                    {currency.format((Number(line.quantity) || 0) * (Number(line.purchasePrice) || 0))}
                                                                </div>
                                                                <button
                                                                    className="icon-btn delete"
                                                                    type="button"
                                                                    onClick={() => removeStockInLine(index)}
                                                                    disabled={stockInLines.length === 1}
                                                                    title="Remove line"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <button type="button" className="btn-secondary" onClick={addStockInLine}>
                                                    Add Product Line
                                                </button>
                                            </div>

                                            <div className="stock-summary">
                                                <div>
                                                    <p className="card-label">Total Amount</p>
                                                    <h3>{currency.format(calculateStockInTotal())}</h3>
                                                </div>
                                                <div className="stock-modal-actions">
                                                    <button
                                                        type="button"
                                                        className="btn-secondary"
                                                        onClick={() => !isSavingStockIn && setShowStockInModal(false)}
                                                        disabled={isSavingStockIn}
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button type="submit" className="cta" disabled={isSavingStockIn}>
                                                        {isSavingStockIn ? "Saving..." : "Save Stock-In"}
                                                    </button>
                                                </div>
                                            </div>

                                            {stockInMessage && (
                                                <div className={`status ${stockInMessage.includes("successfully") ? "success" : "error"}`} role="status">
                                                    {stockInMessage}
                                                </div>
                                            )}
                                        </form>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
