export function downloadInvoicePDF(invoiceId: string, invoiceNumber: number) {
  const link = document.createElement('a');
  link.href = `/api/invoices/${invoiceId}/download`;
  link.download = `invoice-${invoiceNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
