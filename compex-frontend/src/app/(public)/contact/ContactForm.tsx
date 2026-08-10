"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Mail, Phone, MapPin, ArrowRight } from "lucide-react";
import Link from "next/link";

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
  const [submitted, setSubmitted] = useState(false);

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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (validate()) setSubmitted(true);
  }

  function set(field: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  if (submitted) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-[#e8eeff] rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail size={28} className="text-[#1769E0]" />
          </div>
          <h1 className="font-headline-lg text-[#0B1F3A] mb-4">Enquiry Received</h1>
          <p className="font-body-lg text-[#44474d] mb-8">
            Thank you for reaching out. Our team will get back to you shortly.
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block font-label-sm text-[#44474d] mb-1.5">Name *</label>
                  <input className={INPUT_CLS} placeholder="Your name" value={form.name} onChange={set("name")} />
                  {errors.name && <p className="font-body-sm text-red-500 mt-1">{errors.name}</p>}
                </div>
                <div>
                  <label className="block font-label-sm text-[#44474d] mb-1.5">Company *</label>
                  <input className={INPUT_CLS} placeholder="Company name" value={form.company} onChange={set("company")} />
                  {errors.company && <p className="font-body-sm text-red-500 mt-1">{errors.company}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block font-label-sm text-[#44474d] mb-1.5">Email *</label>
                  <input type="email" className={INPUT_CLS} placeholder="you@company.com" value={form.email} onChange={set("email")} />
                  {errors.email && <p className="font-body-sm text-red-500 mt-1">{errors.email}</p>}
                </div>
                <div>
                  <label className="block font-label-sm text-[#44474d] mb-1.5">Phone</label>
                  <input type="tel" className={INPUT_CLS} placeholder="+91 ..." value={form.phone} onChange={set("phone")} />
                </div>
              </div>
              <div>
                <label className="block font-label-sm text-[#44474d] mb-1.5">Subject</label>
                <select className={INPUT_CLS} value={form.subject} onChange={set("subject")}>
                  <option value="">Select a subject</option>
                  <option>Component Sourcing Enquiry</option>
                  <option>BOM Procurement</option>
                  <option>General Enquiry</option>
                  <option>Existing Order</option>
                </select>
              </div>
              <div>
                <label className="block font-label-sm text-[#44474d] mb-1.5">Message *</label>
                <textarea
                  className={`${INPUT_CLS} resize-none`}
                  rows={5}
                  placeholder="Describe your requirement..."
                  value={form.message}
                  onChange={set("message")}
                />
                {errors.message && <p className="font-body-sm text-red-500 mt-1">{errors.message}</p>}
              </div>
              <button
                type="submit"
                className="bg-[#1769E0] text-white px-8 py-4 rounded-lg font-label-md font-bold hover:bg-[#1257b8] transition-colors flex items-center gap-2"
              >
                Send Enquiry <ArrowRight size={18} />
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