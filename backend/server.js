import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import os from "os";
import crypto from "crypto";

const app = express();
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || "";
const MONGODB_FALLBACK_URI = process.env.MONGODB_FALLBACK_URI || "mongodb://127.0.0.1:27017/billing_software";
const MONGODB_USE_FALLBACK = (process.env.MONGODB_USE_FALLBACK || "true").toLowerCase() !== "false";
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const connectMongoWithUri = async (uri, label) => {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });
  console.log(`MongoDB connected via ${label}.`);
};

const isAllowedDevOrigin = (origin) => {
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname;

    if (["localhost", "127.0.0.1", "::1"].includes(host)) {
      return true;
    }

    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) {
      return true;
    }

    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
      return true;
    }

    const match172 = host.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
    if (match172) {
      const secondOctet = Number(match172[1]);
      if (secondOctet >= 16 && secondOctet <= 31) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
};

app.use(express.json());
app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = new Set(CORS_ORIGINS);
      if (!origin || allowed.has(origin) || isAllowedDevOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  })
);

const userSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      unique: true,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    username: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    role: { type: String, enum: ["admin", "cashier"], default: "admin" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    passwordHash: { type: String, required: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: { createdAt: "create_at", updatedAt: "update_at" } }
);

const loginEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    loggedInAt: { type: Date, default: Date.now },
    ip: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
const LoginEvent = mongoose.model("LoginEvent", loginEventSchema);
const customerSchema = new mongoose.Schema(
  {
    customer_id: {
      type: String,
      unique: true,
      default: () => {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).slice(2, 6).toUpperCase();
        return `CUS-${timestamp}-${random}`;
      },
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    tier: { type: String, required: true, default: "Standard" },
    mobile: { type: String, default: "" },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    pincode: { type: String, default: "" },
    gstNumber: { type: String, default: "" },
    outstanding_amount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    allowCredit: { type: Boolean, default: false },
    creditLimit: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, required: true, unique: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    issueDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    status: { type: String, required: true },
    total: { type: Number, required: true },
    category: { type: String, required: true },
  },
  { timestamps: true }
);

const paymentSchema = new mongoose.Schema(
  {
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice" },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    amount: { type: Number, required: true },
    paidAt: { type: Date, required: true },
    method: { type: String, required: true },
  },
  { timestamps: true }
);

