"use client";

import { useState } from "react";
import { createApiKeyAction, revokeApiKeyAction } from "./actions";

type KeyInfo = {
  id: string;
  label: string;
  keyPrefix: string;
  scope: string;
  lastUsedAt: Date | null;
  createdAt: Date;
};

export function ApiKeysManager({
  keys: initialKeys,
  siteId,
}: {
  keys: KeyInfo[];
  siteId: string;
}) {
  const [keys, setKeys] = useState(initialKeys);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<"read" | "write" | "admin">("write");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!label) return;
    setCreating(true);
    const result = await createApiKeyAction({ label, scope, siteId });
    setCreating(false);
    if (result.key) {
      setNewKey(result.key);
      setLabel("");
      if (result.keyInfo) setKeys((prev) => [...prev, result.keyInfo!]);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    await revokeApiKeyAction(id);
    setKeys((prev) => prev.filter((k) => k.id !== id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">API Keys</h1>
      </div>
      <p className="text-sm text-[var(--color-text-muted)] mb-8 max-w-prose">
        API keys grant your MCP client (Claude Desktop, Cursor, etc.) access to this CMS. Keys are shown
        once at creation — store them securely.
      </p>

      {newKey && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-[var(--radius-lg)]">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-2">
            Copy this key now — it will not be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-white dark:bg-black border border-[var(--color-border)] rounded-[var(--radius-sm)] px-3 py-2 break-all">
              {newKey}
            </code>
            <button
              onClick={() => { void navigator.clipboard.writeText(newKey); }}
              className="shrink-0 px-3 py-2 text-xs border border-[var(--color-border)] rounded-[var(--radius-sm)] hover:bg-[var(--color-bg-subtle)]"
            >
              Copy
            </button>
          </div>
          <button onClick={() => setNewKey(null)} className="mt-2 text-xs text-amber-700 dark:text-amber-400 hover:underline">
            I've saved it — dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      <div className="border border-[var(--color-border)] rounded-[var(--radius-lg)] p-4 mb-8">
        <h2 className="font-semibold text-sm mb-4">Create new API key</h2>
        <div className="flex gap-3">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Key label (e.g. Claude Desktop)"
            className="flex-1 px-3 py-2 text-sm border border-[var(--color-border)] rounded-[var(--radius-md)] bg-[var(--color-bg)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as "read" | "write" | "admin")}
            className="px-3 py-2 text-sm border border-[var(--color-border)] rounded-[var(--radius-md)] bg-[var(--color-bg)] focus:outline-none"
          >
            <option value="read">Read</option>
            <option value="write">Write</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={handleCreate}
            disabled={creating || !label}
            className="px-4 py-2 bg-[var(--color-accent)] text-white text-sm rounded-[var(--radius-md)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-colors"
          >
            {creating ? "Creating…" : "Create"}
          </button>
        </div>
      </div>

      {/* Keys list */}
      {keys.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">No API keys yet.</p>
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          {keys.map((key) => (
            <div key={key.id} className="py-3 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-sm">{key.label}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {key.keyPrefix}… · {key.scope} · Created {new Date(key.createdAt).toLocaleDateString()}
                  {key.lastUsedAt && ` · Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                </p>
              </div>
              <button
                onClick={() => handleRevoke(key.id)}
                className="text-xs text-red-600 hover:underline"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
