import type { Task } from "@/types";

export const tasks: Task[] = [
  { id: "t1", title: "Follow up on RQ-8924 supplier quotes", assignedTo: "Arjun R.", dueDate: "2026-08-11", priority: "high", relatedTo: "RQ-8924", completed: false },
  { id: "t2", title: "Customs documentation for ORD-2024", assignedTo: "Sarah K.", dueDate: "2026-08-12", priority: "high", relatedTo: "ORD-2024", completed: false },
  { id: "t3", title: "Send quote QT-4521 to TechCorp", assignedTo: "Mike J.", dueDate: "2026-08-10", priority: "medium", relatedTo: "QT-4521", completed: false },
  { id: "t4", title: "Review L&T Heavy Eng RFQ requirements", assignedTo: "Sarah K.", dueDate: "2026-08-13", priority: "high", relatedTo: "RQ-8923", completed: false },
  { id: "t5", title: "Process payment receipt for INV-2024-089", assignedTo: "Arjun R.", dueDate: "2026-08-10", priority: "medium", relatedTo: "INV-2024-089", completed: true },
  { id: "t6", title: "Update supplier database — Q3 pricing", assignedTo: "Mike J.", dueDate: "2026-08-15", priority: "low", completed: false },
];
