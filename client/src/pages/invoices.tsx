import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Mail, Download, Eye } from "lucide-react";
import { useLocation } from "wouter";
import type { Invoice, Customer } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { InvoiceViewDialog } from "@/components/invoice-view-dialog";
import { downloadInvoicePDF } from "@/lib/download-invoice-pdf";

interface InvoiceWithCustomer extends Invoice {
  customer: Customer;
}

export default function Invoices() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithCustomer | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  const { data: invoices, isLoading } = useQuery<InvoiceWithCustomer[]>({
    queryKey: ["/api/invoices"],
  });

  const togglePaidMutation = useMutation({
    mutationFn: async ({ id, isPaid }: { id: string; isPaid: boolean }) => {
      return await apiRequest("PATCH", `/api/invoices/${id}/mark-paid`, { isPaid });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Invoice updated",
        description: "Payment status has been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update invoice status",
        variant: "destructive",
      });
    },
  });

  const emailMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/invoices/${id}/email`, undefined);
    },
    onSuccess: () => {
      toast({
        title: "Invoice sent",
        description: "Invoice has been emailed to the customer",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send invoice email",
        variant: "destructive",
      });
    },
  });

  const handleTogglePaid = (invoice: InvoiceWithCustomer) => {
    togglePaidMutation.mutate({
      id: invoice.id,
      isPaid: !invoice.isPaid,
    });
  };

  const handleEmail = (invoice: InvoiceWithCustomer) => {
    emailMutation.mutate(invoice.id);
  };

  const handleViewInvoice = (invoice: InvoiceWithCustomer) => {
    setSelectedInvoice(invoice);
    setIsViewDialogOpen(true);
  };

  const handleDownloadPDF = (invoice: InvoiceWithCustomer) => {
    downloadInvoicePDF(invoice.id, invoice.invoiceNumber);
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/invoices/export', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to export invoices');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoices-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export successful",
        description: "Your invoices have been exported to Excel",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export invoices",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Invoices</h1>
          <p className="text-muted-foreground mt-1">
            Track and manage all your invoices
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={!invoices || invoices.length === 0}
            data-testid="button-export-invoices"
          >
            <Download className="h-4 w-4 mr-2" />
            Export to Excel
          </Button>
          <Button onClick={() => setLocation("/invoices/new")} data-testid="button-create-invoice">
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 bg-muted animate-pulse rounded-md" />
              ))}
            </div>
          ) : !invoices || invoices.length === 0 ? (
            <div className="text-center py-12">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Plus className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No invoices yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first invoice to get started
              </p>
              <Button onClick={() => setLocation("/invoices/new")} data-testid="button-create-first-invoice">
                <Plus className="h-4 w-4 mr-2" />
                Create Invoice
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase">
                      Invoice #
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase">
                      Customer
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase">
                      Date
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase">
                      Service
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold uppercase">
                      Amount
                    </th>
                    <th className="text-center py-3 px-4 text-xs font-semibold uppercase">
                      Status
                    </th>
                    <th className="text-center py-3 px-4 text-xs font-semibold uppercase">
                      Paid
                    </th>
                    <th className="text-center py-3 px-4 text-xs font-semibold uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="border-b hover-elevate"
                      data-testid={`row-invoice-${invoice.id}`}
                    >
                      <td className="py-4 px-4 font-medium">
                        #{invoice.invoiceNumber}
                      </td>
                      <td className="py-4 px-4">{invoice.customer.name}</td>
                      <td className="py-4 px-4 text-sm text-muted-foreground">
                        {new Date(invoice.date).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4 text-sm">{invoice.service}</td>
                      <td className="py-4 px-4 text-right font-medium">
                        ${parseFloat(invoice.amount).toFixed(2)}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <Badge
                          variant={invoice.isPaid ? "default" : "secondary"}
                          className="rounded-full"
                          data-testid={`badge-status-${invoice.id}`}
                        >
                          {invoice.isPaid ? "Paid" : "Unpaid"}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex justify-center">
                          <Checkbox
                            checked={invoice.isPaid}
                            onCheckedChange={() => handleTogglePaid(invoice)}
                            data-testid={`checkbox-paid-${invoice.id}`}
                          />
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewInvoice(invoice)}
                            data-testid={`button-view-${invoice.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownloadPDF(invoice)}
                            data-testid={`button-download-pdf-${invoice.id}`}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEmail(invoice)}
                            disabled={emailMutation.isPending}
                            data-testid={`button-email-${invoice.id}`}
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <InvoiceViewDialog
        invoice={selectedInvoice}
        open={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
      />
    </div>
  );
}
