"use client";

import { useSearchParams } from "next/navigation";
import ProposalBuilder from "@/components/ProposalBuilder";

export default function Page() {
  const searchParams = useSearchParams();
  const proposalId = String(searchParams?.get("proposalId") || "").trim();

  return <ProposalBuilder proposalId={proposalId || undefined} />;
}
