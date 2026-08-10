import type { Shipment } from "@/types";

export const shipments: Shipment[] = [
  {
    id: "shp-1",
    trackingNumber: "CXSHP-2024-001",
    orderId: "ord-1",
    orderNumber: "ORD-2024",
    carrier: "DHL Express",
    origin: "Shenzhen, China",
    destination: "Pune, India",
    eta: "2026-08-15",
    status: "in_transit",
    documents: [
      { name: "Commercial Invoice", type: "PDF" },
      { name: "Packing List", type: "PDF" },
      { name: "Bill of Lading", type: "PDF" },
    ],
    events: [
      { date: "2026-08-01T10:00:00Z", location: "Shenzhen, China", description: "Shipment picked up from supplier", completed: true },
      { date: "2026-08-02T06:00:00Z", location: "Hong Kong Airport", description: "Departed origin gateway", completed: true },
      { date: "2026-08-03T14:00:00Z", location: "Delhi Air Cargo, India", description: "Arrived at destination country", completed: true },
      { date: "2026-08-04T09:00:00Z", location: "Delhi Customs", description: "Customs clearance in progress", completed: true },
      { date: "2026-08-05T00:00:00Z", location: "Pune Hub", description: "In transit to delivery address", completed: false },
      { date: "2026-08-15T00:00:00Z", location: "Pune, Maharashtra", description: "Estimated delivery", completed: false },
    ],
  },
  {
    id: "shp-2",
    trackingNumber: "CXSHP-2024-002",
    orderId: "ord-3",
    orderNumber: "ORD-2010",
    carrier: "FedEx International",
    origin: "Dallas, USA",
    destination: "Bangalore, India",
    eta: "2026-07-20",
    status: "delivered",
    documents: [
      { name: "Commercial Invoice", type: "PDF" },
      { name: "Packing List", type: "PDF" },
      { name: "Airway Bill", type: "PDF" },
    ],
    events: [
      { date: "2026-07-08T10:00:00Z", location: "Dallas, USA", description: "Shipment picked up", completed: true },
      { date: "2026-07-10T08:00:00Z", location: "Memphis, USA", description: "Departed origin hub", completed: true },
      { date: "2026-07-12T18:00:00Z", location: "Bangalore Airport", description: "Arrived in India", completed: true },
      { date: "2026-07-13T11:00:00Z", location: "Bangalore Customs", description: "Customs cleared", completed: true },
      { date: "2026-07-20T14:30:00Z", location: "Electronic City, Bangalore", description: "Delivered", completed: true },
    ],
  },
];
