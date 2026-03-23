import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = `http://${window.location.hostname}:4000`;

const emptyLine = {
  productId: "",
  quantity: "1",
  purchasePrice: "",
};

const paymentOptions = [
  { value: "paid", label: "Paid" },
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partial" },
];

export default function StockIn() {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [lines, setLines] = useState([emptyLine]);
  const [supplierId, setSupplierId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("unpaid");
  const [notes, setNotes] = useState("");
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [updatingPaymentId, setUpdatingPaymentId] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const currency = useMemo(
    () =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }),
    []
  );

  const loadData = async () => {
    setIsLoading(true);
    setStatus({ state: "idle", message: "" });

    try {
      const [supplierRes, productRes, historyRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/suppliers`),
        fetch(`${API_BASE_URL}/api/products`),
        fetch(`${API_BASE_URL}/api/stock-in`),
      ]);

      const supplierPayload = await supplierRes.json();
      const productPayload = await productRes.json();
      const historyPayload = await historyRes.json();

      if (!supplierRes.ok) {
        throw new Error(supplierPayload.message || "Failed to load suppliers.");
      }

      if (!productRes.ok) {
        throw new Error(productPayload.message || "Failed to load products.");
      }

      if (!historyRes.ok) {
        throw new Error(historyPayload.message || "Failed to load stock-in history.");
      }

      setSuppliers(supplierPayload.data || []);
      setProducts(productPayload.data || []);
      setHistory(historyPayload.data || []);
    } catch (error) {
      setStatus({ state: "error", message: error.message || "Failed to load data." });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProducts = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/products`);
      const payload = await response.json();
      if (response.ok) {
        setProducts(payload.data || []);
      }
    } catch (error) {
      // Silent refresh to avoid interrupting the user flow.
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLineChange = (index, field, value) => {
    setLines((prev) =>
      prev.map((line, idx) => {
        if (idx !== index) {
          return line;
        }

        return { ...line, [field]: value };
      })
    );
  };

  const addLine = () => {
    setLines((prev) => [...prev, emptyLine]);
  };

  const removeLine = (index) => {
    setLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const totals = lines.map((line) => {
    const quantity = Number(line.quantity);
    const price = Number(line.purchasePrice);
    if (Number.isNaN(quantity) || Number.isNaN(price)) {
      return 0;
    }
    return quantity * price;
  });

  const totalAmount = totals.reduce((sum, value) => sum + value, 0);

  const closeCreateModal = () => {
    if (isSaving) {
      return;
    }
    setIsCreateModalOpen(false);
    setStatus({ state: "idle", message: "" });
  };

  const handlePaymentStatusChange = async (entryId, nextStatus) => {
    if (!entryId || !["paid", "unpaid", "partial"].includes(nextStatus)) {
      return;
    }

    setUpdatingPaymentId(entryId);

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

      setHistory((prev) =>
        prev.map((entry) =>
          (entry.id || entry.stockInId) === entryId
            ? { ...entry, paymentStatus: payload.entry?.paymentStatus || nextStatus }
            : entry
        )
      );
      setStatus({ state: "success", message: "Payment status updated successfully." });
      setTimeout(() => setStatus({ state: "idle", message: "" }), 2200);
    } catch (error) {
      setStatus({ state: "error", message: error.message || "Failed to update payment status." });
    } finally {
      setUpdatingPaymentId("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!supplierId) {
      setStatus({ state: "error", message: "Please select a supplier." });
      return;
    }

    const preparedLines = lines
      .map((line) => ({
        productId: line.productId,
        quantity: Number(line.quantity),
        purchasePrice: Number(line.purchasePrice),
      }))
      .filter((line) => line.productId);

    if (!preparedLines.length) {
      setStatus({ state: "error", message: "Please add at least one product." });
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
      setStatus({ state: "error", message: "Please check quantity and price for all products." });
      return;
    }

    setIsSaving(true);
    setStatus({ state: "idle", message: "" });

    try {
      const response = await fetch(`${API_BASE_URL}/api/stock-in`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          supplierId,
          items: preparedLines,
          paymentStatus,
          notes,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Failed to create stock-in entry.");
      }

      setStatus({ state: "success", message: "Stock-in entry created successfully." });
      setLines([emptyLine]);
      setSupplierId("");
      setPaymentStatus("unpaid");
      setNotes("");
      setHistory((prev) => [payload.entry, ...prev]);
      await refreshProducts();
      setIsCreateModalOpen(false);
      setTimeout(() => setStatus({ state: "idle", message: "" }), 2500);
    } catch (error) {
      setStatus({ state: "error", message: error.message || "Failed to create stock-in entry." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="product-page">
      <div className="product-header">
        <div className="product-title-bar stock-header-actions">
          <h1>Stock-In</h1>
          <button
            type="button"
            className="add-product-btn"
            onClick={() => setIsCreateModalOpen(true)}
          >
            Create Stock-In Entry
          </button>
        </div>
        <p className="product-subtitle">
          Create stock-in entries, update inventory, and track purchase history.
        </p>
      </div>

      <div className="product-content">
        <div className="card">
          <div className="card-head">
            <div>
              <p className="card-label">Stock-In History</p>
              <h3>Recent entries</h3>
            </div>
          </div>

          {isLoading && <div className="alert">Loading stock-in data...</div>}

          {!isLoading && (
            <div className="table stock-history-table">
              <div className="table-row header stock-history-row">
                <span>Stock-In ID</span>
                <span>Reference No</span>
                <span>Date</span>
                <span>Supplier ID</span>
                <span>Total Amount</span>
                <span>Payment</span>
                <span>Notes</span>
              </div>
              {history.length === 0 && (
                <div className="table-row empty">
                  <span>No stock-in entries yet.</span>
                </div>
              )}
              {history.map((entry) => {
                const entryId = entry.id || entry.stockInId;
                return (
                  <div key={entryId}>
                    <div className="table-row stock-history-row">
                    <span className="history-id">{entry.stockInId || entry.id || "-"}</span>
                    <span className="history-ref">{entry.referenceNo || "-"}</span>
                    <span className="history-date">
                      {entry.date || entry.created_at
                        ? new Date(entry.date || entry.created_at).toLocaleString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                            day: "2-digit",
                            month: "short",
                            year: "2-digit",
                          })
                        : "-"}
                    </span>
                    <span className="history-supplier">
                      <span>{entry.supplierId || "-"}</span>
                      <span className="history-supplier-name">{entry.supplierName || ""}</span>
                    </span>
                    <span className="price">{currency.format(entry.totalAmount || 0)}</span>
                    <span>
                      <select
                        className={`stock-status-select ${entry.paymentStatus}`}
                        value={entry.paymentStatus || "unpaid"}
                        onChange={(event) => handlePaymentStatusChange(entryId, event.target.value)}
                        disabled={updatingPaymentId === entryId}
                      >
                        {paymentOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </span>
                    <span className="history-notes">{entry.notes || "-"}</span>
                  </div>
                  <div className="stock-history-items">
                    <div className="table stock-items-table">
                      <div className="table-row header stock-items-row">
                        <span>ID</span>
                        <span>Stock-In ID</span>
                        <span>Product ID</span>
                        <span>Quantity</span>
                        <span>Purchase Price</span>
                        <span>Total</span>
                      </div>
                      {(entry.items || []).length === 0 && (
                        <div className="table-row empty">
                          <span>No items added.</span>
                        </div>
                      )}
                      {(entry.items || []).map((item, index) => (
                        <div className="table-row stock-items-row" key={`${entry.id}-detail-${index}`}>
                          <span>{index + 1}</span>
                          <span>{entry.stockInId || entry.id || "-"}</span>
                          <span>{item.productId || "-"}</span>
                          <span>{item.quantity ?? "-"}</span>
                          <span>{currency.format(item.purchasePrice || 0)}</span>
                          <span>{currency.format(item.lineTotal || 0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {isCreateModalOpen && (
        <div className="modal-overlay" onClick={closeCreateModal}>
          <div className="card modal-content stock-modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="card-head">
              <div>
                <p className="card-label">Create Stock-In Entry</p>
                <h3>Add purchase details</h3>
              </div>
              <button type="button" className="close-btn" onClick={closeCreateModal} aria-label="Close">
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <label className="product-field">
                  <span>Select Supplier *</span>
                  <select
                    value={supplierId}
                    onChange={(event) => setSupplierId(event.target.value)}
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

              <label className="product-field">
                <span>Notes</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows="3"
                  placeholder="Optional notes"
                />
              </label>

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
                    {lines.map((line, index) => (
                      <div className="table-row stock-line-row" key={`line-${index}`}>
                        <select
                          value={line.productId}
                          onChange={(event) => handleLineChange(index, "productId", event.target.value)}
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
                          onChange={(event) => handleLineChange(index, "quantity", event.target.value)}
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.purchasePrice}
                          onChange={(event) => handleLineChange(index, "purchasePrice", event.target.value)}
                        />
                        <div className="stock-total">{currency.format(totals[index] || 0)}</div>
                        <button
                          className="icon-btn delete"
                          type="button"
                          onClick={() => removeLine(index)}
                          disabled={lines.length === 1}
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
                <button type="button" className="btn-secondary" onClick={addLine}>
                  Add Product
                </button>
              </div>

              <div className="stock-summary">
                <div>
                  <p className="card-label">Auto Total Calculation</p>
                  <h3>{currency.format(totalAmount)}</h3>
                </div>
                <div className="stock-modal-actions">
                  <button type="button" className="btn-secondary" onClick={closeCreateModal} disabled={isSaving}>
                    Cancel
                  </button>
                  <button type="submit" className="cta" disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Stock-In"}
                  </button>
                </div>
              </div>

              {status.message && (
                <div className={`status ${status.state}`} role="status">
                  {status.message}
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
