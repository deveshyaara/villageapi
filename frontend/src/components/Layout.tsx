import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Key,
  BarChart3,
  Shield,
  LogOut,
  Map,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { to: "/portal", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/portal/api-keys", icon: Key, label: "API Keys" },
  { to: "/portal/usage", icon: BarChart3, label: "Usage" },
];

const adminItems = [
  { to: "/admin", icon: Shield, label: "Admin Panel", end: true },
];

export default function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-surface-950">
      {/* Sidebar */}
      <aside className="w-64 bg-surface-900 border-r border-surface-700/50 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-surface-700/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Map className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">
                VillageAPI
              </h1>
              <p className="text-xs text-surface-200/60">B2B Data Platform</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-brand-600/20 text-brand-400 shadow-sm"
                    : "text-surface-200/70 hover:bg-surface-800 hover:text-white"
                }`
              }
            >
              <Icon className="w-4.5 h-4.5" />
              {label}
            </NavLink>
          ))}

          {isAdmin && (
            <>
              <div className="pt-4 pb-2">
                <p className="px-3 text-xs font-semibold text-surface-200/40 uppercase tracking-wider">
                  Admin
                </p>
              </div>
              {adminItems.map(({ to, icon: Icon, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-red-600/20 text-red-400 shadow-sm"
                        : "text-surface-200/70 hover:bg-surface-800 hover:text-white"
                    }`
                  }
                >
                  <Icon className="w-4.5 h-4.5" />
                  {label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-surface-700/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-brand-600/30 flex items-center justify-center text-brand-400 text-sm font-semibold">
              {user?.businessName?.charAt(0) ?? "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.businessName ?? "User"}
              </p>
              <p className="text-xs text-surface-200/50 truncate">
                {user?.email ?? ""}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-surface-200/60 hover:bg-red-600/10 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
