"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import { useUser } from "@/components/AppLayout";
import { showError } from "@/lib/toast";

export default function ContractDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;
  const user = useUser();
  const [contract, setContract] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    if (!id) return;
    const fetch = async () => {
      try {
        setLoading(true);
        const authToken = localStorage.getItem("token");
        const API_URL =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        const resp = await axios.get(`${API_URL}/api/contracts`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const list = resp.data?.data || resp.data || [];
        const found = Array.isArray(list)
          ? list.find((c: any) => String(c.id) === String(id))
          : null;
        if (!found) {
          showError("Contract not found");
          router.push("/contracts");
          return;
        }
        setContract(found);
      } catch (e) {
        console.error(e);
        showError("Failed to load contract");
        router.push("/contracts");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [user, id]);

  if (loading)
    return (
      <div className="p-8">
        <div className="text-center text-gray-600">Loading contract...</div>
      </div>
    );
  if (!contract) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <a href="/contracts" className="text-sm text-blue-600 hover:underline">
          &larr; Back to contracts
        </a>
      </div>

      <header className="mb-6">
        <h1 className="text-3xl font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-500 p-6 rounded-lg shadow">
          Contract {contract.contractNumber || contract.id}
        </h1>
      </header>

      <section className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-500">Client</div>
            <div className="text-lg font-medium text-gray-800">
              {contract.clientName || contract.clientId || "N/A"}
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-500">Hoarding</div>
            <div className="text-lg font-medium text-gray-800">
              {contract.hoardingCode || contract.hoardingId || "N/A"}
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-500">Duration</div>
            <div className="text-lg font-medium text-gray-800">
              {contract.durationMonths ?? "N/A"} months
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-500">Payment Terms</div>
            <div className="text-lg font-medium text-gray-800">
              {contract.paymentTerms || "N/A"}
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-500">Start Date</div>
            <div className="text-lg font-medium text-gray-800">
              {contract.startDate
                ? new Date(contract.startDate).toLocaleDateString()
                : "N/A"}
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-500">End Date</div>
            <div className="text-lg font-medium text-gray-800">
              {contract.endDate
                ? new Date(contract.endDate).toLocaleDateString()
                : "N/A"}
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-500">Status</div>
            <div className="inline-flex items-center gap-2">
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                {contract.status}
              </span>
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-500">Created By</div>
            <div className="text-lg font-medium text-gray-800">
              {contract.createdById || "N/A"}
            </div>
          </div>
        </div>

        <div className="mt-6 border-t pt-4">
          <h3 className="text-sm text-gray-500 mb-2">Financials</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-500">Base Price</div>
              <div className="text-lg font-medium text-gray-800">
                {contract.basePrice ?? "0"}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Value</div>
              <div className="text-lg font-medium text-gray-800">
                {contract.totalValue ?? "0"}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Activated At</div>
              <div className="text-lg font-medium text-gray-800">
                {contract.activatedAt
                  ? new Date(contract.activatedAt).toLocaleString()
                  : "N/A"}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
