"use client";
import { useState } from "react";
import { TrendingUp, TrendingDown, Package, FileText, Users, DollarSign } from "lucide-react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const revenueData = [28, 35, 42, 38, 55, 61, 58, 72, 68, 75, 82, 90];
const rfqData = [12, 18, 22, 19, 28, 31, 27, 35, 33, 38, 42, 45];

const topProducts = [
  { mpn: "STM32F103C8T6", revenue: 8.2, units: 1240 },
  { mpn: "STM32F407VGT6", revenue: 6.8, units: 890 },
  { mpn: "TMS320F28335", revenue: 5.4, units: 340 },
  { mpn: "LPC1768FBD100", revenue: 4.1, units: 620 },
  { mpn: "STM32G431CBT6", revenue: 3.7, units: 510 },
];

const topCustomers = [
  { company: "L&T Heavy Engineering", revenue: 12.4, orders: 8 },
  { company: "Tata Motors Ltd", revenue: 9.8, orders: 6 },
  { company: "Mahindra Electric", revenue: 7.3, orders: 5 },
  { company: "Bharat Forge Ltd", revenue: 6.1, orders: 4 },
  { company: "ABB India Ltd", revenue: 4.9, orders: 3 },
];

function MiniBar({ value, max }: { value: number; max: number }) {
  return (
    <div className="w-full h-1.5 bg-[#E4E7EC] rounded-full overflow-hidden">
      <div className="h-full bg-[#1769E0] rounded-full" style={{ width: `${(value / max) * 100}%` }} />
    </div>
  );
}

function SparkLine({ data, color = "#1769E0" }: { data: number[]; color?: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const h = 48;
  const w = 200;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export default function AdminReportsPage() {
  const [period, setPeriod] = useState("12m");

  const kpis = [
    { label: "Total Revenue", value: "₹2.84 Cr", change: "+18.4%", up: true, icon: DollarSign },
    { label: "Total Orders", value: "128", change: "+12.1%", up: true, icon: Package },
    { label: "Total RFQs", value: "408", change: "+9.7%", up: true, icon: FileText },
    { label: "Active Customers", value: "34", change: "-2.8%", up: false, icon: Users },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-headline-lg text-[#111c2d]">Reports & Analytics</h1>
          <p className="font-body-md text-[#44474d]">Business performance overview and key metrics.</p>
        </div>
        <div className="flex gap-1 bg-[#f0f3ff] p-1 rounded-lg">
          {["3m", "6m", "12m", "YTD"].map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 rounded font-label-sm text-xs transition-colors ${period === p ? "bg-white text-[#0B1F3A] shadow-sm" : "text-[#44474d] hover:text-[#0B1F3A]"}`}>{p}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, change, up, icon: Icon }) => (
          <div key={label} className="bg-white rounded-xl border border-[#E4E7EC] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="font-body-sm text-[#44474d] text-sm">{label}</span>
              <div className="w-8 h-8 bg-[#f0f3ff] rounded-lg flex items-center justify-center">
                <Icon size={15} className="text-[#1769E0]" />
              </div>
            </div>
            <p className="font-headline-md text-[#111c2d] text-2xl font-bold mb-1">{value}</p>
            <div className={`flex items-center gap-1 text-xs font-label-sm ${up ? "text-[#12B76A]" : "text-[#F04438]"}`}>
              {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {change} vs last period
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[#E4E7EC] p-5 shadow-sm">
          <h2 className="font-label-md text-[#0B1F3A] font-semibold mb-4">Revenue Trend (₹ Lakhs)</h2>
          <div className="mb-3">
            <SparkLine data={revenueData} color="#1769E0" />
          </div>
          <div className="flex justify-between">
            {MONTHS.map((m) => (
              <span key={m} className="font-body-sm text-[#44474d] text-xs">{m.slice(0, 1)}</span>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E4E7EC] p-5 shadow-sm">
          <h2 className="font-label-md text-[#0B1F3A] font-semibold mb-4">RFQ Volume</h2>
          <div className="mb-3">
            <SparkLine data={rfqData} color="#7B61FF" />
          </div>
          <div className="flex justify-between">
            {MONTHS.map((m) => (
              <span key={m} className="font-body-sm text-[#44474d] text-xs">{m.slice(0, 1)}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[#E4E7EC] p-5 shadow-sm">
          <h2 className="font-label-md text-[#0B1F3A] font-semibold mb-4">Top Products by Revenue</h2>
          <div className="space-y-4">
            {topProducts.map((p) => (
              <div key={p.mpn}>
                <div className="flex justify-between mb-1">
                  <span className="font-mono-label text-[#0B1F3A] text-sm">{p.mpn}</span>
                  <span className="font-label-sm text-[#44474d] text-sm">₹{p.revenue}L · {p.units.toLocaleString()} units</span>
                </div>
                <MiniBar value={p.revenue} max={topProducts[0].revenue} />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E4E7EC] p-5 shadow-sm">
          <h2 className="font-label-md text-[#0B1F3A] font-semibold mb-4">Top Customers by Revenue</h2>
          <div className="space-y-4">
            {topCustomers.map((c) => (
              <div key={c.company}>
                <div className="flex justify-between mb-1">
                  <span className="font-body-sm text-[#0B1F3A] text-sm">{c.company}</span>
                  <span className="font-label-sm text-[#44474d] text-sm">₹{c.revenue}L · {c.orders} orders</span>
                </div>
                <MiniBar value={c.revenue} max={topCustomers[0].revenue} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}