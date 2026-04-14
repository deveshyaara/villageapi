import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "./index.css";

import Login from "@/pages/Login";
import B2BPortal from "@/pages/B2BPortal";
import AdminDashboard from "@/pages/AdminDashboard";
import Layout from "@/components/Layout";
import ApiKeyManager from "@/components/ApiKeyManager";

import { useAuthStore } from "@/store/authStore";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user?.isAdmin) return <Navigate to="/portal" replace />;
  return <>{children}</>;
}

function UsagePage() {
  // Re-exports the chart section from B2BPortal as a standalone page
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Usage Analytics
        </h1>
        <p className="text-sm text-surface-200/50 mt-1">
          Detailed API usage metrics and trends
        </p>
      </div>
      <B2BPortal />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/portal" element={<B2BPortal />} />
            <Route path="/portal/api-keys" element={<ApiKeyManager />} />
            <Route path="/portal/usage" element={<UsagePage />} />

            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
