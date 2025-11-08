import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InvoicePreview } from "@/components/invoice-preview";
import { Label } from "@/components/ui/label";
import type { Invoice, Customer, InvoiceItem } from "@shared/schema";

interface InvoiceWithCustomer extends Invoice {
  customer: Customer;
  items?: InvoiceItem[];
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

  // If invoice has items, use them; otherwise use legacy service field
  const hasItems = invoice.items && invoice.items.length > 0;
  const serviceDescription = hasItems
    ? invoice.items!.map(item => item.description).join(", ")
    : invoice.service;
  const displayAmount = invoice.amount || "0";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invoice #{invoice.invoiceNumber}</DialogTitle>
        </DialogHeader>
        
        {hasItems ? (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-sm">Customer</Label>
                  <p className="font-medium">{invoice.customer.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Date</Label>
                  <p className="font-medium">{new Date(invoice.date).toLocaleDateString()}</p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground text-sm">Line Items</Label>
                <div className="mt-2 border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 px-4 py-3 grid grid-cols-2 gap-4 font-semibold text-sm">
                    <div>Description</div>
                    <div className="text-right">Amount</div>
                  </div>
                  {invoice.items!.map((item, index) => (
                    <div 
                      key={index} 
                      className="px-4 py-3 grid grid-cols-2 gap-4 border-t"
                      data-testid={`invoice-item-${index}`}
                    >
                      <div>{item.description}</div>
                      <div className="text-right font-medium">${parseFloat(item.amount).toFixed(2)}</div>
                    </div>
                  ))}
                  <div className="px-4 py-4 grid grid-cols-2 gap-4 border-t-2 bg-primary/5 font-bold">
                    <div>Total</div>
                    <div className="text-right text-lg text-primary">${parseFloat(displayAmount).toFixed(2)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <InvoicePreview
            customer={invoice.customer}
            date={invoice.date}
            service={serviceDescription || ""}
            amount={displayAmount}
            invoiceNumber={invoice.invoiceNumber}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
