import Link from "next/link";

export function UnavailableWorkflow({ title, backHref }: { title: string; backHref: "/admin" | "/portal" }) {
  return (
    <section className="mx-auto max-w-2xl space-y-4 rounded-lg border border-[#E4E7EC] bg-white p-6">
      <h1 className="font-headline-lg text-[#111c2d]">{title}</h1>
      <p className="font-body-md text-[#44474d]">Not available yet.</p>
      <p className="font-body-sm text-[#44474d]">This workflow is not enabled. No order, invoice or shipment records are shown here.</p>
      <Link href={backHref} className="inline-block font-label-md text-[#1769E0] underline">Back to dashboard</Link>
    </section>
  );
}
