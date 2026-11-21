import type { PlanId } from "@/lib/plans";

export type { PlanId };

export type DocumentStatus = "processing" | "ready" | "failed";

export type DocumentRecord = {
  id: string;
  title: string;
  file_name: string;
  file_size: number;
  page_count: number | null;
  status: DocumentStatus;
  error_message: string | null;
  summary: string | null;
  folder?: string | null;
  created_at: string;
  updated_at: string;
};

export type ChatRole = "user" | "assistant";
