import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, RefreshCcw, Trash2, Calendar, DollarSign, Edit } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

type RecurringInvoice = {
  id: string;
  name: string;
  frequency: "weekly" | "monthly" | "quarterly" | "yearly";
  startDate: string;
  endDate?: string;
  nextInvoiceDate: string;
  lastInvoiceDate?: string;
  isActive: boolean;
  amount: string;
  generatedCount: number;
  lastInvoiceNumber: number | null;
  customer: {
    name: string;
    email: string;
  };
};

export default function RecurringInvoices() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: recurringInvoices, isLoading } = useQuery<RecurringInvoice[]>({
    queryKey: ["/api/recurring-invoices"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/recurring-invoices/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-invoices"] });
      toast({
        title: "Recurring invoice deleted",
        description: "The recurring invoice template has been removed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete recurring invoice",
        variant: "destructive",
      });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/recurring-invoices/${id}/generate`, undefined);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Invoice generated",
        description: "New invoice created and sent to customer",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate invoice",
        variant: "destructive",
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await apiRequest("PATCH", `/api/recurring-invoices/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-invoices"] });
      toast({
        title: "Status updated",
        description: "Recurring invoice status has been changed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    },
  });

  const getFrequencyLabel = (frequency: string) => {
    const labels: { [key: string]: string } = {
      weekly: "Weekly",
      monthly: "Monthly",
      quarterly: "Quarterly",
      yearly: "Yearly",
    };
    return labels[frequency] || frequency;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <p>Loading recurring invoices...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Recurring Invoices</h1>
          <p className="text-muted-foreground mt-1">
            Manage your recurring invoice templates
          </p>
        </div>
        <Button
          onClick={() => setLocation("/recurring-invoices/new")}
          data-testid="button-new-recurring-invoice"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Recurring Invoice
        </Button>
      </div>

      {!recurringInvoices || recurringInvoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No recurring invoices yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create recurring invoice templates to automate your billing
            </p>
            <Button onClick={() => setLocation("/recurring-invoices/new")} data-testid="button-create-first">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Recurring Invoice
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Active Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Next Invoice</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recurringInvoices.map((recurring) => (
                  <TableRow key={recurring.id} data-testid={`row-recurring-${recurring.id}`}>
                    <TableCell className="font-medium" data-testid={`text-name-${recurring.id}`}>
                      {recurring.name}
                    </TableCell>
                    <TableCell data-testid={`text-customer-${recurring.id}`}>
                      <div>
                        <div className="font-medium">{recurring.customer.name}</div>
                        <div className="text-sm text-muted-foreground">{recurring.customer.email}</div>
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-frequency-${recurring.id}`}>
                      <Badge variant="outline">{getFrequencyLabel(recurring.frequency)}</Badge>
                    </TableCell>
                    <TableCell data-testid={`text-amount-${recurring.id}`}>
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-1" />
                        {parseFloat(recurring.amount).toFixed(2)}
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-generated-${recurring.id}`}>
                      <div className="text-sm">
                        <div className="font-medium">{recurring.generatedCount} invoice{recurring.generatedCount !== 1 ? 's' : ''}</div>
                        {recurring.lastInvoiceNumber && (
                          <div className="text-muted-foreground">Last: #{recurring.lastInvoiceNumber}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-next-date-${recurring.id}`}>
                      {new Date(recurring.nextInvoiceDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell data-testid={`text-status-${recurring.id}`}>
                      <Badge variant={recurring.isActive ? "default" : "secondary"}>
                        {recurring.isActive ? "Active" : "Paused"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLocation(`/recurring-invoices/${recurring.id}/edit`)}
                          data-testid={`button-edit-${recurring.id}`}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generateMutation.mutate(recurring.id)}
                          disabled={!recurring.isActive || generateMutation.isPending}
                          data-testid={`button-generate-${recurring.id}`}
                        >
                          <RefreshCcw className="h-4 w-4 mr-2" />
                          Generate
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleActiveMutation.mutate({
                            id: recurring.id,
                            isActive: !recurring.isActive
                          })}
                          data-testid={`button-toggle-${recurring.id}`}
                        >
                          {recurring.isActive ? "Pause" : "Resume"}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              data-testid={`button-delete-${recurring.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete recurring invoice?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will delete the recurring invoice template "{recurring.name}".
                                Previously generated invoices will not be affected.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(recurring.id)}
                                data-testid="button-confirm-delete"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
