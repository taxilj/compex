"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock } from "lucide-react";
import { login, register } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

export default function LoginPage() {
  const router = useRouter();
  const [showPwd, setShowPwd] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "", remember: false });
  const [regForm, setRegForm] = useState({
    companyName: "", contactPerson: "", email: "", phone: "", gstin: "", city: "", password: "",
  });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      const result = await login(loginForm.email, loginForm.password);
      router.push(result.user.role === "CUSTOMER" ? "/portal" : "/admin");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 429) setLoginError("Too many attempts. Please wait and try again.");
        else if (err.statusCode === 401) setLoginError("Invalid email or password.");
        else if (err.statusCode === 422) setLoginError(err.message || "Please check your input and try again.");
        else setLoginError(err.message || "Sign in failed. Please try again.");
      } else {
        setLoginError("Network error. Please check your connection.");
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegLoading(true);
    try {
      const parts = regForm.contactPerson.trim().split(" ");
      const firstName = parts[0] ?? regForm.contactPerson;
      const lastName = parts.slice(1).join(" ") || "-";
      await register({
        firstName,
        lastName,
        email: regForm.email,
        password: regForm.password,
        companyName: regForm.companyName,
        phone: regForm.phone,
        gstin: regForm.gstin || undefined,
        city: regForm.city || undefined,
      });
      setRegSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 429) setRegError("Too many attempts. Please wait and try again.");
        else if (err.statusCode === 409) setRegError("An account with this email already exists.");
        else if (err.statusCode === 422) setRegError("Please check your input. Password must be at least 10 characters with an uppercase letter and a number.");
        else setRegError(err.message || "Registration failed. Please try again.");
      } else {
        setRegError("Network error. Please check your connection.");
      }
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[1100px] flex flex-col md:flex-row shadow-2xl rounded-xl overflow-hidden bg-white border border-[#E4E7EC]">
      {/* Login panel */}
      <div id="sign-in" className="w-full md:w-[42%] bg-[#f0f3ff] p-10 flex flex-col justify-center border-b md:border-b-0 md:border-r border-[#E4E7EC]">
        <div className="max-w-sm mx-auto w-full">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 rounded bg-[#0B1F3A] flex items-center justify-center">
                <span className="text-white font-bold text-sm">CX</span>
              </div>
              <span className="font-headline-sm text-[#0B1F3A]">Compex Solution</span>
            </div>
            <h1 className="font-headline-lg text-[#111c2d] mb-2">Welcome Back</h1>
            <p className="font-body-md text-[#44474d]">Access your industrial procurement dashboard.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block font-label-md text-[#44474d] mb-1.5" htmlFor="login-email">Business Email</label>
              <input
                id="login-email"
                type="email"
                placeholder="user@company.com"
                required
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                className="w-full bg-white text-[#111c2d] px-4 py-3 rounded-lg border border-[#E4E7EC] outline-none focus:border-[#1769E0] focus:ring-1 focus:ring-[#1769E0] transition-colors"
              />
            </div>
            <div>
              <label className="block font-label-md text-[#44474d] mb-1.5" htmlFor="login-pwd">Password</label>
              <div className="relative">
                <input
                  id="login-pwd"
                  type={showPwd ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="w-full bg-white text-[#111c2d] px-4 py-3 pr-12 rounded-lg border border-[#E4E7EC] outline-none focus:border-[#1769E0] focus:ring-1 focus:ring-[#1769E0] transition-colors"
                />
                <button type="button" aria-label={showPwd ? "Hide password" : "Show password"} onClick={() => setShowPwd(!showPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#44474d]">
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={loginForm.remember}
                  onChange={(e) => setLoginForm({ ...loginForm, remember: e.target.checked })}
                  className="w-4 h-4 accent-[#0B1F3A]"
                />
                <span className="font-body-sm text-[#44474d]">Remember Me</span>
              </label>
              <Link href="/contact" className="font-label-sm text-[#1769E0] hover:underline">Need sign-in help?</Link>
            </div>
            {loginError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{loginError}</p>
            )}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-[#0B1F3A] text-white py-3 rounded-lg font-label-md hover:bg-[#0B1F3A]/90 transition-colors mt-2 disabled:opacity-60"
            >
              {loginLoading ? "Signing in…" : "Sign In to Dashboard"}
            </button>
          </form>

          <div className="mt-8 flex items-center gap-2 text-[#44474d]/60 font-label-sm">
            <Lock size={14} />
            <span>Secure Encrypted Connection</span>
          </div>
        </div>
      </div>

      {/* Register panel */}
      <div className="w-full md:w-[58%] bg-white p-10 flex flex-col justify-center">
        <div className="max-w-xl mx-auto w-full">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="font-headline-lg text-[#111c2d] mb-1">New Vendor Registration</h2>
              <p className="font-body-md text-[#44474d]">Join our enterprise supply chain network.</p>
            </div>
            <span className="hidden sm:flex items-center gap-1 bg-[#f0f3ff] border border-[#E4E7EC] text-[#44474d] px-3 py-1 rounded-full font-label-sm text-xs">
              B2B Portal
            </span>
          </div>

          {regSuccess ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <p className="font-label-md text-green-700 mb-2">Account created successfully!</p>
              <p className="font-body-sm text-green-600">Email verification is required before sign-in. If the verification message does not arrive, contact support.</p>
            </div>
          ) : (
            <form noValidate onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: "Company Name *", name: "companyName", type: "text", placeholder: "Your Company Pvt. Ltd.", col: 2 },
                { label: "Contact Person *", name: "contactPerson", type: "text", placeholder: "Full Name" },
                { label: "Business Email *", name: "email", type: "email", placeholder: "procurement@company.in" },
                { label: "Phone *", name: "phone", type: "tel", placeholder: "+91 98765 43210" },
                { label: "GSTIN", name: "gstin", type: "text", placeholder: "27AABCT1234H1Z5" },
                { label: "City *", name: "city", type: "text", placeholder: "Mumbai" },
                { label: "Password *", name: "password", type: "password", placeholder: "Min. 10 characters" },
              ].map((field) => (
                <div key={field.name} className={field.col === 2 ? "col-span-full" : ""}>
                  <label className="block font-label-md text-[#44474d] mb-1.5">{field.label}</label>
                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={regForm[field.name as keyof typeof regForm]}
                    onChange={(e) => setRegForm({ ...regForm, [field.name]: e.target.value })}
                    className="w-full bg-[#f9f9ff] border border-[#E4E7EC] rounded px-4 py-3 font-body-md text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#1769E0] focus:border-[#1769E0]"
                  />
                </div>
              ))}
              {regError && (
                <div className="col-span-full">
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{regError}</p>
                </div>
              )}
              <div className="col-span-full">
                <button
                  type="submit"
                  disabled={regLoading}
                  className="w-full bg-[#1769E0] text-white py-3 rounded-lg font-label-md font-bold hover:bg-[#1257b8] transition-colors disabled:opacity-60"
                >
                  {regLoading ? "Creating account…" : "Create Account"}
                </button>
              </div>
            </form>
          )}

          <p className="font-body-sm text-[#44474d] text-center mt-4">
            Already registered?{" "}
            <Link href="#sign-in" className="text-[#1769E0] hover:underline">Sign in here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