const productSchema = new mongoose.Schema(
  {
    product_id: {
      type: String,
      unique: true,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    product_name: { type: String, required: true },
    sku_code: { type: String, default: "", unique: true, sparse: true },
    barcode: { type: String, unique: true, sparse: true },
    category_id: { type: String, default: "Uncategorized" },
    current_stock: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["active", "inactive", "discontinued"], default: "active" },
    purchase_price: { type: Number, default: 0, min: 0 },
    selling_price: { type: Number, required: true, min: 0 },
    lowStockThreshold: { type: Number, default: 0, min: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

const categorySchema = new mongoose.Schema(
  {
    category_id: {
      type: String,
      unique: true,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    name: { type: String, required: true, unique: true, trim: true },
    categoryCode: { type: String, unique: true, sparse: true, trim: true, uppercase: true },
    description: { type: String, default: "" },
    parent_id: { type: String, default: null }, // For subcategories
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    gstTaxSlab: { type: Number, default: null, min: 0, max: 100 }, // GST percentage
    createdBy: { type: String, default: "System" },
    createdDate: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

const supplierSchema = new mongoose.Schema(
  {
    supplier_id: {
      type: String,
      unique: true,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    supplier_name: { type: String, required: true },
    contact_person: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, required: true, unique: true, sparse: true },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    pincode: { type: String, default: "" },
    gst_number: { type: String, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

const stockInItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    purchasePrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const stockInSchema = new mongoose.Schema(
  {
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
    supplierName: { type: String, required: true },
    stockCategory: { type: String, default: "" },
    referenceNo: { type: String, required: true, unique: true },
    notes: { type: String, default: "" },
    items: { type: [stockInItemSchema], default: [] },
    totalAmount: { type: Number, required: true, min: 0 },
    paymentStatus: { type: String, enum: ["paid", "unpaid", "partial"], default: "unpaid" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

const saleItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    skuCode: { type: String, default: "" },
    barcode: { type: String, default: "" },
    category: { type: String, default: "Uncategorized" },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    taxRate: { type: Number, required: true, min: 0, max: 100 },
    lineSubTotal: { type: Number, required: true, min: 0 },
    lineDiscount: { type: Number, required: true, min: 0 },
    taxableAmount: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

const saleSchema = new mongoose.Schema(
  {
    saleNo: { type: String, required: true, unique: true },
    invoiceNo: { type: String, required: true, unique: true },
    receiptNo: { type: String, required: true, unique: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, default: "" },
    customerPhone: { type: String, default: "" },
    items: { type: [saleItemSchema], default: [] },
    discountType: { type: String, enum: ["none", "flat", "percent"], default: "none" },
    discountValue: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    subTotal: { type: Number, required: true, min: 0 },
    taxTotal: { type: Number, required: true, min: 0 },
    taxType: { type: String, enum: ["gst", "cgst_sgst", "igst", "vat", "none"], default: "cgst_sgst" },
    grandTotal: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: ["cash", "card", "upi"], required: true },
    paidAmount: { type: Number, required: true, min: 0 },
    paymentHistory: {
      type: [
        new mongoose.Schema(
          {
            amount: { type: Number, required: true, min: 0 },
            method: { type: String, enum: ["cash", "card", "upi"], required: true },
            paidAt: { type: Date, required: true },
          },
          { _id: true }
        ),
      ],
      default: [],
    },
    changeAmount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["completed", "partial-return", "returned"], default: "completed" },
    returnedAmount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

const saleReturnItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitRefund: { type: Number, required: true, min: 0 },
    lineRefund: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const saleReturnSchema = new mongoose.Schema(
  {
    returnNo: { type: String, required: true, unique: true },
    saleId: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", required: true },
    saleNo: { type: String, required: true },
    invoiceNo: { type: String, required: true },
    items: { type: [saleReturnItemSchema], default: [] },
    totalRefund: { type: Number, required: true, min: 0 },
    refundMethod: { type: String, enum: ["cash", "card", "upi"], required: true },
    reason: { type: String, default: "" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

const ledgerSchema = new mongoose.Schema(
  {
    ledger_id: {
      type: String,
      unique: true,
      default: () => generateReference("LDG"),
    },
    date: { type: Date, required: true, default: Date.now },
    reference_type: {
      type: String,
      enum: ["Sale", "Stock-In", "Expense"],
      required: true,
    },
    reference_id: { type: String, required: true },
    description: { type: String, default: "" },
    debit_amount: { type: Number, required: true, min: 0, default: 0 },
    credit_amount: { type: Number, required: true, min: 0, default: 0 },
    balance_after: { type: Number, required: true, default: 0 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

const extraExpenseSchema = new mongoose.Schema(
  {
    expense_id: {
      type: String,
      unique: true,
      default: () => generateReference("EXP"),
    },
    date: { type: Date, required: true, default: Date.now },
    category: { type: String, default: "General", trim: true },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    payment_mode: {
      type: String,
      enum: ["cash", "card", "upi", "bank", "other"],
      default: "cash",
    },
    created_by: { type: String, default: "System", trim: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

const Customer = mongoose.model("Customer", customerSchema);
const Invoice = mongoose.model("Invoice", invoiceSchema);
const Payment = mongoose.model("Payment", paymentSchema);
const Product = mongoose.model("Product", productSchema);
const Category = mongoose.model("Category", categorySchema);
const Supplier = mongoose.model("Supplier", supplierSchema);
const StockIn = mongoose.model("StockIn", stockInSchema);
const Sale = mongoose.model("Sale", saleSchema);
const SaleReturn = mongoose.model("SaleReturn", saleReturnSchema);
const Ledger = mongoose.model("Ledger", ledgerSchema);
const ExtraExpense = mongoose.model("ExtraExpense", extraExpenseSchema);

// ─── Accounting Module Schemas ───────────────────────────────────────────────
const acctAccountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    openingBalance: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

const acctCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    type: { type: String, enum: ["income", "expense"], required: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

const acctEntrySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["income", "expense"], required: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "AcctAccount", required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "AcctCategory", required: true },
    amount: { type: Number, required: true, min: 0.01 },
    date: { type: Date, required: true },
    remarks: { type: String, default: "" },
  },
  { timestamps: true }
);

acctEntrySchema.index({ accountId: 1 });
acctEntrySchema.index({ categoryId: 1 });
acctEntrySchema.index({ date: -1 });

const AcctAccount = mongoose.model("AcctAccount", acctAccountSchema);
const AcctCategory = mongoose.model("AcctCategory", acctCategorySchema);
const AcctEntry = mongoose.model("AcctEntry", acctEntrySchema);

function generateStockInReference() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `STI-${timestamp}-${random}`;
}

function generateReference(prefix) {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(5).toString("hex").toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

function roundCurrency(value) {
  return Number((Number(value) || 0).toFixed(2));
}

function resolveAccountingAccountNameFromPaymentMethod(paymentMethod) {
  const normalized = typeof paymentMethod === "string" ? paymentMethod.toLowerCase() : "";
  if (normalized === "card") return "Card";
  if (normalized === "upi") return "UPI";
  return "Cash";
}

async function ensureAccountingAccount(name) {
  let account = await AcctAccount.findOne({ name }).lean();
  if (account) return account;

  try {
    const created = await AcctAccount.create({ name, openingBalance: 0, status: "active" });
    return created.toObject();
  } catch (error) {
    if (error?.code === 11000) {
      account = await AcctAccount.findOne({ name }).lean();
      if (account) return account;
    }
    throw error;
  }
}

async function ensureAccountingCategory(name, type) {
  let category = await AcctCategory.findOne({ name }).lean();
  if (category) return category;

  try {
    const created = await AcctCategory.create({ name, type, status: "active" });
    return created.toObject();
  } catch (error) {
    if (error?.code === 11000) {
      category = await AcctCategory.findOne({ name }).lean();
      if (category) return category;
    }
    throw error;
  }
}

async function postAutoAccountingEntryFromSale({
  type,
  paymentMethod,
  amount,
  date,
  remarks,
  categoryName,
}) {
  const normalizedAmount = roundCurrency(amount);
  if (!normalizedAmount || normalizedAmount <= 0) return;

  try {
    const accountName = resolveAccountingAccountNameFromPaymentMethod(paymentMethod);
    const [account, category] = await Promise.all([
      ensureAccountingAccount(accountName),
      ensureAccountingCategory(categoryName, type),
    ]);

    await AcctEntry.create({
      type,
      accountId: account._id,
      categoryId: category._id,
      amount: normalizedAmount,
      date: date || new Date(),
      remarks: typeof remarks === "string" ? remarks : "",
    });
  } catch (error) {
    // Accounting sync should not block billing transactions.
    console.error("Failed to auto-sync billing transaction to accounting:", error?.message || error);
  }
}

async function postLedgerEntry({ date, referenceType, referenceId, description, debitAmount, creditAmount }) {
  const normalizedDebit = roundCurrency(debitAmount || 0);
  const normalizedCredit = roundCurrency(creditAmount || 0);

  const previous = await Ledger.findOne().sort({ date: -1, created_at: -1, _id: -1 }).lean();
  const previousBalance = roundCurrency(previous?.balance_after || 0);
  const nextBalance = roundCurrency(previousBalance + normalizedCredit - normalizedDebit);

  return Ledger.create({
    date: date || new Date(),
    reference_type: referenceType,
    reference_id: referenceId,
    description: description || "",
    debit_amount: normalizedDebit,
    credit_amount: normalizedCredit,
    balance_after: nextBalance,
  });
}

function parseDateBoundary(rawValue, boundary) {
  if (!rawValue || typeof rawValue !== "string") {
    return null;
  }

  const value = rawValue.trim();
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const withTime = boundary === "start" ? `${value}T00:00:00.000Z` : `${value}T23:59:59.999Z`;
    const parsedDate = new Date(withTime);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  if (boundary === "start") {
    parsedDate.setHours(0, 0, 0, 0);
  } else {
    parsedDate.setHours(23, 59, 59, 999);
  }

  return parsedDate;
}

function buildDateFilter(fromDate, toDate) {
  const startDate = parseDateBoundary(fromDate, "start");
  const endDate = parseDateBoundary(toDate, "end");

  if (!startDate && !endDate) {
    return {};
  }

  if (startDate && endDate && startDate > endDate) {
    return { $gte: endDate, $lte: startDate };
  }

  const filter = {};
  if (startDate) {
    filter.$gte = startDate;
  }
  if (endDate) {
    filter.$lte = endDate;
  }

  return filter;
}

function buildCreatedAtFilter(fromDate, toDate) {
  return buildDateFilter(fromDate, toDate);
}

function normalizeDiscountType(discountType) {
  if (["flat", "percent"].includes(discountType)) {
    return discountType;
  }
  return "none";
}

function normalizePaymentMethod(paymentMethod) {
  if (["cash", "card", "upi"].includes(paymentMethod)) {
    return paymentMethod;
  }
  return null;
}

function normalizeExpensePaymentMode(paymentMode) {
  if (["cash", "card", "upi", "bank", "other"].includes(paymentMode)) {
    return paymentMode;
  }
  return "cash";
}

function computeDiscountAmount(subTotal, discountType, discountValue) {
  if (discountType === "flat") {
    return Math.min(roundCurrency(discountValue), roundCurrency(subTotal));
  }

  if (discountType === "percent") {
    const pct = Math.min(Math.max(discountValue, 0), 100);
    return roundCurrency((subTotal * pct) / 100);
  }

  return 0;
}

function computeSaleOutstanding(sale) {
  const grandTotal = Number(sale?.grandTotal || 0);
  const paidAmount = Number(sale?.paidAmount || 0);
  const returnedAmount = Number(sale?.returnedAmount || 0);
  return roundCurrency(Math.max(grandTotal - paidAmount - returnedAmount, 0));
}

async function computeCustomerOutstanding(customerId) {
  const normalizedCustomerId = String(customerId || "").trim();
  if (!normalizedCustomerId || !mongoose.Types.ObjectId.isValid(normalizedCustomerId)) {
    return 0;
  }

  const [invoiceOutstandingRow, sales] = await Promise.all([
    Invoice.aggregate([
      {
        $match: {
          customerId: new mongoose.Types.ObjectId(normalizedCustomerId),
          status: { $in: ["Sent", "Overdue"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    Sale.find({ customerId: normalizedCustomerId }).select("grandTotal paidAmount returnedAmount").lean(),
  ]);

  const invoiceOutstanding = roundCurrency(invoiceOutstandingRow?.[0]?.total || 0);
  const salesOutstanding = roundCurrency(
    sales.reduce((sum, sale) => sum + computeSaleOutstanding(sale), 0)
  );

  return roundCurrency(invoiceOutstanding + salesOutstanding);
}

async function syncCustomerOutstanding(customerId) {
  const outstandingAmount = await computeCustomerOutstanding(customerId);
  await Customer.findByIdAndUpdate(customerId, { outstanding_amount: outstandingAmount });
  return outstandingAmount;
}

// Helper function to generate SKU
async function generateSKU() {
  try {
    // Find all products with PRD-format SKU codes and get the highest number
    const products = await Product.find({ sku_code: /^PRD-\d{6}$/ })
      .select("sku_code")
      .lean();
    
    let maxNumber = 0;
    
    products.forEach(product => {
      const match = product.sku_code.match(/PRD-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
    });
    
    const nextNumber = maxNumber + 1;
    
    // Format as PRD-000001, PRD-000002, etc.
    return `PRD-${String(nextNumber).padStart(6, '0')}`;
  } catch {
    // Fallback to timestamp-based SKU if there's an error
    return `PRD-${Date.now().toString().slice(-6)}`;
  }
}

// Helper function to generate unique barcode (EAN-13 compatible format)
async function generateBarcode() {
  try {
    let barcode;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      // Generate 13-digit barcode: 890 (country code) + 10 random digits
      const timestamp = Date.now().toString();
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      barcode = '890' + timestamp.slice(-6) + random;
      
      // Check if barcode already exists
      const existing = await Product.findOne({ barcode });
      if (!existing) {
        return barcode;
      }
      attempts++;
    }
    
    // Fallback: use timestamp with random suffix
    return '890' + Date.now().toString().slice(-10);
  } catch {
    // Fallback to timestamp-based barcode if there's an error
    return '890' + Date.now().toString().slice(-10);
  }
}

const seedBillingData = async () => {
  const customerCount = await Customer.countDocuments();
  if (customerCount > 0) {
    return;
  }

  const customerSeed = [
    { name: "Aurora Lab Co", email: "billing@auroralab.co", tier: "Enterprise" },
    { name: "Beacon Retail", email: "ap@beaconretail.io", tier: "Growth" },
    { name: "Canyon Logistics", email: "finance@canyonlogistics.com", tier: "Enterprise" },
    { name: "Delta Studio", email: "hello@deltastudio.design", tier: "Starter" },
    { name: "Evergreen Health", email: "billing@evergreenhealth.org", tier: "Growth" },
  ];

  const invoiceSeed = [
    {
      invoiceNo: "INV-2401",
      customerName: "Aurora Lab Co",
      issueDate: "2026-01-05",
      dueDate: "2026-01-20",
      status: "Paid",
      total: 12450,
      category: "Subscription",
    },
    {
      invoiceNo: "INV-2402",
      customerName: "Beacon Retail",
      issueDate: "2026-01-09",
      dueDate: "2026-01-24",
      status: "Sent",
      total: 8350,
      category: "Services",
    },
    {
      invoiceNo: "INV-2403",
      customerName: "Canyon Logistics",
      issueDate: "2026-01-12",
      dueDate: "2026-01-27",
      status: "Paid",
      total: 6400,
      category: "Hardware",
    },
    {
      invoiceNo: "INV-2404",
      customerName: "Delta Studio",
      issueDate: "2026-01-18",
      dueDate: "2026-02-02",
      status: "Overdue",
      total: 5200,
      category: "Consulting",
    },
    {
      invoiceNo: "INV-2405",
      customerName: "Evergreen Health",
      issueDate: "2026-01-23",
      dueDate: "2026-02-07",
      status: "Sent",
      total: 9100,
      category: "Maintenance",
    },
    {
      invoiceNo: "INV-2406",
      customerName: "Aurora Lab Co",
      issueDate: "2026-01-30",
      dueDate: "2026-02-14",
      status: "Paid",
      total: 14300,
      category: "Services",
    },
    {
      invoiceNo: "INV-2407",
      customerName: "Beacon Retail",
      issueDate: "2026-02-02",
      dueDate: "2026-02-17",
      status: "Sent",
      total: 7200,
      category: "Subscription",
    },
    {
      invoiceNo: "INV-2408",
      customerName: "Canyon Logistics",
      issueDate: "2026-02-05",
      dueDate: "2026-02-20",
      status: "Paid",
      total: 9800,
      category: "Hardware",
    },
  ];

  const paymentSeed = [
    { invoiceNo: "INV-2401", amount: 12450, paidAt: "2026-01-16", method: "ACH" },
    { invoiceNo: "INV-2403", amount: 6400, paidAt: "2026-01-18", method: "Card" },
    { invoiceNo: "INV-2406", amount: 14300, paidAt: "2026-02-03", method: "Wire" },
    { invoiceNo: "INV-2408", amount: 9800, paidAt: "2026-02-08", method: "ACH" },
  ];

  const customers = await Customer.insertMany(customerSeed);
  const customerByName = new Map(customers.map((item) => [item.name, item]));

  const invoices = await Invoice.insertMany(
    invoiceSeed.map((item) => {
      const customer = customerByName.get(item.customerName);
      return {
        invoiceNo: item.invoiceNo,
        customerId: customer?._id,
        issueDate: new Date(item.issueDate),
        dueDate: new Date(item.dueDate),
        status: item.status,
        total: item.total,
        category: item.category,
      };
    })
  );

  const invoiceByNo = new Map(invoices.map((item) => [item.invoiceNo, item]));
  const paymentDocs = paymentSeed
    .map((item) => {
      const invoice = invoiceByNo.get(item.invoiceNo);
      if (!invoice) {
        return null;
      }

      return {
        invoiceId: invoice._id,
        customerId: invoice.customerId,
        amount: item.amount,
        paidAt: new Date(item.paidAt),
        method: item.method,
      };
    })
    .filter(Boolean);

  if (paymentDocs.length) {
    await Payment.insertMany(paymentDocs);
  }
};

const initMongo = async () => {
  if (!MONGODB_URI && !MONGODB_USE_FALLBACK) {
    throw new Error("MONGODB_URI not set and fallback is disabled.");
  }

  try {
    if (!MONGODB_URI) {
      throw new Error("MONGODB_URI not set.");
    }

    await connectMongoWithUri(MONGODB_URI, "primary URI");
  } catch (primaryError) {
    if (!MONGODB_USE_FALLBACK || !MONGODB_FALLBACK_URI) {
      throw primaryError;
    }

    console.warn(
      "Primary MongoDB connection failed. Falling back to local MongoDB URI.",
      primaryError?.message || primaryError
    );

    await connectMongoWithUri(MONGODB_FALLBACK_URI, "fallback URI");
  }

  const passwordHash = await bcrypt.hash("admin123", 10);
  await User.updateOne(
    { email: "admin@example.com" },
    {
      $setOnInsert: {
        email: "admin@example.com",
        username: "admin",
        role: "admin",
        status: "active",
        passwordHash,
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  await backfillProductPurchasePrice();
  await seedBillingData();
};

const backfillProductPurchasePrice = async () => {
  await Product.updateMany(
    {},
    [
      {
        $set: {
          purchase_price: {
            $ifNull: ["$purchase_price", { $ifNull: ["$purchasePrice", 0] }],
          },
        },
      },
      {
        $unset: "purchasePrice",
      },
    ]
  );
};

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/register", async (req, res) => {
  const { email, password, role, username } = req.body || {};

  if (!email || !password || !username) {
    res.status(400).json({ ok: false, message: "Email, username, and password required." });
    return;
  }

  const normalizedRole = role || "admin";

  if (!["admin", "cashier"].includes(normalizedRole)) {
    res.status(400).json({ ok: false, message: "Invalid role." });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await User.create({
      email,
      username,
      role: normalizedRole,
      status: "active",
      passwordHash,
    });
    res.json({ ok: true });
  } catch {
    if (error?.code === 11000) {
      res.status(409).json({ ok: false, message: "Email already exists." });
      return;
    }
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    res.status(400).json({ ok: false, message: "Email and password required." });
    return;
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      res.status(401).json({ ok: false, message: "Invalid credentials." });
      return;
    }

    const matches = await bcrypt.compare(password, user.passwordHash);

    if (!matches) {
      res.status(401).json({ ok: false, message: "Invalid credentials." });
      return;
    }

    const now = new Date();
    await Promise.all([
      User.updateOne({ _id: user._id }, { $set: { lastLoginAt: now } }),
      LoginEvent.create({
        userId: user._id,
        loggedInAt: now,
        ip: req.ip,
        userAgent: req.get("user-agent") || "",
      }),
    ]);

    res.json({
      ok: true,
      user: {
        id: user._id,
        user_id: user.user_id,
        email: user.email,
        username: user.username,
        role: user.role,
        status: user.status,
      },
    });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});
app.post("/api/change-password", async (req, res) => {
  const { email, currentPassword, newPassword } = req.body || {};

  if (!email || !currentPassword || !newPassword) {
    res.status(400).json({ ok: false, message: "Email, current password, and new password required." });
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({ ok: false, message: "New password must be at least 6 characters." });
    return;
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      res.status(401).json({ ok: false, message: "Invalid credentials." });
      return;
    }

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!matches) {
      res.status(401).json({ ok: false, message: "Current password is incorrect." });
      return;
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await User.updateOne({ _id: user._id }, { $set: { passwordHash: newPasswordHash } });

    res.json({ ok: true, message: "Password changed successfully." });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});
app.get("/api/dashboard", async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [totalRevenueRow] = await Invoice.aggregate([
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]);
    const [outstandingRow] = await Invoice.aggregate([
      { $match: { status: { $in: ["Sent", "Overdue"] } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]);
    const overdueCount = await Invoice.countDocuments({ status: "Overdue" });
    const [paidThisMonthRow] = await Payment.aggregate([
      { $match: { paidAt: { $gte: startOfMonth, $lt: nextMonth } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const recentInvoices = await Invoice.aggregate([
      { $sort: { issueDate: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "customers",
          localField: "customerId",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: "$customer" },
      {
        $project: {
          id: { $toString: "$_id" },
          invoice_no: "$invoiceNo",
          status: 1,
          total: 1,
          customer_name: "$customer.name",
        },
      },
    ]);

    const recentPayments = await Payment.aggregate([
      { $sort: { paidAt: -1 } },
      { $limit: 4 },
      {
        $lookup: {
          from: "invoices",
          localField: "invoiceId",
          foreignField: "_id",
          as: "invoice",
        },
      },
      { $unwind: "$invoice" },
      {
        $lookup: {
          from: "customers",
          localField: "customerId",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: "$customer" },
      {
        $project: {
          id: { $toString: "$_id" },
          amount: 1,
          method: 1,
          paid_at: "$paidAt",
          invoice_no: "$invoice.invoiceNo",
          customer_name: "$customer.name",
        },
      },
    ]);

    const revenueByCategory = await Invoice.aggregate([
      { $group: { _id: "$category", total: { $sum: "$total" } } },
      { $sort: { total: -1 } },
      { $project: { _id: 0, category: "$_id", total: 1 } },
    ]);

    const maxCategory = Math.max(
      1,
      ...revenueByCategory.map((item) => Number(item.total))
    );
    const categoryWithRatio = revenueByCategory.map((item) => ({
      ...item,
      ratio: Math.round((Number(item.total) / maxCategory) * 100),
    }));

    res.json({
      kpis: {
        totalRevenue: totalRevenueRow?.total || 0,
        outstanding: outstandingRow?.total || 0,
        overdueCount: overdueCount || 0,
        paidThisMonth: paidThisMonthRow?.total || 0,
      },
      recentInvoices,
      recentPayments,
      revenueByCategory: categoryWithRatio,
    });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.get("/api/products", async (req, res) => {
  try {
    const rows = await Product.find().sort({ created_at: -1 }).lean();
    const data = rows.map((item) => ({
      id: item._id.toString(),
      product_id: item.product_id,
      product_name: item.product_name,
      sku_code: item.sku_code || "-",
      barcode: item.barcode || "-",
      category_id: item.category_id || "Uncategorized",
      purchase_price: item.purchase_price ?? item.purchasePrice ?? 0,
      selling_price: item.selling_price,
      current_stock: item.current_stock ?? 0,
      status: item.status || "active",
      lowStockThreshold: item.lowStockThreshold ?? 0,
      created_at: item.created_at,
      name: item.product_name, // Backward compatibility
      sku: item.sku_code || "-", // Backward compatibility
      category: item.category_id || "Uncategorized", // Backward compatibility
      stock: item.current_stock ?? 0, // Backward compatibility
      purchasePrice: item.purchase_price ?? item.purchasePrice ?? 0, // Backward compatibility
      price: item.selling_price, // Backward compatibility
      addedAt: item.created_at, // Backward compatibility
    }));
    res.json({ ok: true, data });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.post("/api/products", async (req, res) => {
  // Support both old and new field names for backward compatibility
  const product_name = req.body?.product_name || req.body?.name;
  const sku_code = req.body?.sku_code || req.body?.sku;
  const barcode = req.body?.barcode;
  const category_id = req.body?.category_id || req.body?.category;
  const current_stock = req.body?.current_stock ?? req.body?.stock;
  const status = req.body?.status || "active";
  const selling_price = req.body?.selling_price || req.body?.price;
  const { lowStockThreshold } = req.body || {};

  if (!product_name || typeof product_name !== "string") {
    res.status(400).json({ ok: false, message: "Product name required." });
    return;
  }

  const priceValue = Number(selling_price);
  const stockValue = current_stock === undefined || current_stock === null ? 0 : Number(current_stock);
  const threshold = lowStockThreshold === undefined || lowStockThreshold === null ? 50 : Number(lowStockThreshold);

  if (Number.isNaN(priceValue) || priceValue < 0) {
    res.status(400).json({ ok: false, message: "Invalid price." });
    return;
  }

  if (Number.isNaN(stockValue) || stockValue < 0) {
    res.status(400).json({ ok: false, message: "Invalid stock." });
    return;
  }

  try {
    // Generate SKU if not provided
    const skuCodeValue = sku_code && String(sku_code).trim() ? String(sku_code).trim() : await generateSKU();
    
    // Use provided barcode or generate unique barcode
    const barcodeValue = barcode && String(barcode).trim() ? String(barcode).trim() : await generateBarcode();
    
    const created = await Product.create({
      product_name: product_name.trim(),
      sku_code: skuCodeValue,
      barcode: barcodeValue,
      category_id: category_id ? String(category_id).trim() : "Uncategorized",
      selling_price: priceValue,
      current_stock: stockValue,
      status: status,
      lowStockThreshold: threshold,
    });

    res.json({
      ok: true,
      product: {
        id: created._id.toString(),
        product_id: created.product_id,
        product_name: created.product_name,
        sku_code: created.sku_code || "-",
        barcode: created.barcode || "-",
        category_id: created.category_id || "Uncategorized",
        purchase_price: created.purchase_price ?? created.purchasePrice ?? 0,
        selling_price: created.selling_price,
        current_stock: created.current_stock,
        status: created.status,
        lowStockThreshold: created.lowStockThreshold,
        created_at: created.created_at,
        // Backward compatibility
        name: created.product_name,
        sku: created.sku_code || "-",
        category: created.category_id || "Uncategorized",
        stock: created.current_stock,
        purchasePrice: created.purchase_price ?? created.purchasePrice ?? 0,
        price: created.selling_price,
        addedAt: created.created_at,
      },
    });
  } catch {
    // Handle duplicate errors
    if (error.code === 11000 && error.keyPattern) {
      if (error.keyPattern.sku_code) {
        res.status(400).json({ ok: false, message: "SKU code already exists. Please use a different SKU code." });
      } else if (error.keyPattern.barcode) {
        res.status(400).json({ ok: false, message: "Barcode already exists. Please try again." });
      } else {
        res.status(400).json({ ok: false, message: "Duplicate entry detected." });
      }
    } else {
      res.status(500).json({ ok: false, message: "Server error." });
    }
  }
});

app.delete("/api/products/:id", async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ ok: false, message: "Product not found." });
      return;
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.put("/api/products/:id", async (req, res) => {
  // Support both old and new field names for backward compatibility
  const product_name = req.body?.product_name || req.body?.name;
  const sku_code = req.body?.sku_code || req.body?.sku;
  const barcode = req.body?.barcode;
  const category_id = req.body?.category_id || req.body?.category;
  const current_stock = req.body?.current_stock ?? req.body?.stock;
  const status = req.body?.status;
  const selling_price = req.body?.selling_price || req.body?.price;
  const { lowStockThreshold } = req.body || {};

  if (!product_name || typeof product_name !== "string") {
    res.status(400).json({ ok: false, message: "Product name required." });
    return;
  }

  const priceValue = Number(selling_price);
  const stockValue = current_stock === undefined || current_stock === null ? 0 : Number(current_stock);
  const threshold = lowStockThreshold === undefined || lowStockThreshold === null ? 0 : Number(lowStockThreshold);

  if (Number.isNaN(priceValue) || priceValue < 0) {
    res.status(400).json({ ok: false, message: "Invalid price." });
    return;
  }

  if (Number.isNaN(stockValue) || stockValue < 0) {
    res.status(400).json({ ok: false, message: "Invalid stock." });
    return;
  }

  try {
    const updateData = {
      product_name: product_name.trim(),
      sku_code: sku_code ? String(sku_code).trim() : "",
      category_id: category_id ? String(category_id).trim() : "Uncategorized",
      selling_price: priceValue,
      current_stock: stockValue,
      lowStockThreshold: threshold,
    };

    if (barcode !== undefined && barcode !== null && String(barcode).trim()) {
      updateData.barcode = String(barcode).trim();
    }

    if (status) {
      updateData.status = status;
    }

    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!updated) {
      res.status(404).json({ ok: false, message: "Product not found." });
      return;
    }

    res.json({
      ok: true,
      product: {
        id: updated._id.toString(),
        product_id: updated.product_id,
        product_name: updated.product_name,
        sku_code: updated.sku_code || "-",
        barcode: updated.barcode || "-",
        category_id: updated.category_id || "Uncategorized",
        purchase_price: updated.purchase_price ?? updated.purchasePrice ?? 0,
        selling_price: updated.selling_price,
        current_stock: updated.current_stock,
        status: updated.status,
        lowStockThreshold: updated.lowStockThreshold,
        created_at: updated.created_at,
        // Backward compatibility
        name: updated.product_name,
        sku: updated.sku_code || "-",
        category: updated.category_id || "Uncategorized",
        stock: updated.current_stock,
        purchasePrice: updated.purchase_price ?? updated.purchasePrice ?? 0,
        price: updated.selling_price,
        addedAt: updated.created_at,
      },
    });
  } catch {
    if (error.code === 11000 && error.keyPattern) {
      if (error.keyPattern.sku_code) {
        res.status(400).json({ ok: false, message: "SKU code already exists. Please use a different SKU code." });
      } else if (error.keyPattern.barcode) {
        res.status(400).json({ ok: false, message: "Barcode already exists. Please use a different barcode." });
      } else {
        res.status(400).json({ ok: false, message: "Duplicate entry detected." });
      }
    } else {
      res.status(500).json({ ok: false, message: "Server error." });
    }
  }
});

// Update all products' low stock threshold
app.patch("/api/products/bulk/update-threshold", async (req, res) => {
  try {
    const result = await Product.updateMany(
      {},
      { $set: { lowStockThreshold: 0 } }
    );
    res.json({ 
      ok: true, 
      message: `Updated ${result.modifiedCount} products`,
      modifiedCount: result.modifiedCount
    });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

// Search product by barcode
app.get("/api/products/search/barcode/:barcode", async (req, res) => {
  try {
    const { barcode } = req.params;
    
    if (!barcode) {
      res.status(400).json({ ok: false, message: "Barcode is required." });
      return;
    }

    const product = await Product.findOne({ barcode: barcode.trim() });
    
    if (!product) {
      res.status(404).json({ ok: false, message: "Product not found with this barcode." });
      return;
    }

    res.json({
      ok: true,
      product: {
        id: product._id.toString(),
        product_id: product.product_id,
        name: product.product_name,
        sku: product.sku_code || "-",
        barcode: product.barcode || "-",
        category: product.category_id || "Uncategorized",
        purchase_price: product.purchase_price ?? product.purchasePrice ?? 0,
        purchasePrice: product.purchase_price ?? product.purchasePrice ?? 0,
        price: product.selling_price,
        stock: product.current_stock,
        lowStockThreshold: product.lowStockThreshold ?? 0,
        addedAt: product.created_at,
      },
    });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

// Supplier Endpoints
app.get("/api/suppliers", async (req, res) => {
  try {
    const rows = await Supplier.find().sort({ created_at: -1 }).lean();
    const data = rows.map((item) => ({
      id: item._id.toString(),
      supplier_id: item.supplier_id,
      supplier_name: item.supplier_name,
      contact_person: item.contact_person,
      mobile: item.mobile,
      email: item.email,
      address: item.address,
      city: item.city,
      state: item.state,
      pincode: item.pincode,
      gst_number: item.gst_number,
      status: item.status,
      created_at: item.created_at,
      // Backward compatibility
      name: item.supplier_name,
      phone: item.mobile,
      contactPerson: item.contact_person,
      gstNumber: item.gst_number,
      createdAt: item.created_at,
    }));
    res.json({ ok: true, data });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.post("/api/suppliers", async (req, res) => {
  // Support both old and new field names for backward compatibility
  const supplier_name = req.body?.supplier_name || req.body?.name;
  const contact_person = req.body?.contact_person || req.body?.contactPerson;
  const mobile = req.body?.mobile || req.body?.phone;
  const email = req.body?.email;
  const address = req.body?.address;
  const city = req.body?.city;
  const state = req.body?.state;
  const pincode = req.body?.pincode;
  const gst_number = req.body?.gst_number || req.body?.gstNumber;
  const status = req.body?.status || "active";

  if (!supplier_name || typeof supplier_name !== "string") {
    res.status(400).json({ ok: false, message: "Supplier name required." });
    return;
  }

  if (!contact_person || typeof contact_person !== "string") {
    res.status(400).json({ ok: false, message: "Contact person required." });
    return;
  }

  if (!mobile || typeof mobile !== "string") {
    res.status(400).json({ ok: false, message: "Mobile number required." });
    return;
  }

  if (!email || typeof email !== "string") {
    res.status(400).json({ ok: false, message: "Email required." });
    return;
  }

  try {
    const created = await Supplier.create({
      supplier_name: supplier_name.trim(),
      contact_person: contact_person.trim(),
      mobile: mobile.trim(),
      email: email.trim(),
      address: address ? String(address).trim() : "",
      city: city ? String(city).trim() : "",
      state: state ? String(state).trim() : "",
      pincode: pincode ? String(pincode).trim() : "",
      gst_number: gst_number ? String(gst_number).trim() : "",
      status: status,
    });

    res.json({
      ok: true,
      supplier: {
        id: created._id.toString(),
        supplier_id: created.supplier_id,
        supplier_name: created.supplier_name,
        contact_person: created.contact_person,
        mobile: created.mobile,
        email: created.email,
        address: created.address,
        city: created.city,
        state: created.state,
        pincode: created.pincode,
        gst_number: created.gst_number,
        status: created.status,
        created_at: created.created_at,
        // Backward compatibility
        name: created.supplier_name,
        phone: created.mobile,
        contactPerson: created.contact_person,
        gstNumber: created.gst_number,
        createdAt: created.created_at,
      },
    });
  } catch {
    // Handle duplicate email error
    if (error.code === 11000 && error.keyPattern && error.keyPattern.email) {
      res.status(400).json({ ok: false, message: "Email already exists. Please use a different email." });
    } else {
      res.status(500).json({ ok: false, message: "Server error." });
    }
  }
});

app.put("/api/suppliers/:id", async (req, res) => {
  // Support both old and new field names for backward compatibility
  const supplier_name = req.body?.supplier_name || req.body?.name;
  const contact_person = req.body?.contact_person || req.body?.contactPerson;
  const mobile = req.body?.mobile || req.body?.phone;
  const email = req.body?.email;
  const city = req.body?.city;
  const state = req.body?.state;
  const pincode = req.body?.pincode;
  const address = req.body?.address;
  const gst_number = req.body?.gst_number || req.body?.gstNumber;
  const status = req.body?.status;

  if (!supplier_name || typeof supplier_name !== "string") {
    res.status(400).json({ ok: false, message: "Supplier name required." });
    return;
  }

  if (!contact_person || typeof contact_person !== "string") {
    res.status(400).json({ ok: false, message: "Contact person required." });
    return;
  }

  if (!mobile || typeof mobile !== "string") {
    res.status(400).json({ ok: false, message: "Mobile number required." });
    return;
  }

  if (!email || typeof email !== "string") {
    res.status(400).json({ ok: false, message: "Email required." });
    return;
  }

  try {
    // Fetch existing supplier to handle email uniqueness
    const existing = await Supplier.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ ok: false, message: "Supplier not found." });
      return;
    }

    const updateData = {
      supplier_name: supplier_name.trim(),
      contact_person: contact_person.trim(),
      mobile: mobile.trim(),
      email: email.trim(),
      address: address ? String(address).trim() : "",
      city: city ? String(city).trim() : "",
      state: state ? String(state).trim() : "",
      pincode: pincode ? String(pincode).trim() : "",
      gst_number: gst_number ? String(gst_number).trim() : "",
    };

    if (status) {
      updateData.status = status;
    }

    const updated = await Supplier.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    res.json({
      ok: true,
      supplier: {
        id: updated._id.toString(),
        supplier_id: updated.supplier_id,
        supplier_name: updated.supplier_name,
        contact_person: updated.contact_person,
        mobile: updated.mobile,
        email: updated.email,
        address: updated.address,
        city: updated.city,
        state: updated.state,
        pincode: updated.pincode,
        gst_number: updated.gst_number,
        status: updated.status,
        created_at: updated.created_at,
        // Backward compatibility
        name: updated.supplier_name,
        phone: updated.mobile,
        contactPerson: updated.contact_person,
        gstNumber: updated.gst_number,
        createdAt: updated.created_at,
      },
    });
  } catch {
    // Handle duplicate email error
    if (error.code === 11000 && error.keyPattern && error.keyPattern.email) {
      res.status(400).json({ ok: false, message: "Email already exists. Please use a different email." });
    } else {
      res.status(500).json({ ok: false, message: "Server error." });
    }
  }
});

app.delete("/api/suppliers/:id", async (req, res) => {
  try {
    const deleted = await Supplier.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ ok: false, message: "Supplier not found." });
      return;
    }
    res.json({ ok: true, message: "Supplier deleted successfully." });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

// Stock-In Endpoints
app.get("/api/stock-in", async (req, res) => {
  try {
    const rows = await StockIn.find().sort({ created_at: -1 }).lean();
    const data = rows.map((entry) => ({
      id: entry._id.toString(),
      stockInId: entry._id.toString(),
      supplierId: entry.supplierId?.toString?.() || "",
      supplierName: entry.supplierName,
      stockCategory: entry.stockCategory || "",
      referenceNo: entry.referenceNo || "",
      notes: entry.notes || "",
      items: entry.items || [],
      totalAmount: entry.totalAmount,
      paymentStatus: entry.paymentStatus,
      date: entry.created_at,
      created_at: entry.created_at,
    }));
    res.json({ ok: true, data });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.post("/api/stock-in", async (req, res) => {
  const { supplierId, items, paymentStatus, notes } = req.body || {};
  const rawStockCategory = typeof req.body?.stockCategory === "string"
    ? req.body.stockCategory
    : req.body?.category;

  if (!supplierId || !mongoose.Types.ObjectId.isValid(supplierId)) {
    res.status(400).json({ ok: false, message: "Valid supplier is required." });
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ ok: false, message: "At least one product is required." });
    return;
  }

  if (paymentStatus && !["paid", "unpaid", "partial"].includes(paymentStatus)) {
    res.status(400).json({ ok: false, message: "Invalid payment status." });
    return;
  }

  const normalizedStatus = paymentStatus || "unpaid";
  const sanitizedNotes = typeof notes === "string" ? notes.trim() : "";
  const sanitizedStockCategory = typeof rawStockCategory === "string" ? rawStockCategory.trim() : "";

  const preparedItems = items.map((item) => ({
    productId: item?.productId,
    quantity: Number(item?.quantity),
    purchasePrice: Number(item?.purchasePrice),
  }));

  const invalidItem = preparedItems.find(
    (item) =>
      !item.productId ||
      !mongoose.Types.ObjectId.isValid(item.productId) ||
      Number.isNaN(item.quantity) ||
      item.quantity <= 0 ||
      Number.isNaN(item.purchasePrice) ||
      item.purchasePrice < 0
  );

  if (invalidItem) {
    res.status(400).json({ ok: false, message: "Invalid product, quantity, or price." });
    return;
  }

  try {
    const supplier = await Supplier.findById(supplierId).lean();
    if (!supplier) {
      res.status(404).json({ ok: false, message: "Supplier not found." });
      return;
    }

    const productIds = [...new Set(preparedItems.map((item) => item.productId))];
    const products = await Product.find({ _id: { $in: productIds } }).lean();

    if (products.length !== productIds.length) {
      res.status(400).json({ ok: false, message: "One or more products are invalid." });
      return;
    }

    const productMap = new Map(products.map((product) => [product._id.toString(), product]));

    const itemsWithDetails = preparedItems.map((item) => {
      const product = productMap.get(item.productId);
      const lineTotal = Number((item.quantity * item.purchasePrice).toFixed(2));
      return {
        productId: product._id,
        productName: product.product_name,
        quantity: item.quantity,
        purchasePrice: item.purchasePrice,
        lineTotal,
      };
    });

    const totalAmount = Number(
      itemsWithDetails.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2)
    );

    const bulkOps = itemsWithDetails.map((item) => ({
      updateOne: {
        filter: { _id: item.productId },
        update: {
          $inc: { current_stock: item.quantity },
          $set: { purchase_price: item.purchasePrice },
        },
      },
    }));

    if (bulkOps.length) {
      await Product.bulkWrite(bulkOps);
    }

    const created = await StockIn.create({
      supplierId: supplier._id,
      supplierName: supplier.supplier_name,
      stockCategory: sanitizedStockCategory,
      referenceNo: generateStockInReference(),
      notes: sanitizedNotes,
      items: itemsWithDetails,
      totalAmount,
      paymentStatus: normalizedStatus,
    });

    await postLedgerEntry({
      date: created.created_at,
      referenceType: "Stock-In",
      referenceId: created.referenceNo || created._id.toString(),
      description: `Stock-In from ${created.supplierName}`,
      debitAmount: created.totalAmount,
      creditAmount: 0,
    });

    res.status(201).json({
      ok: true,
      entry: {
        id: created._id.toString(),
        stockInId: created._id.toString(),
        supplierId: created.supplierId.toString(),
        supplierName: created.supplierName,
        stockCategory: created.stockCategory || "",
        referenceNo: created.referenceNo,
        notes: created.notes || "",
        items: created.items,
        totalAmount: created.totalAmount,
        paymentStatus: created.paymentStatus,
        date: created.created_at,
        created_at: created.created_at,
      },
    });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.patch("/api/stock-in/:id/payment-status", async (req, res) => {
  const { id } = req.params;
  const { paymentStatus } = req.body || {};

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ ok: false, message: "Valid stock-in id is required." });
    return;
  }

  if (!paymentStatus || !["paid", "unpaid", "partial"].includes(paymentStatus)) {
    res.status(400).json({ ok: false, message: "Valid payment status is required." });
    return;
  }

  try {
    const updated = await StockIn.findByIdAndUpdate(
      id,
      { paymentStatus },
      { new: true }
    ).lean();

    if (!updated) {
      res.status(404).json({ ok: false, message: "Stock-in entry not found." });
      return;
    }

    res.json({
      ok: true,
      entry: {
        id: updated._id.toString(),
        stockInId: updated._id.toString(),
        supplierId: updated.supplierId?.toString?.() || "",
        supplierName: updated.supplierName,
        stockCategory: updated.stockCategory || "",
        referenceNo: updated.referenceNo || "",
        notes: updated.notes || "",
        items: updated.items || [],
        totalAmount: updated.totalAmount,
        paymentStatus: updated.paymentStatus,
        date: updated.created_at,
        created_at: updated.created_at,
      },
    });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.get("/api/billing/products", async (req, res) => {
  const { query, barcode } = req.query || {};

  const filters = [{ status: { $ne: "discontinued" } }];

  if (barcode && String(barcode).trim()) {
    filters.push({ barcode: String(barcode).trim() });
  }

  if (query && String(query).trim()) {
    const regex = new RegExp(String(query).trim(), "i");
    filters.push({
      $or: [{ product_name: regex }, { sku_code: regex }, { barcode: regex }],
    });
  }

  try {
    const rows = await Product.find({ $and: filters }).sort({ product_name: 1 }).limit(100).lean();
    const data = rows.map((item) => ({
      id: item._id.toString(),
      name: item.product_name,
      sku: item.sku_code || "-",
      barcode: item.barcode || "",
      category: item.category_id || "Uncategorized",
      purchasePrice: item.purchase_price ?? item.purchasePrice ?? 0,
      price: item.selling_price || 0,
      stock: item.current_stock || 0,
      status: item.status || "active",
    }));
    res.json({ ok: true, data });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.get("/api/billing/products/search/barcode/:barcode", async (req, res) => {
  const barcode = req.params?.barcode ? String(req.params.barcode).trim() : "";

  if (!barcode) {
    res.status(400).json({ ok: false, message: "Barcode is required." });
    return;
  }

  try {
    const product = await Product.findOne({ barcode }).lean();
    if (!product) {
      res.status(404).json({ ok: false, message: "Product not found for this barcode." });
      return;
    }

    res.json({
      ok: true,
      product: {
        id: product._id.toString(),
        name: product.product_name,
        sku: product.sku_code || "-",
        barcode: product.barcode || "",
        category: product.category_id || "Uncategorized",
        purchasePrice: product.purchase_price ?? product.purchasePrice ?? 0,
        price: product.selling_price || 0,
        stock: product.current_stock || 0,
        status: product.status || "active",
      },
    });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.get("/api/billing/sales", async (req, res) => {
  try {
    const rows = await Sale.find().sort({ created_at: -1 }).limit(100).lean();
    const data = rows.map((sale) => ({
      id: sale._id.toString(),
      saleNo: sale.saleNo,
      invoiceNo: sale.invoiceNo,
      customer: {
        id: sale.customerId?.toString?.() || "",
        name: sale.customerName || "",
        email: sale.customerEmail || "",
        phone: sale.customerPhone || "",
      },
      itemCount: (sale.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0),
      paymentMethod: sale.paymentMethod,
      subTotal: sale.subTotal,
      discountType: sale.discountType,
      discountValue: sale.discountValue,
      discountAmount: sale.discountAmount,
      taxTotal: sale.taxTotal,
      grandTotal: sale.grandTotal,
      paidAmount: sale.paidAmount,
      outstandingAmount: computeSaleOutstanding(sale),
      paymentHistory: sale.paymentHistory || [],
      changeAmount: sale.changeAmount,
      status: sale.status,
      returnedAmount: sale.returnedAmount || 0,
      created_at: sale.created_at,
    }));

    res.json({ ok: true, data });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.get("/api/billing/sales/:saleRef", async (req, res) => {
  const { saleRef } = req.params;
  const matchFilter = mongoose.Types.ObjectId.isValid(saleRef)
    ? { $or: [{ _id: saleRef }, { saleNo: saleRef }, { invoiceNo: saleRef }] }
    : { $or: [{ saleNo: saleRef }, { invoiceNo: saleRef }] };

  try {
    const sale = await Sale.findOne(matchFilter).lean();

    if (!sale) {
      res.status(404).json({ ok: false, message: "Sale not found." });
      return;
    }

    const linkedCustomer = sale.customerId
      ? await Customer.findById(sale.customerId).select("name email mobile").lean()
      : null;

    const resolvedCustomer = {
      id: sale.customerId?.toString?.() || linkedCustomer?._id?.toString?.() || "",
      name: sale.customerName || linkedCustomer?.name || "",
      email: sale.customerEmail || linkedCustomer?.email || "",
      phone: sale.customerPhone || linkedCustomer?.mobile || "",
    };

    res.json({
      ok: true,
      sale: {
        id: sale._id.toString(),
        saleNo: sale.saleNo,
        invoiceNo: sale.invoiceNo,
        customer: resolvedCustomer,
        items: sale.items || [],
        discountType: sale.discountType,
        discountValue: sale.discountValue,
        discountAmount: sale.discountAmount,
        subTotal: sale.subTotal,
        taxTotal: sale.taxTotal,
        taxType: sale.taxType || "cgst_sgst",
        grandTotal: sale.grandTotal,
        paymentMethod: sale.paymentMethod,
        paidAmount: sale.paidAmount,
        outstandingAmount: computeSaleOutstanding(sale),
        paymentHistory: sale.paymentHistory || [],
        changeAmount: sale.changeAmount,
        status: sale.status,
        returnedAmount: sale.returnedAmount || 0,
        created_at: sale.created_at,
        saleDate: sale.created_at,
      },
    });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.post("/api/billing/sales", async (req, res) => {
  const { customerId, items, discountType, discountValue, paymentMethod, paidAmount, defaultTaxRate, taxType } = req.body || {};

  const normalizedCustomerId = typeof customerId === "string" ? customerId.trim() : "";
  if (!normalizedCustomerId || !mongoose.Types.ObjectId.isValid(normalizedCustomerId)) {
    res.status(400).json({ ok: false, message: "Valid customer is required." });
    return;
  }

  if (!Array.isArray(items) || !items.length) {
    res.status(400).json({ ok: false, message: "At least one item is required." });
    return;
  }

  const normalizedPaymentMethod = normalizePaymentMethod(
    typeof paymentMethod === "string" ? paymentMethod.toLowerCase() : ""
  );

  if (!normalizedPaymentMethod) {
    res.status(400).json({ ok: false, message: "Payment method must be cash, card, or upi." });
    return;
  }

  const normalizedDiscountType = normalizeDiscountType(
    typeof discountType === "string" ? discountType.toLowerCase() : "none"
  );

  const discountValueNumber = Number(discountValue || 0);
  if (Number.isNaN(discountValueNumber) || discountValueNumber < 0) {
    res.status(400).json({ ok: false, message: "Invalid discount value." });
    return;
  }

  if (normalizedDiscountType === "percent" && discountValueNumber > 100) {
    res.status(400).json({ ok: false, message: "Percentage discount cannot exceed 100." });
    return;
  }

  const aggregatedRequestedItems = [];

  for (const rawItem of items) {
    const quantity = Number(rawItem?.quantity);
    const productId = rawItem?.productId ? String(rawItem.productId).trim() : "";
    const barcode = rawItem?.barcode ? String(rawItem.barcode).trim() : "";

    if ((!productId && !barcode) || Number.isNaN(quantity) || quantity <= 0) {
      res.status(400).json({ ok: false, message: "Each item must include valid product and quantity." });
      return;
    }

    aggregatedRequestedItems.push({
      productId,
      barcode,
      quantity,
    });
  }

  const productIds = [...new Set(aggregatedRequestedItems.map((item) => item.productId).filter(Boolean))];
  const barcodes = [...new Set(aggregatedRequestedItems.map((item) => item.barcode).filter(Boolean))];
  const productQuery = [];

  if (productIds.length) {
    productQuery.push({ _id: { $in: productIds } });
  }

  if (barcodes.length) {
    productQuery.push({ barcode: { $in: barcodes } });
  }

  if (!productQuery.length) {
    res.status(400).json({ ok: false, message: "No valid products provided." });
    return;
  }

  try {
    const selectedCustomer = await Customer.findById(normalizedCustomerId).lean();
    if (!selectedCustomer) {
      res.status(404).json({ ok: false, message: "Selected customer not found." });
      return;
    }

    const productRows = await Product.find({ $or: productQuery }).lean();
    const byId = new Map(productRows.map((product) => [product._id.toString(), product]));
    const byBarcode = new Map(productRows.filter((product) => product.barcode).map((product) => [product.barcode, product]));

    const mergedByProduct = new Map();

    for (const item of aggregatedRequestedItems) {
      const product = item.productId ? byId.get(item.productId) : byBarcode.get(item.barcode);

      if (!product) {
        res.status(400).json({ ok: false, message: "One or more products are invalid." });
        return;
      }

      if (product.status === "discontinued" || product.status === "inactive") {
        res.status(400).json({ ok: false, message: `Product ${product.product_name} is not active for billing.` });
        return;
      }

      const key = product._id.toString();
      const currentQty = mergedByProduct.get(key)?.quantity || 0;
      mergedByProduct.set(key, { product, quantity: currentQty + item.quantity });
    }

    const preparedLines = [...mergedByProduct.values()];

    const insufficient = preparedLines.find((line) => line.quantity > (line.product.current_stock || 0));
    if (insufficient) {
      res.status(400).json({
        ok: false,
        message: `Insufficient stock for ${insufficient.product.product_name}. Available: ${insufficient.product.current_stock || 0}`,
      });
      return;
    }

    const categoryNames = [...new Set(preparedLines.map((line) => line.product.category_id).filter(Boolean))];
    const categoryRows = categoryNames.length
      ? await Category.find({ name: { $in: categoryNames } }).select("name gstTaxSlab").lean()
      : [];

    const taxByCategory = new Map(
      categoryRows.map((category) => [category.name, Number(category.gstTaxSlab) || 0])
    );

    const fallbackTaxRate = Number(defaultTaxRate);
    const effectiveDefaultTaxRate = Number.isNaN(fallbackTaxRate) || fallbackTaxRate < 0 ? 18 : fallbackTaxRate;

    const subTotal = roundCurrency(
      preparedLines.reduce((sum, line) => sum + line.quantity * (line.product.selling_price || 0), 0)
    );

    const computedDiscountAmount = computeDiscountAmount(subTotal, normalizedDiscountType, discountValueNumber);

    const lineDetails = preparedLines.map((line) => ({
      ...line,
      lineSubTotal: roundCurrency(line.quantity * (line.product.selling_price || 0)),
    }));

    let discountRemaining = computedDiscountAmount;

    const finalItems = lineDetails.map((line, index) => {
      const rawAllocatedDiscount =
        index === lineDetails.length - 1
          ? discountRemaining
          : roundCurrency((line.lineSubTotal / Math.max(subTotal, 1)) * computedDiscountAmount);

      const lineDiscount = Math.min(roundCurrency(rawAllocatedDiscount), line.lineSubTotal);
      discountRemaining = roundCurrency(discountRemaining - lineDiscount);

      const taxRate = roundCurrency(
        taxByCategory.has(line.product.category_id)
          ? taxByCategory.get(line.product.category_id)
          : effectiveDefaultTaxRate
      );

      const taxableAmount = roundCurrency(Math.max(line.lineSubTotal - lineDiscount, 0));
      const taxAmount = roundCurrency((taxableAmount * taxRate) / 100);
      const lineTotal = roundCurrency(taxableAmount + taxAmount);

      return {
        productId: line.product._id,
        productName: line.product.product_name,
        skuCode: line.product.sku_code || "",
        barcode: line.product.barcode || "",
        category: line.product.category_id || "Uncategorized",
        quantity: line.quantity,
        unitPrice: roundCurrency(line.product.selling_price || 0),
        taxRate,
        lineSubTotal: line.lineSubTotal,
        lineDiscount,
        taxableAmount,
        taxAmount,
        lineTotal,
      };
    });

    const taxTotal = roundCurrency(finalItems.reduce((sum, item) => sum + item.taxAmount, 0));
    const grandTotal = roundCurrency(finalItems.reduce((sum, item) => sum + item.lineTotal, 0));

    const normalizedPaidAmount = Number(
      paidAmount === undefined || paidAmount === null || paidAmount === "" ? 0 : paidAmount
    );

    if (Number.isNaN(normalizedPaidAmount) || normalizedPaidAmount < 0 || normalizedPaidAmount > grandTotal) {
      res.status(400).json({ ok: false, message: "Paid amount must be between 0 and grand total." });
      return;
    }

    const roundedPaidAmount = roundCurrency(normalizedPaidAmount);
    const changeAmount = 0;
    const initialPaymentHistory =
      roundedPaidAmount > 0
        ? [
            {
              amount: roundedPaidAmount,
              method: normalizedPaymentMethod,
              paidAt: new Date(),
            },
          ]
        : [];

    let created = null;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      try {
        created = await Sale.create({
          saleNo: generateReference("SAL"),
          invoiceNo: generateReference("INV"),
          receiptNo: generateReference("RCPT"),
          customerId: selectedCustomer._id,
          customerName: selectedCustomer.name,
          customerEmail: selectedCustomer.email || "",
          customerPhone: selectedCustomer.mobile || "",
          items: finalItems,
          discountType: normalizedDiscountType,
          discountValue: roundCurrency(discountValueNumber),
          discountAmount: computedDiscountAmount,
          subTotal,
          taxTotal,
          taxType: taxType || "cgst_sgst",
          grandTotal,
          paymentMethod: normalizedPaymentMethod,
          paidAmount: roundedPaidAmount,
          paymentHistory: initialPaymentHistory,
          changeAmount,
          status: "completed",
          returnedAmount: 0,
        });
        break;
      } catch (creationError) {
        if (creationError?.code === 11000 && attempt < 11) {
          continue;
        }
        throw creationError;
      }
    }

    const stockOps = finalItems.map((item) => ({
      updateOne: {
        filter: { _id: item.productId },
        update: { $inc: { current_stock: -item.quantity } },
      },
    }));

    try {
      if (stockOps.length) {
        await Product.bulkWrite(stockOps);
      }
    } catch (stockError) {
      if (created?._id) {
        await Sale.deleteOne({ _id: created._id });
      }
      throw stockError;
    }

    await postLedgerEntry({
      date: created.created_at,
      referenceType: "Sale",
      referenceId: created.invoiceNo,
      description: `Sale ${created.saleNo}`,
      debitAmount: 0,
      creditAmount: created.grandTotal,
    });

    await postAutoAccountingEntryFromSale({
      type: "income",
      paymentMethod: created.paymentMethod,
      amount: created.paidAmount,
      date: created.created_at,
      remarks: `Sale ${created.saleNo} (${created.invoiceNo}) payment received`,
      categoryName: "Sales Income",
    });

    const customerOutstanding = await syncCustomerOutstanding(created.customerId);

    res.status(201).json({
      ok: true,
      sale: {
        id: created._id.toString(),
        saleNo: created.saleNo,
        invoiceNo: created.invoiceNo,
        receiptNo: created.receiptNo,
        customer: {
          id: created.customerId?.toString?.() || "",
          name: created.customerName || "",
          email: created.customerEmail || "",
          phone: created.customerPhone || "",
        },
        items: created.items,
        discountType: created.discountType,
        discountValue: created.discountValue,
        discountAmount: created.discountAmount,
        subTotal: created.subTotal,
        taxTotal: created.taxTotal,
        taxType: created.taxType,
        grandTotal: created.grandTotal,
        paymentMethod: created.paymentMethod,
        paidAmount: created.paidAmount,
        outstandingAmount: computeSaleOutstanding(created),
        paymentHistory: created.paymentHistory || [],
        changeAmount: created.changeAmount,
        status: created.status,
        created_at: created.created_at,
        saleDate: created.created_at,
      },
      invoice: {
        invoiceNo: created.invoiceNo,
        saleNo: created.saleNo,
        receiptNo: created.receiptNo,
        customer: {
          id: created.customerId?.toString?.() || "",
          name: created.customerName || "",
          email: created.customerEmail || "",
          phone: created.customerPhone || "",
        },
        createdAt: created.created_at,
        items: created.items,
        summary: {
          subTotal: created.subTotal,
          discountAmount: created.discountAmount,
          taxTotal: created.taxTotal,
          grandTotal: created.grandTotal,
          paidAmount: created.paidAmount,
          changeAmount: created.changeAmount,
        },
        paymentMethod: created.paymentMethod,
      },
      customerOutstanding,
    });
  } catch {
    if (error.code === 11000) {
      const conflictFields = Object.keys(error.keyPattern || {});
      res.status(409).json({
        ok: false,
        message: conflictFields.length
          ? `Duplicate value conflict on ${conflictFields.join(", ")}. Please retry.`
          : "Invoice generation conflict. Please retry.",
        conflict: {
          fields: conflictFields,
          keyValue: error.keyValue || null,
        },
      });
      return;
    }

    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.post("/api/billing/sales/:saleId/payments", async (req, res) => {
  const { saleId } = req.params;
  const amount = Number(req.body?.amount);
  const paymentMethod = normalizePaymentMethod(
    typeof req.body?.paymentMethod === "string" ? req.body.paymentMethod.toLowerCase() : ""
  );
  const paidAt = req.body?.paidAt ? new Date(req.body.paidAt) : new Date();

  if (!saleId || !mongoose.Types.ObjectId.isValid(saleId)) {
    res.status(400).json({ ok: false, message: "Valid sale is required." });
    return;
  }

  if (Number.isNaN(amount) || amount <= 0) {
    res.status(400).json({ ok: false, message: "Payment amount must be greater than zero." });
    return;
  }

  if (!paymentMethod) {
    res.status(400).json({ ok: false, message: "Payment method must be cash, card, or upi." });
    return;
  }

  if (Number.isNaN(paidAt.getTime())) {
    res.status(400).json({ ok: false, message: "Invalid payment date." });
    return;
  }

  try {
    const sale = await Sale.findById(saleId);
    if (!sale) {
      res.status(404).json({ ok: false, message: "Sale not found." });
      return;
    }

    const outstanding = computeSaleOutstanding(sale);
    if (outstanding <= 0) {
      res.status(400).json({ ok: false, message: "This invoice is already fully paid." });
      return;
    }

    const appliedAmount = roundCurrency(Math.min(amount, outstanding));
    sale.paidAmount = roundCurrency(Number(sale.paidAmount || 0) + appliedAmount);
    sale.paymentHistory = [
      ...(sale.paymentHistory || []),
      {
        amount: appliedAmount,
        method: paymentMethod,
        paidAt,
      },
    ];

    await sale.save();

    await postAutoAccountingEntryFromSale({
      type: "income",
      paymentMethod,
      amount: appliedAmount,
      date: paidAt,
      remarks: `Payment received for sale ${sale.saleNo} (${sale.invoiceNo})`,
      categoryName: "Sales Income",
    });

    const customerOutstanding = await syncCustomerOutstanding(sale.customerId);

    res.status(201).json({
      ok: true,
      payment: {
        amount: appliedAmount,
        method: paymentMethod,
        paidAt,
      },
      sale: {
        id: sale._id.toString(),
        saleNo: sale.saleNo,
        invoiceNo: sale.invoiceNo,
        paidAmount: sale.paidAmount,
        outstandingAmount: computeSaleOutstanding(sale),
        paymentHistory: sale.paymentHistory || [],
      },
      customerOutstanding,
    });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.get("/api/billing/returns", async (req, res) => {
  try {
    const rows = await SaleReturn.find().sort({ created_at: -1 }).limit(100).lean();
    const data = rows.map((entry) => ({
      id: entry._id.toString(),
      returnNo: entry.returnNo,
      saleId: entry.saleId?.toString?.() || "",
      saleNo: entry.saleNo,
      invoiceNo: entry.invoiceNo,
      items: entry.items || [],
      totalRefund: entry.totalRefund,
      refundMethod: entry.refundMethod,
      reason: entry.reason || "",
      created_at: entry.created_at,
    }));
    res.json({ ok: true, data });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.get("/api/billing/returns/:returnRef", async (req, res) => {
  const { returnRef } = req.params;
  const matchFilter = mongoose.Types.ObjectId.isValid(returnRef)
    ? { $or: [{ _id: returnRef }, { returnNo: returnRef }] }
    : { returnNo: returnRef };

  try {
    const entry = await SaleReturn.findOne(matchFilter).lean();

    if (!entry) {
      res.status(404).json({ ok: false, message: "Return not found." });
      return;
    }

    res.json({
      ok: true,
      return: {
        id: entry._id.toString(),
        returnNo: entry.returnNo,
        saleId: entry.saleId?.toString?.() || "",
        saleNo: entry.saleNo,
        invoiceNo: entry.invoiceNo,
        items: entry.items || [],
        totalRefund: entry.totalRefund,
        refundMethod: entry.refundMethod,
        reason: entry.reason || "",
        created_at: entry.created_at,
      },
    });
  } catch {
    console.error("Error in GET /api/billing/returns/:returnRef:", error);
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.post("/api/billing/returns", async (req, res) => {
  const { saleId, items, refundMethod, reason } = req.body || {};

  if (!saleId || !mongoose.Types.ObjectId.isValid(saleId)) {
    res.status(400).json({ ok: false, message: "Valid sale is required." });
    return;
  }

  if (!Array.isArray(items) || !items.length) {
    res.status(400).json({ ok: false, message: "At least one return item is required." });
    return;
  }

  const normalizedRefundMethod = normalizePaymentMethod(
    typeof refundMethod === "string" ? refundMethod.toLowerCase() : ""
  );

  if (!normalizedRefundMethod) {
    res.status(400).json({ ok: false, message: "Refund method must be cash, card, or upi." });
    return;
  }

  const returnReason = typeof reason === "string" ? reason.trim() : "";

  const requestedMap = new Map();
  for (const item of items) {
    const productId = item?.productId ? String(item.productId).trim() : "";
    const quantity = Number(item?.quantity);

    if (!productId || !mongoose.Types.ObjectId.isValid(productId) || Number.isNaN(quantity) || quantity <= 0) {
      res.status(400).json({ ok: false, message: "Each return line needs valid product and quantity." });
      return;
    }

    requestedMap.set(productId, (requestedMap.get(productId) || 0) + quantity);
  }

  try {
    const sale = await Sale.findById(saleId).lean();
    if (!sale) {
      res.status(404).json({ ok: false, message: "Sale not found." });
      return;
    }

    const soldMap = new Map();
    for (const line of sale.items || []) {
      const key = line.productId?.toString?.();
      if (!key) {
        continue;
      }

      soldMap.set(key, {
        productName: line.productName,
        quantity: (soldMap.get(key)?.quantity || 0) + (line.quantity || 0),
        unitRefund: roundCurrency((line.lineTotal || 0) / Math.max(line.quantity || 1, 1)),
      });
    }

    const previousReturns = await SaleReturn.find({ saleId: sale._id }).lean();
    const previouslyReturnedMap = new Map();

    for (const entry of previousReturns) {
      for (const line of entry.items || []) {
        const key = line.productId?.toString?.();
        if (!key) {
          continue;
        }
        previouslyReturnedMap.set(key, (previouslyReturnedMap.get(key) || 0) + (line.quantity || 0));
      }
    }

    const returnLines = [];

    for (const [productId, quantity] of requestedMap.entries()) {
      const sold = soldMap.get(productId);
      if (!sold) {
        res.status(400).json({ ok: false, message: "One or more products are not part of the sale." });
        return;
      }

      const alreadyReturned = previouslyReturnedMap.get(productId) || 0;
      const availableToReturn = sold.quantity - alreadyReturned;

      if (quantity > availableToReturn) {
        res.status(400).json({
          ok: false,
          message: `Return quantity exceeds allowed quantity for ${sold.productName}. Remaining returnable: ${availableToReturn}`,
        });
        return;
      }

      returnLines.push({
        productId: new mongoose.Types.ObjectId(productId),
        productName: sold.productName,
        quantity,
        unitRefund: sold.unitRefund,
        lineRefund: roundCurrency(quantity * sold.unitRefund),
      });
    }

    const totalRefund = roundCurrency(returnLines.reduce((sum, line) => sum + line.lineRefund, 0));

    const stockOps = returnLines.map((line) => ({
      updateOne: {
        filter: { _id: line.productId },
        update: { $inc: { current_stock: line.quantity } },
      },
    }));

    if (stockOps.length) {
      await Product.bulkWrite(stockOps);
    }

    const createdReturn = await SaleReturn.create({
      returnNo: generateReference("RET"),
      saleId: sale._id,
      saleNo: sale.saleNo,
      invoiceNo: sale.invoiceNo,
      items: returnLines,
      totalRefund,
      refundMethod: normalizedRefundMethod,
      reason: returnReason,
    });

    const afterReturnedMap = new Map(previouslyReturnedMap);
    for (const [productId, quantity] of requestedMap.entries()) {
      afterReturnedMap.set(productId, (afterReturnedMap.get(productId) || 0) + quantity);
    }

    const fullyReturned = [...soldMap.entries()].every(
      ([productId, sold]) => (afterReturnedMap.get(productId) || 0) >= sold.quantity
    );

    const nextReturnedAmount = roundCurrency((sale.returnedAmount || 0) + totalRefund);
    const nextStatus = fullyReturned ? "returned" : "partial-return";

    await Sale.findByIdAndUpdate(sale._id, {
      returnedAmount: nextReturnedAmount,
      status: nextStatus,
    });

    const customerOutstanding = await syncCustomerOutstanding(sale.customerId);

    await postAutoAccountingEntryFromSale({
      type: "expense",
      paymentMethod: normalizedRefundMethod,
      amount: totalRefund,
      date: createdReturn.created_at,
      remarks: `Refund issued for sale ${sale.saleNo} (${sale.invoiceNo}), return ${createdReturn.returnNo}`,
      categoryName: "Sales Return Refund",
    });

    res.status(201).json({
      ok: true,
      returnEntry: {
        id: createdReturn._id.toString(),
        returnNo: createdReturn.returnNo,
        saleId: createdReturn.saleId.toString(),
        saleNo: createdReturn.saleNo,
        invoiceNo: createdReturn.invoiceNo,
        items: createdReturn.items,
        totalRefund: createdReturn.totalRefund,
        refundMethod: createdReturn.refundMethod,
        reason: createdReturn.reason,
        created_at: createdReturn.created_at,
      },
      sale: {
        id: sale._id.toString(),
        saleNo: sale.saleNo,
        invoiceNo: sale.invoiceNo,
        status: nextStatus,
        returnedAmount: nextReturnedAmount,
        outstandingAmount: roundCurrency(Math.max((sale.grandTotal || 0) - (sale.paidAmount || 0) - nextReturnedAmount, 0)),
      },
      customerOutstanding,
    });
  } catch {
    if (error.code === 11000) {
      res.status(409).json({ ok: false, message: "Return generation conflict. Please retry." });
      return;
    }

    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.get("/api/invoices", async (req, res) => {
  try {
    const rows = await Invoice.aggregate([
      { $sort: { issueDate: -1 } },
      {
        $lookup: {
          from: "customers",
          localField: "customerId",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: "$customer" },
      {
        $project: {
          id: { $toString: "$_id" },
          invoice_no: "$invoiceNo",
          issue_date: "$issueDate",
          due_date: "$dueDate",
          status: 1,
          total: 1,
          category: 1,
          customer_name: "$customer.name",
        },
      },
    ]);
    res.json({ ok: true, data: rows });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.get("/api/customers", async (req, res) => {
  try {
    const rows = await Customer.aggregate([
      {
        $lookup: {
          from: "invoices",
          localField: "_id",
          foreignField: "customerId",
          as: "invoices",
        },
      },
      {
        $addFields: {
          outstanding: { $ifNull: ["$outstanding_amount", 0] },
        },
      },
      {
        $project: {
          id: { $toString: "$_id" },
          customer_id: { $ifNull: ["$customer_id", ""] },
          name: 1,
          email: 1,
          tier: 1,
          mobile: { $ifNull: ["$mobile", ""] },
          phone: { $ifNull: ["$mobile", ""] },
          address: 1,
          city: 1,
          state: 1,
          pincode: 1,
          gstNumber: { $ifNull: ["$gstNumber", ""] },
          outstanding_amount: { $ifNull: ["$outstanding_amount", 0] },
          status: 1,
          allowCredit: 1,
          creditLimit: { $ifNull: ["$creditLimit", 0] },
          outstanding: 1,
          invoicesCount: { $size: "$invoices" },
          createdAt: "$createdAt",
        },
      },
      { $sort: { name: 1 } },
    ]);
    res.json({ ok: true, data: rows });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.post("/api/customers", async (req, res) => {
  const customer_id =
    typeof req.body?.customer_id === "string" && req.body.customer_id.trim()
      ? req.body.customer_id.trim()
      : undefined;
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const tier = typeof req.body?.tier === "string" && req.body.tier.trim() ? req.body.tier.trim() : "Standard";
  const mobile =
    typeof req.body?.mobile === "string"
      ? req.body.mobile.trim()
      : typeof req.body?.phone === "string"
      ? req.body.phone.trim()
      : "";
  const address = typeof req.body?.address === "string" ? req.body.address.trim() : "";
  const city = typeof req.body?.city === "string" ? req.body.city.trim() : "";
  const state = typeof req.body?.state === "string" ? req.body.state.trim() : "";
  const pincode = typeof req.body?.pincode === "string" ? req.body.pincode.trim() : "";
  const gstNumber =
    typeof req.body?.gstNumber === "string"
      ? req.body.gstNumber.trim()
      : typeof req.body?.gst_number === "string"
      ? req.body.gst_number.trim()
      : "";
  const status = req.body?.status === "inactive" ? "inactive" : "active";
  const allowCredit = Boolean(req.body?.allowCredit);
  const creditLimit = Number(req.body?.creditLimit || 0);

  if (!name) {
    res.status(400).json({ ok: false, message: "Customer name required." });
    return;
  }

  if (!email) {
    res.status(400).json({ ok: false, message: "Customer email required." });
    return;
  }

  if (Number.isNaN(creditLimit) || creditLimit < 0) {
    res.status(400).json({ ok: false, message: "Invalid credit limit." });
    return;
  }

  try {
    const exists = await Customer.findOne({ email }).lean();
    if (exists) {
      res.status(409).json({ ok: false, message: "Customer email already exists." });
      return;
    }

    if (customer_id) {
      const existingCustomerId = await Customer.findOne({ customer_id }).lean();
      if (existingCustomerId) {
        res.status(409).json({ ok: false, message: "Customer ID already exists." });
        return;
      }
    }

    const created = await Customer.create({
      ...(customer_id ? { customer_id } : {}),
      name,
      email,
      tier,
      mobile,
      address,
      city,
      state,
      pincode,
      gstNumber,
      outstanding_amount: 0,
      status,
      allowCredit,
      creditLimit: allowCredit ? creditLimit : 0,
    });

    res.status(201).json({
      ok: true,
      customer: {
        id: created._id.toString(),
        customer_id: created.customer_id,
        name: created.name,
        email: created.email,
        tier: created.tier,
        mobile: created.mobile || "",
        phone: created.mobile || "",
        address: created.address,
        city: created.city || "",
        state: created.state || "",
        pincode: created.pincode || "",
        gstNumber: created.gstNumber || "",
        gst_number: created.gstNumber || "",
        outstanding_amount: created.outstanding_amount || 0,
        status: created.status,
        allowCredit: created.allowCredit,
        creditLimit: created.creditLimit || 0,
        outstanding: 0,
        invoicesCount: 0,
        createdAt: created.createdAt,
      },
    });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.put("/api/customers/:id", async (req, res) => {
  const customer_id =
    typeof req.body?.customer_id === "string" && req.body.customer_id.trim()
      ? req.body.customer_id.trim()
      : undefined;
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const tier = typeof req.body?.tier === "string" && req.body.tier.trim() ? req.body.tier.trim() : "Standard";
  const mobile =
    typeof req.body?.mobile === "string"
      ? req.body.mobile.trim()
      : typeof req.body?.phone === "string"
      ? req.body.phone.trim()
      : "";
  const address = typeof req.body?.address === "string" ? req.body.address.trim() : "";
  const city = typeof req.body?.city === "string" ? req.body.city.trim() : "";
  const state = typeof req.body?.state === "string" ? req.body.state.trim() : "";
  const pincode = typeof req.body?.pincode === "string" ? req.body.pincode.trim() : "";
  const gstNumber =
    typeof req.body?.gstNumber === "string"
      ? req.body.gstNumber.trim()
      : typeof req.body?.gst_number === "string"
      ? req.body.gst_number.trim()
      : "";
  const status = req.body?.status === "inactive" ? "inactive" : "active";
  const allowCredit = Boolean(req.body?.allowCredit);
  const creditLimit = Number(req.body?.creditLimit || 0);

  if (!name) {
    res.status(400).json({ ok: false, message: "Customer name required." });
    return;
  }

  if (!email) {
    res.status(400).json({ ok: false, message: "Customer email required." });
    return;
  }

  if (Number.isNaN(creditLimit) || creditLimit < 0) {
    res.status(400).json({ ok: false, message: "Invalid credit limit." });
    return;
  }

  try {
    const existing = await Customer.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ ok: false, message: "Customer not found." });
      return;
    }

    const duplicate = await Customer.findOne({ email, _id: { $ne: req.params.id } }).lean();
    if (duplicate) {
      res.status(409).json({ ok: false, message: "Customer email already exists." });
      return;
    }

    if (customer_id) {
      const duplicateCustomerId = await Customer.findOne({ customer_id, _id: { $ne: req.params.id } }).lean();
      if (duplicateCustomerId) {
        res.status(409).json({ ok: false, message: "Customer ID already exists." });
        return;
      }
    }

    const updated = await Customer.findByIdAndUpdate(
      req.params.id,
      {
        ...(customer_id ? { customer_id } : {}),
        name,
        email,
        tier,
        mobile,
        address,
        city,
        state,
        pincode,
        gstNumber,
        status,
        allowCredit,
        creditLimit: allowCredit ? creditLimit : 0,
      },
      { new: true }
    );

    const outstandingRow = await Invoice.aggregate([
      {
        $match: {
          customerId: updated._id,
          status: { $in: ["Sent", "Overdue"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]);

    const invoicesCount = await Invoice.countDocuments({ customerId: updated._id });

    res.json({
      ok: true,
      customer: {
        id: updated._id.toString(),
        customer_id: updated.customer_id,
        name: updated.name,
        email: updated.email,
        tier: updated.tier,
        mobile: updated.mobile || "",
        phone: updated.mobile || "",
        address: updated.address,
        city: updated.city || "",
        state: updated.state || "",
        pincode: updated.pincode || "",
        gstNumber: updated.gstNumber || "",
        gst_number: updated.gstNumber || "",
        outstanding_amount: updated.outstanding_amount || 0,
        status: updated.status,
        allowCredit: updated.allowCredit,
        creditLimit: updated.creditLimit || 0,
        outstanding: outstandingRow?.[0]?.total || 0,
        invoicesCount,
        createdAt: updated.createdAt,
      },
    });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.delete("/api/customers/:id", async (req, res) => {
  try {
    const linkedInvoices = await Invoice.countDocuments({ customerId: req.params.id });
    if (linkedInvoices > 0) {
      res.status(400).json({ ok: false, message: "Cannot delete customer with purchase history." });
      return;
    }

    const deleted = await Customer.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ ok: false, message: "Customer not found." });
      return;
    }

    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.get("/api/customers/:id/purchase-history", async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id).lean();
    if (!customer) {
      res.status(404).json({ ok: false, message: "Customer not found." });
      return;
    }

    const [invoices, sales] = await Promise.all([
      Invoice.find({ customerId: customer._id }).sort({ issueDate: -1 }).lean(),
      Sale.find({ customerId: customer._id }).sort({ created_at: -1 }).lean(),
    ]);

    const invoiceIds = invoices.map((item) => item._id);
    const invoicePayments = invoiceIds.length
      ? await Payment.find({ invoiceId: { $in: invoiceIds } }).sort({ paidAt: -1 }).lean()
      : [];

    const paymentsByInvoice = new Map();
    for (const payment of invoicePayments) {
      const key = payment.invoiceId?.toString();
      const current = paymentsByInvoice.get(key) || [];
      current.push({
        id: payment._id.toString(),
        amount: payment.amount,
        method: payment.method,
        paidAt: payment.paidAt,
      });
      paymentsByInvoice.set(key, current);
    }

    const invoicePurchases = invoices.map((invoice) => {
      const payments = paymentsByInvoice.get(invoice._id.toString()) || [];
      const paidAmount = roundCurrency(
        payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
      );
      const outstandingAmount = roundCurrency(Math.max(Number(invoice.total || 0) - paidAmount, 0));

      return {
        id: `invoice-${invoice._id.toString()}`,
        invoiceNo: invoice.invoiceNo,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        status: invoice.status,
        total: invoice.total,
        category: invoice.category,
        payments,
        paidAmount,
        outstandingAmount,
      };
    });

    const saleStatusLabel = (sale) => {
      const remaining = computeSaleOutstanding(sale);
      if (sale.status === "returned") {
        return "Returned";
      }
      if (remaining <= 0) {
        return "Paid";
      }
      if (Number(sale.paidAmount || 0) > 0) {
        return "Partially Paid";
      }
      return "Unpaid";
    };

    const salePurchases = sales.map((sale) => {
      const mappedPayments = (sale.paymentHistory || []).map((payment, index) => ({
        id: `sale-payment-${sale._id.toString()}-${index}`,
        amount: Number(payment.amount || 0),
        method: payment.method || sale.paymentMethod || "cash",
        paidAt: payment.paidAt || sale.created_at,
      }));

      const payments =
        mappedPayments.length > 0
          ? mappedPayments
          : Number(sale.paidAmount || 0) > 0
          ? [
              {
                id: `sale-payment-${sale._id.toString()}-legacy`,
                amount: Number(sale.paidAmount || 0),
                method: sale.paymentMethod || "cash",
                paidAt: sale.created_at,
              },
            ]
          : [];

      const paidAmount = roundCurrency(
        payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
      );

      return {
        id: `sale-${sale._id.toString()}`,
        invoiceNo: sale.invoiceNo,
        issueDate: sale.created_at,
        dueDate: sale.created_at,
        status: saleStatusLabel(sale),
        total: Number(sale.grandTotal || 0),
        category: (sale.items || [])[0]?.category || "Billing Sale",
        payments,
        paidAmount,
        outstandingAmount: computeSaleOutstanding(sale),
      };
    });

    const purchases = [...salePurchases, ...invoicePurchases].sort(
      (a, b) => new Date(b.issueDate || 0).getTime() - new Date(a.issueDate || 0).getTime()
    );

    const totalPurchases = purchases.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const totalPaid = roundCurrency(
      purchases.reduce((sum, item) => sum + Number(item.paidAmount || 0), 0)
    );
    const outstanding = roundCurrency(
      purchases.reduce((sum, item) => sum + Number(item.outstandingAmount || 0), 0)
    );

    res.json({
      ok: true,
      customer: {
        id: customer._id.toString(),
        customer_id: customer.customer_id || "",
        name: customer.name,
        email: customer.email,
        tier: customer.tier,
        mobile: customer.mobile || "",
        phone: customer.mobile || "",
        address: customer.address || "",
        city: customer.city || "",
        state: customer.state || "",
        pincode: customer.pincode || "",
        gstNumber: customer.gstNumber || "",
        gst_number: customer.gstNumber || "",
        outstanding_amount: Number(customer.outstanding_amount || 0),
        status: customer.status || "active",
        allowCredit: Boolean(customer.allowCredit),
        creditLimit: Number(customer.creditLimit || 0),
      },
      summary: {
        invoicesCount: purchases.length,
        totalPurchases,
        totalPaid,
        outstanding,
      },
      purchases,
    });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.get("/api/payments", async (req, res) => {
  try {
    const rows = await Payment.aggregate([
      { $sort: { paidAt: -1 } },
      {
        $lookup: {
          from: "invoices",
          localField: "invoiceId",
          foreignField: "_id",
          as: "invoice",
        },
      },
      { $unwind: "$invoice" },
      {
        $lookup: {
          from: "customers",
          localField: "customerId",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: "$customer" },
      {
        $project: {
          id: { $toString: "$_id" },
          amount: 1,
          method: 1,
          paid_at: "$paidAt",
          invoice_no: "$invoice.invoiceNo",
          customer_name: "$customer.name",
        },
      },
    ]);
    res.json({ ok: true, data: rows });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.get("/api/reports", async (req, res) => {
  try {
    const rows = await Invoice.aggregate([
      { $group: { _id: "$category", total: { $sum: "$total" } } },
      { $sort: { total: -1 } },
      { $project: { _id: 0, category: "$_id", total: 1 } },
    ]);
    res.json({ ok: true, data: rows });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.get("/api/accounting/ledger", async (req, res) => {
  const { fromDate, toDate, limit } = req.query || {};

  const dateFilter = buildDateFilter(fromDate, toDate);
  const match = Object.keys(dateFilter).length ? { date: dateFilter } : {};
  const parsedLimit = Number(limit);
  const safeLimit = Number.isNaN(parsedLimit) || parsedLimit <= 0 ? 200 : Math.min(parsedLimit, 1000);

  try {
    const rows = await Ledger.find(match).sort({ date: -1, created_at: -1 }).limit(safeLimit).lean();
    const data = rows.map((entry) => ({
      id: entry._id.toString(),
      ledger_id: entry.ledger_id,
      date: entry.date,
      reference_type: entry.reference_type,
      reference_id: entry.reference_id,
      description: entry.description || "",
      debit_amount: Number(entry.debit_amount || 0),
      credit_amount: Number(entry.credit_amount || 0),
      balance_after: Number(entry.balance_after || 0),
      created_at: entry.created_at,
    }));

    res.json({ ok: true, data });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.get("/api/accounting/expenses", async (req, res) => {
  const { fromDate, toDate, category } = req.query || {};
  const dateFilter = buildDateFilter(fromDate, toDate);
  const match = {};

  if (Object.keys(dateFilter).length) {
    match.date = dateFilter;
  }

  if (typeof category === "string" && category.trim()) {
    match.category = category.trim();
  }

  try {
    const rows = await ExtraExpense.find(match).sort({ date: -1, created_at: -1 }).lean();
    const data = rows.map((entry) => ({
      id: entry._id.toString(),
      expense_id: entry.expense_id,
      date: entry.date,
      category: entry.category || "General",
      description: entry.description,
      amount: Number(entry.amount || 0),
      payment_mode: entry.payment_mode || "cash",
      created_by: entry.created_by || "System",
      created_at: entry.created_at,
      updated_at: entry.updated_at,
    }));
    res.json({ ok: true, data });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.post("/api/accounting/expenses", async (req, res) => {
  const category = typeof req.body?.category === "string" && req.body.category.trim()
    ? req.body.category.trim()
    : "General";
  const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
  const paymentMode = normalizeExpensePaymentMode(
    typeof req.body?.payment_mode === "string" ? req.body.payment_mode.trim().toLowerCase() : "cash"
  );
  const createdBy = typeof req.body?.created_by === "string" && req.body.created_by.trim()
    ? req.body.created_by.trim()
    : "System";
  const amount = Number(req.body?.amount);
  const requestedDate = req.body?.date ? new Date(req.body.date) : new Date();

  if (!description) {
    res.status(400).json({ ok: false, message: "Expense description is required." });
    return;
  }

  if (Number.isNaN(amount) || amount <= 0) {
    res.status(400).json({ ok: false, message: "Expense amount must be greater than zero." });
    return;
  }

  if (Number.isNaN(requestedDate.getTime())) {
    res.status(400).json({ ok: false, message: "Invalid expense date." });
    return;
  }

  try {
    const created = await ExtraExpense.create({
      date: requestedDate,
      category,
      description,
      amount: roundCurrency(amount),
      payment_mode: paymentMode,
      created_by: createdBy,
    });

    await postLedgerEntry({
      date: created.date,
      referenceType: "Expense",
      referenceId: created.expense_id,
      description: created.description,
      debitAmount: created.amount,
      creditAmount: 0,
    });

    res.status(201).json({
      ok: true,
      expense: {
        id: created._id.toString(),
        expense_id: created.expense_id,
        date: created.date,
        category: created.category || "General",
        description: created.description,
        amount: Number(created.amount || 0),
        payment_mode: created.payment_mode || "cash",
        created_by: created.created_by || "System",
        created_at: created.created_at,
        updated_at: created.updated_at,
      },
    });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.put("/api/accounting/expenses/:id", async (req, res) => {
  const { id } = req.params;

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ ok: false, message: "Valid expense id is required." });
    return;
  }

  const category = typeof req.body?.category === "string" && req.body.category.trim()
    ? req.body.category.trim()
    : "General";
  const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
  const paymentMode = normalizeExpensePaymentMode(
    typeof req.body?.payment_mode === "string" ? req.body.payment_mode.trim().toLowerCase() : "cash"
  );
  const createdBy = typeof req.body?.created_by === "string" && req.body.created_by.trim()
    ? req.body.created_by.trim()
    : "System";
  const amount = Number(req.body?.amount);
  const requestedDate = req.body?.date ? new Date(req.body.date) : null;

  if (!description) {
    res.status(400).json({ ok: false, message: "Expense description is required." });
    return;
  }

  if (Number.isNaN(amount) || amount <= 0) {
    res.status(400).json({ ok: false, message: "Expense amount must be greater than zero." });
    return;
  }

  if (!requestedDate || Number.isNaN(requestedDate.getTime())) {
    res.status(400).json({ ok: false, message: "Invalid expense date." });
    return;
  }

  try {
    const updated = await ExtraExpense.findByIdAndUpdate(
      id,
      {
        date: requestedDate,
        category,
        description,
        amount: roundCurrency(amount),
        payment_mode: paymentMode,
        created_by: createdBy,
      },
      { new: true }
    ).lean();

    if (!updated) {
      res.status(404).json({ ok: false, message: "Expense not found." });
      return;
    }

    res.json({
      ok: true,
      expense: {
        id: updated._id.toString(),
        expense_id: updated.expense_id,
        date: updated.date,
        category: updated.category || "General",
        description: updated.description,
        amount: Number(updated.amount || 0),
        payment_mode: updated.payment_mode || "cash",
        created_by: updated.created_by || "System",
        created_at: updated.created_at,
        updated_at: updated.updated_at,
      },
    });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.delete("/api/accounting/expenses/:id", async (req, res) => {
  const { id } = req.params;

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ ok: false, message: "Valid expense id is required." });
    return;
  }

  try {
    const deleted = await ExtraExpense.findByIdAndDelete(id).lean();

    if (!deleted) {
      res.status(404).json({ ok: false, message: "Expense not found." });
      return;
    }

    res.json({ ok: true, message: "Expense deleted successfully." });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.get("/api/accounting/expenses/report/date-wise", async (req, res) => {
  const { fromDate, toDate, category } = req.query || {};
  const dateFilter = buildDateFilter(fromDate, toDate);
  const match = {};

  if (Object.keys(dateFilter).length) {
    match.date = dateFilter;
  }

  if (typeof category === "string" && category.trim()) {
    match.category = category.trim();
  }

  try {
    const report = await ExtraExpense.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$date",
            },
          },
          totalAmount: { $sum: "$amount" },
          expenseCount: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      {
        $project: {
          _id: 0,
          date: "$_id",
          totalAmount: { $round: ["$totalAmount", 2] },
          expenseCount: 1,
        },
      },
    ]);

    res.json({ ok: true, data: report });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.get("/api/accounting/revenue-summary", async (req, res) => {
  const { fromDate, toDate } = req.query || {};
  const createdAtFilter = buildCreatedAtFilter(fromDate, toDate);
  const match = Object.keys(createdAtFilter).length ? { created_at: createdAtFilter } : {};

  try {
    const [saleRow, stockInRow, expenseRow] = await Promise.all([
      Sale.aggregate([
        { $match: match },
        { $group: { _id: null, total: { $sum: "$grandTotal" } } },
      ]),
      StockIn.aggregate([
        { $match: match },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      ExtraExpense.aggregate([
        Object.keys(createdAtFilter).length ? { $match: { date: createdAtFilter } } : { $match: {} },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    const totalSalesRevenue = roundCurrency(saleRow?.[0]?.total || 0);
    const totalPurchaseCost = roundCurrency(stockInRow?.[0]?.total || 0);
    const totalExtraExpenses = roundCurrency(expenseRow?.[0]?.total || 0);
    const grossProfit = roundCurrency(totalSalesRevenue - totalPurchaseCost - totalExtraExpenses);

    res.json({
      ok: true,
      summary: {
        totalSalesRevenue,
        totalPurchaseCost,
        totalExtraExpenses,
        grossProfit,
      },
    });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.get("/api/accounting/cash-count", async (req, res) => {
  const requestedDate = typeof req.query?.date === "string" && req.query.date.trim()
    ? req.query.date.trim()
    : new Date().toISOString().slice(0, 10);

  const dayStart = parseDateBoundary(requestedDate, "start");
  const dayEnd = parseDateBoundary(requestedDate, "end");

  if (!dayStart || !dayEnd) {
    res.status(400).json({ ok: false, message: "Invalid report date." });
    return;
  }

  try {
    const paymentRows = await Sale.aggregate([
      { $match: { created_at: { $gte: dayStart, $lte: dayEnd } } },
      { $group: { _id: "$paymentMethod", total: { $sum: "$grandTotal" } } },
    ]);

    const totalsByMethod = new Map(
      paymentRows.map((entry) => [String(entry._id || "").toLowerCase(), roundCurrency(entry.total || 0)])
    );

    const dailyCashSales = roundCurrency(totalsByMethod.get("cash") || 0);
    const cardSales = roundCurrency(totalsByMethod.get("card") || 0);
    const upiSales = roundCurrency(totalsByMethod.get("upi") || 0);
    const totalCollection = roundCurrency(dailyCashSales + cardSales + upiSales);

    res.json({
      ok: true,
      date: requestedDate,
      report: {
        dailyCashSales,
        cardSales,
        upiSales,
        totalCollection,
      },
    });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

// ==================== ACCOUNTING MODULE ENDPOINTS ====================

// ── Accounts ──────────────────────────────────────────────────────────────

app.get("/api/acct/accounts", async (req, res) => {
  try {
    const { search, status } = req.query;
    const match = {};
    if (search && typeof search === "string" && search.trim()) {
      match.name = { $regex: search.trim(), $options: "i" };
    }
    if (status && ["active", "inactive"].includes(status)) {
      match.status = status;
    }

    const accounts = await AcctAccount.find(match).sort({ name: 1 }).lean();
    const accountIds = accounts.map((a) => a._id);

    const [incomeRows, expenseRows] = await Promise.all([
      AcctEntry.aggregate([
        { $match: { accountId: { $in: accountIds }, type: "income" } },
        { $group: { _id: "$accountId", total: { $sum: "$amount" } } },
      ]),
      AcctEntry.aggregate([
        { $match: { accountId: { $in: accountIds }, type: "expense" } },
        { $group: { _id: "$accountId", total: { $sum: "$amount" } } },
      ]),
    ]);

    const incomeMap = new Map(incomeRows.map((r) => [r._id.toString(), roundCurrency(r.total)]));
    const expenseMap = new Map(expenseRows.map((r) => [r._id.toString(), roundCurrency(r.total)]));

    const data = accounts.map((a) => {
      const aid = a._id.toString();
      const totalIn = incomeMap.get(aid) || 0;
      const totalOut = expenseMap.get(aid) || 0;
      return {
        id: aid,
        name: a.name,
        openingBalance: roundCurrency(a.openingBalance || 0),
        totalIn,
        totalOut,
        currentBalance: roundCurrency((a.openingBalance || 0) + totalIn - totalOut),
        status: a.status,
        createdAt: a.createdAt,
      };
    });

    res.json({ ok: true, data });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.post("/api/acct/accounts", async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const openingBalance = roundCurrency(Number(req.body?.openingBalance) || 0);
  const status = ["active", "inactive"].includes(req.body?.status) ? req.body.status : "active";

  if (!name) {
    res.status(400).json({ ok: false, message: "Account name is required." });
    return;
  }

  try {
    const created = await AcctAccount.create({ name, openingBalance, status });
    res.status(201).json({
      ok: true,
      account: {
        id: created._id.toString(),
        name: created.name,
        openingBalance: created.openingBalance,
        totalIn: 0,
        totalOut: 0,
        currentBalance: created.openingBalance,
        status: created.status,
        createdAt: created.createdAt,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ ok: false, message: "Account name already exists." });
    } else {
      res.status(500).json({ ok: false, message: "Server error." });
    }
  }
});

app.put("/api/acct/accounts/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ ok: false, message: "Invalid account id." });
    return;
  }

  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const openingBalance = roundCurrency(Number(req.body?.openingBalance) || 0);
  const status = ["active", "inactive"].includes(req.body?.status) ? req.body.status : "active";

  if (!name) {
    res.status(400).json({ ok: false, message: "Account name is required." });
    return;
  }

  try {
    const updated = await AcctAccount.findByIdAndUpdate(
      id,
      { name, openingBalance, status },
      { new: true }
    ).lean();

    if (!updated) {
      res.status(404).json({ ok: false, message: "Account not found." });
      return;
    }

    const [incomeRow, expenseRow] = await Promise.all([
      AcctEntry.aggregate([{ $match: { accountId: updated._id, type: "income" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      AcctEntry.aggregate([{ $match: { accountId: updated._id, type: "expense" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    ]);
    const totalIn = roundCurrency(incomeRow?.[0]?.total || 0);
    const totalOut = roundCurrency(expenseRow?.[0]?.total || 0);

    res.json({
      ok: true,
      account: {
        id: updated._id.toString(),
        name: updated.name,
        openingBalance: roundCurrency(updated.openingBalance || 0),
        totalIn,
        totalOut,
        currentBalance: roundCurrency((updated.openingBalance || 0) + totalIn - totalOut),
        status: updated.status,
        createdAt: updated.createdAt,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ ok: false, message: "Account name already exists." });
    } else {
      res.status(500).json({ ok: false, message: "Server error." });
    }
  }
});

app.delete("/api/acct/accounts/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ ok: false, message: "Invalid account id." });
    return;
  }

  try {
    const entryCount = await AcctEntry.countDocuments({ accountId: new mongoose.Types.ObjectId(id) });
    if (entryCount > 0) {
      res.status(400).json({ ok: false, message: `Cannot delete account. ${entryCount} entr${entryCount === 1 ? "y is" : "ies are"} linked to it.` });
      return;
    }

    const deleted = await AcctAccount.findByIdAndDelete(id).lean();
    if (!deleted) {
      res.status(404).json({ ok: false, message: "Account not found." });
      return;
    }

    res.json({ ok: true, message: "Account deleted successfully." });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.get("/api/acct/accounts/:id/detail", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ ok: false, message: "Invalid account id." });
    return;
  }

  try {
    const account = await AcctAccount.findById(id).lean();
    if (!account) {
      res.status(404).json({ ok: false, message: "Account not found." });
      return;
    }

    const { fromDate, toDate, type, categoryId } = req.query;
    const dateFilter = buildDateFilter(fromDate, toDate);
    const entryMatch = { accountId: new mongoose.Types.ObjectId(id) };
    if (Object.keys(dateFilter).length) entryMatch.date = dateFilter;
    if (type && ["income", "expense"].includes(type)) entryMatch.type = type;
    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
      entryMatch.categoryId = new mongoose.Types.ObjectId(categoryId);
    }

    const [entries, incomeAgg, expenseAgg, totalEntryCount] = await Promise.all([
      AcctEntry.find(entryMatch).sort({ date: -1 }).populate("categoryId", "name type").lean(),
      AcctEntry.aggregate([{ $match: { accountId: new mongoose.Types.ObjectId(id), type: "income" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      AcctEntry.aggregate([{ $match: { accountId: new mongoose.Types.ObjectId(id), type: "expense" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      AcctEntry.countDocuments({ accountId: new mongoose.Types.ObjectId(id) }),
    ]);

    const totalIn = roundCurrency(incomeAgg?.[0]?.total || 0);
    const totalOut = roundCurrency(expenseAgg?.[0]?.total || 0);

    res.json({
      ok: true,
      account: {
        id: account._id.toString(),
        name: account.name,
        openingBalance: roundCurrency(account.openingBalance || 0),
        totalIn,
        totalOut,
        currentBalance: roundCurrency((account.openingBalance || 0) + totalIn - totalOut),
        status: account.status,
        totalEntryCount,
      },
      entries: entries.map((e) => ({
        id: e._id.toString(),
        type: e.type,
        categoryName: e.categoryId?.name || "",
        amount: roundCurrency(e.amount),
        date: e.date,
        remarks: e.remarks || "",
        createdAt: e.createdAt,
      })),
    });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

// ── Categories ─────────────────────────────────────────────────────────────

app.get("/api/acct/categories", async (req, res) => {
  try {
    const { search, type, status } = req.query;
    const match = {};
    if (search && typeof search === "string" && search.trim()) {
      match.name = { $regex: search.trim(), $options: "i" };
    }
    if (type && ["income", "expense"].includes(type)) match.type = type;
    if (status && ["active", "inactive"].includes(status)) match.status = status;

    const cats = await AcctCategory.find(match).sort({ type: 1, name: 1 }).lean();
    res.json({
      ok: true,
      data: cats.map((c) => ({
        id: c._id.toString(),
        name: c.name,
        type: c.type,
        status: c.status,
        createdAt: c.createdAt,
      })),
    });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.post("/api/acct/categories", async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const type = ["income", "expense"].includes(req.body?.type) ? req.body.type : null;
  const status = ["active", "inactive"].includes(req.body?.status) ? req.body.status : "active";

  if (!name) {
    res.status(400).json({ ok: false, message: "Category name is required." });
    return;
  }
  if (!type) {
    res.status(400).json({ ok: false, message: "Category type (income/expense) is required." });
    return;
  }

  try {
    const created = await AcctCategory.create({ name, type, status });
    res.status(201).json({
      ok: true,
      category: { id: created._id.toString(), name: created.name, type: created.type, status: created.status, createdAt: created.createdAt },
    });
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ ok: false, message: "Category name already exists." });
    } else {
      res.status(500).json({ ok: false, message: "Server error." });
    }
  }
});

app.put("/api/acct/categories/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ ok: false, message: "Invalid category id." });
    return;
  }

  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const status = ["active", "inactive"].includes(req.body?.status) ? req.body.status : "active";

  if (!name) {
    res.status(400).json({ ok: false, message: "Category name is required." });
    return;
  }

  try {
    const updated = await AcctCategory.findByIdAndUpdate(id, { name, status }, { new: true }).lean();
    if (!updated) {
      res.status(404).json({ ok: false, message: "Category not found." });
      return;
    }
    res.json({
      ok: true,
      category: { id: updated._id.toString(), name: updated.name, type: updated.type, status: updated.status, createdAt: updated.createdAt },
    });
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ ok: false, message: "Category name already exists." });
    } else {
      res.status(500).json({ ok: false, message: "Server error." });
    }
  }
});

app.delete("/api/acct/categories/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ ok: false, message: "Invalid category id." });
    return;
  }

  try {
    const entryCount = await AcctEntry.countDocuments({ categoryId: new mongoose.Types.ObjectId(id) });
    if (entryCount > 0) {
      res.status(400).json({ ok: false, message: `Cannot delete category. ${entryCount} entr${entryCount === 1 ? "y is" : "ies are"} linked to it.` });
      return;
    }

    const deleted = await AcctCategory.findByIdAndDelete(id).lean();
    if (!deleted) {
      res.status(404).json({ ok: false, message: "Category not found." });
      return;
    }

    res.json({ ok: true, message: "Category deleted successfully." });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

// ── Entries ────────────────────────────────────────────────────────────────

app.get("/api/acct/entries", async (req, res) => {
  try {
    const { fromDate, toDate, type, accountId, categoryId, search } = req.query;
    const dateFilter = buildDateFilter(fromDate, toDate);
    const match = {};
    if (Object.keys(dateFilter).length) match.date = dateFilter;
    if (type && ["income", "expense"].includes(type)) match.type = type;
    if (accountId && mongoose.Types.ObjectId.isValid(accountId)) {
      match.accountId = new mongoose.Types.ObjectId(accountId);
    }
    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
      match.categoryId = new mongoose.Types.ObjectId(categoryId);
    }
    if (search && typeof search === "string" && search.trim()) {
      match.remarks = { $regex: search.trim(), $options: "i" };
    }

    const entries = await AcctEntry.find(match)
      .sort({ date: -1, createdAt: -1 })
      .populate("accountId", "name")
      .populate("categoryId", "name type")
      .lean();

    let totalIncome = 0;
    let totalExpense = 0;
    for (const e of entries) {
      if (e.type === "income") totalIncome += e.amount || 0;
      else totalExpense += e.amount || 0;
    }
    totalIncome = roundCurrency(totalIncome);
    totalExpense = roundCurrency(totalExpense);

    res.json({
      ok: true,
      summary: {
        totalIncome,
        totalExpense,
        net: roundCurrency(totalIncome - totalExpense),
        count: entries.length,
      },
      data: entries.map((e) => ({
        id: e._id.toString(),
        type: e.type,
        accountId: e.accountId?._id?.toString() || "",
        accountName: e.accountId?.name || "",
        categoryId: e.categoryId?._id?.toString() || "",
        categoryName: e.categoryId?.name || "",
        amount: roundCurrency(e.amount),
        date: e.date,
        remarks: e.remarks || "",
        createdAt: e.createdAt,
      })),
    });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.post("/api/acct/entries", async (req, res) => {
  const type = ["income", "expense"].includes(req.body?.type) ? req.body.type : null;
  const accountId = req.body?.accountId;
  const categoryId = req.body?.categoryId;
  const amount = roundCurrency(Number(req.body?.amount));
  const date = req.body?.date ? new Date(req.body.date) : null;
  const remarks = typeof req.body?.remarks === "string" ? req.body.remarks.trim() : "";

  if (!type) { res.status(400).json({ ok: false, message: "Entry type (income/expense) is required." }); return; }
  if (!accountId || !mongoose.Types.ObjectId.isValid(accountId)) { res.status(400).json({ ok: false, message: "Valid account is required." }); return; }
  if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) { res.status(400).json({ ok: false, message: "Valid category is required." }); return; }
  if (!amount || amount <= 0) { res.status(400).json({ ok: false, message: "Amount must be greater than zero." }); return; }
  if (!date || Number.isNaN(date.getTime())) { res.status(400).json({ ok: false, message: "Valid date is required." }); return; }

  try {
    const [account, category] = await Promise.all([
      AcctAccount.findById(accountId).lean(),
      AcctCategory.findById(categoryId).lean(),
    ]);

    if (!account) { res.status(400).json({ ok: false, message: "Account not found." }); return; }
    if (account.status === "inactive") { res.status(400).json({ ok: false, message: "Cannot create entry under an inactive account." }); return; }
    if (!category) { res.status(400).json({ ok: false, message: "Category not found." }); return; }
    if (category.status === "inactive") { res.status(400).json({ ok: false, message: "Cannot use an inactive category." }); return; }
    if (category.type !== type) { res.status(400).json({ ok: false, message: `This category is for ${category.type} entries only.` }); return; }

    const created = await AcctEntry.create({ type, accountId, categoryId, amount, date, remarks });
    res.status(201).json({
      ok: true,
      entry: {
        id: created._id.toString(),
        type: created.type,
        accountId,
        accountName: account.name,
        categoryId,
        categoryName: category.name,
        amount: created.amount,
        date: created.date,
        remarks: created.remarks,
        createdAt: created.createdAt,
      },
    });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.put("/api/acct/entries/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) { res.status(400).json({ ok: false, message: "Invalid entry id." }); return; }

  const type = ["income", "expense"].includes(req.body?.type) ? req.body.type : null;
  const accountId = req.body?.accountId;
  const categoryId = req.body?.categoryId;
  const amount = roundCurrency(Number(req.body?.amount));
  const date = req.body?.date ? new Date(req.body.date) : null;
  const remarks = typeof req.body?.remarks === "string" ? req.body.remarks.trim() : "";

  if (!type) { res.status(400).json({ ok: false, message: "Entry type is required." }); return; }
  if (!accountId || !mongoose.Types.ObjectId.isValid(accountId)) { res.status(400).json({ ok: false, message: "Valid account is required." }); return; }
  if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) { res.status(400).json({ ok: false, message: "Valid category is required." }); return; }
  if (!amount || amount <= 0) { res.status(400).json({ ok: false, message: "Amount must be greater than zero." }); return; }
  if (!date || Number.isNaN(date.getTime())) { res.status(400).json({ ok: false, message: "Valid date is required." }); return; }

  try {
    const [account, category] = await Promise.all([
      AcctAccount.findById(accountId).lean(),
      AcctCategory.findById(categoryId).lean(),
    ]);

    if (!account) { res.status(400).json({ ok: false, message: "Account not found." }); return; }
    if (account.status === "inactive") { res.status(400).json({ ok: false, message: "Cannot use an inactive account." }); return; }
    if (!category) { res.status(400).json({ ok: false, message: "Category not found." }); return; }
    if (category.status === "inactive") { res.status(400).json({ ok: false, message: "Cannot use an inactive category." }); return; }
    if (category.type !== type) { res.status(400).json({ ok: false, message: `This category is for ${category.type} entries only.` }); return; }

    const updated = await AcctEntry.findByIdAndUpdate(
      id,
      { type, accountId, categoryId, amount, date, remarks },
      { new: true }
    ).lean();

    if (!updated) { res.status(404).json({ ok: false, message: "Entry not found." }); return; }

    res.json({
      ok: true,
      entry: {
        id: updated._id.toString(),
        type: updated.type,
        accountId,
        accountName: account.name,
        categoryId,
        categoryName: category.name,
        amount: updated.amount,
        date: updated.date,
        remarks: updated.remarks,
        createdAt: updated.createdAt,
      },
    });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

app.delete("/api/acct/entries/:id", async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) { res.status(400).json({ ok: false, message: "Invalid entry id." }); return; }

  try {
    const deleted = await AcctEntry.findByIdAndDelete(id).lean();
    if (!deleted) { res.status(404).json({ ok: false, message: "Entry not found." }); return; }
    res.json({ ok: true, message: "Entry deleted successfully." });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

// ==================== CATEGORY ENDPOINTS ====================

// Get all categories
app.get("/api/categories", async (req, res) => {
  try {
    const categories = await Category.find().sort({ created_at: -1 }).lean();
    res.json({
      ok: true,
      data: categories.map(cat => ({
        id: cat._id.toString(),
        category_id: cat.category_id,
        name: cat.name,
        categoryCode: cat.categoryCode,
        description: cat.description,
        parent_id: cat.parent_id,
        status: cat.status,
        gstTaxSlab: cat.gstTaxSlab,
        createdBy: cat.createdBy,
        createdDate: cat.createdDate,
        createdAt: cat.created_at,
      })),
    });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

// Get category by ID or search
app.get("/api/categories/search/:query", async (req, res) => {
  try {
    const { query } = req.params;
    const categories = await Category.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
        { categoryCode: { $regex: query, $options: "i" } },
      ],
    })
      .sort({ created_at: -1 })
      .lean();

    res.json({
      ok: true,
      data: categories.map(cat => ({
        id: cat._id.toString(),
        category_id: cat.category_id,
        name: cat.name,
        categoryCode: cat.categoryCode,
        description: cat.description,
        parent_id: cat.parent_id,
        status: cat.status,
        gstTaxSlab: cat.gstTaxSlab,
        createdBy: cat.createdBy,
        createdDate: cat.createdDate,
        createdAt: cat.created_at,
      })),
    });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

// Create new category
app.post("/api/categories", async (req, res) => {
  const { name, categoryCode, description, parent_id, status, gstTaxSlab, createdBy, createdDate } = req.body;

  if (!name || typeof name !== "string") {
    res.status(400).json({ ok: false, message: "Category name is required." });
    return;
  }

  try {
    // Auto-generate category code if not provided
    let finalCategoryCode = categoryCode ? String(categoryCode).trim().toUpperCase() : null;
    
    if (!finalCategoryCode) {
      // Find the highest existing category code number
      const existingCategories = await Category.find({ categoryCode: /^CAT\d+$/i })
        .sort({ categoryCode: -1 })
        .limit(50);
      
      let maxNumber = 0;
      for (const cat of existingCategories) {
        if (cat.categoryCode) {
          const match = cat.categoryCode.match(/^CAT(\d+)$/i);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNumber) {
              maxNumber = num;
            }
          }
        }
      }
      
      finalCategoryCode = `CAT${String(maxNumber + 1).padStart(3, '0')}`;
    }

    const newCategory = new Category({
      name: name.trim(),
      categoryCode: finalCategoryCode,
      description: description ? String(description).trim() : "",
      parent_id: parent_id || null,
      status: status || "active",
      gstTaxSlab: gstTaxSlab ? parseFloat(gstTaxSlab) : null,
      createdBy: createdBy || "System",
      createdDate: createdDate ? new Date(createdDate) : new Date(),
    });

    const created = await newCategory.save();
    res.status(201).json({
      ok: true,
      category: {
        id: created._id.toString(),
        category_id: created.category_id,
        name: created.name,
        categoryCode: created.categoryCode,
        description: created.description,
        parent_id: created.parent_id,
        status: created.status,
        gstTaxSlab: created.gstTaxSlab,
        createdBy: created.createdBy,
        createdDate: created.createdDate,
        createdAt: created.created_at,
      },
    });
  } catch {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const fieldName = field === "name" ? "Category name" : field === "categoryCode" ? "Category code" : field;
      res.status(400).json({ ok: false, message: `${fieldName} already exists.` });
    } else {
      res.status(500).json({ ok: false, message: "Server error." });
    }
  }
});

// Update category
app.put("/api/categories/:id", async (req, res) => {
  const { name, categoryCode, description, parent_id, status, gstTaxSlab, createdBy, createdDate } = req.body;

  if (!name || typeof name !== "string") {
    res.status(400).json({ ok: false, message: "Category name is required." });
    return;
  }

  try {
    const updateData = {
      name: name.trim(),
      description: description ? String(description).trim() : "",
      status: status || "active",
      gstTaxSlab: gstTaxSlab ? parseFloat(gstTaxSlab) : null,
      createdBy: createdBy || "System",
      createdDate: createdDate ? new Date(createdDate) : new Date(),
    };

    if (categoryCode) {
      updateData.categoryCode = String(categoryCode).trim().toUpperCase();
    }

    if (parent_id) {
      updateData.parent_id = parent_id;
    } else {
      updateData.parent_id = null;
    }

    const updated = await Category.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });

    if (!updated) {
      res.status(404).json({ ok: false, message: "Category not found." });
      return;
    }

    res.json({
      ok: true,
      category: {
        id: updated._id.toString(),
        category_id: updated.category_id,
        name: updated.name,
        categoryCode: updated.categoryCode,
        description: updated.description,
        parent_id: updated.parent_id,
        status: updated.status,
        gstTaxSlab: updated.gstTaxSlab,
        createdBy: updated.createdBy,
        createdDate: updated.createdDate,
        createdAt: updated.created_at,
      },
    });
  } catch {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const fieldName = field === "name" ? "Category name" : field === "categoryCode" ? "Category code" : field;
      res.status(400).json({ ok: false, message: `${fieldName} already exists.` });
    } else {
      res.status(500).json({ ok: false, message: "Server error." });
    }
  }
});

// Delete category
app.delete("/api/categories/:id", async (req, res) => {
  try {
    // Check if any products are using this category
    const productsCount = await Product.countDocuments({
      category_id: (await Category.findById(req.params.id))?.name,
    });

    if (productsCount > 0) {
      res.status(400).json({
        ok: false,
        message: `Cannot delete category. ${productsCount} product(s) are linked to it.`,
      });
      return;
    }

    const deleted = await Category.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ ok: false, message: "Category not found." });
      return;
    }

    res.json({ ok: true, message: "Category deleted successfully." });
  } catch {
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

initMongo()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
      const networkInterfaces = os.networkInterfaces();
      const addresses = Object.values(networkInterfaces)
        .flat()
        .filter(iface => iface.family === 'IPv4' && !iface.internal)
        .map(iface => iface.address);
      if (addresses.length > 0) {
        console.log(`Network: http://${addresses[0]}:${PORT}`);
      }
    });
  })
  .catch((error) => {
    console.error("Failed to initialize MongoDB", error);
    process.exit(1);
  });

