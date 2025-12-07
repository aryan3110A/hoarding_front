import React from "react";
import "./globals.css";
import AppLayout from "@/components/AppLayout";

export const metadata = {
  title: "Shubham Advertise - Hoarding Management",
  description: "Centralized hoarding management and sales platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
