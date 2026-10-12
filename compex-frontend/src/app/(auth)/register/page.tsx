import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import LoginPage from "../login/page";

export const metadata: Metadata = pageMetadata({
  title: "Create an Account",
  description: "Create a Compex Solution customer account to submit RFQs, track quotations and manage your BOMs.",
  path: "/register",
  noindex: true,
});


// Customer registration is intentionally presented alongside sign-in so users
// can switch to the existing account flow without losing the registration UI.
// Reusing this component keeps validation, API handling, and verification
// messaging aligned with the established /auth/register contract.
export default function RegisterPage() {
  return <LoginPage />;
}
