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
  created_at: string;
  updated_at: string;
  content_hash?: string | null;
  source_kind?: "text" | "ocr" | "mixed" | null;
};

export type ChatRole = "user" | "assistant";

export type Citation = {
  documentId: string;
  documentTitle: string;
  pageNumber: number;
  chunkIndex: number;
  excerpt: string;
};

export type ChatMessageRecord = {
  id: string;
  role: ChatRole;
  content: string;
  source_pages: number[];
  citations?: Citation[];
  created_at: string;
};

export type SummaryType =
  | "general"
  | "detailed"
  | "chapters"
  | "bullets"
  | "keywords"
  | "exam";

export type StudyType =
  | "notes"
  | "concepts"
  | "mcq"
  | "true_false"
  | "qa"
  | "flashcards"
  | "mock_exam"
  | "wrong_book";
