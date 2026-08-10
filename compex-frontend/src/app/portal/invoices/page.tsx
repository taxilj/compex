"use client";
import { useState } from "react";
import Link from "next/link";
import { invoices } from "@/data/mock/invoices";
import { StatusBadge } from "@/components/ui/StatusBadge";

const tabs = ["All", "Paid", "Pending", "Overdue"];

export default function InvoicesPage() {
  const [activeTab, setActiveTab] = useState("All");
  const filtered = activeTab === "All" ? invoices : invoices.filter((i) => i.status === activeTab.toLowerCase());

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      <div>
        <h1 className="font-headline-lg text-[#111c2d]">Invoices</h1>
        <p className="font-body-md text-[#44474d] mt-1">{invoices.length} total invoices</p>
      </div>
      <div className="flex gap-1 bg-[#f0f3ff] rounded-lg p-1 w-fit">
        {tabs.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded font-label-md text-sm transition-colors ${activeTab === tab ? "bg-white text-[#0B1F3A] shadow-sm" : "text-[#44474d] hover:text-[#111c2d]"}`}
          >{tab}</button>
        ))}
      </div>
      <div className="bg-white rounded-lg border border-[#E4E7EC] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead>
              <tr className="bg-[#f0f3ff]">
                {["Invoice #", "Date", "Order", "Amount", "Due Date", "Status", ""].map((h) => (
                  <th key={h} className="py-3 px-5 font-label-sm text-[#44474d] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EC]">
              {filtered.map((inv) => (
                <tr key={inv.id} className={`hover:bg-[#f0f3ff]/50 transition-colors ${inv.status === "overdue" ? "bg-[#F04438]/5" : ""}`}>
                  <td className="py-3 px-5">
                    <Link href={`/portal/invoices/${inv.id}`} className="font-mono-label text-[#1769E0] hover:underline font-medium">{inv.number}</Link>
                  </td>
                  <td className="py-3 px-5 font-body-sm text-[#44474d]">{inv.invoiceDate}</td>
                  <td className="py-3 px-5 font-mono-label text-[#44474d]">{inv.orderNumber}</td>
                  <td className="py-3 px-5 font-mono-label text-[#111c2d] font-medium">₹{inv.grandTotal.toLocaleString()}</td>
                  <td className="py-3 px-5 font-body-sm text-[#44474d]">{inv.dueDate}</td>
                  <td className="py-3 px-5"><StatusBadge status={inv.status} /></td>
                  <td className="py-3 px-5"><Link href={`/portal/invoices/${inv.id}`} className="font-label-sm text-[#1769E0] hover:underline text-xs">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}