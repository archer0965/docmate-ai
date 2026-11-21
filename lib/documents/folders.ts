/**
 * 資料夾輔助：documents.folder 可為 null（未分類）。
 * 若 DB 尚未套用 migration，API 會忽略 folder 欄位。
 */

export const UNCATEGORIZED_FOLDER = "";

export function normalizeFolder(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim().slice(0, 80);
  if (!trimmed) return null;
  return trimmed;
}

export function groupDocumentsByFolder<T extends { folder?: string | null }>(
  documents: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const doc of documents) {
    const key = doc.folder?.trim() || "未分類";
    const list = map.get(key) ?? [];
    list.push(doc);
    map.set(key, list);
  }
  return map;
}

/** 從標題前綴 [資料夾名] 解析（無 DB folder 欄位時的後援） */
export function folderFromTitlePrefix(title: string): {
  folder: string | null;
  displayTitle: string;
} {
  const match = title.match(/^\[([^\]]{1,80})\]\s*(.*)$/);
  if (!match) {
    return { folder: null, displayTitle: title };
  }
  return {
    folder: match[1].trim() || null,
    displayTitle: (match[2] || title).trim() || title,
  };
}
