"use client";

import { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useUser } from "@/components/AppLayout";
import { accountantAPI, clientsAPI, contractsAPI } from "@/lib/api";
import { showError, showSuccess } from "@/lib/toast";

const paymentMethods = [
  "CASH",
  "BANK_TRANSFER",
  "UPI",
  "CHEQUE",
  "CARD",
  "OTHER",
];

export default function AccountantDashboardPage() {
  const user = useUser();
  const roleLower = String(user?.role || "").toLowerCase();

  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);

  const [clients, setClients] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<
    "invoices" | "payments" | "printing"
  >("invoices");

  const [invoiceForm, setInvoiceForm] = useState({
    clientId: "",
    contractId: "",
    subtotal: "",
    taxAmount: "",
    dueDate: "",
    notes: "",
  });

  const [paymentForm, setPaymentForm] = useState({
    invoiceId: "",
    amount: "",
    method: "UPI",
    reference: "",
    notes: "",
  });

  const [expenseForm, setExpenseForm] = useState({
    clientId: "",
    contractId: "",
    description: "",
    amount: "",
    incurredOn: "",
    vendor: "",
    notes: "",
  });

  const canAccess = useMemo(() => {
    return ["accountant", "owner", "manager", "admin"].includes(roleLower);
  }, [roleLower]);

  const fetchSummary = async () => {
    try {
      const resp = await accountantAPI.summary();
      if (resp?.success) {
        setSummary(resp.data || null);
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to load summary");
    }
  };

  const fetchLists = async () => {
    try {
      setLoading(true);
      const [invoiceRes, paymentRes, expenseRes] = await Promise.all([
        accountantAPI.listInvoices({ page: 1, limit: 50 }),
        accountantAPI.listPayments({ page: 1, limit: 50 }),
        accountantAPI.listPrintingExpenses({ page: 1, limit: 50 }),
      ]);

      if (invoiceRes?.success) {
        setInvoices(invoiceRes.data?.rows || []);
      }
      if (paymentRes?.success) {
        setPayments(paymentRes.data?.rows || []);
      }
      if (expenseRes?.success) {
        setExpenses(expenseRes.data?.rows || []);
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to load finance data");
    } finally {
      setLoading(false);
    }
  };

  const fetchLookups = async () => {
    try {
      const [clientsRes, contractsRes] = await Promise.all([
        clientsAPI.getAll(),
        contractsAPI.getAll(),
      ]);
      if (clientsRes?.success) setClients(clientsRes.data || []);
      if (contractsRes?.success) setContracts(contractsRes.data || []);
    } catch (_) {
      setClients([]);
      setContracts([]);
    }
  };

  useEffect(() => {
    if (!canAccess) return;
    fetchSummary();
    fetchLists();
    fetchLookups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess]);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        clientId: invoiceForm.clientId,
        contractId: invoiceForm.contractId || undefined,
        subtotal: Number(invoiceForm.subtotal || 0),
        taxAmount: invoiceForm.taxAmount ? Number(invoiceForm.taxAmount) : 0,
        dueDate: invoiceForm.dueDate || undefined,
        notes: invoiceForm.notes || undefined,
      };
      const resp = await accountantAPI.createInvoice(payload);
      if (resp?.success) {
        showSuccess("Invoice created");
        setInvoiceForm({
          clientId: "",
          contractId: "",
          subtotal: "",
          taxAmount: "",
          dueDate: "",
          notes: "",
        });
        fetchSummary();
        fetchLists();
      } else {
        showError(resp?.message || "Failed to create invoice");
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to create invoice");
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        amount: Number(paymentForm.amount || 0),
        method: paymentForm.method,
        reference: paymentForm.reference || undefined,
        notes: paymentForm.notes || undefined,
      };
      const resp = await accountantAPI.recordPayment(
        paymentForm.invoiceId,
        payload,
      );
      if (resp?.success) {
        showSuccess("Payment recorded");
        setPaymentForm({
          invoiceId: "",
          amount: "",
          method: "UPI",
          reference: "",
          notes: "",
        });
        fetchSummary();
        fetchLists();
      } else {
        showError(resp?.message || "Failed to record payment");
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to record payment");
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        clientId: expenseForm.clientId || undefined,
        contractId: expenseForm.contractId || undefined,
        description: expenseForm.description,
        amount: Number(expenseForm.amount || 0),
        incurredOn: expenseForm.incurredOn || undefined,
        vendor: expenseForm.vendor || undefined,
        notes: expenseForm.notes || undefined,
      };
      const resp = await accountantAPI.createPrintingExpense(payload);
      if (resp?.success) {
        showSuccess("Printing expense saved");
        setExpenseForm({
          clientId: "",
          contractId: "",
          description: "",
          amount: "",
          incurredOn: "",
          vendor: "",
          notes: "",
        });
        fetchSummary();
        fetchLists();
      } else {
        showError(resp?.message || "Failed to save expense");
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to save expense");
    }
  };

  return (
    <ProtectedRoute component="accounting">
      <div className="page-container">
        <div className="page-header">
          <h1>Accountant Dashboard</h1>
          <p>Invoices, payments, and printing expenses</p>
        </div>

        <div className="grid">
          <div className="stat-card">
            <h3>₹{summary?.totalBilled || 0}</h3>
            <p>Total Billed</p>
          </div>
          <div className="stat-card">
            <h3>₹{summary?.totalPaid || 0}</h3>
            <p>Total Paid</p>
          </div>
          <div className="stat-card">
            <h3>₹{summary?.outstanding || 0}</h3>
            <p>Outstanding</p>
          </div>
          <div className="stat-card">
            <h3>₹{summary?.totalPrintingExpense || 0}</h3>
            <p>Printing Expenses</p>
          </div>
        </div>

        <div className="card">
          <div className="tab-bar">
            <button
              className={
                activeTab === "invoices" ? "tab-button active" : "tab-button"
              }
              onClick={() => setActiveTab("invoices")}
            >
              Invoices
            </button>
            <button
              className={
                activeTab === "payments" ? "tab-button active" : "tab-button"
              }
              onClick={() => setActiveTab("payments")}
            >
              Payments
            </button>
            <button
              className={
                activeTab === "printing" ? "tab-button active" : "tab-button"
              }
              onClick={() => setActiveTab("printing")}
            >
              Printing Expenses
            </button>
          </div>

          {loading && <p>Loading...</p>}

          {activeTab === "invoices" && (
            <div className="grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
              <div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Client</th>
                      <th>Total</th>
                      <th>Paid</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invoices || []).map((inv) => (
                      <tr key={inv.id}>
                        <td>{inv.invoiceNumber}</td>
                        <td>{inv.client?.name || "—"}</td>
                        <td>₹{inv.totalAmount}</td>
                        <td>₹{inv.paidAmount}</td>
                        <td>{inv.status}</td>
                      </tr>
                    ))}
                    {(!invoices || invoices.length === 0) && (
                      <tr>
                        <td colSpan={5}>No invoices yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <form onSubmit={handleCreateInvoice} className="form">
                <h3>Create Invoice</h3>
                <div className="form-group">
                  <label>Client</label>
                  <select
                    value={invoiceForm.clientId}
                    onChange={(e) =>
                      setInvoiceForm((prev) => ({
                        ...prev,
                        clientId: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select client</option>
                    {clients.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Contract (optional)</label>
                  <select
                    value={invoiceForm.contractId}
                    onChange={(e) =>
                      setInvoiceForm((prev) => ({
                        ...prev,
                        contractId: e.target.value,
                      }))
                    }
                  >
                    <option value="">None</option>
                    {contracts.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.contractNumber}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Subtotal</label>
                  <input
                    type="number"
                    value={invoiceForm.subtotal}
                    onChange={(e) =>
                      setInvoiceForm((prev) => ({
                        ...prev,
                        subtotal: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Tax Amount</label>
                  <input
                    type="number"
                    value={invoiceForm.taxAmount}
                    onChange={(e) =>
                      setInvoiceForm((prev) => ({
                        ...prev,
                        taxAmount: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Due Date</label>
                  <input
                    type="date"
                    value={invoiceForm.dueDate}
                    onChange={(e) =>
                      setInvoiceForm((prev) => ({
                        ...prev,
                        dueDate: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={invoiceForm.notes}
                    onChange={(e) =>
                      setInvoiceForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                  />
                </div>
                <button className="tab-button active" type="submit">
                  Create Invoice
                </button>
              </form>
            </div>
          )}

          {activeTab === "payments" && (
            <div className="grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
              <div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Client</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Paid At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(payments || []).map((p) => (
                      <tr key={p.id}>
                        <td>{p.invoice?.invoiceNumber || "—"}</td>
                        <td>{p.invoice?.client?.name || "—"}</td>
                        <td>₹{p.amount}</td>
                        <td>{p.method}</td>
                        <td>
                          {p.paidAt
                            ? new Date(p.paidAt).toLocaleDateString()
                            : "—"}
                        </td>
                      </tr>
                    ))}
                    {(!payments || payments.length === 0) && (
                      <tr>
                        <td colSpan={5}>No payments yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <form onSubmit={handleRecordPayment} className="form">
                <h3>Record Payment</h3>
                <div className="form-group">
                  <label>Invoice</label>
                  <select
                    value={paymentForm.invoiceId}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        invoiceId: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select invoice</option>
                    {invoices.map((inv: any) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNumber}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Amount</label>
                  <input
                    type="number"
                    value={paymentForm.amount}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        amount: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Method</label>
                  <select
                    value={paymentForm.method}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        method: e.target.value,
                      }))
                    }
                  >
                    {paymentMethods.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Reference</label>
                  <input
                    type="text"
                    value={paymentForm.reference}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        reference: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={paymentForm.notes}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                  />
                </div>
                <button className="tab-button active" type="submit">
                  Record Payment
                </button>
              </form>
            </div>
          )}

          {activeTab === "printing" && (
            <div className="grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
              <div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Client</th>
                      <th>Contract</th>
                      <th>Amount</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(expenses || []).map((exp) => (
                      <tr key={exp.id}>
                        <td>{exp.description}</td>
                        <td>{exp.client?.name || "—"}</td>
                        <td>{exp.contract?.contractNumber || "—"}</td>
                        <td>₹{exp.amount}</td>
                        <td>
                          {exp.incurredOn
                            ? new Date(exp.incurredOn).toLocaleDateString()
                            : "—"}
                        </td>
                      </tr>
                    ))}
                    {(!expenses || expenses.length === 0) && (
                      <tr>
                        <td colSpan={5}>No expenses yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <form onSubmit={handleCreateExpense} className="form">
                <h3>Add Printing Expense</h3>
                <div className="form-group">
                  <label>Client (optional)</label>
                  <select
                    value={expenseForm.clientId}
                    onChange={(e) =>
                      setExpenseForm((prev) => ({
                        ...prev,
                        clientId: e.target.value,
                      }))
                    }
                  >
                    <option value="">None</option>
                    {clients.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Contract (optional)</label>
                  <select
                    value={expenseForm.contractId}
                    onChange={(e) =>
                      setExpenseForm((prev) => ({
                        ...prev,
                        contractId: e.target.value,
                      }))
                    }
                  >
                    <option value="">None</option>
                    {contracts.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.contractNumber}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <input
                    type="text"
                    value={expenseForm.description}
                    onChange={(e) =>
                      setExpenseForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Amount</label>
                  <input
                    type="number"
                    value={expenseForm.amount}
                    onChange={(e) =>
                      setExpenseForm((prev) => ({
                        ...prev,
                        amount: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    value={expenseForm.incurredOn}
                    onChange={(e) =>
                      setExpenseForm((prev) => ({
                        ...prev,
                        incurredOn: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Vendor</label>
                  <input
                    type="text"
                    value={expenseForm.vendor}
                    onChange={(e) =>
                      setExpenseForm((prev) => ({
                        ...prev,
                        vendor: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={expenseForm.notes}
                    onChange={(e) =>
                      setExpenseForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                  />
                </div>
                <button className="tab-button active" type="submit">
                  Save Expense
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
