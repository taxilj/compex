import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { SetupAccountClient } from "./SetupAccountClient";

export const metadata: Metadata = pageMetadata({
  title: "Set Up Your Account",
  description: "Confirm your email and choose a password to activate your Compex Solution customer account.",
  path: "/setup-account",
  noindex: true,
});


export default async function SetupAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <main className="px-4 py-20 md:px-8"><SetupAccountClient token={token} /></main>;
}
