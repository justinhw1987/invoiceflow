import { Card, CardContent } from "@/components/ui/card";
import type { Customer } from "@shared/schema";
import { FileText } from "lucide-react";

interface InvoicePreviewProps {
  customer: Customer;
  date: string;
  service: string;
  amount: string;
  invoiceNumber: number;
}

export function InvoicePreview({
  customer,
  date,
  service,
  amount,
  invoiceNumber,
}: InvoicePreviewProps) {
  return (
    <Card className="bg-white dark:bg-card">
      <CardContent className="p-8 space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold text-foreground">INVOICE</h2>
            </div>
            <p className="text-sm text-muted-foreground">Invoice #{invoiceNumber}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-foreground">Invoice Manager</p>
            <p className="text-sm text-muted-foreground">Your Business Name</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
              Bill To
            </p>
            <div className="space-y-1">
              <p className="font-semibold text-foreground">{customer.name}</p>
              <p className="text-sm text-muted-foreground">{customer.email}</p>
              <p className="text-sm text-muted-foreground">{customer.phone}</p>
              <p className="text-sm text-muted-foreground">{customer.address}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
              Invoice Date
            </p>
            <p className="font-medium text-foreground">
              {new Date(date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>

        <div>
          <div className="border-b pb-2 mb-4">
            <div className="grid grid-cols-2 gap-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Description
              </p>
              <p className="text-xs font-semibold uppercase text-muted-foreground text-right">
                Amount
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <p className="text-sm text-foreground">{service}</p>
            <p className="text-sm font-medium text-foreground text-right">
              ${parseFloat(amount).toFixed(2)}
            </p>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex justify-between items-center">
            <p className="text-lg font-semibold text-foreground">Total</p>
            <p className="text-2xl font-bold text-primary">
              ${parseFloat(amount).toFixed(2)}
            </p>
          </div>
        </div>

        <div className="text-center pt-8 border-t">
          <p className="text-xs text-muted-foreground">
            Thank you for your business!
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
