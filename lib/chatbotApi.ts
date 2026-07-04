import api from "./api";
import type { ChatbotIntent } from "@/components/chatbot/types";

export type ChatbotFilters = Record<string, unknown>;

export type ChatbotAction = {
  type: "navigate" | "expand" | "export";
  label: string;
  href?: string;
  exportType?: "csv";
  payload?: Record<string, unknown>;
};

export type ChatbotExpandable = {
  id: string;
  title: string;
  rows: Array<Record<string, string | number | null>>;
};

export type ChatbotResponse = {
  summary: string;
  resolvedPeriod?: string;
  dataFreshness: string;
  breakdown: Array<{ label: string; value: string }>;
  expandable?: ChatbotExpandable[];
  actions: ChatbotAction[];
  intent: ChatbotIntent;
  filters: ChatbotFilters;
};

export type SuggestionCategory = {
  id: string;
  label: string;
  prompts: Array<{
    label: string;
    intent: ChatbotIntent;
    filters?: ChatbotFilters;
  }>;
};

export const chatbotAPI = {
  getSuggestions: async () => {
    const response = await api.get("/chatbot/suggestions");
    return response.data;
  },
  query: async (payload: {
    message: string;
    sessionId: string;
    intent?: ChatbotIntent;
    filters?: ChatbotFilters;
  }) => {
    const response = await api.post("/chatbot/query", payload);
    return response.data;
  },
  exportCsv: async (payload: { intent: ChatbotIntent; filters?: ChatbotFilters }) => {
    const response = await api.post("/chatbot/export", payload, {
      responseType: "blob",
    });
    return response.data as Blob;
  },
};
