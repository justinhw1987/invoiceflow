import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText, DollarSign, CheckCircle, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import type { Invoice, Customer } from "@shared/schema";

interface InvoiceWithCustomer extends Invoice {
  customer: Customer;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();

  const { data: invoices, isLoading } = useQuery<InvoiceWithCustomer[]>({
    queryKey: ["/api/invoices"],
  });

  const totalInvoices = invoices?.length || 0;
  const paidAmount = invoices
    ?.filter((inv) => inv.isPaid)
    .reduce((sum, inv) => sum + parseFloat(inv.amount), 0) || 0;
  const unpaidAmount = invoices
    ?.filter((inv) => !inv.isPaid)
    .reduce((sum, inv) => sum + parseFloat(inv.amount), 0) || 0;

  const recentInvoices = invoices?.slice(0, 5) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Overview of your invoice activity
          </p>
        </div>
        <Button onClick={() => setLocation("/invoices/new")} data-testid="button-create-invoice">
          <Plus className="h-4 w-4 mr-2" />
          Create Invoice
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-total-invoices">
              {totalInvoices}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All time invoices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Amount</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-paid-amount">
              ${paidAmount.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total received
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unpaid Amount</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-unpaid-amount">
              ${unpaidAmount.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Outstanding balance
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Invoices</CardTitle>
            <Button variant="ghost" onClick={() => setLocation("/invoices")} data-testid="button-view-all">
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 bg-muted animate-pulse rounded-md" />
              ))}
            </div>
          ) : recentInvoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No invoices yet</p>
              <Button
                variant="outline"
                onClick={() => setLocation("/invoices/new")}
                className="mt-4"
                data-testid="button-create-first-invoice"
              >
                Create Your First Invoice
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
                    <th className="text-right py-3 px-4 text-xs font-semibold uppercase">
                      Amount
                    </th>
                    <th className="text-center py-3 px-4 text-xs font-semibold uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="border-b hover-elevate cursor-pointer"
                      onClick={() => setLocation(`/invoices/${invoice.id}`)}
                      data-testid={`row-invoice-${invoice.id}`}
                    >
                      <td className="py-4 px-4 font-medium">
                        #{invoice.invoiceNumber}
                      </td>
                      <td className="py-4 px-4">{invoice.customer.name}</td>
                      <td className="py-4 px-4 text-sm text-muted-foreground">
                        {new Date(invoice.date).toLocaleDateString()}
                      </td>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
