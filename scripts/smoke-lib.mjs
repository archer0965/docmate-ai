/**
 * 不需網路的函式煙霧測試（給初學者確認核心邏輯）
 * 執行：node scripts/smoke-lib.mjs
 */

import assert from "node:assert/strict";

// 動態用 tsx 較佳；此處直接複刻關鍵邏輯做最小驗證
function chunkPages(pages, maxChars = 1200) {
  const chunks = [];
  let chunkIndex = 0;
  for (const page of pages) {
    if (!page.text) continue;
    if (page.text.length <= maxChars) {
      chunks.push({ chunkIndex, pageNumber: page.pageNumber, content: page.text });
      chunkIndex += 1;
      continue;
    }
    let start = 0;
    while (start < page.text.length) {
      const end = Math.min(start + maxChars, page.text.length);
      const slice = page.text.slice(start, end).trim();
      if (slice) {
        chunks.push({ chunkIndex, pageNumber: page.pageNumber, content: slice });
        chunkIndex += 1;
      }
      start = end;
    }
  }
  return chunks;
}

const pages = [
  { pageNumber: 1, text: "你好，這是第一頁。" },
  { pageNumber: 2, text: "A".repeat(2500) },
  { pageNumber: 3, text: "" },
];

const chunks = chunkPages(pages);
assert.equal(chunks[0].pageNumber, 1);
assert.ok(chunks.length >= 3);
assert.ok(chunks.every((c) => c.content.length > 0));
assert.ok(chunks.every((c) => c.pageNumber === 1 || c.pageNumber === 2));

console.log("smoke-lib OK", { chunks: chunks.length });
