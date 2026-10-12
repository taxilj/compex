import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import ContactForm from "./ContactForm";

export const metadata: Metadata = pageMetadata({
  title: "Contact Us | Compex Solution",
  description: "Contact Compex Solution for electronic component sourcing enquiries, BOM procurement and import support. Send an enquiry or call the sales team.",
  path: "/contact",
});

export default function ContactPage() {
  return <ContactForm />;
}