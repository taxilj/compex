export interface Customer {
  id: string;
  company: string;
  initials: string;
  contact: string;
  email: string;
  phone: string;
  gstin: string;
  city: string;
  region: "North" | "South" | "West" | "East";
  salesperson: string;
  rfqCount: number;
  orderCount: number;
  revenueL: number; // in lakhs
  status: "active" | "inactive";
  joinedDate: string;
}

export const customers: Customer[] = [
  { id: "c1", company: "TechCorp Industries", initials: "TI", contact: "Rajesh Kumar", email: "rajesh@techcorp.in", phone: "+91 98765 43210", gstin: "27AAPFT3098R1ZD", city: "Mumbai", region: "West", salesperson: "Arjun", rfqCount: 12, orderCount: 8, revenueL: 24.5, status: "active", joinedDate: "2023-03-15" },
  { id: "c2", company: "L&T Heavy Engineering", initials: "LT", contact: "Priya Sharma", email: "priya.s@lnt.co.in", phone: "+91 98765 11223", gstin: "27AAACL1534F1ZQ", city: "Mumbai", region: "West", salesperson: "Sarah", rfqCount: 31, orderCount: 22, revenueL: 187.2, status: "active", joinedDate: "2022-09-01" },
  { id: "c3", company: "Tata Motors Ltd", initials: "TM", contact: "Anil Desai", email: "a.desai@tatamotors.com", phone: "+91 99887 12345", gstin: "27AAACT2727Q1ZW", city: "Pune", region: "West", salesperson: "Arjun", rfqCount: 45, orderCount: 38, revenueL: 342.8, status: "active", joinedDate: "2022-01-10" },
  { id: "c4", company: "Mahindra Electric", initials: "ME", contact: "Sonia Verma", email: "sonia@mahindra.com", phone: "+91 97654 32101", gstin: "27AABCM9790M1ZI", city: "Nashik", region: "West", salesperson: "Mike", rfqCount: 18, orderCount: 11, revenueL: 89.4, status: "active", joinedDate: "2023-06-20" },
  { id: "c5", company: "Bharat Forge Ltd", initials: "BF", contact: "Vikram Singh", email: "v.singh@bharatforge.com", phone: "+91 94567 89012", gstin: "27AABCB1421F1ZH", city: "Pune", region: "West", salesperson: "Sarah", rfqCount: 9, orderCount: 6, revenueL: 45.1, status: "active", joinedDate: "2023-11-05" },
  { id: "c6", company: "ISRO Satellite Centre", initials: "IS", contact: "Dr. Ramesh Nair", email: "r.nair@isro.gov.in", phone: "+91 80123 45678", gstin: "29AACTS8901F1ZK", city: "Bengaluru", region: "South", salesperson: "Mike", rfqCount: 7, orderCount: 4, revenueL: 18.6, status: "active", joinedDate: "2024-01-15" },
  { id: "c7", company: "Godrej & Boyce Mfg", initials: "GB", contact: "Mehul Patel", email: "mehul.p@godrej.com", phone: "+91 91234 56789", gstin: "27AABCG0123M1ZP", city: "Mumbai", region: "West", salesperson: "Arjun", rfqCount: 5, orderCount: 2, revenueL: 12.3, status: "inactive", joinedDate: "2024-03-08" },
  { id: "c8", company: "ABB India Ltd", initials: "AB", contact: "Lars Hansen", email: "l.hansen@abb.com", phone: "+91 80987 65432", gstin: "29AAACA0312Q1ZY", city: "Bengaluru", region: "South", salesperson: "Sarah", rfqCount: 22, orderCount: 17, revenueL: 134.7, status: "active", joinedDate: "2022-11-30" },
];