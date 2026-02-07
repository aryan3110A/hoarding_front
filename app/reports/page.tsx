"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import Link from "next/link";
import { useUser } from "@/components/AppLayout";
import AccessDenied from "@/components/AccessDenied";

export default function Reports() {
  const user = useUser();
  const [reportType, setReportType] = useState("occupancy");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reportData, setReportData] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    // Component will handle access control via useUser
  }, []);

  const fetchReport = async () => {
    try {
      const token = localStorage.getItem("token");
      let response;

      if (reportType === "occupancy") {
        response = await axios.get(
          `${
            process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
          }/api/reports/occupancy`,
          {
            params: { startDate, endDate },
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      } else {
        // For other reports, fetch from bookings/contracts
        const [bookingsRes, contractsRes, hoardingsRes, enquiriesRes] =
          await Promise.all([
            axios.get(
              `${
                process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
              }/api/bookings`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            ),
            axios.get(
              `${
                process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
              }/api/contracts`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            ),
            axios.get(
              `${
                process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
              }/api/hoardings`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            ),
            axios.get(
              `${
                process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
              }/api/enquiries`,
              {
                headers: { Authorization: `Bearer ${token}` },
              }
            ),
          ]);

        if (reportType === "revenue") {
          const bookings = bookingsRes.data.filter((b: any) => {
            if (startDate && new Date(b.startDate) < new Date(startDate))
              return false;
            if (endDate && new Date(b.endDate) > new Date(endDate))
              return false;
            return true;
          });
          response = { data: bookings };
        } else if (reportType === "expiring") {
          const contracts = contractsRes.data.filter((c: any) => {
            const daysUntilExpiry = Math.ceil(
              (new Date(c.endDate).getTime() - new Date().getTime()) /
                (1000 * 60 * 60 * 24)
            );
            return c.status === "Active" && daysUntilExpiry <= 30;
          });
          response = { data: contracts };
        } else if (reportType === "sales") {
          response = { data: enquiriesRes.data };
        }
      }

      if (response) {
        setReportData(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch report:", error);
    }
  };

  const exportToCSV = () => {
    if (!reportData || reportData.length === 0) return;

    let csv = "";
    if (reportType === "occupancy") {
      csv = "Hoarding Location,Total Days,Booked Days,Occupancy %\n";
      reportData.forEach((item: any) => {
        csv += `${item.hoardingLocation},${item.totalDays},${
          item.bookedDays
        },${item.occupancyPercentage.toFixed(2)}%\n`;
      });
    } else if (reportType === "revenue") {
      csv = "Hoarding ID,Client ID,Start Date,End Date,Total Amount\n";
      reportData.forEach((item: any) => {
        csv += `${item.hoardingId},${item.clientId},${item.startDate},${
          item.endDate
        },${item.pricing?.total || 0}\n`;
      });
    }

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType}_report_${
      new Date().toISOString().split("T")[0]
    }.csv`;
    a.click();
  };

  if (!user) {
    return (
      <div style={{ textAlign: "center", padding: "40px" }}>
        <p>Loading...</p>
      </div>
    );
  }

  const userRole = user?.role?.toLowerCase() || "";
  if (
    userRole !== "owner" &&
    userRole !== "manager" &&
    userRole !== "admin" &&
    userRole !== "accountant"
  ) {
    return <AccessDenied />;
  }

  return (
    <div>
        <h1>Reports</h1>

        <div className="card">
          <h3>Report Filters</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "15px",
            }}
          >
            <div className="form-group">
              <label>Report Type</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
              >
                <option value="occupancy">Occupancy Report</option>
                <option value="revenue">Revenue Report</option>
                <option value="expiring">Expiring Contracts</option>
                <option value="sales">Sales Performance</option>
              </select>
            </div>
            <div className="form-group">
              <label>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <button onClick={fetchReport} className="btn btn-primary">
            Generate Report
          </button>
          {reportData && (
            <button
              onClick={exportToCSV}
              className="btn btn-secondary"
              style={{ marginLeft: "10px" }}
            >
              Export to CSV
            </button>
          )}
        </div>

        {reportData && (
          <div className="card">
            <h3>
              {reportType === "occupancy"
                ? "Occupancy Report"
                : reportType === "revenue"
                ? "Revenue Report"
                : reportType === "expiring"
                ? "Expiring Contracts"
                : "Sales Performance"}
            </h3>
            {Array.isArray(reportData) && reportData.length > 0 ? (
              <table className="table">
                <thead>
                  {reportType === "occupancy" && (
                    <tr>
                      <th>Hoarding Location</th>
                      <th>Total Days</th>
                      <th>Booked Days</th>
                      <th>Occupancy %</th>
                    </tr>
                  )}
                  {reportType === "revenue" && (
                    <tr>
                      <th>Hoarding ID</th>
                      <th>Client ID</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th>Total Amount</th>
                    </tr>
                  )}
                  {reportType === "expiring" && (
                    <tr>
                      <th>Client ID</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th>Days Until Expiry</th>
                      <th>Total Value</th>
                    </tr>
                  )}
                  {reportType === "sales" && (
                    <tr>
                      <th>Client Name</th>
                      <th>Contact</th>
                      <th>Source</th>
                      <th>Status</th>
                      <th>Created Date</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {reportData.map((item: any, index: number) => (
                    <tr key={index}>
                      {reportType === "occupancy" && (
                        <>
                          <td>{item.hoardingLocation}</td>
                          <td>{item.totalDays}</td>
                          <td>{item.bookedDays}</td>
                          <td>{item.occupancyPercentage.toFixed(2)}%</td>
                        </>
                      )}
                      {reportType === "revenue" && (
                        <>
                          <td>{item.hoardingId}</td>
                          <td>{item.clientId}</td>
                          <td>
                            {new Date(item.startDate).toLocaleDateString()}
                          </td>
                          <td>{new Date(item.endDate).toLocaleDateString()}</td>
                          <td>₹{item.pricing?.total || 0}</td>
                        </>
                      )}
                      {reportType === "expiring" && (
                        <>
                          <td>{item.clientId}</td>
                          <td>
                            {new Date(item.startDate).toLocaleDateString()}
                          </td>
                          <td>{new Date(item.endDate).toLocaleDateString()}</td>
                          <td>
                            {Math.ceil(
                              (new Date(item.endDate).getTime() -
                                new Date().getTime()) /
                                (1000 * 60 * 60 * 24)
                            )}{" "}
                            days
                          </td>
                          <td>₹{item.pricing?.total || 0}</td>
                        </>
                      )}
                      {reportType === "sales" && (
                        <>
                          <td>{item.clientName}</td>
                          <td>{item.contact}</td>
                          <td>{item.source}</td>
                          <td>{item.status}</td>
                          <td>
                            {new Date(item.createdAt).toLocaleDateString()}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  color: "var(--text-secondary)",
                }}
              >
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>📊</div>
                <h3
                  style={{ marginBottom: "8px", color: "var(--text-primary)" }}
                >
                  No Data Available
                </h3>
                <p>
                  No data found for the selected report type and date range.
                </p>
              </div>
            )}
          </div>
        )}
        {!reportData && (
          <div className="card">
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                color: "var(--text-secondary)",
              }}
            >
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>📊</div>
              <h3 style={{ marginBottom: "8px", color: "var(--text-primary)" }}>
                No Report Generated
              </h3>
              <p style={{ marginBottom: "24px" }}>
                Select a report type and click "Generate Report" to view data.
              </p>
            </div>
          </div>
        )}
      </div>
  );
}
