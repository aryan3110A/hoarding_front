"use client";

export default function AccessDenied() {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ fontSize: "72px", marginBottom: "20px" }}>🚫</div>
      <h1 style={{ color: "var(--text-primary)", marginBottom: "10px" }}>
        Access Denied
      </h1>
      <p style={{ color: "var(--text-secondary)", fontSize: "18px" }}>
        You don't have permission to access this page.
      </p>
      <p style={{ color: "var(--text-secondary)", marginTop: "10px" }}>
        Please contact your administrator if you believe this is an error.
      </p>
    </div>
  );
}
