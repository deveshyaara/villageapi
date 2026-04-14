import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, MapPin, Activity, BarChart3, Check } from "lucide-react";
import api from "@/lib/api";
import Charts from "@/components/Charts";
import DataTable from "@/components/Tables";

interface AdminStats {
  totalUsers: number;
  totalVillages: number;
  totalApiCalls: number;
  usersByStatus: Array<{ status: string; _count: number }>;
  usersByPlan: Array<{ planType: string; _count: number }>;
  topStates?: Array<{ label: string; value: number }>;
  apiRequests30Days?: Array<{ label: string; value: number }>;
  requestsByEndpoint?: Array<{ label: string; value: number }>;
  usageByHour?: Array<{ label: number; value: number }>;
}

interface AdminUser {
  id: number;
  email: string;
  businessName: string;
  gstNumber: string | null;
  status: string;
  planType: string;
  isAdmin: boolean;
  createdAt: string;
  _count: { apiKeys: number; apiLogs: number };
}

const statusColors: Record<string, string> = {
  PENDING_APPROVAL: "bg-yellow-500/15 text-yellow-400",
  ACTIVE: "bg-green-500/15 text-green-400",
  SUSPENDED: "bg-red-500/15 text-red-400",
};

export default function AdminDashboard() {
  const queryClient = useQueryClient();

  const statsQuery = useQuery<AdminStats>({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const { data } = await api.get("/admin/stats");
      return data.data;
    },
  });

  const usersQuery = useQuery<{ users: AdminUser[] }>({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const { data } = await api.get("/admin/users");
      return data.data;
    },
  });

  const stats = statsQuery.data;

  const approveMutation = useMutation({
    mutationFn: async (userId: number) => {
      await api.patch(`/admin/users/${userId}/status`, { status: "ACTIVE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });

  const statCards = [
    {
      label: "Total Users",
      value: stats?.totalUsers ?? 0,
      icon: Users,
      color: "from-blue-500 to-blue-700",
    },
    {
      label: "Villages",
      value: stats?.totalVillages ?? 0,
      icon: MapPin,
      color: "from-emerald-500 to-emerald-700",
    },
    {
      label: "API Calls",
      value: stats?.totalApiCalls ?? 0,
      icon: Activity,
      color: "from-violet-500 to-violet-700",
    },
    {
      label: "Active Users",
      value:
        stats?.usersByStatus?.find((s) => s.status === "ACTIVE")?._count ?? 0,
      icon: BarChart3,
      color: "from-amber-500 to-amber-700",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Admin Dashboard
        </h1>
        <p className="text-sm text-surface-200/50 mt-1">
          Platform overview and user management
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-surface-900 border border-surface-700/50 rounded-xl p-6 hover:border-surface-700 transition-colors"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-surface-200/50">{label}</span>
              <div
                className={`w-9 h-9 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center`}
              >
                <Icon className="w-4.5 h-4.5 text-white" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">
              {value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Charts
          title="Users by Plan"
          variant="pie"
          data={
            stats?.usersByPlan?.map((p) => ({
              label: p.planType,
              value: p._count,
            })) ?? []
          }
        />
        <Charts
          title="API Requests (30 Days)"
          variant="line"
          color="#10b981"
          data={stats?.apiRequests30Days ?? []}
        />
        <Charts
          title="Top 10 States"
          variant="bar"
          color="#a78bfa"
          data={stats?.topStates ?? []}
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 mb-8">
        <Charts
           title="Usage by Hour (Last 24h)"
           variant="bar"
           color="#f59e0b"
           data={stats?.usageByHour?.map(u => ({ label: `${u.label}:00`, value: u.value })) ?? []}
        />
        <Charts
           title="Requests by Endpoint"
           variant="bar"
           color="#ef4444"
           data={stats?.requestsByEndpoint ?? []}
        />
      </div>

      {/* Users Table */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">
          Recent Users
        </h2>
        <DataTable
          data={usersQuery.data?.users ?? []}
          keyExtractor={(u) => u.id}
          loading={usersQuery.isLoading}
          emptyMessage="No users registered yet"
          columns={[
            {
              key: "businessName",
              header: "Business",
              render: (u) => (
                <div>
                  <p className="font-medium text-white">{u.businessName}</p>
                  <p className="text-xs text-surface-200/40">{u.email}</p>
                </div>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (u) => (
                <span
                  className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    statusColors[u.status] ?? "bg-gray-500/15 text-gray-400"
                  }`}
                >
                  {u.status.replace("_", " ")}
                </span>
              ),
            },
            { key: "planType", header: "Plan" },
            {
              key: "apiLogs",
              header: "API Calls",
              render: (u) => u._count.apiLogs.toLocaleString(),
            },
            {
              key: "createdAt",
              header: "Joined",
              render: (u) => new Date(u.createdAt).toLocaleDateString(),
            },
            {
              key: "actions",
              header: "Actions",
              render: (u) => (
                <div className="flex items-center gap-2">
                  {u.status === "PENDING_APPROVAL" && (
                    <button
                      onClick={() => approveMutation.mutate(u.id)}
                      disabled={approveMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-md transition-colors text-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approve
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
