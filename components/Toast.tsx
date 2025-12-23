"use client";

import { useEffect, useState } from "react";

type ToastItem = {
  id: number;
  type: "success" | "error" | "info";
  message: string;
  title?: string | null;
  hideTitle?: boolean;
};

export default function Toast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    let idCounter = 1;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        type: "success" | "error" | "info";
        message: string;
        timeout?: number;
        title?: string | null;
        hideTitle?: boolean;
      };
      const id = idCounter++;
      setToasts((t) => [
        ...t,
        {
          id,
          type: detail.type,
          message: detail.message,
          title: detail.title,
          hideTitle: detail.hideTitle,
        },
      ]);

      const timeout = detail.timeout ?? 5000;
      setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, timeout);
    };

    window.addEventListener("app-toast", handler as EventListener);
    return () =>
      window.removeEventListener("app-toast", handler as EventListener);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div style={{ position: "fixed", right: 20, top: 20, zIndex: 9999 }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            marginBottom: 10,
            minWidth: 300,
            padding: "12px 16px",
            borderRadius: 8,
            boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
            color:
              t.type === "error"
                ? "#7f1d1d"
                : t.type === "success"
                ? "#064e3b"
                : "#0f172a",
            background:
              t.type === "error"
                ? "#fee2e2"
                : t.type === "success"
                ? "#ecfccb"
                : "#f1f5f9",
            border: "1px solid rgba(0,0,0,0.04)",
          }}
        >
          {t.hideTitle || t.title === "" || t.title === null ? null : (
            <div
              style={{
                fontWeight: 600,
                marginBottom: 6,
                textTransform: "capitalize",
              }}
            >
              {t.title ?? t.type}
            </div>
          )}
          <div style={{ fontSize: 14 }}>{t.message}</div>
        </div>
      ))}
    </div>
  );
}
