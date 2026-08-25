"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Mail, Phone, MapPin, ArrowRight } from "lucide-react";
import Link from "next/link";
import { submitPublicLead } from "@/lib/api/leads";

const INPUT_CLS = "w-full border border-[#E4E7EC] rounded-lg px-4 py-3 font-body-md text-[#111c2d] placeholder:text-[#75777e] focus:outline-none focus:border-[#1769E0] focus:ring-1 focus:ring-[#1769E0] transition-colors";

interface FormData {
  name: string;
  company: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

const EMPTY: FormData = { name: "", company: "", email: "", phone: "", subject: "", message: "" };

export default function ContactForm() {
  const [form, setForm] = useState<FormData>(EMPTY);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [submittedReference, setSubmittedReference] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const submissionKey = useRef<string | undefined>(undefined);

  function validate(): boolean {
    const e: Partial<FormData> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.company.trim()) e.company = "Company is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email";
    if (!form.message.trim()) e.message = "Message is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      submissionKey.current ??= crypto.randomUUID();
      const result = await submitPublicLead({
        source: "CONTACT",
        contactName: form.name,
        contactEmail: form.email,
        contactPhone: form.phone || undefined,
        companyName: form.company,
        subject: form.subject || undefined,
        message: form.message,
        website,
      }, submissionKey.current);
      setSubmittedReference(result.referenceNumber);
    } catch {
      setSubmitError("We could not submit your enquiry. Please try again shortly.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function set(field: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  if (submittedReference) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-[#e8eeff] rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail size={28} className="text-[#1769E0]" />
          </div>
          <h1 className="font-headline-lg text-[#0B1F3A] mb-4">Enquiry Received</h1>
          <p className="font-body-lg text-[#44474d] mb-8">
            Thank you for reaching out. Your reference is <strong>{submittedReference}</strong>; our team will get back to you shortly.
          </p>
          <Link href="/" className="inline-flex items-center gap-2 text-[#1769E0] font-label-md hover:underline">
            Back to Home <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <section className="py-20 px-4 md:px-8 bg-[#0B1F3A]">
        <div className="max-w-[1280px] mx-auto">
          <p className="font-label-md text-[#1769E0] uppercase tracking-widest mb-4">Contact</p>
          <h1 className="font-display-lg text-white mb-6 max-w-3xl">Get in Touch</h1>
          <p className="font-body-lg text-[#7587a7] max-w-2xl">
            Send us your component requirement or enquiry and our team will respond promptly.
          </p>
        </div>
      </section>

      <section className="py-20 px-4 md:px-8">
        <div className="max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
            <h2 className="font-headline-lg text-[#0B1F3A] mb-8">Send an Enquiry</h2>
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <input
                aria-hidden="true"
                autoComplete="off"
                className="hidden"
                name="website"
                tabIndex={-1}
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="contact-name" className="block font-label-sm text-[#44474d] mb-1.5">Name *</label>
                  <input id="contact-name" className={INPUT_CLS} placeholder="Your name" value={form.name} onChange={set("name")} aria-invalid={!!errors.name} />
                  {errors.name && <p className="font-body-sm text-red-500 mt-1" role="alert">{errors.name}</p>}
                </div>
                <div>
                  <label htmlFor="contact-company" className="block font-label-sm text-[#44474d] mb-1.5">Company *</label>
                  <input id="contact-company" className={INPUT_CLS} placeholder="Company name" value={form.company} onChange={set("company")} aria-invalid={!!errors.company} />
                  {errors.company && <p className="font-body-sm text-red-500 mt-1" role="alert">{errors.company}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="contact-email" className="block font-label-sm text-[#44474d] mb-1.5">Email *</label>
                  <input id="contact-email" type="email" className={INPUT_CLS} placeholder="you@company.com" value={form.email} onChange={set("email")} aria-invalid={!!errors.email} />
                  {errors.email && <p className="font-body-sm text-red-500 mt-1" role="alert">{errors.email}</p>}
                </div>
                <div>
                  <label htmlFor="contact-phone" className="block font-label-sm text-[#44474d] mb-1.5">Phone</label>
                  <input id="contact-phone" type="tel" className={INPUT_CLS} placeholder="+91 ..." value={form.phone} onChange={set("phone")} />
                </div>
              </div>
              <div>
                  <label htmlFor="contact-subject" className="block font-label-sm text-[#44474d] mb-1.5">Subject</label>
                  <select id="contact-subject" className={INPUT_CLS} value={form.subject} onChange={set("subject")}>
                  <option value="">Select a subject</option>
                  <option>Component Sourcing Enquiry</option>
                  <option>BOM Procurement</option>
                  <option>General Enquiry</option>
                  <option>Existing Order</option>
                </select>
              </div>
              <div>
                  <label htmlFor="contact-message" className="block font-label-sm text-[#44474d] mb-1.5">Message *</label>
                  <textarea
                    id="contact-message"
                  className={`${INPUT_CLS} resize-none`}
                  rows={5}
                  placeholder="Describe your requirement..."
                  value={form.message}
                  onChange={set("message")}
                />
                  {errors.message && <p className="font-body-sm text-red-500 mt-1" role="alert">{errors.message}</p>}
                </div>
              {submitError && <p className="font-body-sm text-red-500" role="alert">{submitError}</p>}
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#1769E0] text-white px-8 py-4 rounded-lg font-label-md font-bold hover:bg-[#1257b8] transition-colors flex items-center gap-2"
              >
                {isSubmitting ? "Sending…" : "Send Enquiry"} <ArrowRight size={18} />
              </button>
            </form>
          </div>

          <div className="space-y-8">
            <div>
              <h2 className="font-headline-sm text-[#0B1F3A] mb-6">Contact Details</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Mail size={20} className="text-[#1769E0] mt-0.5 shrink-0" />
                  <div>
                    <p className="font-label-sm text-[#44474d] uppercase mb-0.5">Email</p>
                    <p className="font-body-md text-[#111c2d]">info@compexsolution.com</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone size={20} className="text-[#1769E0] mt-0.5 shrink-0" />
                  <div>
                    <p className="font-label-sm text-[#44474d] uppercase mb-0.5">Phone</p>
                    <p className="font-body-md text-[#111c2d]">Available on request</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin size={20} className="text-[#1769E0] mt-0.5 shrink-0" />
                  <div>
                    <p className="font-label-sm text-[#44474d] uppercase mb-0.5">Location</p>
                    <p className="font-body-md text-[#111c2d]">India</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#f0f3ff] rounded-xl p-6">
              <h3 className="font-headline-sm text-[#0B1F3A] mb-3">Need a Quote?</h3>
              <p className="font-body-md text-[#44474d] mb-4">
                For component sourcing, use our dedicated RFQ form for faster response.
              </p>
              <Link
                href="/request-quote"
                className="inline-flex items-center gap-2 bg-[#1769E0] text-white px-6 py-3 rounded-lg font-label-md hover:bg-[#1257b8] transition-colors"
              >
                Request a Quote <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
