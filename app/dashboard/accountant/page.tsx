"use client";

import { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useUser } from "@/components/AppLayout";
import { accountantAPI, clientsAPI, contractsAPI } from "@/lib/api";
import { showError, showSuccess } from "@/lib/toast";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const paymentMethods = [
  "CASH",
  "BANK_TRANSFER",
  "UPI",
  "CHEQUE",
  "CARD",
  "OTHER",
];

const queueTabs = [
  { value: "to_be_generated", label: "To Be Generated" },
  { value: "pending", label: "Pending" },
  { value: "overdue", label: "Overdue" },
  { value: "completed", label: "Completed" },
];

const defaultBillFirmOptions = ["Firm A", "Firm B", "Firm C"];

const formatCurrency = (value: unknown) =>
  `Rs ${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString() : "-";

const formatEnumLabel = (value?: string | null) => {
  if (!value) return "-";
  return String(value)
    .toLowerCase()
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
};

const normalizeDisplayText = (value?: string | null) =>
  String(value || "-")
    .replace(/Ã¢â‚¬â€/g, "-")
    .replace(/Ãƒâ€”/g, "x")
    .replace(/â€”/g, "-");

const getBillPdfUrl = (path?: string | null) =>
  path ? `${API_BASE_URL}${path}` : null;

export default function AccountantDashboardPage() {
  const user = useUser();
  const roleLower = String(user?.role || "").toLowerCase();

  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentTrackingGroups, setPaymentTrackingGroups] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [queueGroups, setQueueGroups] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [firmOptions, setFirmOptions] = useState<string[]>(defaultBillFirmOptions);
  const [queueSearch, setQueueSearch] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"invoices" | "payments" | "printing">(
    "invoices",
  );
  const [activeQueueTab, setActiveQueueTab] = useState<
    "to_be_generated" | "pending" | "overdue" | "completed"
  >("to_be_generated");
  const [expandedClients, setExpandedClients] = useState<string[]>([]);
  const [selectedEventsByClient, setSelectedEventsByClient] = useState<
    Record<string, string[]>
  >({});
  const [expandedPaymentGroups, setExpandedPaymentGroups] = useState<string[]>([]);
  const [expandedBills, setExpandedBills] = useState<string[]>([]);
  const [billModal, setBillModal] = useState<{
    open: boolean;
    clientId: string;
    clientName: string;
    partyName: string;
    partyDetails: {
      billingCompanyName?: string | null;
      clientName?: string | null;
      gstin?: string | null;
      billingPhone?: string | null;
      billingEmail?: string | null;
      billingAddress?: string | null;
    };
    rows: any[];
  }>({
    open: false,
    clientId: "",
    clientName: "",
    partyName: "",
    partyDetails: {},
    rows: [],
  });
  const [billForm, setBillForm] = useState({
    firmName: defaultBillFirmOptions[0],
    useCustomFirm: false,
    customFirmName: "",
    billNumber: "",
    remarks: "",
    billingCompanyName: "",
    billingPhone: "",
    billingEmail: "",
    gstin: "",
    billingAddress: "",
    billPdf: null as File | null,
  });
  const [generatingBill, setGeneratingBill] = useState(false);

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
    invoiceNumber: "",
    partyName: "",
    amount: "",
    paidAt: new Date().toISOString().slice(0, 10),
    method: "UPI",
    reference: "",
    notes: "",
  });
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [reminderForm, setReminderForm] = useState({
    invoiceId: "",
    invoiceNumber: "",
    partyName: "",
    reminderAt: "",
    reminderNote: "",
  });
  const [reminderModalOpen, setReminderModalOpen] = useState(false);

  const [expenseForm, setExpenseForm] = useState({
    clientId: "",
    contractId: "",
    description: "",
    amount: "",
    incurredOn: "",
    vendor: "",
    notes: "",
  });

  const canAccess = useMemo(
    () => ["accountant", "owner", "manager", "admin"].includes(roleLower),
    [roleLower],
  );

  const billingSummary = summary?.billingQueue || {};

  const selectedFirmName = billForm.useCustomFirm
    ? billForm.customFirmName.trim()
    : billForm.firmName.trim();

  const fetchSummary = async () => {
    try {
      const resp = await accountantAPI.summary();
      if (resp?.success) setSummary(resp.data || null);
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to load summary");
    }
  };

  const fetchQueue = async (tab = activeQueueTab) => {
    try {
      setQueueLoading(true);
      const resp = await accountantAPI.getBillingQueue({ tab });
      if (resp?.success) {
        setQueueGroups(resp.data?.groups || []);
      } else {
        setQueueGroups([]);
      }
    } catch (e: any) {
      setQueueGroups([]);
      showError(e?.response?.data?.message || "Failed to load billing queue");
    } finally {
      setQueueLoading(false);
    }
  };

  const fetchLists = async () => {
    try {
      setLoading(true);
      const [invoiceRes, paymentRes, expenseRes, trackingRes] = await Promise.all([
        accountantAPI.listInvoices({ page: 1, limit: 50 }),
        accountantAPI.listPayments({ page: 1, limit: 50 }),
        accountantAPI.listPrintingExpenses({ page: 1, limit: 50 }),
        accountantAPI.getPaymentTracking({ search: paymentSearch || undefined }),
      ]);

      if (invoiceRes?.success) setInvoices(invoiceRes.data?.rows || []);
      if (paymentRes?.success) setPayments(paymentRes.data?.rows || []);
      if (expenseRes?.success) setExpenses(expenseRes.data?.rows || []);
      if (trackingRes?.success) setPaymentTrackingGroups(trackingRes.data?.groups || []);
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

  const fetchFirmOptions = async () => {
    try {
      const resp = await accountantAPI.listFirms();
      if (resp?.success && Array.isArray(resp.data) && resp.data.length) {
        setFirmOptions(resp.data);
        return;
      }
      setFirmOptions(defaultBillFirmOptions);
    } catch (_) {
      setFirmOptions(defaultBillFirmOptions);
    }
  };

  useEffect(() => {
    if (!canAccess) return;
    fetchSummary();
    fetchLists();
    fetchLookups();
    fetchFirmOptions();
    fetchQueue(activeQueueTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess]);

  useEffect(() => {
    if (!canAccess) return;
    setExpandedClients([]);
    fetchQueue(activeQueueTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQueueTab]);

  useEffect(() => {
    if (!canAccess) return;
    fetchLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentSearch]);

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
        fetchFirmOptions();
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
        paidAt: paymentForm.paidAt || undefined,
        method: paymentForm.method,
        reference: paymentForm.reference || undefined,
        notes: paymentForm.notes || undefined,
      };
      const resp = await accountantAPI.recordPayment(paymentForm.invoiceId, payload);
      if (resp?.success) {
        showSuccess("Payment recorded");
        setPaymentForm({
          invoiceId: "",
          invoiceNumber: "",
          partyName: "",
          amount: "",
          paidAt: new Date().toISOString().slice(0, 10),
          method: "UPI",
          reference: "",
          notes: "",
        });
        setPaymentModalOpen(false);
        fetchSummary();
        fetchLists();
      } else {
        showError(resp?.message || "Failed to record payment");
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to record payment");
    }
  };

  const openPaymentModal = (bill: any, group: any) => {
    setPaymentForm({
      invoiceId: bill.invoiceId,
      invoiceNumber: bill.invoiceNumber,
      partyName: group.partyName || group.clientName,
      amount: String(bill.remainingAmount || ""),
      paidAt: new Date().toISOString().slice(0, 10),
      method: "UPI",
      reference: "",
      notes: "",
    });
    setPaymentModalOpen(true);
  };

  const closePaymentModal = () => {
    setPaymentModalOpen(false);
    setPaymentForm({
      invoiceId: "",
      invoiceNumber: "",
      partyName: "",
      amount: "",
      paidAt: new Date().toISOString().slice(0, 10),
      method: "UPI",
      reference: "",
      notes: "",
    });
  };

  const openReminderModal = (bill: any, group: any, daysAhead?: number) => {
    const reminderDate = new Date();
    if (daysAhead) {
      reminderDate.setDate(reminderDate.getDate() + daysAhead);
    }
    setReminderForm({
      invoiceId: bill.invoiceId,
      invoiceNumber: bill.invoiceNumber,
      partyName: group.partyName || group.clientName,
      reminderAt: daysAhead
        ? reminderDate.toISOString().slice(0, 10)
        : bill.reminderAt
          ? new Date(bill.reminderAt).toISOString().slice(0, 10)
          : "",
      reminderNote: bill.reminderNote || "",
    });
    setReminderModalOpen(true);
  };

  const closeReminderModal = () => {
    setReminderModalOpen(false);
    setReminderForm({
      invoiceId: "",
      invoiceNumber: "",
      partyName: "",
      reminderAt: "",
      reminderNote: "",
    });
  };

  const handleScheduleReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderForm.invoiceId) {
      showError("Select a bill first");
      return;
    }
    if (!reminderForm.reminderAt) {
      showError("Please select a reminder date");
      return;
    }

    try {
      const resp = await accountantAPI.scheduleInvoiceReminder(reminderForm.invoiceId, {
        reminderAt: reminderForm.reminderAt,
        reminderNote: reminderForm.reminderNote || undefined,
      });
      if (resp?.success) {
        showSuccess("Payment reminder scheduled");
        closeReminderModal();
        fetchLists();
      } else {
        showError(resp?.message || "Failed to schedule reminder");
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to schedule reminder");
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

  const handleMarkPoPending = async (eventId: string) => {
    try {
      const resp = await accountantAPI.markBillingEventPoPending(eventId);
      if (resp?.success) {
        showSuccess("Moved to PO Pending");
        fetchSummary();
        fetchQueue(activeQueueTab);
      } else {
        showError(resp?.message || "Failed to update billing status");
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to update billing status");
    }
  };

  const toggleClient = (clientId: string) => {
    setExpandedClients((prev) =>
      prev.includes(clientId)
        ? prev.filter((value) => value !== clientId)
        : [...prev, clientId],
    );
  };

  const toggleEventSelection = (clientId: string, eventId: string) => {
    setSelectedEventsByClient((prev) => {
      const existing = prev[clientId] || [];
      const next = existing.includes(eventId)
        ? existing.filter((value) => value !== eventId)
        : [...existing, eventId];
      return { ...prev, [clientId]: next };
    });
  };

  const togglePaymentGroup = (clientId: string) => {
    setExpandedPaymentGroups((prev) =>
      prev.includes(clientId)
        ? prev.filter((value) => value !== clientId)
        : [...prev, clientId],
    );
  };

  const toggleBill = (invoiceId: string) => {
    setExpandedBills((prev) =>
      prev.includes(invoiceId)
        ? prev.filter((value) => value !== invoiceId)
        : [...prev, invoiceId],
    );
  };

  const openBillModal = (group: any, rows: any[]) => {
    const now = new Date();
    const billNumber = `BILL-${now.getFullYear()}${String(
      now.getMonth() + 1,
    ).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${now
      .getTime()
      .toString()
      .slice(-4)}`;

    setBillModal({
      open: true,
      clientId: group.clientId,
      clientName: group.clientName,
      partyName: group.partyName || group.clientName,
      partyDetails: group.partyDetails || {},
      rows,
    });
    setBillForm({
      firmName: firmOptions[0] || defaultBillFirmOptions[0],
      useCustomFirm: false,
      customFirmName: "",
      billNumber,
      remarks: "",
      billingCompanyName: group.partyDetails?.billingCompanyName || "",
      billingPhone: group.partyDetails?.billingPhone || "",
      billingEmail: group.partyDetails?.billingEmail || "",
      gstin: group.partyDetails?.gstin || "",
      billingAddress: group.partyDetails?.billingAddress || "",
      billPdf: null,
    });
  };

  const closeBillModal = () => {
    setBillModal({
      open: false,
      clientId: "",
      clientName: "",
      partyName: "",
      partyDetails: {},
      rows: [],
    });
    setBillForm({
      firmName: firmOptions[0] || defaultBillFirmOptions[0],
      useCustomFirm: false,
      customFirmName: "",
      billNumber: "",
      remarks: "",
      billingCompanyName: "",
      billingPhone: "",
      billingEmail: "",
      gstin: "",
      billingAddress: "",
      billPdf: null,
    });
  };

  const billTotals = useMemo(
    () =>
      (billModal.rows || []).reduce(
        (acc, row) => {
          acc.base += Number(row?.billingDetails?.finalAgreedPriceBase || 0);
          acc.gst += Number(row?.billingDetails?.gstAmount || 0);
          acc.total += Number(row?.billingDetails?.totalWithGst || 0);
          return acc;
        },
        { base: 0, gst: 0, total: 0 },
      ),
    [billModal.rows],
  );

  const filteredQueueGroups = useMemo(() => {
    const term = queueSearch.trim().toLowerCase();
    if (!term) return queueGroups;

    return (queueGroups || [])
      .map((group: any) => {
        const clientMatches = [
          group.partyName,
          group.clientName,
          group.partyDetails?.gstin,
          group.partyDetails?.billingPhone,
          group.partyDetails?.billingEmail,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(term),
        );

        const rows = (group.rows || []).filter((row: any) => {
          if (clientMatches) return true;
          return [
            row.code,
            row.city,
            row.area,
            row.landmark,
            row.position,
            row.hoardingType,
            row.billingDetails?.billNumber,
            row.billingDetails?.invoiceNumber,
          ].some((value) =>
            String(value || "")
              .toLowerCase()
              .includes(term),
          );
        });

        if (!rows.length) return null;

        const totals = rows.reduce(
          (acc: any, row: any) => {
            acc.base += Number(row?.billingDetails?.finalAgreedPriceBase || 0);
            acc.gst += Number(row?.billingDetails?.gstAmount || 0);
            acc.withGst += Number(row?.billingDetails?.totalWithGst || 0);
            return acc;
          },
          { base: 0, gst: 0, withGst: 0 },
        );

        return { ...group, rows, totals };
      })
      .filter(Boolean);
  }, [queueGroups, queueSearch]);

  const filteredPaymentGroups = useMemo(() => {
    const term = paymentSearch.trim().toLowerCase();
    if (!term) return paymentTrackingGroups;

    return (paymentTrackingGroups || [])
      .map((group: any) => {
        const partyMatch = [
          group.partyName,
          group.clientName,
          group.partyDetails?.billingPhone,
          group.partyDetails?.billingEmail,
          group.partyDetails?.gstin,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(term),
        );

        const bills = (group.bills || []).filter((bill: any) => {
          if (partyMatch) return true;
          return [
            bill.invoiceNumber,
            bill.contractNumber,
            bill.firm,
            bill.status,
          ].some((value) =>
            String(value || "")
              .toLowerCase()
              .includes(term),
          );
        });

        if (!bills.length) return null;
        return {
          ...group,
          bills,
          totalPendingAmount: bills.reduce(
            (sum: number, bill: any) => sum + Number(bill.remainingAmount || 0),
            0,
          ),
        };
      })
      .filter(Boolean);
  }, [paymentSearch, paymentTrackingGroups]);

  const handleGenerateBill = async () => {
    try {
      if (!billModal.rows.length) {
        showError("Select at least one billing item");
        return;
      }
      if (!selectedFirmName) {
        showError("Please select a firm");
        return;
      }
      if (!billForm.billNumber.trim()) {
        showError("Please enter bill number");
        return;
      }

      const billingProfilePayload = {
        billingCompanyName: billForm.billingCompanyName.trim() || undefined,
        billingPhone: billForm.billingPhone.trim() || undefined,
        billingEmail: billForm.billingEmail.trim() || undefined,
        gstin: billForm.gstin.trim() || undefined,
        billingAddress: billForm.billingAddress.trim() || undefined,
      };

      if (Object.values(billingProfilePayload).some(Boolean)) {
        await clientsAPI.upsertBillingProfile(billModal.clientId, billingProfilePayload);
      }

      setGeneratingBill(true);
      const resp = await accountantAPI.generateBill({
        eventIds: billModal.rows.map((row) => row.id),
        firmName: selectedFirmName,
        billNumber: billForm.billNumber.trim(),
        remarks: billForm.remarks.trim() || undefined,
        billPdf: billForm.billPdf,
      });

      if (resp?.success) {
        showSuccess("Bill generated successfully");
        setSelectedEventsByClient((prev) => ({
          ...prev,
          [billModal.clientId]: [],
        }));
        closeBillModal();
        fetchSummary();
        fetchQueue(activeQueueTab);
        fetchLists();
        fetchFirmOptions();
      } else {
        showError(resp?.message || "Failed to generate bill");
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || "Failed to generate bill");
    } finally {
      setGeneratingBill(false);
    }
  };

  return (
    <ProtectedRoute component="accounting">
      <div className="page-container">
        <div className="page-header">
          <h1>Accountant Dashboard</h1>
          <p>Billing queue, invoice desk, payments, and printing expenses.</p>
        </div>

        <div className="grid">
          <div className="stat-card">
            <h3>{formatCurrency(billingSummary?.totalBillingDoneBase)}</h3>
            <p>Total Billing Done (Base)</p>
          </div>
          <div className="stat-card">
            <h3>{formatCurrency(billingSummary?.totalBillingDoneWithGst)}</h3>
            <p>Total Billing Done (With GST)</p>
          </div>
          <div className="stat-card">
            <h3>{billingSummary?.totalBillsGenerated || 0}</h3>
            <p>Total Bills Generated</p>
          </div>
          <div className="stat-card">
            <h3>
              {billingSummary?.toBeGenerated?.count || 0} /{" "}
              {formatCurrency(billingSummary?.toBeGenerated?.amount)}
            </h3>
            <p>To Be Generated</p>
          </div>
          <div className="stat-card">
            <h3>
              {billingSummary?.pending?.count || 0} /{" "}
              {formatCurrency(billingSummary?.pending?.amount)}
            </h3>
            <p>Pending</p>
          </div>
          <div className="stat-card">
            <h3>
              {billingSummary?.overdue?.count || 0} /{" "}
              {formatCurrency(billingSummary?.overdue?.amount)}
            </h3>
            <p>Overdue</p>
          </div>
          <div className="stat-card">
            <h3>
              {billingSummary?.completed?.count || 0} /{" "}
              {formatCurrency(billingSummary?.completed?.amount)}
            </h3>
            <p>Completed</p>
          </div>
          <div className="stat-card">
            <h3>{formatCurrency(summary?.totalPrintingExpense)}</h3>
            <p>Printing Expenses Logged</p>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            <div>
              <h2 style={{ marginBottom: 6 }}>Billing Queue</h2>
              <p style={{ color: "var(--text-secondary)", margin: 0 }}>
                Grouped by client by default. Bills become due only after the hoarding
                goes live.
              </p>
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>
              PO Pending {billingSummary?.pending?.poPending?.count || 0} | Upcoming{" "}
              {billingSummary?.pending?.upcomingScheduled?.count || 0}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div className="tab-bar" style={{ marginBottom: 0 }}>
              {queueTabs.map((tab) => (
                <button
                  key={tab.value}
                  className={
                    activeQueueTab === tab.value ? "tab-button active" : "tab-button"
                  }
                  onClick={() => setActiveQueueTab(tab.value as any)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Search client, hoarding, city, area..."
              value={queueSearch}
              onChange={(e) => setQueueSearch(e.target.value)}
              style={{ minWidth: 260, flex: "1 1 280px", maxWidth: 360 }}
            />
          </div>

          {queueLoading && <p>Loading billing queue...</p>}
          {!queueLoading && filteredQueueGroups.length === 0 && (
            <div className="empty-state">
              {queueSearch.trim()
                ? "No billing items matched your search."
                : "No billing items in this tab yet."}
            </div>
          )}
          {!queueLoading &&
            filteredQueueGroups.map((group: any) => {
              const expanded = expandedClients.includes(group.clientId);
              const generatedBillNumbers = Array.from(
                new Set(
                  (group.rows || [])
                    .map((row: any) => row.billingDetails?.billNumber || row.billingDetails?.invoiceNumber)
                    .filter(Boolean),
                ),
              );
              return (
                <div
                  key={group.clientId}
                  style={{
                    border: "1px solid var(--border-color)",
                    borderRadius: 16,
                    padding: 18,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 16,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <h3 style={{ marginBottom: 6 }}>{group.partyName || group.clientName}</h3>
                      {group.partyName && group.clientName && group.partyName !== group.clientName && (
                        <p style={{ margin: "0 0 6px", color: "var(--text-secondary)" }}>
                          Client: {group.clientName}
                        </p>
                      )}
                      <p style={{ margin: 0, color: "var(--text-secondary)" }}>
                        Base {formatCurrency(group.totals?.base)} | GST{" "}
                        {formatCurrency(group.totals?.gst)} | With GST{" "}
                        {formatCurrency(group.totals?.withGst)}
                      </p>
                      {!!generatedBillNumbers.length && (
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            marginTop: 10,
                          }}
                        >
                          {generatedBillNumbers.map((billNumber) => (
                            <span
                              key={String(billNumber)}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 999,
                                background: "rgba(37, 99, 235, 0.10)",
                                color: "#1d4ed8",
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              Bill {String(billNumber)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {activeQueueTab !== "completed" && (
                        <button
                          className="tab-button"
                          onClick={() => openBillModal(group, group.rows || [])}
                        >
                          Create Bill
                        </button>
                      )}
                      <button
                        className={expanded ? "tab-button active" : "tab-button"}
                        onClick={() => toggleClient(group.clientId)}
                      >
                        {expanded ? "Collapse" : "Expand"}
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div style={{ marginTop: 16 }}>
                      <div
                        style={{
                          padding: 12,
                          borderRadius: 12,
                          background: "rgba(15, 23, 42, 0.04)",
                          marginBottom: 14,
                        }}
                      >
                        <strong>Expanded Totals:</strong> Base{" "}
                        {formatCurrency(group.totals?.base)} | GST{" "}
                        {formatCurrency(group.totals?.gst)} | With GST{" "}
                        {formatCurrency(group.totals?.withGst)}
                      </div>

                      <div
                        style={{
                          padding: 12,
                          borderRadius: 12,
                          background: "rgba(59, 130, 246, 0.08)",
                          marginBottom: 14,
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                          gap: 10,
                        }}
                      >
                        <div>
                          <strong>Party / Billing Name:</strong>{" "}
                          {normalizeDisplayText(
                            group.partyDetails?.billingCompanyName || group.partyName,
                          )}
                        </div>
                        <div>
                          <strong>GSTIN:</strong>{" "}
                          {normalizeDisplayText(group.partyDetails?.gstin)}
                        </div>
                        <div>
                          <strong>Contact:</strong>{" "}
                          {normalizeDisplayText(group.partyDetails?.billingPhone)}
                        </div>
                        <div>
                          <strong>Email:</strong>{" "}
                          {normalizeDisplayText(group.partyDetails?.billingEmail)}
                        </div>
                        <div style={{ gridColumn: "1 / -1" }}>
                          <strong>Address:</strong>{" "}
                          {normalizeDisplayText(group.partyDetails?.billingAddress)}
                        </div>
                      </div>

                      {activeQueueTab !== "completed" && (
                        <div style={{ marginBottom: 14 }}>
                          <button
                            className="tab-button active"
                            disabled={!(selectedEventsByClient[group.clientId] || []).length}
                            onClick={() =>
                              openBillModal(
                                group,
                                (group.rows || []).filter((row: any) =>
                                  (selectedEventsByClient[group.clientId] || []).includes(
                                    row.id,
                                  ),
                                ),
                              )
                            }
                          >
                            Create Bill (Selected)
                          </button>
                        </div>
                      )}

                      <div style={{ display: "grid", gap: 12 }}>
                        {(group.rows || []).map((row: any) => {
                          const billPdfUrl = getBillPdfUrl(
                            row.billingDetails?.billPdfUrl,
                          );

                          return (
                            <div
                              key={row.id}
                              style={{
                                border: "1px solid var(--border-color)",
                                borderRadius: 14,
                                padding: 16,
                                background: "#fff",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: 16,
                                  flexWrap: "wrap",
                                  marginBottom: 12,
                                }}
                              >
                                <div>
                                  <h4 style={{ marginBottom: 6 }}>{row.code}</h4>
                                  <p style={{ margin: 0, color: "var(--text-secondary)" }}>
                                    {normalizeDisplayText(row.city)} |{" "}
                                    {normalizeDisplayText(row.area)} |{" "}
                                    {normalizeDisplayText(row.landmark)}
                                  </p>
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 10,
                                    alignItems: "center",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  {activeQueueTab !== "completed" && (
                                    <input
                                      type="checkbox"
                                      checked={(
                                        selectedEventsByClient[group.clientId] || []
                                      ).includes(row.id)}
                                      onChange={() =>
                                        toggleEventSelection(group.clientId, row.id)
                                      }
                                    />
                                  )}
                                  <span className="status-badge">
                                    {formatEnumLabel(row.billingDetails?.status)}
                                  </span>
                                  {(row.billingDetails?.billNumber ||
                                    row.billingDetails?.invoiceNumber) && (
                                    <span
                                      style={{
                                        padding: "6px 10px",
                                        borderRadius: 999,
                                        background: "rgba(2, 132, 199, 0.12)",
                                        color: "#0f766e",
                                        fontSize: 12,
                                        fontWeight: 700,
                                      }}
                                    >
                                      Bill {String(
                                        row.billingDetails?.billNumber ||
                                          row.billingDetails?.invoiceNumber,
                                      )}
                                    </span>
                                  )}
                                  {row.warningNotLive && (
                                    <span
                                      style={{
                                        padding: "6px 10px",
                                        borderRadius: 999,
                                        background: "rgba(245, 158, 11, 0.12)",
                                        color: "#b45309",
                                        fontSize: 12,
                                        fontWeight: 600,
                                      }}
                                    >
                                      Hoarding not live yet
                                    </span>
                                  )}
                                  {String(row.billingDetails?.status) !== "PO_PENDING" &&
                                    String(row.billingDetails?.status) !== "COMPLETED" && (
                                      <button
                                        className="tab-button"
                                        onClick={() => handleMarkPoPending(row.id)}
                                      >
                                        Mark PO Pending
                                      </button>
                                    )}
                                </div>
                              </div>

                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns:
                                    "repeat(auto-fit, minmax(220px, 1fr))",
                                  gap: 10,
                                }}
                              >
                                <div>
                                  <strong>Base Price:</strong>{" "}
                                  {formatCurrency(row.billingDetails?.finalAgreedPriceBase)}
                                </div>
                                <div>
                                  <strong>GST:</strong>{" "}
                                  {row.billingDetails?.gstApplicable ? "Yes" : "No"}
                                </div>
                                <div>
                                  <strong>Total With GST:</strong>{" "}
                                  {formatCurrency(row.billingDetails?.totalWithGst)}
                                </div>
                                <div>
                                  <strong>Duration:</strong>{" "}
                                  {row.billingDetails?.durationMonths || 0} month(s)
                                </div>
                                <div>
                                  <strong>Billing Frequency:</strong>{" "}
                                  {formatEnumLabel(row.billingDetails?.billingFrequency)}
                                </div>
                                <div>
                                  <strong>Payment Plan:</strong>{" "}
                                  {formatEnumLabel(row.billingDetails?.paymentPlanType)}
                                </div>
                                <div>
                                  <strong>Mode of Payment:</strong>{" "}
                                  {formatEnumLabel(row.billingDetails?.modeOfPayment)}
                                </div>
                                <div>
                                  <strong>Printing:</strong>{" "}
                                  {row.billingDetails?.gstApplicable
                                    ? `${formatCurrency(
                                        row.billingDetails?.printingChargesBase,
                                      )} + GST ${formatCurrency(
                                        row.billingDetails?.printingChargesGst,
                                      )} = ${formatCurrency(
                                        row.billingDetails?.printingChargesTotal,
                                      )}`
                                    : formatCurrency(
                                        row.billingDetails?.printingChargesBase,
                                      )}
                                </div>
                                <div>
                                  <strong>Mounting:</strong>{" "}
                                  {row.billingDetails?.gstApplicable
                                    ? `${formatCurrency(
                                        row.billingDetails?.mountingChargesBase,
                                      )} + GST ${formatCurrency(
                                        row.billingDetails?.mountingChargesGst,
                                      )} = ${formatCurrency(
                                        row.billingDetails?.mountingChargesTotal,
                                      )}`
                                    : formatCurrency(
                                        row.billingDetails?.mountingChargesBase,
                                      )}
                                </div>
                                <div>
                                  <strong>Billing Period:</strong>{" "}
                                  {formatDate(row.billingDetails?.billingPeriodStart)} -{" "}
                                  {formatDate(row.billingDetails?.billingPeriodEnd)}
                                </div>
                                <div>
                                  <strong>Next Due Trigger:</strong>{" "}
                                  {formatDate(row.billingDetails?.nextDueTriggerDate)}
                                </div>
                                <div>
                                  <strong>City:</strong> {normalizeDisplayText(row.city)}
                                </div>
                                <div>
                                  <strong>Area / Zone:</strong>{" "}
                                  {normalizeDisplayText(row.area)}
                                </div>
                                <div>
                                  <strong>Location / Landmark:</strong>{" "}
                                  {normalizeDisplayText(row.landmark)}
                                </div>
                                <div>
                                  <strong>Facing Direction:</strong>{" "}
                                  {normalizeDisplayText(row.facingDirection)}
                                </div>
                                <div>
                                  <strong>Size:</strong>{" "}
                                  {normalizeDisplayText(row.sizeSquareFeet || row.size)}
                                  {row.sizeSquareFeet && row.size && (
                                    <small
                                      style={{
                                        display: "block",
                                        color: "var(--text-secondary)",
                                      }}
                                    >
                                      Stored as {normalizeDisplayText(row.size)}
                                    </small>
                                  )}
                                </div>
                                <div>
                                  <strong>Position:</strong>{" "}
                                  {normalizeDisplayText(row.position)}
                                </div>
                                <div>
                                  <strong>Type:</strong>{" "}
                                  {normalizeDisplayText(row.hoardingType)}
                                </div>
                                <div>
                                  <strong>Illumination:</strong>{" "}
                                  {normalizeDisplayText(row.illumination)}
                                </div>
                              </div>

                              {(row.billingDetails?.invoiceNumber ||
                                row.billingDetails?.generatedAt ||
                                row.billingDetails?.generatedRemarks) && (
                                <div
                                  style={{
                                    marginTop: 14,
                                    padding: 14,
                                    borderRadius: 12,
                                    background: "rgba(59, 130, 246, 0.08)",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns:
                                        "repeat(auto-fit, minmax(200px, 1fr))",
                                      gap: 10,
                                    }}
                                  >
                                    <div>
                                      <strong>Bill / Invoice Number:</strong>{" "}
                                      {normalizeDisplayText(
                                        row.billingDetails?.billNumber ||
                                          row.billingDetails?.invoiceNumber,
                                      )}
                                    </div>
                                    <div>
                                      <strong>Firm:</strong>{" "}
                                      {normalizeDisplayText(
                                        row.billingDetails?.billingFirm,
                                      )}
                                    </div>
                                    <div>
                                      <strong>Generated On:</strong>{" "}
                                      {formatDate(row.billingDetails?.generatedAt)}
                                    </div>
                                    <div>
                                      <strong>Invoice Status:</strong>{" "}
                                      {formatEnumLabel(
                                        row.billingDetails?.invoiceStatus,
                                      )}
                                    </div>
                                    <div>
                                      <strong>Paid Amount:</strong>{" "}
                                      {formatCurrency(row.billingDetails?.paidAmount)}
                                    </div>
                                    <div>
                                      <strong>Remarks:</strong>{" "}
                                      {normalizeDisplayText(
                                        row.billingDetails?.generatedRemarks,
                                      )}
                                    </div>
                                    {billPdfUrl && (
                                      <div>
                                        <strong>Bill PDF:</strong>{" "}
                                        <a
                                          href={billPdfUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          style={{ color: "var(--primary-color)" }}
                                        >
                                          Open PDF
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            <div>
              <h2 style={{ marginBottom: 6 }}>Finance Workspace</h2>
              <p style={{ color: "var(--text-secondary)", margin: 0 }}>
                Existing invoice, payment, and printing expense tools stay available
                here.
              </p>
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>
              Total Billed {formatCurrency(summary?.totalBilled)} | Paid{" "}
              {formatCurrency(summary?.totalPaid)} | Outstanding{" "}
              {formatCurrency(summary?.outstanding)}
            </div>
          </div>

          <div className="tab-bar">
            <button
              className={activeTab === "invoices" ? "tab-button active" : "tab-button"}
              onClick={() => setActiveTab("invoices")}
            >
              Invoices
            </button>
            <button
              className={activeTab === "payments" ? "tab-button active" : "tab-button"}
              onClick={() => setActiveTab("payments")}
            >
              Payments
            </button>
            <button
              className={activeTab === "printing" ? "tab-button active" : "tab-button"}
              onClick={() => setActiveTab("printing")}
            >
              Printing Expenses
            </button>
          </div>

          {loading && <p>Loading finance workspace...</p>}
          {activeTab === "invoices" && (
            <div className="grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
              <div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Client</th>
                      <th>Firm</th>
                      <th>Total</th>
                      <th>Paid</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invoices || []).map((inv) => (
                      <tr key={inv.id}>
                        <td>{normalizeDisplayText(inv.invoiceNumber)}</td>
                        <td>{normalizeDisplayText(inv.client?.name)}</td>
                        <td>{normalizeDisplayText(inv.billingFirm)}</td>
                        <td>{formatCurrency(inv.totalAmount)}</td>
                        <td>{formatCurrency(inv.paidAmount)}</td>
                        <td>{formatEnumLabel(inv.status)}</td>
                      </tr>
                    ))}
                    {(!invoices || invoices.length === 0) && (
                      <tr>
                        <td colSpan={6}>No invoices yet.</td>
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
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 16,
                }}
              >
                <div>
                  <h3 style={{ marginBottom: 6 }}>Bill-wise Payment Tracking</h3>
                  <p style={{ margin: 0, color: "var(--text-secondary)" }}>
                    First level shows party name and total pending amount. Expand to see bill numbers and actions.
                  </p>
                </div>
                <input
                  type="text"
                  value={paymentSearch}
                  onChange={(e) => setPaymentSearch(e.target.value)}
                  placeholder="Search party, bill, GST, contract"
                  style={{ minWidth: 260 }}
                />
              </div>

              <div style={{ display: "grid", gap: 14 }}>
                {(filteredPaymentGroups || []).map((group: any) => {
                  const expanded = expandedPaymentGroups.includes(group.clientId);
                  return (
                    <div
                      key={group.clientId}
                      style={{
                        border: "1px solid var(--border-color)",
                        borderRadius: 16,
                        padding: 18,
                        background: "#fff",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 16,
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <h3 style={{ marginBottom: 6 }}>{group.partyName}</h3>
                          {group.partyName !== group.clientName && (
                            <p style={{ margin: "0 0 6px", color: "var(--text-secondary)" }}>
                              Client: {group.clientName}
                            </p>
                          )}
                          <p style={{ margin: 0, color: "var(--text-secondary)" }}>
                            Pending Amount {formatCurrency(group.totalPendingAmount)}
                          </p>
                        </div>
                        <button
                          className={expanded ? "tab-button active" : "tab-button"}
                          onClick={() => togglePaymentGroup(group.clientId)}
                        >
                          {expanded ? "Collapse" : "Expand Bills"}
                        </button>
                      </div>

                      {expanded && (
                        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                          {(group.bills || []).map((bill: any) => {
                            const billExpanded = expandedBills.includes(bill.invoiceId);
                            const isPending = Number(bill.remainingAmount || 0) > 0;
                            return (
                              <div
                                key={bill.invoiceId}
                                style={{
                                  border: "1px solid var(--border-color)",
                                  borderRadius: 14,
                                  padding: 16,
                                  background: isPending
                                    ? "rgba(239, 68, 68, 0.04)"
                                    : "rgba(34, 197, 94, 0.04)",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: 12,
                                    flexWrap: "wrap",
                                    alignItems: "center",
                                  }}
                                >
                                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                                    <strong>{bill.invoiceNumber}</strong>
                                    <span
                                      style={{
                                        padding: "6px 10px",
                                        borderRadius: 999,
                                        background: isPending
                                          ? "rgba(239, 68, 68, 0.12)"
                                          : "rgba(34, 197, 94, 0.12)",
                                        color: isPending ? "#b91c1c" : "#15803d",
                                        fontSize: 12,
                                        fontWeight: 700,
                                      }}
                                    >
                                      {isPending ? "Pending" : "Cleared"}
                                    </span>
                                    <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                                      Remaining {formatCurrency(bill.remainingAmount)}
                                    </span>
                                  </div>
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    <button className="tab-button" onClick={() => openPaymentModal(bill, group)}>
                                      Payment Received
                                    </button>
                                    <button className="tab-button" onClick={() => openReminderModal(bill, group, 7)}>
                                      Remind in 7 Days
                                    </button>
                                    <button className="tab-button" onClick={() => openReminderModal(bill, group)}>
                                      Custom Reminder
                                    </button>
                                    <button
                                      className={billExpanded ? "tab-button active" : "tab-button"}
                                      onClick={() => toggleBill(bill.invoiceId)}
                                    >
                                      {billExpanded ? "Hide Details" : "Show Details"}
                                    </button>
                                  </div>
                                </div>

                                {billExpanded && (
                                  <div style={{ marginTop: 14 }}>
                                    <div
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                                        gap: 10,
                                        marginBottom: 14,
                                      }}
                                    >
                                      <div><strong>Bill Created:</strong> {formatDate(bill.billCreatedDate)}</div>
                                      <div><strong>Total Bill Amount:</strong> {formatCurrency(bill.totalAmount)}</div>
                                      <div>
                                        <strong>Remaining Amount:</strong>{" "}
                                        <span style={{ color: isPending ? "#b91c1c" : "#15803d", fontWeight: 700 }}>
                                          {formatCurrency(bill.remainingAmount)}
                                        </span>
                                      </div>
                                      <div><strong>Days Due:</strong> {bill.daysDue}</div>
                                      <div><strong>Last Payment Received:</strong> {formatDate(bill.lastPaymentReceivedDate)}</div>
                                      <div><strong>Reminder Date:</strong> {formatDate(bill.reminderAt)}</div>
                                      <div><strong>Reminder Note:</strong> {normalizeDisplayText(bill.reminderNote)}</div>
                                      <div><strong>Contract:</strong> {normalizeDisplayText(bill.contractNumber)}</div>
                                    </div>

                                    <div>
                                      <strong>Payment History</strong>
                                      <table className="table" style={{ marginTop: 10 }}>
                                        <thead>
                                          <tr>
                                            <th>Date</th>
                                            <th>Amount</th>
                                            <th>Method</th>
                                            <th>Status</th>
                                            <th>Reference</th>
                                            <th>Note</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(bill.paymentHistory || []).map((payment: any) => (
                                            <tr key={payment.id}>
                                              <td>{formatDate(payment.paidAt)}</td>
                                              <td>{formatCurrency(payment.amount)}</td>
                                              <td>{formatEnumLabel(payment.method)}</td>
                                              <td>{formatEnumLabel(payment.status)}</td>
                                              <td>{normalizeDisplayText(payment.reference)}</td>
                                              <td>{normalizeDisplayText(payment.notes)}</td>
                                            </tr>
                                          ))}
                                          {(!bill.paymentHistory || bill.paymentHistory.length === 0) && (
                                            <tr>
                                              <td colSpan={6}>No payment history yet.</td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {(!filteredPaymentGroups || filteredPaymentGroups.length === 0) && (
                  <div className="empty-state">
                    No bills found for the current payment filters.
                  </div>
                )}
              </div>
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
                        <td>{normalizeDisplayText(exp.description)}</td>
                        <td>{normalizeDisplayText(exp.client?.name)}</td>
                        <td>{normalizeDisplayText(exp.contract?.contractNumber)}</td>
                        <td>{formatCurrency(exp.amount)}</td>
                        <td>{formatDate(exp.incurredOn)}</td>
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

        {paymentModalOpen && (
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 p-4"
            onClick={closePaymentModal}
          >
            <div
              className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleRecordPayment} className="form">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <h3 style={{ marginBottom: 6 }}>Payment Received</h3>
                    <p style={{ color: "var(--text-secondary)", margin: 0 }}>
                      {paymentForm.partyName} | {paymentForm.invoiceNumber}
                    </p>
                  </div>
                  <button type="button" className="tab-button" onClick={closePaymentModal}>
                    Close
                  </button>
                </div>

                <div className="form-group">
                  <label>Amount Received</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    value={paymentForm.paidAt}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({ ...prev, paidAt: e.target.value }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Method</label>
                  <select
                    value={paymentForm.method}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({ ...prev, method: e.target.value }))
                    }
                  >
                    {paymentMethods.map((m) => (
                      <option key={m} value={m}>
                        {formatEnumLabel(m)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Reference Number</label>
                  <input
                    type="text"
                    value={paymentForm.reference}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({ ...prev, reference: e.target.value }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Note / Remarks</label>
                  <textarea
                    value={paymentForm.notes}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
                  />
                </div>
                <button className="tab-button active" type="submit">
                  Save Payment
                </button>
              </form>
            </div>
          </div>
        )}

        {reminderModalOpen && (
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 p-4"
            onClick={closeReminderModal}
          >
            <div
              className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleScheduleReminder} className="form">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <h3 style={{ marginBottom: 6 }}>Custom Reminder</h3>
                    <p style={{ color: "var(--text-secondary)", margin: 0 }}>
                      {reminderForm.partyName} | {reminderForm.invoiceNumber}
                    </p>
                  </div>
                  <button type="button" className="tab-button" onClick={closeReminderModal}>
                    Close
                  </button>
                </div>

                <div className="form-group">
                  <label>Reminder Date</label>
                  <input
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    value={reminderForm.reminderAt}
                    onChange={(e) =>
                      setReminderForm((prev) => ({ ...prev, reminderAt: e.target.value }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Note</label>
                  <textarea
                    value={reminderForm.reminderNote}
                    onChange={(e) =>
                      setReminderForm((prev) => ({ ...prev, reminderNote: e.target.value }))
                    }
                  />
                </div>
                <button className="tab-button active" type="submit">
                  Save Reminder
                </button>
              </form>
            </div>
          </div>
        )}

        {billModal.open && (
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 p-4"
            onClick={closeBillModal}
          >
            <div
              className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                  marginBottom: 16,
                }}
              >
                <div>
                  <h3 style={{ marginBottom: 6 }}>Create Bill</h3>
                  <p style={{ color: "var(--text-secondary)", margin: 0 }}>
                    {billModal.partyName || billModal.clientName} | {billModal.rows.length} item(s) selected
                  </p>
                  {billModal.partyName &&
                    billModal.clientName &&
                    billModal.partyName !== billModal.clientName && (
                      <p style={{ color: "var(--text-secondary)", margin: "6px 0 0" }}>
                        Client: {billModal.clientName}
                      </p>
                    )}
                </div>
                <button className="tab-button" onClick={closeBillModal}>
                  Close
                </button>
              </div>
              <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", gap: 20 }}>
                <div>
                  <div
                    style={{
                      border: "1px solid var(--border-color)",
                      borderRadius: 14,
                      overflow: "hidden",
                    }}
                  >
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Hoarding</th>
                          <th>Billing Period</th>
                          <th>Base</th>
                          <th>GST</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billModal.rows.map((row: any) => (
                          <tr key={row.id}>
                            <td>
                              <div>{row.code}</div>
                              <small style={{ color: "var(--text-secondary)" }}>
                                {normalizeDisplayText(row.city)} |{" "}
                                {normalizeDisplayText(row.area)}
                              </small>
                              {(row.sizeSquareFeet || row.size) && (
                                <small
                                  style={{
                                    display: "block",
                                    color: "var(--text-secondary)",
                                    marginTop: 4,
                                  }}
                                >
                                  Size: {normalizeDisplayText(row.sizeSquareFeet || row.size)}
                                </small>
                              )}
                              {row.warningNotLive && (
                                <div
                                  style={{
                                    marginTop: 6,
                                    color: "#b45309",
                                    fontSize: 12,
                                    fontWeight: 600,
                                  }}
                                >
                                  Hoarding not live yet.
                                </div>
                              )}
                            </td>
                            <td>
                              {formatDate(row.billingDetails?.billingPeriodStart)} -{" "}
                              {formatDate(row.billingDetails?.billingPeriodEnd)}
                            </td>
                            <td>{formatCurrency(row.billingDetails?.finalAgreedPriceBase)}</td>
                            <td>{formatCurrency(row.billingDetails?.gstAmount)}</td>
                            <td>{formatCurrency(row.billingDetails?.totalWithGst)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div
                    style={{
                      marginTop: 14,
                      padding: 14,
                      borderRadius: 14,
                      background: "rgba(15, 23, 42, 0.04)",
                    }}
                  >
                    <strong>Totals:</strong> Base {formatCurrency(billTotals.base)} | GST{" "}
                    {formatCurrency(billTotals.gst)} | With GST{" "}
                    {formatCurrency(billTotals.total)}
                  </div>
                </div>

                <div className="form">
                  <h3>Bill Details</h3>
                  <div
                    style={{
                      marginBottom: 14,
                      padding: 14,
                      borderRadius: 14,
                      background: "rgba(59, 130, 246, 0.08)",
                    }}
                  >
                    <strong>Party / Billing Details</strong>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: 10,
                        marginTop: 10,
                      }}
                    >
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Party / Billing Name</label>
                        <input
                          type="text"
                          value={billForm.billingCompanyName}
                          onChange={(e) =>
                            setBillForm((prev) => ({
                              ...prev,
                              billingCompanyName: e.target.value,
                            }))
                          }
                          placeholder={billModal.partyName || billModal.clientName}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Contact Number</label>
                        <input
                          type="text"
                          value={billForm.billingPhone}
                          onChange={(e) =>
                            setBillForm((prev) => ({
                              ...prev,
                              billingPhone: e.target.value,
                            }))
                          }
                          placeholder="Billing mobile / contact"
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Email</label>
                        <input
                          type="email"
                          value={billForm.billingEmail}
                          onChange={(e) =>
                            setBillForm((prev) => ({
                              ...prev,
                              billingEmail: e.target.value,
                            }))
                          }
                          placeholder="Billing email"
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>GSTIN</label>
                        <input
                          type="text"
                          value={billForm.gstin}
                          onChange={(e) =>
                            setBillForm((prev) => ({ ...prev, gstin: e.target.value }))
                          }
                          placeholder="GST number"
                        />
                      </div>
                      <div
                        className="form-group"
                        style={{ marginBottom: 0, gridColumn: "1 / -1" }}
                      >
                        <label>Billing Address</label>
                        <textarea
                          value={billForm.billingAddress}
                          onChange={(e) =>
                            setBillForm((prev) => ({
                              ...prev,
                              billingAddress: e.target.value,
                            }))
                          }
                          placeholder="Billing address"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Firm</label>
                    <select
                      value={billForm.useCustomFirm ? "__custom__" : billForm.firmName}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "__custom__") {
                          setBillForm((prev) => ({
                            ...prev,
                            useCustomFirm: true,
                            customFirmName: prev.customFirmName || "",
                          }));
                          return;
                        }
                        setBillForm((prev) => ({
                          ...prev,
                          firmName: value,
                          useCustomFirm: false,
                        }));
                      }}
                    >
                      {(firmOptions.length ? firmOptions : defaultBillFirmOptions).map(
                        (option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ),
                      )}
                      <option value="__custom__">Custom firm...</option>
                    </select>
                  </div>
                  {billForm.useCustomFirm && (
                    <div className="form-group">
                      <label>Custom Firm Name</label>
                      <input
                        type="text"
                        value={billForm.customFirmName}
                        onChange={(e) =>
                          setBillForm((prev) => ({
                            ...prev,
                            customFirmName: e.target.value,
                          }))
                        }
                        placeholder="Enter billing firm name"
                      />
                    </div>
                  )}
                  <div className="form-group">
                    <label>Bill Number</label>
                    <input
                      type="text"
                      value={billForm.billNumber}
                      onChange={(e) =>
                        setBillForm((prev) => ({ ...prev, billNumber: e.target.value }))
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Remarks</label>
                    <textarea
                      value={billForm.remarks}
                      onChange={(e) =>
                        setBillForm((prev) => ({ ...prev, remarks: e.target.value }))
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Upload Bill PDF (optional)</label>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(e) =>
                        setBillForm((prev) => ({
                          ...prev,
                          billPdf: e.target.files?.[0] || null,
                        }))
                      }
                    />
                  </div>
                  <button
                    className="tab-button active"
                    onClick={handleGenerateBill}
                    disabled={generatingBill}
                    type="button"
                  >
                    {generatingBill ? "Generating..." : "Mark Bill as Generated"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
