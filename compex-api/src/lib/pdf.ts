import PDFDocument from "pdfkit";

export interface QuotationPdfData {
  quotationNumber: string;
  customerName: string;
  companyName: string;
  validUntil: Date;
  currency: string;
  items: {
    partNumber: string;
    description: string;
    quantity: number;
    unitPrice: string;
    taxRate: string;
    lineTotal: string;
  }[];
  subtotal: string;
  tax: string;
  total: string;
  deliveryTerms?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
}

export function generateQuotationPdf(data: QuotationPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = 595 - 100;
    const gray = "#555555";
    const dark = "#1a1a1a";
    const accent = "#1d4ed8";

    doc.fontSize(20).fillColor(accent).text("Compex Solution", 50, 50);
    doc.fontSize(9).fillColor(gray).text("Industrial Sourcing & Procurement", 50, 74);
    doc.fontSize(9).fillColor(gray).text("contact@compexsolution.com", 50, 86);

    doc.fontSize(22).fillColor(dark).text("QUOTATION", 400, 50, { align: "right" });
    doc.fontSize(10).fillColor(gray).text(data.quotationNumber, 400, 76, { align: "right" });
    doc.fontSize(9).fillColor(gray).text(`Date: ${new Date().toLocaleDateString("en-IN")}`, 400, 90, { align: "right" });
    doc.fontSize(9).fillColor(gray).text(`Valid Until: ${data.validUntil.toLocaleDateString("en-IN")}`, 400, 103, { align: "right" });

    doc.moveTo(50, 120).lineTo(545, 120).strokeColor("#e5e7eb").stroke();

    doc.fontSize(9).fillColor(gray).text("BILL TO", 50, 135);
    doc.fontSize(11).fillColor(dark).text(data.companyName, 50, 148);
    doc.fontSize(10).fillColor(gray).text(data.customerName, 50, 162);

    const tableTop = 210;
    doc.rect(50, tableTop, W, 22).fill("#f3f4f6");
    doc.fontSize(9).fillColor(gray);
    doc.text("ITEM / PART NO.", 55, tableTop + 7);
    doc.text("QTY", 320, tableTop + 7, { width: 40, align: "right" });
    doc.text("UNIT PRICE", 365, tableTop + 7, { width: 70, align: "right" });
    doc.text("TAX %", 440, tableTop + 7, { width: 40, align: "right" });
    doc.text("TOTAL", 485, tableTop + 7, { width: 60, align: "right" });

    let y = tableTop + 28;
    for (const item of data.items) {
      doc.fontSize(9).fillColor(dark).text(item.partNumber, 55, y, { width: 130 });
      doc.fontSize(8).fillColor(gray).text(item.description, 55, y + 12, { width: 255 });
      doc.fontSize(9).fillColor(dark).text(String(item.quantity), 320, y, { width: 40, align: "right" });
      doc.text(`${data.currency} ${item.unitPrice}`, 365, y, { width: 70, align: "right" });
      doc.text(`${item.taxRate}%`, 440, y, { width: 40, align: "right" });
      doc.text(`${data.currency} ${item.lineTotal}`, 485, y, { width: 60, align: "right" });
      y += 36;
      doc.moveTo(50, y - 4).lineTo(545, y - 4).strokeColor("#f3f4f6").stroke();
    }

    y += 10;
    doc.fontSize(9).fillColor(gray).text("Subtotal:", 400, y);
    doc.fillColor(dark).text(`${data.currency} ${data.subtotal}`, 485, y, { width: 60, align: "right" });
    y += 16;
    doc.fillColor(gray).text("Tax:", 400, y);
    doc.fillColor(dark).text(`${data.currency} ${data.tax}`, 485, y, { width: 60, align: "right" });
    y += 16;
    doc.rect(395, y, 150, 22).fill(accent);
    doc.fontSize(10).fillColor("#ffffff").text("TOTAL:", 400, y + 6);
    doc.text(`${data.currency} ${data.total}`, 485, y + 6, { width: 60, align: "right" });

    y += 40;
    if (data.deliveryTerms) {
      doc.fontSize(9).fillColor(gray).text(`Delivery Terms: `, 50, y, { continued: true });
      doc.fillColor(dark).text(data.deliveryTerms);
      y += 14;
    }
    if (data.paymentTerms) {
      doc.fontSize(9).fillColor(gray).text(`Payment Terms: `, 50, y, { continued: true });
      doc.fillColor(dark).text(data.paymentTerms);
      y += 14;
    }
    if (data.notes) {
      doc.fontSize(9).fillColor(gray).text("Notes: ", 50, y, { continued: true });
      doc.fillColor(dark).text(data.notes);
    }

    const pageHeight = 842;
    doc.fontSize(8).fillColor(gray).text("This quotation is valid for the period stated above. All prices are subject to change thereafter.", 50, pageHeight - 60, { width: W, align: "center" });
    doc.text("Compex Solution — contact@compexsolution.com", 50, pageHeight - 48, { width: W, align: "center" });

    doc.end();
  });
}
