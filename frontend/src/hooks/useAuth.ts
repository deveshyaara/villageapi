import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

interface AuthUser {
  id: number;
  email: string;
  businessName: string;
  gstNumber: string | null;
  phone: string | null;
  status: string;
  planType: string;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useAuth() {
  const { user, token, setAuth, logout } = useAuthStore();

  const profileQuery = useQuery<AuthUser>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const { data } = await api.get("/auth/me");
      return data.data;
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const login = async (email: string, password: string) => {
    const { data } = await api.post("/auth/login", { email, password });
    setAuth(data.data.user, data.data.token);
    return data.data;
  };

  const register = async (payload: {
    email: string;
    password: string;
    businessName: string;
    gstNumber?: string;
    phone?: string;
  }) => {
    const { data } = await api.post("/auth/register", payload);
    return data.data;
  };

  return {
    user,
    token,
    isAuthenticated: !!token,
    isAdmin: user?.isAdmin ?? false,
    profile: profileQuery.data,
    profileLoading: profileQuery.isLoading,
    login,
    register,
    logout,
  };
}
