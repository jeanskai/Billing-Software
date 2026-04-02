import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL = `http://${window.location.hostname}:4000`;

const paymentMethods = ["cash", "card", "upi"];
const taxTypes = [
  { value: "gst", label: "GST" },
  { value: "cgst_sgst", label: "CGST + SGST" },
  { value: "igst", label: "IGST" },
  { value: "vat", label: "VAT" },
  { value: "none", label: "No Tax" },
];

const formatInr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const roundCurrency = (value) => Number((Number(value) || 0).toFixed(2));

const numberToWordsInr = (amount) => {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const twoDigitWords = (num) => {
    if (num < 20) {
      return ones[num];
    }
    const ten = Math.floor(num / 10);
    const rem = num % 10;
    return `${tens[ten]}${rem ? ` ${ones[rem]}` : ""}`.trim();
  };

  const threeDigitWords = (num) => {
    const hundred = Math.floor(num / 100);
    const rem = num % 100;
    const hundredPart = hundred ? `${ones[hundred]} Hundred` : "";
    const remPart = rem ? twoDigitWords(rem) : "";
    return `${hundredPart}${hundredPart && remPart ? " " : ""}${remPart}`.trim();
  };

  const integerToIndianWords = (num) => {
    if (num === 0) {
      return "Zero";
    }

    const parts = [];
    const crore = Math.floor(num / 10000000);
    num %= 10000000;
    const lakh = Math.floor(num / 100000);
    num %= 100000;
    const thousand = Math.floor(num / 1000);
    num %= 1000;
    const rest = num;

    if (crore) {
      parts.push(`${threeDigitWords(crore)} Crore`);
    }
    if (lakh) {
      parts.push(`${threeDigitWords(lakh)} Lakh`);
    }
    if (thousand) {
      parts.push(`${threeDigitWords(thousand)} Thousand`);
    }
    if (rest) {
      parts.push(threeDigitWords(rest));
    }

    return parts.join(" ").trim();
  };

  const normalizedAmount = Math.max(roundCurrency(amount), 0);
  const rupees = Math.floor(normalizedAmount);
  const paise = Math.round((normalizedAmount - rupees) * 100);

  const rupeeWords = integerToIndianWords(rupees);
  if (!paise) {
    return `Rupees ${rupeeWords} Only`;
  }

  const paiseWords = integerToIndianWords(paise);
  return ` ${rupeeWords} and ${paiseWords} Rupees Only`;
};

const normalizeDiscountType = (type) => {
  if (["flat", "percent"].includes(type)) {
    return type;
  }
  return "none";
};

const normalizeCustomer = (customer) => ({
  id: customer?.id || "",
  name: customer?.name || "",
  email: customer?.email || "",
  phone: customer?.phone || customer?.mobile || "",
});

const hasCustomerData = (customer) =>
  Boolean((customer?.name || "").trim() || (customer?.email || "").trim() || (customer?.phone || "").trim());

const createProductPickerRow = (seed = {}) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  value: seed.value || "",
  searchText: seed.searchText || "",
  quantity: seed.quantity || "1",
});

const getProductLabel = (product) => product?.name;

