"use client";
import { useState } from "react";
import Link from "next/link";
import { orders } from "@/data/mock/orders";
import { StatusBadge } from "@/components/ui/StatusBadge";

const tabs = ["All", "Processing", "Procurement", "Shipped", "Delivered", "Cancelled"];

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState("All");

  const filtered = activeTab === "All"
    ? orders
    : orders.filter((o) => o.status.toLowerCase() === activeTab.toLowerCase());

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      <div>
        <h1 className="font-headline-lg text-[#111c2d]">My Orders</h1>
        <p className="font-body-md text-[#44474d] mt-1">{orders.length} total orders</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#f0f3ff] rounded-lg p-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded font-label-md text-sm whitespace-nowrap transition-colors ${
              activeTab === tab ? "bg-white text-[#0B1F3A] shadow-sm" : "text-[#44474d] hover:text-[#111c2d]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-[#E4E7EC] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="bg-[#f0f3ff]">
                {["Order #", "Date", "Items", "Total", "Payment", "Status", ""].map((h) => (
                  <th key={h} className="py-3 px-5 font-label-sm text-[#44474d] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EC]">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center font-body-md text-[#44474d]">No orders found</td></tr>
              ) : filtered.map((order) => (
                <tr key={order.id} className="hover:bg-[#f0f3ff]/50 transition-colors">
                  <td className="py-3 px-5">
                    <Link href={`/portal/orders/${order.id}`} className="font-mono-label text-[#1769E0] hover:underline font-medium">{order.number}</Link>
                  </td>
                  <td className="py-3 px-5 font-body-sm text-[#44474d]">{order.createdAt.split("T")[0]}</td>
                  <td className="py-3 px-5 font-body-sm text-[#111c2d]">{order.items.length}</td>
                  <td className="py-3 px-5 font-mono-label text-[#111c2d] font-medium">₹{order.grandTotal.toLocaleString()}</td>
                  <td className="py-3 px-5"><StatusBadge status={order.paymentStatus} /></td>
                  <td className="py-3 px-5"><StatusBadge status={order.status} /></td>
                  <td className="py-3 px-5">
                    <Link href={`/portal/orders/${order.id}`} className="font-label-sm text-[#1769E0] hover:underline text-xs">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}