import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Copy, Check, Key, AlertCircle } from "lucide-react";
import api from "@/lib/api";

interface ApiKeyItem {
  id: number;
  key: string;
  name: string;
  status: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function ApiKeyManager() {
  const queryClient = useQueryClient();
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const keysQuery = useQuery<ApiKeyItem[]>({
    queryKey: ["b2b", "api-keys"],
    queryFn: async () => {
      const { data } = await api.get("/b2b/api-keys");
      return data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.post("/b2b/api-keys", { name });
      return data.data;
    },
    onSuccess: (data) => {
      setNewKeySecret(data.secret);
      setNewKeyName("");
      queryClient.invalidateQueries({ queryKey: ["b2b", "api-keys"] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/b2b/api-keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["b2b", "api-keys"] });
    },
  });

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">API Keys</h2>
      </div>

      {/* Create new key */}
      <div className="bg-surface-900 border border-surface-700/50 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-surface-200/80 mb-4">
          Generate New Key
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g., Production, Staging)"
            className="flex-1 px-4 py-2.5 bg-surface-800 border border-surface-700/50 rounded-lg text-white text-sm placeholder:text-surface-200/30 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all"
          />
          <button
            onClick={() => newKeyName.trim() && createMutation.mutate(newKeyName.trim())}
            disabled={!newKeyName.trim() || createMutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Generate
          </button>
        </div>

        {/* Show secret once */}
        {newKeySecret && (
          <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-300">
                  Save your API secret now — it won't be shown again
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 p-2 bg-surface-950 rounded text-xs text-yellow-200 font-mono break-all">
                    {newKeySecret}
                  </code>
                  <button
                    onClick={() => copyToClipboard(newKeySecret, "secret")}
                    className="p-2 hover:bg-surface-800 rounded-lg transition-colors"
                  >
                    {copiedId === "secret" ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-surface-200/60" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Keys list */}
      <div className="bg-surface-900 border border-surface-700/50 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-700/50">
              <th className="text-left px-6 py-3.5 text-xs font-semibold text-surface-200/50 uppercase tracking-wider">
                Name
              </th>
              <th className="text-left px-6 py-3.5 text-xs font-semibold text-surface-200/50 uppercase tracking-wider">
                Key
              </th>
              <th className="text-left px-6 py-3.5 text-xs font-semibold text-surface-200/50 uppercase tracking-wider">
                Status
              </th>
              <th className="text-left px-6 py-3.5 text-xs font-semibold text-surface-200/50 uppercase tracking-wider">
                Last Used
              </th>
              <th className="text-right px-6 py-3.5 text-xs font-semibold text-surface-200/50 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-700/30">
            {keysQuery.data?.map((apiKey) => (
              <tr
                key={apiKey.id}
                className="hover:bg-surface-800/50 transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-brand-400" />
                    <span className="text-sm font-medium text-white">
                      {apiKey.name}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-surface-200/60 font-mono">
                      {apiKey.key.slice(0, 16)}...
                    </code>
                    <button
                      onClick={() => copyToClipboard(apiKey.key, `key-${apiKey.id}`)}
                      className="p-1 hover:bg-surface-700 rounded transition-colors"
                    >
                      {copiedId === `key-${apiKey.id}` ? (
                        <Check className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-surface-200/40" />
                      )}
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      apiKey.status === "ACTIVE"
                        ? "bg-green-500/15 text-green-400"
                        : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {apiKey.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-surface-200/50">
                  {apiKey.lastUsedAt
                    ? new Date(apiKey.lastUsedAt).toLocaleDateString()
                    : "Never"}
                </td>
                <td className="px-6 py-4 text-right">
                  {apiKey.status === "ACTIVE" && (
                    <button
                      onClick={() => revokeMutation.mutate(apiKey.id)}
                      className="p-2 text-surface-200/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {keysQuery.data?.length === 0 && (
          <div className="p-12 text-center">
            <Key className="w-10 h-10 text-surface-200/20 mx-auto mb-3" />
            <p className="text-sm text-surface-200/40">
              No API keys yet. Generate one above to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
