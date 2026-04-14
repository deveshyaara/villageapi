import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Map, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

const FREE_EMAIL_PROVIDERS = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"];

const registerSchema = z.object({
  email: z.string().email("Invalid email address")
    .refine((val) => {
      const domain = val.split("@")[1];
      return !FREE_EMAIL_PROVIDERS.includes(domain?.toLowerCase() || "");
    }, "Please use a business email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  businessName: z.string().min(2, "Business name is required"),
  gstNumber: z.string().optional(),
  phone: z.string().optional(),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { login, register: registerUser } = useAuth();
  const navigate = useNavigate();

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onLogin = async (data: LoginForm) => {
    setError("");
    try {
      await login(data.email, data.password);
      navigate("/portal");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message ?? "Login failed";
      setError(msg);
    }
  };

  const onRegister = async (data: RegisterForm) => {
    setError("");
    setSuccess("");
    try {
      await registerUser(data);
      setSuccess(
        "Account created! Your account is pending admin approval. You'll receive an email once approved."
      );
      setMode("login");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message ?? "Registration failed";
      setError(msg);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-surface-950 via-brand-950 to-surface-950 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(51,128,255,0.12),transparent_70%)]" />
        <div className="relative z-10 max-w-md text-center px-8">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-2xl shadow-brand-500/25">
            <Map className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">
            VillageAPI
          </h1>
          <p className="text-lg text-surface-200/60 leading-relaxed">
            India's most comprehensive village-level geographical data platform.
            Access 6 lakh+ villages across 36 states via REST API.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              { n: "6L+", l: "Villages" },
              { n: "700+", l: "Districts" },
              { n: "36", l: "States/UTs" },
            ].map(({ n, l }) => (
              <div key={l} className="p-4 rounded-xl bg-white/5 backdrop-blur-sm">
                <p className="text-2xl font-bold text-brand-400">{n}</p>
                <p className="text-xs text-surface-200/50 mt-1">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-surface-950">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Map className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">VillageAPI</h1>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="text-sm text-surface-200/50 mb-8">
            {mode === "login"
              ? "Sign in to access your B2B dashboard"
              : "Register to start using VillageAPI"}
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-green-400">
              {success}
            </div>
          )}

          {mode === "login" ? (
            <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-200/70 mb-1.5">
                  Email
                </label>
                <input
                  {...loginForm.register("email")}
                  type="email"
                  className="w-full px-4 py-3 bg-surface-900 border border-surface-700/50 rounded-lg text-white text-sm placeholder:text-surface-200/30 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all"
                  placeholder="you@company.com"
                />
                {loginForm.formState.errors.email && (
                  <p className="mt-1 text-xs text-red-400">
                    {loginForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-200/70 mb-1.5">
                  Password
                </label>
                <input
                  {...loginForm.register("password")}
                  type="password"
                  className="w-full px-4 py-3 bg-surface-900 border border-surface-700/50 rounded-lg text-white text-sm placeholder:text-surface-200/30 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all"
                  placeholder="••••••••"
                />
                {loginForm.formState.errors.password && (
                  <p className="mt-1 text-xs text-red-400">
                    {loginForm.formState.errors.password.message}
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={loginForm.formState.isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {loginForm.formState.isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Sign in <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form
              onSubmit={registerForm.handleSubmit(onRegister)}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-surface-200/70 mb-1.5">
                  Business Name *
                </label>
                <input
                  {...registerForm.register("businessName")}
                  className="w-full px-4 py-3 bg-surface-900 border border-surface-700/50 rounded-lg text-white text-sm placeholder:text-surface-200/30 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all"
                  placeholder="Acme Technologies Pvt Ltd"
                />
                {registerForm.formState.errors.businessName && (
                  <p className="mt-1 text-xs text-red-400">
                    {registerForm.formState.errors.businessName.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-200/70 mb-1.5">
                  Email *
                </label>
                <input
                  {...registerForm.register("email")}
                  type="email"
                  className="w-full px-4 py-3 bg-surface-900 border border-surface-700/50 rounded-lg text-white text-sm placeholder:text-surface-200/30 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all"
                  placeholder="you@company.com"
                />
                {registerForm.formState.errors.email && (
                  <p className="mt-1 text-xs text-red-400">
                    {registerForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-200/70 mb-1.5">
                  Password *
                </label>
                <input
                  {...registerForm.register("password")}
                  type="password"
                  className="w-full px-4 py-3 bg-surface-900 border border-surface-700/50 rounded-lg text-white text-sm placeholder:text-surface-200/30 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all"
                  placeholder="Minimum 8 characters"
                />
                {registerForm.formState.errors.password && (
                  <p className="mt-1 text-xs text-red-400">
                    {registerForm.formState.errors.password.message}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-surface-200/70 mb-1.5">
                    GST Number
                  </label>
                  <input
                    {...registerForm.register("gstNumber")}
                    className="w-full px-4 py-3 bg-surface-900 border border-surface-700/50 rounded-lg text-white text-sm placeholder:text-surface-200/30 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all"
                    placeholder="29ABCDE1234F1Z5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-200/70 mb-1.5">
                    Phone
                  </label>
                  <input
                    {...registerForm.register("phone")}
                    className="w-full px-4 py-3 bg-surface-900 border border-surface-700/50 rounded-lg text-white text-sm placeholder:text-surface-200/30 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all"
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={registerForm.formState.isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {registerForm.formState.isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Create Account <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-surface-200/50">
            {mode === "login" ? (
              <>
                Don't have an account?{" "}
                <button
                  onClick={() => {
                    setMode("register");
                    setError("");
                  }}
                  className="text-brand-400 hover:text-brand-300 font-medium transition-colors"
                >
                  Register
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => {
                    setMode("login");
                    setError("");
                  }}
                  className="text-brand-400 hover:text-brand-300 font-medium transition-colors"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
