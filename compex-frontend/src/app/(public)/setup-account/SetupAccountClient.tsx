"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle, XCircle } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api/client";

export function SetupAccountClient({ token }: { token?: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(token ? null : "This account-setup link is missing its token.");
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!token || loading) return;
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const result = await apiFetch<{ message: string }>("/auth/complete-account-setup", { method: "POST", body: JSON.stringify({ token, password }) });
      setComplete(true);
      setMessage(result.message);
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "Unable to set up this account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-[#E4E7EC] bg-white p-8 shadow-sm">
      {complete ? <CheckCircle className="mx-auto mb-4 text-[#12B76A]" size={40} /> : message && !token ? <XCircle className="mx-auto mb-4 text-[#F04438]" size={40} /> : null}
      <h1 className="text-center font-headline-lg text-[#0B1F3A]">Set up your customer account</h1>
      {complete ? <><p className="mt-3 text-center font-body-md text-[#44474d]">{message}</p><div className="mt-6 text-center"><Link href="/login" className="rounded bg-[#1769E0] px-5 py-2.5 font-label-md text-white hover:bg-[#1257b8]">Sign in</Link></div></> : <form onSubmit={submit} className="mt-6 space-y-4">
        <p className="font-body-sm text-[#44474d]">Choose a password with at least 10 characters, including an uppercase letter and a number.</p>
        <label className="block"><span className="font-label-md text-[#44474d]">Password</span><input aria-label="Password" type="password" autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 w-full rounded border border-[#E4E7EC] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1769E0]" /></label>
        <label className="block"><span className="font-label-md text-[#44474d]">Confirm password</span><input aria-label="Confirm password" type="password" autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1.5 w-full rounded border border-[#E4E7EC] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1769E0]" /></label>
        {message && <p role="alert" className="rounded border border-[#F04438]/30 bg-[#FEF3F2] px-3 py-2 text-sm text-[#B42318]">{message}</p>}
        <button disabled={!token || loading} className="w-full rounded bg-[#1769E0] py-3 font-label-md text-white hover:bg-[#1257b8] disabled:opacity-60">{loading ? "Activating account…" : "Activate account"}</button>
      </form>}
    </div>
  );
}
