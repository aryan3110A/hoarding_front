"use client";

import React from "react";
import { useParams } from "next/navigation";
import ProposalBuilder from "@/components/ProposalBuilder";

export default function EditProposalPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || "");
  return <ProposalBuilder proposalId={id} />;
}
