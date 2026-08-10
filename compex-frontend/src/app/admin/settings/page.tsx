"use client";
import { useState } from "react";
import { Save, Building2, Mail, Globe, Shield, Bell, Palette } from "lucide-react";

type TabKey = "company" | "email" | "integrations" | "security" | "notifications" | "appearance";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "company", label: "Company", icon: Building2 },
  { key: "email", label: "Email", icon: Mail },
  { key: "integrations", label: "Integrations", icon: Globe },
  { key: "security", label: "Security", icon: Shield },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "appearance", label: "Appearance", icon: Palette },
];

function Field({ label, type = "text", defaultValue, placeholder }: { label: string; type?: string; defaultValue?: string; placeholder?: string }) {
  return (
    <div>
      <label className="block font-label-sm text-[#44474d] text-sm mb-1.5">{label}</label>
      <input type={type} defaultValue={defaultValue} placeholder={placeholder} className="w-full px-3 py-2.5 bg-white border border-[#E4E7EC] rounded-lg text-sm text-[#111c2d] focus:outline-none focus:ring-2 focus:ring-[#1769E0] placeholder-[#44474d]/50" />
    </div>
  );
}

function Toggle({ label, description, defaultOn = false }: { label: string; description: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#E4E7EC] last:border-0">
      <div>
        <p className="font-label-sm text-[#111c2d] text-sm">{label}</p>
        <p className="font-body-sm text-[#44474d] text-xs mt-0.5">{description}</p>
      </div>
      <button onClick={() => setOn(!on)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${on ? "bg-[#1769E0]" : "bg-[#E4E7EC]"}`} aria-checked={on} role="switch">
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

function SaveBar() {
  return (
    <div className="flex justify-end pt-4 border-t border-[#E4E7EC]">
      <button className="flex items-center gap-2 bg-[#0B1F3A] text-white px-5 py-2.5 rounded-lg font-label-md text-sm hover:bg-[#0B1F3A]/90 transition-colors">
        <Save size={14} /> Save Changes
      </button>
    </div>
  );
}

function CompanyTab() {
  return (
    <div className="space-y-5">
      <h2 className="font-label-lg text-[#111c2d] font-semibold">Company Information</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Company Name" defaultValue="Compex Solutions Pvt. Ltd." />
        <Field label="GSTIN" defaultValue="29AABCC1234F1Z5" />
        <Field label="Website" defaultValue="https://compex.in" type="url" />
        <Field label="Support Email" defaultValue="support@compex.in" type="email" />
        <div className="md:col-span-2">
          <Field label="Registered Address" defaultValue="123, Electronics Industrial Area, Bengaluru – 560058" />
        </div>
        <Field label="PAN" defaultValue="AABCC1234F" />
        <Field label="Contact Phone" defaultValue="+91 80 4567 8901" type="tel" />
      </div>
      <SaveBar />
    </div>
  );
}

function EmailTab() {
  return (
    <div className="space-y-5">
      <h2 className="font-label-lg text-[#111c2d] font-semibold">Email Configuration</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="SMTP Host" defaultValue="smtp.compex.in" />
        <Field label="SMTP Port" defaultValue="587" />
        <Field label="SMTP User" defaultValue="noreply@compex.in" />
        <Field label="SMTP Password" type="password" defaultValue="••••••••••••" />
        <Field label="From Name" defaultValue="Compex Solutions" />
        <Field label="Reply-To" defaultValue="support@compex.in" type="email" />
      </div>
      <SaveBar />
    </div>
  );
}

function IntegrationsTab() {
  const integrations = [
    { name: "Tally ERP", description: "Sync invoices and ledger entries", connected: true },
    { name: "IndiaMART", description: "Import leads from IndiaMART portal", connected: false },
    { name: "TradeIndia", description: "Import leads from TradeIndia portal", connected: false },
    { name: "GSTIN API", description: "Auto-fill GSTIN details for customers", connected: true },
  ];
  return (
    <div className="space-y-5">
      <h2 className="font-label-lg text-[#111c2d] font-semibold">Third-Party Integrations</h2>
      <div className="space-y-3">
        {integrations.map((intg) => (
          <div key={intg.name} className="flex items-center justify-between p-4 bg-[#f0f3ff] rounded-lg">
            <div>
              <p className="font-label-sm text-[#0B1F3A] font-medium">{intg.name}</p>
              <p className="font-body-sm text-[#44474d] text-xs mt-0.5">{intg.description}</p>
            </div>
            <button className={`px-3 py-1.5 rounded font-label-sm text-xs ${intg.connected ? "bg-white border border-[#E4E7EC] text-[#F04438] hover:bg-[#FEF3F2]" : "bg-[#0B1F3A] text-white hover:bg-[#0B1F3A]/90"}`}>
              {intg.connected ? "Disconnect" : "Connect"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SecurityTab() {
  return (
    <div className="space-y-5">
      <h2 className="font-label-lg text-[#111c2d] font-semibold">Security Settings</h2>
      <Toggle label="Two-Factor Authentication" description="Require 2FA for all admin users" defaultOn />
      <Toggle label="Session Timeout" description="Auto-logout after 30 minutes of inactivity" defaultOn />
      <Toggle label="IP Allowlist" description="Restrict admin access to specific IP ranges" />
      <Toggle label="Audit Logging" description="Log all admin actions for compliance" defaultOn />
      <SaveBar />
    </div>
  );
}

function NotificationsTab() {
  return (
    <div className="space-y-5">
      <h2 className="font-label-lg text-[#111c2d] font-semibold">Notification Preferences</h2>
      <Toggle label="New RFQ Alert" description="Email when a new RFQ is submitted" defaultOn />
      <Toggle label="RFQ Assigned" description="Email when an RFQ is assigned to you" defaultOn />
      <Toggle label="Order Status Change" description="Email when an order status changes" defaultOn />
      <Toggle label="Payment Received" description="Email when a payment is marked received" defaultOn />
      <Toggle label="Low Stock Alert" description="Alert when a product availability drops to On Request" />
      <Toggle label="Weekly Summary" description="Weekly digest of activity and KPIs" defaultOn />
      <SaveBar />
    </div>
  );
}

function AppearanceTab() {
  return (
    <div className="space-y-5">
      <h2 className="font-label-lg text-[#111c2d] font-semibold">Appearance</h2>
      <div>
        <label className="block font-label-sm text-[#44474d] text-sm mb-3">Theme</label>
        <div className="flex gap-3">
          {["Light", "Dark", "System"].map((t) => (
            <label key={t} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="theme" defaultChecked={t === "Light"} className="accent-[#1769E0]" />
              <span className="font-label-sm text-[#111c2d] text-sm">{t}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="block font-label-sm text-[#44474d] text-sm mb-3">Sidebar Density</label>
        <div className="flex gap-3">
          {["Compact", "Comfortable"].map((d) => (
            <label key={d} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="density" defaultChecked={d === "Comfortable"} className="accent-[#1769E0]" />
              <span className="font-label-sm text-[#111c2d] text-sm">{d}</span>
            </label>
          ))}
        </div>
      </div>
      <SaveBar />
    </div>
  );
}

const TAB_CONTENT: Record<TabKey, React.ReactNode> = {
  company: <CompanyTab />,
  email: <EmailTab />,
  integrations: <IntegrationsTab />,
  security: <SecurityTab />,
  notifications: <NotificationsTab />,
  appearance: <AppearanceTab />,
};

export default function AdminSettingsPage() {
  const [active, setActive] = useState<TabKey>("company");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-lg text-[#111c2d]">System Settings</h1>
        <p className="font-body-md text-[#44474d]">Configure platform-wide preferences and integrations.</p>
      </div>
      <div className="flex gap-6">
        <nav className="w-48 shrink-0">
          <ul className="space-y-1">
            {TABS.map(({ key, label, icon: Icon }) => (
              <li key={key}>
                <button onClick={() => setActive(key)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left font-label-sm text-sm transition-colors ${active === key ? "bg-[#f0f3ff] text-[#0B1F3A] font-medium" : "text-[#44474d] hover:bg-[#f0f3ff]/60"}`}>
                  <Icon size={15} />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex-1 bg-white rounded-xl border border-[#E4E7EC] p-6 shadow-sm min-h-[400px]">
          {TAB_CONTENT[active]}
        </div>
      </div>
    </div>
  );
}