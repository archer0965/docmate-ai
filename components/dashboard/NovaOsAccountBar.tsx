"use client";

import { useEffect, useRef, useState } from "react";
import { NOVAOS_HUB_URL, NOVAOS_MATRIX } from "@/lib/novaos-matrix";

export function NovaOsAccountBar({ email }: { email?: string | null }) {
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const label = email || "NovaOS 用戶";
  const initials = label.slice(0, 2).toUpperCase();

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setMatrixOpen(false);
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={rootRef} className="flex items-center gap-2">
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setMatrixOpen((v) => !v);
            setMenuOpen(false);
          }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-brand-100 bg-white text-slate-700 shadow-sm hover:bg-brand-50"
          aria-label="切換拓新雲端產品"
          title="快速切換至主站／其他工具"
        >
          <span className="text-sm font-bold" aria-hidden>
            ⊞
          </span>
        </button>
        {matrixOpen ? (
          <div className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-brand-100 bg-white p-2 shadow-xl">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              拓新雲端產品矩陣
            </p>
            {NOVAOS_MATRIX.map((p) => (
              <a
                key={p.href}
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-brand-50"
                onClick={() => setMatrixOpen(false)}
              >
                {p.name}
                <span className="text-slate-400">↗</span>
              </a>
            ))}
          </div>
        ) : null}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setMenuOpen((v) => !v);
            setMatrixOpen(false);
          }}
          className="inline-flex max-w-[11rem] items-center gap-2 rounded-xl border border-brand-100 bg-white py-1 pl-1 pr-2.5 shadow-sm"
          aria-label="拓新雲端 NovaOS 帳號狀態"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-xs font-semibold text-white">
            {initials}
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block truncate text-xs font-semibold text-slate-900">
              拓新雲端 NovaOS 帳號
            </span>
            <span className="block truncate text-[10px] text-slate-500">
              {label}
            </span>
          </span>
        </button>
        {menuOpen ? (
          <div className="absolute right-0 z-50 mt-2 w-52 rounded-2xl border border-brand-100 bg-white p-2 shadow-xl">
            <a
              href="/dashboard"
              className="block rounded-xl px-3 py-2 text-sm font-medium text-brand-800 hover:bg-brand-50"
              onClick={() => setMenuOpen(false)}
            >
              前往功能工作台
            </a>
            <a
              href={`${NOVAOS_HUB_URL}/admin/aidoc`}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl px-3 py-2 text-sm font-medium text-indigo-800 hover:bg-indigo-50"
              onClick={() => setMenuOpen(false)}
            >
              進入管理後台
            </a>
            <a
              href={`${NOVAOS_HUB_URL}/dashboard`}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => setMenuOpen(false)}
            >
              前往 NovaOS 主站中控
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
