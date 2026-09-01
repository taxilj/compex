"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { apiFetch } from "@/lib/api/client";

export function VerifyEmailClient({ token }: { token?: string }) {
  const [state, setState] = useState<"loading" | "success" | "error">(token ? "loading" : "error");
  const [message, setMessage] = useState(token ? "Verifying your email…" : "The verification link is missing its token.");
  const firedRef = useRef(false);

  useEffect(() => {
    if (!token || firedRef.current) return;
    firedRef.current = true;
    apiFetch<{ message: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then((result) => {
        setState("success");
        setMessage(result.message || "Your email has been verified.");
      })
      .catch(() => {
        setState("error");
        setMessage("This verification link is invalid, expired, or has already been used.");
      });
  }, [token]);

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-[#E4E7EC] bg-white p-8 text-center shadow-sm">
      {state === "loading" && <Loader2 className="mx-auto mb-4 animate-spin text-[#1769E0]" size={40} />}
      {state === "success" && <CheckCircle className="mx-auto mb-4 text-[#12B76A]" size={40} />}
      {state === "error" && <XCircle className="mx-auto mb-4 text-[#F04438]" size={40} />}
      <h1 className="font-headline-lg text-[#0B1F3A]">{state === "success" ? "Email Verified" : state === "loading" ? "Verifying Email" : "Verification Failed"}</h1>
      <p className="mt-3 font-body-md text-[#44474d]">{message}</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/login" className="rounded bg-[#1769E0] px-5 py-2.5 font-label-md text-white hover:bg-[#1257b8]">Sign in</Link>
        {state === "error" && <Link href="/contact" className="rounded border border-[#E4E7EC] px-5 py-2.5 font-label-md text-[#0B1F3A] hover:bg-[#f0f3ff]">Contact support</Link>}
      </div>
    </div>
  );
}
