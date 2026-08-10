export interface Vendor {
  id: string;
  company: string;
  initials: string;
  contact: string;
  email: string;
  country: string;
  categories: string[];
  rating: number; // 1-5
  orderCount: number;
  totalValueL: number; // in lakhs
  status: "active" | "inactive" | "pending";
  leadTimeDays: number;
}

export const vendors: Vendor[] = [
  { id: "v1", company: "STMicroelectronics AG", initials: "ST", contact: "Marc Dubois", email: "m.dubois@st.com", country: "Switzerland", categories: ["MCUs", "Power ICs", "Sensors"], rating: 5, orderCount: 142, totalValueL: 892.4, status: "active", leadTimeDays: 14 },
  { id: "v2", company: "Texas Instruments Inc", initials: "TI", contact: "James Wilson", email: "j.wilson@ti.com", country: "USA", categories: ["DSPs", "Analog ICs", "MCUs"], rating: 5, orderCount: 98, totalValueL: 634.1, status: "active", leadTimeDays: 21 },
  { id: "v3", company: "NXP Semiconductors", initials: "NX", contact: "Peter van Berg", email: "p.vanberg@nxp.com", country: "Netherlands", categories: ["MCUs", "RF ICs", "Security"], rating: 4, orderCount: 67, totalValueL: 421.8, status: "active", leadTimeDays: 18 },
  { id: "v4", company: "Infineon Technologies", initials: "IF", contact: "Klaus Weber", email: "k.weber@infineon.com", country: "Germany", categories: ["Power Semiconductors", "MCUs"], rating: 4, orderCount: 54, totalValueL: 318.5, status: "active", leadTimeDays: 28 },
  { id: "v5", company: "Mouser Electronics", initials: "MO", contact: "Sarah Johnson", email: "s.johnson@mouser.com", country: "USA", categories: ["Distribution", "All Categories"], rating: 4, orderCount: 203, totalValueL: 1204.7, status: "active", leadTimeDays: 7 },
  { id: "v6", company: "Arrow Electronics", initials: "AE", contact: "David Park", email: "d.park@arrow.com", country: "USA", categories: ["Distribution", "All Categories"], rating: 3, orderCount: 89, totalValueL: 567.2, status: "active", leadTimeDays: 10 },
  { id: "v7", company: "Shenzhen IC Depot", initials: "SD", contact: "Wei Zhang", email: "w.zhang@icdepot.cn", country: "China", categories: ["Passive Components", "Connectors"], rating: 3, orderCount: 31, totalValueL: 89.4, status: "active", leadTimeDays: 35 },
  { id: "v8", company: "Avnet India Pvt Ltd", initials: "AV", contact: "Ravi Menon", email: "r.menon@avnet.in", country: "India", categories: ["Distribution", "All Categories"], rating: 4, orderCount: 76, totalValueL: 445.3, status: "pending", leadTimeDays: 5 },
];