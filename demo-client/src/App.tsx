import { useState, useRef, useEffect } from "react";
import { Search, MapPin, Building2, User, Mail, Phone, Loader2, Check } from "lucide-react";

interface VillageItem {
  value: string;
  label: string;
  fullAddress: string;
  hierarchy: {
    village: string;
    subDistrict: string;
    district: string;
    state: string;
    country: string;
  };
}

export default function App() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<VillageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    village: "",
    subDistrict: "",
    district: "",
    state: "",
    country: "India",
    message: "",
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchVillages = async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || "/api/v1";
      const apiKey = import.meta.env.VITE_API_KEY;
      const res = await fetch(`${apiBase}/autocomplete?q=${encodeURIComponent(q)}`, {
        headers: apiKey ? { "X-API-Key": apiKey } : {},
      });
      const json = await res.json();
      if (json.success) {
        setSuggestions(json.data);
      }
    } catch (e) {
      console.error("Failed to search villages", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item: VillageItem) => {
    setQuery(item.label);
    setFormData(prev => ({
      ...prev,
      village: item.hierarchy.village,
      subDistrict: item.hierarchy.subDistrict,
      district: item.hierarchy.district,
      state: item.hierarchy.state,
      country: item.hierarchy.country,
    }));
    setShowDropdown(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitSuccess(true);
    setTimeout(() => setSubmitSuccess(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 py-12">
      <div className="max-w-4xl w-full grid md:grid-cols-2 gap-8 bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Left pane - Demo Instructions */}
        <div className="p-8 md:p-12 bg-blue-600 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <MapPin size={200} />
          </div>
          <div className="relative z-10">
            <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-sm font-semibold tracking-wider uppercase mb-6 text-blue-50">
              API Demonstration
            </span>
            <h1 className="text-4xl font-extrabold mb-4 leading-tight">
              VillageAPI Integration Demo
            </h1>
            <p className="text-blue-100 text-lg mb-8 leading-relaxed">
              Experience lightning-fast geographic auto-completion powered by VillageAPI. Typing any village name automatically resolves the complete hierarchical address down to the state level.
            </p>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 rounded-xl bg-blue-700/50 backdrop-blur border border-blue-500/30">
                <div className="p-2 bg-blue-500 rounded-lg shrink-0">
                  <DatabaseIcon />
                </div>
                <div>
                  <h3 className="font-semibold text-white">600K+ Villages</h3>
                  <p className="text-sm text-blue-200 mt-1">Instant search across India's complete rural geography.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right pane - Form */}
        <div className="p-8 md:p-12 lg:pl-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-800">Contact Sales</h2>
            <p className="text-slate-500">Fill in your details and let our smart autocomplete handle the address.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* User Details */}
            <div className="grid grid-cols-1 gap-5">
              <div className="relative">
                <User className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                <input
                  required
                  type="text"
                  placeholder="Full Name"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                  value={formData.fullName}
                  onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                  <input
                    required
                    type="email"
                    placeholder="Email"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                  <input
                    type="tel"
                    placeholder="Phone"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <hr className="border-slate-200" />

            {/* Smart Address Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-500" />
                Smart Address Location
              </h3>

              <div className="relative" ref={dropdownRef}>
                <Search className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                {loading && <Loader2 className="absolute right-3 top-3 text-blue-500 w-5 h-5 animate-spin" />}
                <input
                  type="text"
                  placeholder="Search your Village/Area (e.g. Manibeli)..."
                  className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-slate-900 bg-white"
                  value={query}
                  onChange={e => {
                    setQuery(e.target.value);
                    setShowDropdown(true);
                    searchVillages(e.target.value);
                  }}
                  onFocus={() => setShowDropdown(true)}
                />
                
                {/* Autocomplete Dropdown */}
                {showDropdown && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-slate-100 max-h-60 overflow-y-auto z-50">
                    {suggestions.map((item) => (
                      <div
                        key={item.value}
                        onClick={() => handleSelect(item)}
                        className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                      >
                        <p className="font-semibold text-slate-800">{item.label}</p>
                        <p className="text-xs text-slate-500 truncate">{item.fullAddress}</p>
                      </div>
                    ))}
                  </div>
                )}
                {showDropdown && query.length >= 2 && suggestions.length === 0 && !loading && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-slate-100 p-4 text-center z-50 text-slate-500 text-sm">
                    No matching villages found
                  </div>
                )}
              </div>

              {/* Auto-filled read-only fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">Sub-District</label>
                  <input readOnly value={formData.subDistrict} className="w-full bg-slate-50 border border-slate-200 text-slate-600 rounded-md px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">District</label>
                  <input readOnly value={formData.district} className="w-full bg-slate-50 border border-slate-200 text-slate-600 rounded-md px-3 py-2 text-sm focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">State</label>
                  <input readOnly value={formData.state} className="w-full bg-slate-50 border border-slate-200 text-slate-600 rounded-md px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">Country</label>
                  <input readOnly value={formData.country} className="w-full bg-slate-50 border border-slate-200 text-slate-600 rounded-md px-3 py-2 text-sm focus:outline-none" />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className={`w-full py-3 rounded-lg text-white font-semibold flex items-center justify-center gap-2 transition-all ${
                submitSuccess ? "bg-green-500 hover:bg-green-600" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {submitSuccess ? (
                <>
                  <Check className="w-5 h-5" /> Registered!
                </>
              ) : (
                "Submit Inquiry"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function DatabaseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
      <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
      <path d="M3 5V19A9 3 0 0 0 21 19V5"></path>
      <path d="M3 12A9 3 0 0 0 21 12"></path>
    </svg>
  );
}