export default function Billing() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [returns, setReturns] = useState([]);
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [cartItems, setCartItems] = useState([]);
  const [discountType, setDiscountType] = useState("none");
  const [discountValue, setDiscountValue] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paidAmount, setPaidAmount] = useState("0");
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastInvoice, setLastInvoice] = useState(null);
  const [lastGeneratedSale, setLastGeneratedSale] = useState(null);

  const [selectedSaleId, setSelectedSaleId] = useState("");
  const [selectedSale, setSelectedSale] = useState(null);
  const [returnQuantities, setReturnQuantities] = useState({});
  const [refundMethod, setRefundMethod] = useState("cash");
  const [returnReason, setReturnReason] = useState("");
  const [isReturning, setIsReturning] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedInvoiceCustomer, setSelectedInvoiceCustomer] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showInvoiceDetailsModal, setShowInvoiceDetailsModal] = useState(false);
  const [receivePaymentAmount, setReceivePaymentAmount] = useState("");
  const [receivePaymentMethod, setReceivePaymentMethod] = useState("cash");
  const [isReceivingPayment, setIsReceivingPayment] = useState(false);
  const [taxType, setTaxType] = useState("cgst_sgst");
  const [productPickerRows, setProductPickerRows] = useState(() => [createProductPickerRow()]);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [showReturnDetailsModal, setShowReturnDetailsModal] = useState(false);
  const [showReturnProcessModal, setShowReturnProcessModal] = useState(false);
  const [historyTab, setHistoryTab] = useState("invoices");
  const [invoicePage, setInvoicePage] = useState(1);
  const [returnPage, setReturnPage] = useState(1);
  const billingCartTableRef = useRef(null);
  const shouldScrollToLatestRowRef = useRef(false);
  const invoicesPerPage = 20;
  const returnsPerPage = 20;

  const loadData = async () => {
    setStatus({ state: "loading", message: "Loading billing data..." });
    try {
      const [productRes, categoryRes, customerRes, saleRes, returnRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/billing/products`),
        fetch(`${API_BASE_URL}/api/categories`),
        fetch(`${API_BASE_URL}/api/customers`),
        fetch(`${API_BASE_URL}/api/billing/sales`),
        fetch(`${API_BASE_URL}/api/billing/returns`),
      ]);

      const productPayload = await productRes.json();
      const categoryPayload = await categoryRes.json();
      const customerPayload = await customerRes.json();
      const salePayload = await saleRes.json();
      const returnPayload = await returnRes.json();

      if (!productRes.ok) {
        throw new Error(productPayload.message || "Failed to load products.");
      }

      if (!categoryRes.ok) {
        throw new Error(categoryPayload.message || "Failed to load categories.");
      }

      if (!customerRes.ok) {
        throw new Error(customerPayload.message || "Failed to load customers.");
      }

      if (!saleRes.ok) {
        throw new Error(salePayload.message || "Failed to load sales.");
      }

      if (!returnRes.ok) {
        throw new Error(returnPayload.message || "Failed to load returns.");
      }

      setProducts(productPayload.data || []);
      setCategories(categoryPayload.data || []);
      setCustomers(customerPayload.data || []);
      setSales(salePayload.data || []);
      setReturns(returnPayload.data || []);
      setStatus({ state: "idle", message: "" });
    } catch (error) {
      setStatus({ state: "error", message: error.message || "Failed to load billing data." });
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const taxByCategory = useMemo(
    () =>
      new Map(
        categories.map((category) => [
          category.name,
          Number(category.gstTaxSlab) || 0,
        ])
      ),
    [categories]
  );

  const filteredProducts = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) {
      return products.slice(0, 20);
    }

    return products
      .filter((product) => {
        const name = (product.name || "").toLowerCase();
        const sku = (product.sku || "").toLowerCase();
        const barcode = (product.barcode || "").toLowerCase();
        return name.includes(normalized) || sku.includes(normalized) || barcode.includes(normalized);
      })
      .slice(0, 40);
  }, [products, searchQuery]);

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })),
    [products]
  );

  const cartWithTotals = useMemo(() => {
    const normalizedDiscountType = normalizeDiscountType(discountType);
    const discountValueNumber = Number(discountValue || 0);

    const baseLines = productPickerRows
      .map((row) => {
        const matchedProduct = products.find((product) => String(product.id) === row.value);
        if (!matchedProduct) {
          return null;
        }

        const qty = Number(row.quantity) || 0;
        const price = Number(matchedProduct.price) || 0;
      const lineSubTotal = roundCurrency(qty * price);
        const taxRate = Number(taxByCategory.get(matchedProduct.category) || 18);

        return {
        rowId: row.id,
        productId: matchedProduct.id,
        name: matchedProduct.name,
        sku: matchedProduct.sku,
        barcode: matchedProduct.barcode,
        category: matchedProduct.category,
        price,
        availableStock: Number(matchedProduct.stock) || 0,
        quantity: qty,
        lineSubTotal,
        taxRate,
        };
      })
      .filter(Boolean);

    const subTotal = roundCurrency(baseLines.reduce((sum, line) => sum + line.lineSubTotal, 0));

    let discountAmount = 0;
    if (normalizedDiscountType === "flat") {
      discountAmount = Math.min(roundCurrency(discountValueNumber), subTotal);
    } else if (normalizedDiscountType === "percent") {
      discountAmount = roundCurrency((subTotal * Math.min(Math.max(discountValueNumber, 0), 100)) / 100);
    }

    let discountRemaining = discountAmount;

    const lines = baseLines.map((line, index) => {
      const allocated =
        index === baseLines.length - 1
          ? discountRemaining
          : roundCurrency((line.lineSubTotal / Math.max(subTotal, 1)) * discountAmount);

      const lineDiscount = Math.min(allocated, line.lineSubTotal);
      discountRemaining = roundCurrency(discountRemaining - lineDiscount);

      const taxableAmount = roundCurrency(Math.max(line.lineSubTotal - lineDiscount, 0));
      const taxAmount = roundCurrency((taxableAmount * line.taxRate) / 100);
      const lineTotal = roundCurrency(taxableAmount + taxAmount);

      return {
        ...line,
        lineDiscount,
        taxableAmount,
        taxAmount,
        lineTotal,
      };
    });

    const taxTotal = roundCurrency(lines.reduce((sum, line) => sum + line.taxAmount, 0));
    const grandTotal = roundCurrency(lines.reduce((sum, line) => sum + line.lineTotal, 0));

    // Calculate tax breakdown based on tax type
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let vat = 0;

    if (taxType === "cgst_sgst") {
      cgst = roundCurrency(taxTotal / 2);
      sgst = roundCurrency(taxTotal / 2);
    } else if (taxType === "igst") {
      igst = taxTotal;
    } else if (taxType === "vat") {
      vat = taxTotal;
    } else if (taxType === "none") {
      // No tax
    } else {
      // Default GST
      cgst = roundCurrency(taxTotal / 2);
      sgst = roundCurrency(taxTotal / 2);
    }

    return {
      lines,
      subTotal,
      discountAmount,
      taxTotal,
      cgst,
      sgst,
      igst,
      vat,
      grandTotal,
    };
  }, [productPickerRows, products, discountType, discountValue, taxByCategory, taxType]);

  const addToCart = (product) => {
    if (!product || product.stock <= 0) {
      setStatus({ state: "error", message: "Product is out of stock." });
      return;
    }

    setProductPickerRows((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        value: String(product.id),
        searchText: getProductLabel(product),
        quantity: "1",
      },
    ]);

    setStatus({ state: "success", message: `${product.name} added to cart.` });
    setTimeout(() => setStatus({ state: "idle", message: "" }), 1800);
  };

  const updateCartQuantity = (rowId, value) => {
    const quantity = Number(value);

    setProductPickerRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        if (Number.isNaN(quantity) || quantity <= 0) {
          return { ...row, quantity: "1" };
        }

        return {
          ...row,
          quantity: String(quantity),
        };
      })
    );
  };

  const removeFromCart = (rowId) => {
    setProductPickerRows((prev) => {
      const nextRows = prev.filter((row) => row.id !== rowId);
      return nextRows.length ? nextRows : [createProductPickerRow()];
    });
  };

  const handleBarcodeAdd = async () => {
    const trimmed = barcodeInput.trim();
    if (!trimmed) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/billing/products/search/barcode/${encodeURIComponent(trimmed)}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Product not found for this barcode.");
      }

      addToCart(payload.product);
      setBarcodeInput("");
    } catch (error) {
      setStatus({ state: "error", message: error.message || "Failed to add barcode item." });
    }
  };

  const handleAddProductPickerRow = () => {
    shouldScrollToLatestRowRef.current = true;
    setProductPickerRows((prev) => [...prev, createProductPickerRow()]);
  };

  useEffect(() => {
    if (!shouldScrollToLatestRowRef.current) {
      return;
    }

    const tableEl = billingCartTableRef.current;
    if (tableEl) {
      tableEl.scrollTop = tableEl.scrollHeight;
      const rows = tableEl.querySelectorAll(".billing-cart-picker-row");
      const lastRow = rows[rows.length - 1];
      if (lastRow) {
        lastRow.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }

    shouldScrollToLatestRowRef.current = false;
  }, [productPickerRows]);

  const handleProductPickerChange = (rowId, value) => {
    setProductPickerRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        const selectedProduct = products.find((product) => String(product.id) === String(value));

        return {
          ...row,
          value,
          searchText: selectedProduct ? getProductLabel(selectedProduct) : "",
        };
      })
    );
  };

  const handleProductPickerInputChange = (rowId, text) => {
    const normalized = text.trim().toLowerCase();

    setProductPickerRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        if (!normalized) {
          return { ...row, searchText: text, value: "" };
        }

        const exactMatch = products.find((product) => {
          const name = (product.name || "").toLowerCase();
          const sku = (product.sku || "").toLowerCase();
          const barcode = (product.barcode || "").toLowerCase();
          return name === normalized || sku === normalized || barcode === normalized;
        });

        if (!exactMatch) {
          return { ...row, searchText: text, value: "" };
        }

        return {
          ...row,
          searchText: text,
          value: String(exactMatch.id),
        };
      })
    );
  };

  const renderInvoicePrint = (invoiceData, fallbackCustomer, printWindow) => {
    const escapeHtml = (value) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const customer = hasCustomerData(normalizeCustomer(invoiceData?.customer))
      ? normalizeCustomer(invoiceData.customer)
      : normalizeCustomer(fallbackCustomer);
    const invoiceNo = invoiceData?.invoiceNo || lastInvoice?.invoiceNo || `INV-${Date.now()}`;
    const invoiceDate = new Date(invoiceData?.saleDate || invoiceData?.created_at || Date.now());
    const paymentMethodLabel = (invoiceData?.paymentMethod || paymentMethod || "cash").toUpperCase();
    const subTotal = Number(invoiceData?.subTotal || 0);
    const discountAmount = Number(invoiceData?.discountAmount || 0);
    const taxTotal = Number(invoiceData?.taxTotal || 0);
    const grandTotal = Number(invoiceData?.grandTotal || 0);
    const discountTypeValue = normalizeDiscountType(invoiceData?.discountType || "none");
    const discountValueNumber = Number(invoiceData?.discountValue || 0);
    const invoiceTaxType = invoiceData?.taxType || "cgst_sgst";
    const grandTotalInWords = numberToWordsInr(grandTotal);
    const discountLabel =
      discountTypeValue === "percent"
        ? `Discount (${discountValueNumber}%)`
        : discountTypeValue === "flat"
          ? "Discount (Flat)"
          : "Discount";
    const items = Array.isArray(invoiceData?.items) ? invoiceData.items : [];

    const rows = items
      .map((item, index) => {
        const quantity = Number(item.quantity || 0);
        const rate = Number(item.unitPrice || item.price || 0);
        const taxAmount = Number(item.taxAmount || 0);
        const lineTotal = Number(item.lineTotal || 0);
        const hasSplitTax = invoiceTaxType === "cgst_sgst" || invoiceTaxType === "gst";
        const cgstAmount = hasSplitTax ? roundCurrency(taxAmount / 2) : 0;
        const sgstAmount = hasSplitTax ? roundCurrency(taxAmount / 2) : 0;
        const taxRateHalf = roundCurrency(Number(item.taxRate || 0) / 2);

        return `
          <tr>
            <td class="num">${index + 1}</td>
            <td>${escapeHtml(item.productName || item.name || "-")}</td>
            <td class="num">${escapeHtml(quantity.toFixed(2))}</td>
            <td class="num">${escapeHtml(rate.toFixed(2))}</td>
            <td class="num">${escapeHtml(cgstAmount.toFixed(2))}<div class="tax-note">${hasSplitTax ? `${taxRateHalf}%` : "-"}</div></td>
            <td class="num">${escapeHtml(sgstAmount.toFixed(2))}<div class="tax-note">${hasSplitTax ? `${taxRateHalf}%` : "-"}</div></td>
            <td class="num">${escapeHtml(formatInr.format(lineTotal))}</td>
          </tr>
        `;
      })
      .join("");

    const receiptWindow = printWindow || window.open("", "_blank", "width=900,height=1100");
    if (!receiptWindow) {
      setStatus({ state: "error", message: "Unable to open print window. Please allow pop-ups and try again." });
      return;
    }

    receiptWindow.document.open();
    receiptWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Invoice ${escapeHtml(invoiceNo)}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 0;
            }

            * {
              box-sizing: border-box;
            }

            html,
            body {
              margin: 0;
              padding: 0;
              width: 100%;
              min-height: 100vh;
              background: #ffffff;
              color: #1f2937;
              font-family: "Segoe UI", Arial, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            body {
              display: flex;
              justify-content: center;
              align-items: center;
              background: #f3f4f6;
              padding: 10mm 0;
            }

            .invoice-page {
              width: 190mm;
              min-height: 277mm;
              margin: 10mm auto;
              padding: 10mm 8mm;
              background: #ffffff;
            }

            @media print {
              html,
              body {
                min-height: 297mm;
              }

              body {
                background: #ffffff;
                align-items: flex-start;
                padding: 0;
              }

              .invoice-page {
                margin: 0;
              }
            }

            .top {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }

            .company-name {
              margin: 0;
              font-size: 18px;
              font-weight: 700;
              letter-spacing: 0.2px;
            }

            .company-meta,
            .small-text {
              font-size: 12px;
              line-height: 1.4;
              color: #374151;
            }

            .invoice-title {
              margin: 0;
              font-size: 44px;
              letter-spacing: 0.6px;
              color: #111827;
              text-align: right;
            }

            .invoice-no {
              margin-top: 6px;
              font-size: 12px;
              text-align: right;
              color: #4b5563;
            }

            .meta-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 24px;
              margin-top: 18px;
              font-size: 12px;
            }

            .party-block h4 {
              margin: 0 0 6px;
              font-size: 13px;
              font-weight: 700;
            }

            .date-block {
              display: grid;
              grid-template-columns: auto auto;
              row-gap: 6px;
              column-gap: 6px;
              align-content: start;
              justify-content: end;
              width: fit-content;
              margin-left: auto;
            }

            .date-block .k {
              color: #4b5563;
              text-align: left;
            }

            .date-block .v {
              text-align: left;
              font-weight: 600;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 14px;
              font-size: 12px;
            }

            thead th {
              background: #3f4643;
              color: #ffffff;
              font-weight: 600;
              padding: 9px 8px;
              text-align: left;
            }

            td {
              border-bottom: 1px solid #d1d5db;
              padding: 8px;
              vertical-align: top;
            }

            .num {
              text-align: right;
              white-space: nowrap;
            }

            .tax-note {
              font-size: 10px;
              color: #6b7280;
              margin-top: 1px;
            }

            .totals-wrap {
              margin-top: 8px;
              display: flex;
              justify-content: flex-end;
            }

            .totals {
              width: 320px;
              font-size: 12px;
            }

            .totals .row {
              display: flex;
              justify-content: space-between;
              padding: 7px 0;
            }

            .totals .row strong {
              font-weight: 700;
            }

            .totals .grand {
              font-size: 15px;
            }

            .word-line {
              margin-top: 8px;
              text-align: right;
              font-size: 12px;
            }

            .word-line em {
              font-style: italic;
              font-weight: 600;
            }

            .footer {
              margin-top: 46px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }

            .notes-title {
              margin: 0 0 6px;
              font-size: 13px;
              font-weight: 600;
            }

            .signature {
              text-align: right;
              font-size: 12px;
            }

            .signature-line {
              width: 180px;
              border-top: 1px solid #111827;
              margin-top: 26px;
              margin-left: auto;
            }
          </style>
        </head>
        <body>
          <main class="invoice-page">
            <section class="top">
              <div>
                <h2 class="company-name">KAVYA IMPEX</h2>
                <div class="company-meta">
                  Gujarat<br />
                  India<br />
                  GSTIN 24ALXPK1502B1ZI<br />
                  jeanskai099@gmail.com
                </div>
              </div>
              <div>
                <h1 class="invoice-title">INVOICE</h1>
                <div class="invoice-no"># ${escapeHtml(invoiceNo)}</div>
              </div>
            </section>

            <section class="meta-grid">
              <div class="party-block">
                <h4>Bill To</h4>
                <div class="small-text">
                  <strong>${escapeHtml(customer.name || "Walk-in Customer")}</strong><br />
                  Phone: ${escapeHtml(customer.phone || "-")}<br />
                  Email: ${escapeHtml(customer.email || "-")}
                </div>
                <h4 style="margin-top:14px;">Ship To</h4>
                <div class="small-text">
                  <strong>${escapeHtml(customer.name || "Walk-in Customer")}</strong><br />
                  Phone: ${escapeHtml(customer.phone || "-")}
                </div>
              </div>
              <div class="date-block">
                <div class="k">Invoice Date :</div>
                <div class="v">${escapeHtml(invoiceDate.toLocaleDateString("en-GB"))}</div>
                <div class="k">Payment :</div>
                <div class="v">${escapeHtml(paymentMethodLabel)}</div>
              </div>
            </section>

            <table>
              <thead>
                <tr>
                  <th class="num" style="width:40px;">#</th>
                  <th>Item &amp; Description</th>
                  <th class="num" style="width:86px;">Qty</th>
                  <th class="num" style="width:86px;">Rate</th>
                  <th class="num" style="width:86px;">CGST</th>
                  <th class="num" style="width:86px;">SGST</th>
                  <th class="num" style="width:120px;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>

            <section class="totals-wrap">
              <div class="totals">
                <div class="row"><span>Sub Total</span><span>${escapeHtml(formatInr.format(subTotal))}</span></div>
                <div class="row"><span>${escapeHtml(discountLabel)}</span><span>${escapeHtml(formatInr.format(discountAmount))}</span></div>
                <div class="row"><span>CGST</span><span>${escapeHtml(formatInr.format(invoiceTaxType === "cgst_sgst" || invoiceTaxType === "gst" ? taxTotal / 2 : 0))}</span></div>
                <div class="row"><span>SGST</span><span>${escapeHtml(formatInr.format(invoiceTaxType === "cgst_sgst" || invoiceTaxType === "gst" ? taxTotal / 2 : 0))}</span></div>
                <div class="row grand"><strong>Total</strong><strong>${escapeHtml(formatInr.format(grandTotal))}</strong></div>
                <div class="word-line">Total In Words: <em>${escapeHtml(grandTotalInWords)}</em></div>
              </div>
            </section>

            <section class="footer">
              <div>
                <p class="notes-title">Notes</p>
                <div class="small-text">Thanks for your business.</div>
              </div>
              <div class="signature">
                Authorized Signature
                <div class="signature-line"></div>
              </div>
            </section>
          </main>
          <script>
            (function () {
              function triggerPrint() {
                window.focus();
                window.print();
              }

              if (document.readyState === "complete") {
                setTimeout(triggerPrint, 500);
              } else {
                window.addEventListener("load", function () {
                  setTimeout(triggerPrint, 500);
                });
              }
            })();
          </script>
        </body>
      </html>
    `);

    receiptWindow.document.close();
  };

  const handlePrintReceipt = async () => {
    if (!lastGeneratedSale?.id) {
      setStatus({ state: "error", message: "Please generate invoice first, then print receipt." });
      return;
    }

    const printWindow = window.open("", "_blank", "width=900,height=1100");
    if (!printWindow) {
      setStatus({ state: "error", message: "Unable to open print window. Please allow pop-ups and try again." });
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/billing/sales/${lastGeneratedSale.id}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Failed to load generated invoice for printing.");
      }

      const invoice = payload.sale || lastGeneratedSale;
      renderInvoicePrint(invoice, lastGeneratedSale.customer, printWindow);
    } catch (error) {
      printWindow.close();
      setStatus({ state: "error", message: error.message || "Failed to print generated invoice." });
    }
  };

  const handlePrintInvoiceAction = async (sale) => {
    const printWindow = window.open("", "_blank", "width=900,height=1100");
    if (!printWindow) {
      setStatus({ state: "error", message: "Unable to open print window. Please allow pop-ups and try again." });
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/billing/sales/${sale.id}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Failed to load invoice for printing.");
      }

      const invoice = payload.sale || sale;
      renderInvoicePrint(invoice, sale.customer, printWindow);
    } catch (error) {
      printWindow.close();
      setStatus({ state: "error", message: error.message || "Failed to print invoice." });
    }
  };

  const generateInvoice = async () => {
    if (!selectedInvoiceCustomer?.id) {
      setStatus({ state: "error", message: "Please select a customer first." });
      return;
    }

    if (!cartWithTotals.lines.length) {
      setStatus({ state: "error", message: "Add at least one item to generate invoice." });
      return;
    }

    if (!paymentMethods.includes(paymentMethod)) {
      setStatus({ state: "error", message: "Please select valid payment method." });
      return;
    }

    const normalizedPaidAmount = paidAmount === "" ? 0 : Number(paidAmount);
    if (Number.isNaN(normalizedPaidAmount) || normalizedPaidAmount < 0 || normalizedPaidAmount > cartWithTotals.grandTotal) {
      setStatus({ state: "error", message: "Paid amount must be between 0 and grand total." });
      return;
    }

    setIsGenerating(true);
    try {
      const selectedCustomer = normalizeCustomer(selectedInvoiceCustomer);

      const response = await fetch(`${API_BASE_URL}/api/billing/sales`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: selectedInvoiceCustomer.id,
          items: cartWithTotals.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
          discountType: normalizeDiscountType(discountType),
          discountValue: Number(discountValue || 0),
          paymentMethod,
          paidAmount: normalizedPaidAmount,
          taxType: taxType || "cgst_sgst",
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Failed to generate invoice.");
      }

      const payloadCustomer = normalizeCustomer(payload.sale?.customer);
      const mergedCustomer = hasCustomerData(payloadCustomer) ? payloadCustomer : selectedCustomer;

      setLastInvoice(payload.invoice);
      setCartItems([]);
      setProductPickerRows([createProductPickerRow()]);
      setPaidAmount("0");
      setDiscountType("none");
      setDiscountValue("0");
      setTaxType("cgst_sgst");
      setSelectedInvoiceCustomer(null);
      setStatus({ state: "success", message: `Invoice ${payload.invoice.invoiceNo} generated successfully.` });
      const generatedSale = {
        ...payload.sale,
        customer: mergedCustomer,
      };
      setLastGeneratedSale(generatedSale);
      setSales((prev) => [generatedSale, ...prev]);
      setShowInvoiceModal(false);
      await loadData();
    } catch (error) {
      setStatus({ state: "error", message: error.message || "Failed to generate invoice." });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInvoiceClick = async (sale) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/billing/sales/${sale.id}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Failed to load invoice details.");
      }

      const apiCustomer = normalizeCustomer(payload.sale?.customer);
      const saleCustomer = normalizeCustomer(sale?.customer);
      const fallbackCustomer = hasCustomerData(apiCustomer) ? apiCustomer : saleCustomer;

      setSelectedSaleId(sale.id);
      setSelectedInvoice({
        ...payload.sale,
        customer: fallbackCustomer,
      });
      setReceivePaymentAmount("");
      setReceivePaymentMethod("cash");
      setShowInvoiceDetailsModal(true);
    } catch (error) {
      console.error("Error loading invoice:", error);
      setStatus({ state: "error", message: error.message || "Failed to load invoice details." });
    }
  };

  const receiveInvoicePayment = async () => {
    if (!selectedInvoice?.id) {
      setStatus({ state: "error", message: "Select an invoice first." });
      return;
    }

    const amount = Number(receivePaymentAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      setStatus({ state: "error", message: "Enter valid payment amount." });
      return;
    }

    if (!paymentMethods.includes(receivePaymentMethod)) {
      setStatus({ state: "error", message: "Select valid payment method." });
      return;
    }

    setIsReceivingPayment(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/billing/sales/${selectedInvoice.id}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          paymentMethod: receivePaymentMethod,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "Failed to receive payment.");
      }

      const updatedInvoice = {
        ...selectedInvoice,
        paidAmount: payload.sale?.paidAmount ?? selectedInvoice.paidAmount,
        outstandingAmount: payload.sale?.outstandingAmount ?? selectedInvoice.outstandingAmount,
        paymentHistory: payload.sale?.paymentHistory ?? selectedInvoice.paymentHistory ?? [],
      };

      setSelectedInvoice(updatedInvoice);
      setSales((prev) =>
        prev.map((sale) =>
          sale.id === selectedInvoice.id
            ? {
              ...sale,
              paidAmount: updatedInvoice.paidAmount,
              outstandingAmount: updatedInvoice.outstandingAmount,
              paymentHistory: updatedInvoice.paymentHistory,
            }
            : sale
        )
      );

      setReceivePaymentAmount("");
      setStatus({ state: "success", message: "Payment received and outstanding updated." });
    } catch (error) {
      setStatus({ state: "error", message: error.message || "Failed to receive payment." });
    } finally {
      setIsReceivingPayment(false);
    }
  };

  const handleSaleSelect = async (saleId) => {
    setSelectedSaleId(saleId);
    setSelectedSale(null);
    setReturnQuantities({});

    if (!saleId) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/billing/sales/${saleId}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Failed to load sale details.");
      }

      setSelectedSale(payload.sale);
    } catch (error) {
      setStatus({ state: "error", message: error.message || "Failed to load sale." });
    }
  };

  const handleReturnClick = async (returnEntry) => {
    try {
      // Use returnNo as the parameter instead of id
      const endpoint = `${API_BASE_URL}/api/billing/returns/${returnEntry.id}`;


      const response = await fetch(endpoint);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Failed to load return details.");
      }


      setSelectedReturn(payload.return);
      setShowReturnDetailsModal(true);
    } catch (error) {
      console.error("Error loading return:", error);
      setStatus({ state: "error", message: error.message || "Failed to load return details." });
    }
  };

  const submitReturn = async () => {
    if (!selectedSale || !selectedSale.id) {
      setStatus({ state: "error", message: "Please select a sale for return." });
      return;
    }

    const items = (selectedSale.items || [])
      .map((item) => ({
        productId: item.productId,
        quantity: Number(returnQuantities[item.productId] || 0),
      }))
      .filter((item) => item.quantity > 0);

    if (!items.length) {
      setStatus({ state: "error", message: "Enter at least one return quantity." });
      return;
    }

    setIsReturning(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/billing/returns`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          saleId: selectedSale.id,
          items,
          refundMethod,
          reason: returnReason,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "Failed to process sale return.");
      }

      setStatus({ state: "success", message: `Return ${payload.returnEntry.returnNo} processed successfully.` });
      setReturns((prev) => [payload.returnEntry, ...prev]);
      setSelectedSaleId("");
      setSelectedSale(null);
      setReturnQuantities({});
      setReturnReason("");
      setShowReturnProcessModal(false);
      await loadData();
    } catch (error) {
      setStatus({ state: "error", message: error.message || "Failed to process return." });
    } finally {
      setIsReturning(false);
    }
  };

  const openCreateInvoiceFlow = () => {
    setSelectedInvoiceCustomer(null);
    setPaidAmount("0");
    setProductPickerRows([createProductPickerRow()]);
    setShowInvoiceModal(true);
  };

  const handleInvoiceCustomerChange = (event) => {
    const customerId = event.target.value;
    const matchedCustomer = customers.find((customer) => String(customer.id) === customerId);
    setSelectedInvoiceCustomer(matchedCustomer || null);
  };

  return (
    <div className="billing-page">
      <div className="billing-header">

        <div className="billing-stats">
          <div className="stat-card billing-stat-card">
            <div className="stat-value billing-stat-products">{products.length}</div>
            <div className="stat-label">Total Products</div>
          </div>
          <div className="stat-card billing-stat-card">
            <div className="stat-value billing-stat-sales">{sales.length}</div>
            <div className="stat-label">Sales</div>
          </div>
          <div className="stat-card billing-stat-card">
            <div className="stat-value billing-stat-returns">{returns.length}</div>
            <div className="stat-label">Returns</div>
          </div>
        </div>
      </div>

      {status.message && (
        <div className={`status ${status.state === "error" ? "error" : status.state === "success" ? "success" : ""}`}>
          {status.message}
        </div>
      )}

      <div className="tab-nav">
        <button
          type="button"
          className={`tab-btn ${historyTab === "invoices" ? "active" : ""}`}
          onClick={() => { setHistoryTab("invoices"); setInvoicePage(1); }}
        >
          Sale History
        </button>
        <button
          type="button"
          className={`tab-btn ${historyTab === "returns" ? "active" : ""}`}
          onClick={() => { setHistoryTab("returns"); setReturnPage(1); }}
        >
          Return History
        </button>
      </div>

      {historyTab === "invoices" && (
        <section className="card">
          <div className="card-head">
            <div>
              
              <h3>Sale History ({sales.length})</h3>
            </div>
            <button type="button" className="add-product-btn" onClick={openCreateInvoiceFlow}>
              Create Invoice
            </button>
          </div>
          <div className="table invoice-history-table">
            <div className="table-row invoice-history-row header">
              <span>Invoice No</span>
              <span>Date</span>
              <span>Items</span>
              <span>Payment</span>
              <span>Total Amount</span>
              <span>Paid Amount</span>
              <span>Outstanding</span>
              <span>Action</span>
            </div>
            {sales.length === 0 && (
              <div className="table-row invoice-history-row empty">
                <span>No invoices generated yet.</span>
              </div>
            )}
            {sales.slice((invoicePage - 1) * invoicesPerPage, invoicePage * invoicesPerPage).map((sale) => (
              <div className="table-row invoice-history-row" key={sale.id}>
                <span
                  className="invoice-number-link"
                  onClick={() => handleInvoiceClick(sale)}
                >
                  {sale.invoiceNo || "-"}
                </span>
                <span className="invoice-datetime">
                  <span className="invoice-date">
                    {new Date(sale.saleDate || sale.created_at).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "2-digit",
                    })}
                  </span>
                  <span className="invoice-time">
                    {new Date(sale.saleDate || sale.created_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </span>
                </span>
                <span>{sale.itemCount || (sale.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0)} items</span>
                <span>{(sale.paymentMethod || "cash").toUpperCase()}</span>
                <span>{formatInr.format(sale.grandTotal || 0)}</span>
                <span>{formatInr.format(sale.paidAmount || 0)}</span>
                <span>{formatInr.format(sale.outstandingAmount || 0)}</span>
                <span>
                  <button
                    type="button"
                    className="icon-btn history"
                    onClick={() => handlePrintInvoiceAction(sale)}
                    title="Print Invoice"
                    aria-label="Print Invoice"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 6 2 18 2 18 9"></polyline>
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                      <rect x="6" y="14" width="12" height="8"></rect>
                    </svg>
                  </button>
                </span>
              </div>
            ))}
          </div>
          {sales.length > 0 && (
            <div className="category-pagination">
              <span className="tag">
                Showing {(invoicePage - 1) * invoicesPerPage + 1}-{Math.min(invoicePage * invoicesPerPage, sales.length)} of {sales.length}
              </span>
              <div className="category-pagination-controls">
                <button
                  type="button"
                  className="category-page-btn icon"
                  onClick={() => setInvoicePage((p) => Math.max(1, p - 1))}
                  disabled={invoicePage === 1}
                  aria-label="Previous page"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>
                {Array.from({ length: Math.ceil(sales.length / invoicesPerPage) }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={`category-page-btn ${page === invoicePage ? "active" : ""}`.trim()}
                    onClick={() => setInvoicePage(page)}
                    aria-current={page === invoicePage ? "page" : undefined}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  className="category-page-btn icon"
                  onClick={() => setInvoicePage((p) => Math.min(Math.ceil(sales.length / invoicesPerPage), p + 1))}
                  disabled={invoicePage === Math.ceil(sales.length / invoicesPerPage)}
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
      )}

      {historyTab === "returns" && (
        <section className="card">
          <div className="card-head">
            <div>
              
              <h3>Return History ({returns.length})</h3>
            </div>
            <button type="button" className="add-product-btn" onClick={() => setShowReturnProcessModal(true)}>
              Return Sale
            </button>
          </div>
          <div className="table return-history-table">
            <div className="table-row return-history-row header">
              <span>Return No</span>
              <span>Invoice No</span>
              <span>Date</span>
              <span>Items Returned</span>
              <span>Refund Method</span>
              <span>Refund Amount</span>
            </div>
            {returns.length === 0 && (
              <div className="table-row return-history-row empty">
                <span>No returns processed yet.</span>
              </div>
            )}
            {returns.slice((returnPage - 1) * returnsPerPage, returnPage * returnsPerPage).map((returnEntry) => (
              <div className="table-row return-history-row" key={returnEntry.id}>
                <span
                  className="invoice-number-link"
                  onClick={() => handleReturnClick(returnEntry)}
                >
                  {returnEntry.returnNo || "-"}
                </span>
                <span>{returnEntry.invoiceNo || "-"}</span>
                <span className="invoice-datetime">
                  <span className="invoice-date">
                    {new Date(returnEntry.created_at).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "2-digit",
                    })}
                  </span>
                  <span className="invoice-time">
                    {new Date(returnEntry.created_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </span>
                </span>
                <span>{(returnEntry.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0)} items</span>
                <span>{(returnEntry.refundMethod || "cash").toUpperCase()}</span>
                <span>{formatInr.format(returnEntry.totalRefund || 0)}</span>
              </div>
            ))}
          </div>
          {returns.length > 0 && (
            <div className="category-pagination">
              <span className="tag">
                Showing {(returnPage - 1) * returnsPerPage + 1}-{Math.min(returnPage * returnsPerPage, returns.length)} of {returns.length}
              </span>
              <div className="category-pagination-controls">
                <button
                  type="button"
                  className="category-page-btn icon"
                  onClick={() => setReturnPage((p) => Math.max(1, p - 1))}
                  disabled={returnPage === 1}
                  aria-label="Previous page"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>
                {Array.from({ length: Math.ceil(returns.length / returnsPerPage) }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={`category-page-btn ${page === returnPage ? "active" : ""}`.trim()}
                    onClick={() => setReturnPage(page)}
                    aria-current={page === returnPage ? "page" : undefined}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  className="category-page-btn icon"
                  onClick={() => setReturnPage((p) => Math.min(Math.ceil(returns.length / returnsPerPage), p + 1))}
                  disabled={returnPage === Math.ceil(returns.length / returnsPerPage)}
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
      )}

      {/* Invoice Creation Modal */}
      {showInvoiceModal && (
        <div className="modal-overlay" onClick={() => !isGenerating && setShowInvoiceModal(false)}>
          <div className="modal-content create-invoice-modal" onClick={(e) => e.stopPropagation()}>
            <div className="card create-invoice-card">
              <div className="card-head">
                <div>
                  <h3>Create invoice and collect payment</h3>
                </div>
                <button
                  type="button"
                  className="close-btn"
                  onClick={() => !isGenerating && setShowInvoiceModal(false)}
                  title="Close"
                >
                  ✕
                </button>
              </div>

              <div className="form-row">
                <label className="product-field">
                  <span>Select Customer *</span>
                  <select
                    value={selectedInvoiceCustomer?.id ? String(selectedInvoiceCustomer.id) : ""}
                    onChange={handleInvoiceCustomerChange}
                    required
                  >
                    <option value="">Choose customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={String(customer.id)}>
                        {customer.name || "Unnamed Customer"} {customer.phone ? `• ${customer.phone}` : ""}
                      </option>
                    ))}
                  </select> 
                </label>
              </div>

              <section className="create-invoice-layout">
                <div className="card billing-cart billing-cart-lines">
                  {(() => {
                    const cartLineLookup = new Map(cartWithTotals.lines.map((line) => [line.rowId, line]));

                    return (
                  <>
                  <datalist id="billing-product-list">
                    {sortedProducts.map((product) => (
                      <option key={`billing-product-${product.id}`} value={getProductLabel(product)} />
                    ))}
                  </datalist>
                  <div className="table billing-cart-table" ref={billingCartTableRef}>
                    <div className="table-row header billing-cart-line-row">
                      <span>Item</span>
                      <span className="right">Qty</span>
                      <span className="right">Price</span>
                      <span className="right">Tax</span>
                      <span className="right">Total</span>
                      <span className="right">Action</span>
                    </div>
                    {productPickerRows.map((row) => {
                      const selectedProduct = products.find((product) => String(product.id) === row.value);
                      const line = cartLineLookup.get(row.id);

                      return (
                      <div className="table-row billing-cart-line-row billing-cart-picker-row" key={row.id}>
                        <label className="product-field invoice-product-select">
                          <span>Select Product</span>
                          <input
                            type="text"
                            list="billing-product-list"
                            placeholder="Select product"
                            value={row.searchText || getProductLabel(selectedProduct)}
                            onChange={(event) => handleProductPickerInputChange(row.id, event.target.value)}
                          />
                        </label>
                          <span className="right">
                            <input
                              type="number"
                              min="1"
                              max={line?.availableStock || undefined}
                              value={row.quantity}
                              onChange={(event) => updateCartQuantity(row.id, event.target.value)}
                              className="billing-qty-input"
                            />
                          </span>
                          <div className="billing-line-box billing-line-value billing-picker-meta">{line ? formatInr.format(line.price) : "-"}</div>
                          <div className="billing-line-box billing-line-value billing-picker-meta">{line ? formatInr.format(line.taxAmount || 0) : "-"}</div>
                          <div className="billing-line-box billing-line-value billing-picker-meta">{line ? formatInr.format(line.lineTotal || 0) : "-"}</div>
                          <span className="right">
                            <button type="button" className="icon-btn danger" onClick={() => removeFromCart(row.id)} title="Remove from cart" disabled={productPickerRows.length === 1}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                            </button>
                          </span>
                        </div>
                        );
                      })}
                  </div>
                  </>
                    );
                  })()}
                  <button type="button" className="btn-secondary billing-cart-add-btn" onClick={handleAddProductPickerRow}>
                    Add Product Line
                  </button>
                </div>


                <div className="billing-summary-controls">
                  <label className="product-field">
                    <span>Tax Type</span>
                    <select value={taxType} onChange={(event) => setTaxType(event.target.value)}>
                      {taxTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="product-field">
                    <span>Discount Type</span>
                    <select value={discountType} onChange={(event) => setDiscountType(event.target.value)}>
                      <option value="none">None</option>
                      <option value="flat">Flat</option>
                      <option value="percent">%</option>
                    </select>
                  </label>
                  <label className="product-field">
                    <span>Discount Value</span>
                    <input
                      type="number"
                      min="0"
                      value={discountValue}
                      onChange={(event) => setDiscountValue(event.target.value)}
                    />
                  </label>
                  <label className="product-field">
                    <span>Payment Method</span>
                    <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                      {paymentMethods.map((method) => (
                        <option key={method} value={method}>
                          {method.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="product-field paid-amount-field">
                    <span>Paid Amount</span>
                    <input
                      type="number"
                      min="0"
                      max={cartWithTotals.grandTotal || 0}
                      step="0.01"
                      value={paidAmount}
                      onChange={(event) => setPaidAmount(event.target.value)}
                      placeholder="0 for credit sale"
                    />
                  </label>
                </div>

                <div className="billing-summary-values">
                  <p>Sub Total: <strong>{formatInr.format(cartWithTotals.subTotal)}</strong></p>
                  <p>Discount: <strong>{formatInr.format(cartWithTotals.discountAmount)}</strong></p>
                  {taxType === "cgst_sgst" && (
                    <>
                      <p>CGST: <strong>{formatInr.format(cartWithTotals.cgst)}</strong></p>
                      <p>SGST: <strong>{formatInr.format(cartWithTotals.sgst)}</strong></p>
                    </>
                  )}
                  {taxType === "igst" && (
                    <p>IGST: <strong>{formatInr.format(cartWithTotals.igst)}</strong></p>
                  )}
                  {taxType === "vat" && (
                    <p>VAT: <strong>{formatInr.format(cartWithTotals.vat)}</strong></p>
                  )}
                  {taxType === "gst" && (
                    <p>GST: <strong>{formatInr.format(cartWithTotals.taxTotal)}</strong></p>
                  )}
                  {taxType !== "none" && (
                    <p>Total Tax: <strong>{formatInr.format(cartWithTotals.taxTotal)}</strong></p>
                  )}
                </div>

                <div className="billing-invoice-footer">
                  <div className="billing-invoice-total">
                    <p className="card-label">Total Amount</p>
                    <h3>{formatInr.format(cartWithTotals.grandTotal)}</h3>
                    <p className="billing-outstanding-inline">
                      Outstanding After Save: <strong>{formatInr.format(Math.max(cartWithTotals.grandTotal - (Number(paidAmount || 0) || 0), 0))}</strong>
                    </p>
                  </div>

                  <div className="billing-actions">
                    <button type="button" className="btn-secondary" onClick={() => setShowInvoiceModal(false)} disabled={isGenerating}>
                      Cancel
                    </button>
                    <button type="button" className="cta" onClick={generateInvoice} disabled={isGenerating}>
                      {isGenerating ? "Generating..." : "Generate Invoice"}
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
      {/* Sale Return Modal */}
      {
        showReturnProcessModal && (
          <div className="modal-overlay" onClick={() => setShowReturnProcessModal(false)}>
            <div className="modal-content billing-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Process Sale Return</h2>
                <button type="button" className="modal-close" onClick={() => {
                  setShowReturnProcessModal(false);
                  setSelectedSaleId("");
                  setSelectedSale(null);
                  setReturnQuantities({});
                  setReturnReason("");
                }}>
                  ×
                </button>
              </div>
              <div className="modal-body">
                <div className="billing-return-controls">
                  <label className="product-field">
                    <span>Select Sale</span>
                    <select value={selectedSaleId} onChange={(event) => handleSaleSelect(event.target.value)}>
                      <option value="">Choose sale/invoice</option>
                      {sales.map((sale) => (
                        <option key={sale.id} value={sale.id}>
                          {sale.invoiceNo} • {formatInr.format(sale.grandTotal || 0)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="product-field">
                    <span>Refund Method</span>
                    <select value={refundMethod} onChange={(event) => setRefundMethod(event.target.value)}>
                      {paymentMethods.map((method) => (
                        <option key={method} value={method}>
                          {method.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="product-field billing-return-reason">
                    <span>Reason</span>
                    <input value={returnReason} onChange={(event) => setReturnReason(event.target.value)} placeholder="Optional" />
                  </label>
                </div>

                {selectedSale && (
                  <div className="table">
                    <div className="table-row header billing-return-row">
                      <span>Item</span>
                      <span className="right">Sold Qty</span>
                      <span className="right">Return Qty</span>
                    </div>
                    {(selectedSale.items || []).map((item) => (
                      <div className="table-row billing-return-row" key={`${item.productId}-${item.productName}`}>
                        <span>{item.productName}</span>
                        <span className="right">{item.quantity}</span>
                        <span className="right">
                          <input
                            type="number"
                            min="0"
                            max={item.quantity}
                            className="billing-qty-input"
                            value={returnQuantities[item.productId] || "0"}
                            onChange={(event) =>
                              setReturnQuantities((prev) => ({
                                ...prev,
                                [item.productId]: event.target.value,
                              }))
                            }
                          />
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="billing-actions">
                  <button type="button" className="cta" onClick={submitReturn} disabled={isReturning || !selectedSale}>
                    {isReturning ? "Processing..." : "Process Sale Return"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Invoice Details Modal */}
      {
        showInvoiceDetailsModal && selectedInvoice && (
          <div className="modal-overlay" onClick={() => setShowInvoiceDetailsModal(false)}>
            <div className="modal-content invoice-details-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Invoice Details</h2>
                <button type="button" className="modal-close" onClick={() => setShowInvoiceDetailsModal(false)}>
                  ×
                </button>
              </div>
              <div className="modal-body">
                <div className="invoice-customer-section">
                  <div className="invoice-customer-row">
                    <span>Customer:</span>
                    <span>{selectedInvoice.customer?.name || "-"}</span>
                  </div>
                  <div className="invoice-customer-row">
                    <span>Email:</span>
                    <span>{selectedInvoice.customer?.email || "-"}</span>
                  </div>
                  <div className="invoice-customer-row">
                    <span>Phone:</span>
                    <span>{selectedInvoice.customer?.phone || "-"}</span>
                  </div>
                </div>

                <div className="invoice-items-section">
                  <h3>Items ({(selectedInvoice.items || []).length})</h3>
                  <div className="table">
                    <div className="table-row header">
                      <span>Product</span>
                      <span>Quantity</span>
                      <span>Price</span>
                      <span>Tax</span>
                      <span>Total</span>
                    </div>
                    {(selectedInvoice.items || []).length === 0 ? (
                      <div className="table-row empty">
                        <span>No items found.</span>
                      </div>
                    ) : (
                      (selectedInvoice.items || []).map((item, idx) => (
                        <div className="table-row" key={idx}>
                          <span>{item.productName || "-"}</span>
                          <span>{item.quantity || 0}</span>
                          <span>{formatInr.format(item.unitPrice || 0)}</span>
                          <span>{formatInr.format(item.taxAmount || 0)}</span>
                          <span>{formatInr.format(item.lineTotal || 0)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="invoice-totals-section">
                  <div className="invoice-total-row">
                    <span>Subtotal:</span>
                    <span>{formatInr.format(selectedInvoice.subTotal || 0)}</span>
                  </div>
                  {selectedInvoice.discountAmount > 0 && (
                    <>
                      <div className="invoice-total-row">
                        <span>Discount ({selectedInvoice.discountType === "flat" ? "Flat" : selectedInvoice.discountType === "percent" ? `${selectedInvoice.discountValue || 0}%` : ""}):</span>
                        <span className="discount">-{formatInr.format(selectedInvoice.discountAmount || 0)}</span>
                      </div>
                    </>
                  )}
                  {(selectedInvoice.taxType === "cgst_sgst" || !selectedInvoice.taxType) && (
                    <>
                      <div className="invoice-total-row">
                        <span>CGST:</span>
                        <span>{formatInr.format((selectedInvoice.taxTotal || 0) / 2)}</span>
                      </div>
                      <div className="invoice-total-row">
                        <span>SGST:</span>
                        <span>{formatInr.format((selectedInvoice.taxTotal || 0) / 2)}</span>
                      </div>
                    </>
                  )}
                  {selectedInvoice.taxType === "igst" && (
                    <div className="invoice-total-row">
                      <span>IGST:</span>
                      <span>{formatInr.format(selectedInvoice.taxTotal || 0)}</span>
                    </div>
                  )}
                  {selectedInvoice.taxType === "vat" && (
                    <div className="invoice-total-row">
                      <span>VAT:</span>
                      <span>{formatInr.format(selectedInvoice.taxTotal || 0)}</span>
                    </div>
                  )}
                  {selectedInvoice.taxType === "gst" && (
                    <div className="invoice-total-row">
                      <span>GST:</span>
                      <span>{formatInr.format(selectedInvoice.taxTotal || 0)}</span>
                    </div>
                  )}
                  {selectedInvoice.taxType !== "none" && (
                    <div className="invoice-total-row">
                      <span>Total Tax:</span>
                      <span>{formatInr.format(selectedInvoice.taxTotal || 0)}</span>
                    </div>
                  )}
                  <div className="invoice-total-row grand-total">
                    <span>Grand Total:</span>
                    <span>{formatInr.format(selectedInvoice.grandTotal || 0)}</span>
                  </div>
                  <div className="invoice-total-row">
                    <span>Paid Amount:</span>
                    <span>{formatInr.format(selectedInvoice.paidAmount || 0)}</span>
                  </div>
                  <div className="invoice-total-row">
                    <span>Outstanding:</span>
                    <span>{formatInr.format(selectedInvoice.outstandingAmount || 0)}</span>
                  </div>
                  {selectedInvoice.changeAmount > 0 && (
                    <div className="invoice-total-row">
                      <span>Change:</span>
                      <span>{formatInr.format(selectedInvoice.changeAmount || 0)}</span>
                    </div>
                  )}
                </div>

                <div className="invoice-items-section invoice-payment-section">
                  <h3>Payment History ({(selectedInvoice.paymentHistory || []).length})</h3>
                  <div className="table payment-history-table">
                    <div className="table-row header payment-history-row">
                      <span>Date</span>
                      <span>Method</span>
                      <span>Amount</span>
                    </div>
                    {(selectedInvoice.paymentHistory || []).length === 0 ? (
                      <div className="table-row empty">
                        <span>No payment received yet.</span>
                      </div>
                    ) : (
                      (selectedInvoice.paymentHistory || []).map((entry, idx) => (
                        <div className="table-row payment-history-row" key={entry._id || idx}>
                          <span>{new Date(entry.paidAt || Date.now()).toLocaleString("en-IN")}</span>
                          <span>{String(entry.method || "cash").toUpperCase()}</span>
                          <span>{formatInr.format(entry.amount || 0)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {(selectedInvoice.outstandingAmount || 0) > 0 && (
                  <div className="billing-return-controls invoice-receive-payment-box">
                    <label className="product-field">
                      <span>Receive Payment Amount</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={receivePaymentAmount}
                        onChange={(event) => setReceivePaymentAmount(event.target.value)}
                        placeholder="Enter amount"
                      />
                    </label>
                    <label className="product-field">
                      <span>Payment Method</span>
                      <select value={receivePaymentMethod} onChange={(event) => setReceivePaymentMethod(event.target.value)}>
                        {paymentMethods.map((method) => (
                          <option key={method} value={method}>
                            {method.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="billing-actions invoice-receive-actions">
                      <button type="button" className="cta" onClick={receiveInvoicePayment} disabled={isReceivingPayment}>
                        {isReceivingPayment ? "Saving..." : "Receive Payment"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* Return Details Modal */}
      {
        showReturnDetailsModal && selectedReturn && (
          <div className="modal-overlay" onClick={() => setShowReturnDetailsModal(false)}>
            <div className="modal-content invoice-details-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Return Details</h2>
                <button type="button" className="modal-close" onClick={() => setShowReturnDetailsModal(false)}>
                  ×
                </button>
              </div>
              <div className="modal-body">
                <div className="return-items-section">
                  <h3>Items Returned ({(selectedReturn.items || []).length})</h3>
                  <div className="table">
                    <div className="table-row header">
                      <span>Product</span>
                      <span>Quantity Returned</span>
                      <span>Unit Refund</span>
                      <span>Line Refund</span>
                    </div>
                    {(selectedReturn.items || []).length === 0 ? (
                      <div className="table-row empty">
                        <span>No items found.</span>
                      </div>
                    ) : (
                      (selectedReturn.items || []).map((item, idx) => (
                        <div className="table-row" key={idx}>
                          <span>{item.productName || "-"}</span>
                          <span>{item.quantity || 0}</span>
                          <span>{formatInr.format(item.unitRefund || 0)}</span>
                          <span>{formatInr.format(item.lineRefund || 0)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="invoice-totals-section">
                  <div className="invoice-total-row">
                    <span>Return No:</span>
                    <span>{selectedReturn.returnNo || "-"}</span>
                  </div>
                  <div className="invoice-total-row">
                    <span>Invoice No:</span>
                    <span>{selectedReturn.invoiceNo || "-"}</span>
                  </div>
                  <div className="invoice-total-row">
                    <span>Refund Method:</span>
                    <span>{(selectedReturn.refundMethod || "cash").toUpperCase()}</span>
                  </div>
                  <div className="invoice-total-row">
                    <span>Reason:</span>
                    <span>{selectedReturn.reason || "-"}</span>
                  </div>
                  <div className="invoice-total-row grand-total">
                    <span>Total Refund:</span>
                    <span>{formatInr.format(selectedReturn.totalRefund || 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}
