import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

interface UsageData {
  totalCalls: number;
  callsByDay: Array<{ createdAt: string; _count: number }>;
  callsByEndpoint: Array<{ endpoint: string; _count: number }>;
  period: { days: number; since: string };
}

export function useUsage(days = 30) {
  return useQuery<UsageData>({
    queryKey: ["b2b", "usage", days],
    queryFn: async () => {
      const { data } = await api.get(`/b2b/usage?days=${days}`);
      return data.data;
    },
    staleTime: 60 * 1000,
  });
}
