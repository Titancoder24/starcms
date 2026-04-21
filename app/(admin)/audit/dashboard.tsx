"use client";

import { useState } from "react";
import type { AuditRun } from "@/lib/db/schema";
import { runAuditAction } from "./actions";

type Props = {
  items: AuditRun[];
  siteId: string;
};

export function AuditDashboard({ items, siteId }: Props) {
  const [filter, setFilter] = useState<"all" | "red" | "yellow" | "green">("all");
  const [selected, setSelected] = useState<AuditRun | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  const filtered = items.filter((item) => filter === "all" || item.status === filter);

  const handleReaudit = async (url: string) => {
    setRunning(url);
    await runAuditAction(url, siteId);
    setRunning(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Audit Dashboard</h1>
        <div className="flex gap-1">
          {(["all", "red", "yellow", "green"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                filter === s
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[var(--color-border)] rounded-[var(--radius-lg)]">
          <p className="text-[var(--color-text-muted)]">No audit results yet. Run an audit on a published page.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-text-muted)] text-xs">
                <th className="text-left py-2 pr-4 font-medium">URL</th>
                <th className="text-right py-2 px-2 font-medium">Status</th>
                <th className="text-right py-2 px-2 font-medium">Perf</th>
                <th className="text-right py-2 px-2 font-medium">SEO</th>
                <th className="text-right py-2 px-2 font-medium">AI</th>
                <th className="text-right py-2 px-2 font-medium">Links</th>
                <th className="text-right py-2 pl-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-[var(--color-bg-subtle)] cursor-pointer"
                  onClick={() => setSelected(row)}
                >
                  <td className="py-3 pr-4 truncate max-w-[300px]">
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--color-accent)] hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {row.url.replace(/^https?:\/\//, "")}
                    </a>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="py-3 px-2 text-right text-[var(--color-text-muted)]">
                    {row.performanceScore ?? "—"}
                  </td>
                  <td className="py-3 px-2 text-right text-[var(--color-text-muted)]">
                    {row.seoScore ?? "—"}
                  </td>
                  <td className="py-3 px-2 text-right text-[var(--color-text-muted)]">
                    {row.aiReadinessScore ?? "—"}
                  </td>
                  <td className="py-3 px-2 text-right text-[var(--color-text-muted)]">
                    {(row.brokenLinks as unknown[])?.length ?? 0}
                  </td>
                  <td className="py-3 pl-2 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); void handleReaudit(row.url); }}
                      disabled={running === row.url}
                      className="text-xs text-[var(--color-accent)] hover:underline disabled:opacity-50"
                    >
                      {running === row.url ? "Running…" : "Re-audit"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setSelected(null)}>
          <div className="flex-1 bg-black/30" />
          <div
            className="w-[480px] bg-[var(--color-bg)] border-l border-[var(--color-border)] h-full overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm truncate">{selected.url}</h2>
              <button onClick={() => setSelected(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
              <Stat label="Performance" value={selected.performanceScore} />
              <Stat label="SEO" value={selected.seoScore} />
              <Stat label="Accessibility" value={selected.accessibilityScore} />
              <Stat label="AI Readiness" value={selected.aiReadinessScore} />
              <Stat label="LCP" value={selected.lcpMs ? `${selected.lcpMs}ms` : null} />
              <Stat label="TTFB" value={selected.ttfbMs ? `${selected.ttfbMs}ms` : null} />
            </div>
            <h3 className="font-semibold text-sm mb-3">Issues</h3>
            <div className="space-y-2">
              {(selected.issues as Array<{ code: string; severity: string; message: string; fix: string }> ?? []).map((issue, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-[var(--radius-sm)] text-xs ${
                    issue.severity === "error"
                      ? "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300"
                      : "bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
                  }`}
                >
                  <div className="font-semibold">{issue.code}</div>
                  <p className="mt-0.5">{issue.message}</p>
                  {issue.fix && <p className="mt-1 opacity-75 italic">{issue.fix}</p>}
                </div>
              ))}
              {(selected.issues as unknown[])?.length === 0 && (
                <p className="text-xs text-[var(--color-text-muted)]">No issues found.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${
        status === "green" ? "bg-green-500" : status === "red" ? "bg-red-500" : "bg-amber-500"
      }`}
    />
  );
}

function Stat({ label, value }: { label: string; value: number | string | null | undefined }) {
  return (
    <div className="bg-[var(--color-bg-subtle)] rounded-[var(--radius-sm)] p-3">
      <div className="text-xs text-[var(--color-text-muted)]">{label}</div>
      <div className="font-semibold text-[var(--color-text)] mt-0.5">{value ?? "—"}</div>
    </div>
  );
}
