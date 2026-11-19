import Link from "next/link";

export function UnavailableWorkflow({
  title,
  backHref,
}: {
  title: string;
  backHref: "/admin" | "/portal";
}) {
  return (
    <section className="mx-auto max-w-2xl space-y-4 rounded-lg border border-[#E4E7EC] bg-white p-6">
      <h1 className="font-headline-lg text-[#111c2d]">{title}</h1>
      <p className="font-body-md text-[#44474d]">
        Please contact Compex for these documents.
      </p>
      <p className="font-body-sm text-[#44474d]">
        {backHref === "/admin"
          ? "Official invoices, GST and accounting are managed in ERPNext. Its connection is pending; no local financial records are created here."
          : "Our team can help with invoices, payment confirmations and shipment documents. Your enquiries and RFQs remain available in the dashboard."}
      </p>
      <Link
        href="/contact"
        className="inline-block font-label-md text-[#1769E0] underline mr-4"
      >
        Contact Compex
      </Link>
      <Link
        href={backHref}
        className="inline-block font-label-md text-[#1769E0] underline"
      >
        Back to dashboard
      </Link>
    </section>
  );
}
