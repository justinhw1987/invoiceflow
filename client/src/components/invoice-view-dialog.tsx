import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InvoicePreview } from "@/components/invoice-preview";
import type { Invoice, Customer } from "@shared/schema";

interface InvoiceWithCustomer extends Invoice {
  customer: Customer;
}

interface InvoiceViewDialogProps {
  invoice: InvoiceWithCustomer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvoiceViewDialog({
  invoice,
  open,
  onOpenChange,
}: InvoiceViewDialogProps) {
  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invoice #{invoice.invoiceNumber}</DialogTitle>
        </DialogHeader>
        <InvoicePreview
          customer={invoice.customer}
          date={invoice.date}
          service={invoice.service}
          amount={invoice.amount}
          invoiceNumber={invoice.invoiceNumber}
        />
      </DialogContent>
    </Dialog>
  );
}
