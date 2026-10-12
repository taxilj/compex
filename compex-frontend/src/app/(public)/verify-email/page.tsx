import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { VerifyEmailClient } from "./VerifyEmailClient";

export const metadata: Metadata = pageMetadata({
  title: "Verify Your Email",
  description: "Verify your email address to activate your Compex Solution account.",
  path: "/verify-email",
  noindex: true,
});


export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <main className="px-4 py-20 md:px-8">
      <VerifyEmailClient token={token} />
    </main>
  );
}
