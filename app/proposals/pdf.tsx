"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Legacy implementation replaced by the Phase-2 Proposal Builder.
// Keep this file as a redirect target for any old imports.
export default function GenerateProposalPDF() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/proposals/create");
  }, [router]);
  return null;
}
