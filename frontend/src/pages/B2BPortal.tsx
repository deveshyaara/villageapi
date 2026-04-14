import { Key, BarChart3, Shield, ArrowUpRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUsage } from "@/hooks/useUsage";
import Charts from "@/components/Charts";
import ApiKeyManager from "@/components/ApiKeyManager";

const planBadgeColors: Record<string, string> = {
  FREE: "bg-gray-500/15 text-gray-400",
  PREMIUM: "bg-blue-500/15 text-blue-400",
  PRO: "bg-violet-500/15 text-violet-400",
  UNLIMITED: "bg-amber-500/15 text-amber-400",
};

export default function B2BPortal() {
  const { user } = useAuth();
  const { data: usage, isLoading: usageLoading } = useUsage(30);

  const dailyData =
    usage?.callsByDay?.map((d) => ({
      label: new Date(d.createdAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      }),
      value: d._count,
    })) ?? [];

  const endpointData =
    usage?.callsByEndpoint?.map((e) => ({
      label: e.endpoint,
      value: e._count,
    })) ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            B2B Portal
          </h1>
          <p className="text-sm text-surface-200/50 mt-1">
            Manage your API keys and monitor usage
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
              planBadgeColors[user?.planType ?? "FREE"]
            }`}
          >
            {user?.planType ?? "FREE"} Plan
          </span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-900 border border-surface-700/50 rounded-xl p-6 hover:border-surface-700 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-surface-200/50">Total API Calls</span>
            <BarChart3 className="w-4 h-4 text-brand-400" />
          </div>
          <p className="text-3xl font-bold text-white">
            {usageLoading ? "—" : (usage?.totalCalls ?? 0).toLocaleString()}
          </p>
          <p className="text-xs text-surface-200/40 mt-1">Last 30 days</p>
        </div>
        <div className="bg-surface-900 border border-surface-700/50 rounded-xl p-6 hover:border-surface-700 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-surface-200/50">Plan</span>
            <Shield className="w-4 h-4 text-violet-400" />
          </div>
          <p className="text-3xl font-bold text-white">
            {user?.planType ?? "FREE"}
          </p>
          <a
            href="#"
            className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 mt-1 transition-colors"
          >
            Upgrade <ArrowUpRight className="w-3 h-3" />
          </a>
        </div>
        <div className="bg-surface-900 border border-surface-700/50 rounded-xl p-6 hover:border-surface-700 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-surface-200/50">Active Keys</span>
            <Key className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-3xl font-bold text-white">—</p>
          <p className="text-xs text-surface-200/40 mt-1">Max 5 per account</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Charts title="Daily API Calls (30 days)" data={dailyData} color="#3380ff" />
        <Charts
          title="Calls by Endpoint"
          variant="bar"
          data={endpointData}
          color="#a78bfa"
        />
      </div>

      {/* API Key Manager */}
      <ApiKeyManager />
    </div>
  );
}
