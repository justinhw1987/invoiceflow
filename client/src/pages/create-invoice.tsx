import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import type { Customer } from "@shared/schema";
import { InvoicePreview } from "@/components/invoice-preview";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function CreateInvoice() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [customerId, setCustomerId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [service, setService] = useState("");
  const [amount, setAmount] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/invoices", data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Invoice created",
        description: "Invoice has been saved and synced to Google Sheets",
      });
      setLocation("/invoices");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create invoice",
        variant: "destructive",
      });
    },
  });

  const emailMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      return await apiRequest("POST", `/api/invoices/${invoiceId}/email`, undefined);
    },
    onSuccess: () => {
      toast({
        title: "Invoice sent",
        description: "Invoice has been emailed to the customer",
      });
      setLocation("/invoices");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send invoice email",
        variant: "destructive",
      });
    },
  });

  const handlePreview = () => {
    if (!customerId || !service || !amount) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    setShowPreview(true);
  };

  const handleSaveAndEmail = async () => {
    const result = await createMutation.mutateAsync({
      customerId,
      date,
      service,
      amount: amount,
      isPaid: false,
    });

    if (result.id) {
      emailMutation.mutate(result.id);
    }
  };

  const handleSaveDraft = () => {
    createMutation.mutate({
      customerId,
      date,
      service,
      amount: amount,
      isPaid: false,
    });
  };

  const selectedCustomer = customers?.find((c) => c.id === customerId);

  if (showPreview && selectedCustomer) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => setShowPreview(false)}
            data-testid="button-back-to-form"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Form
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Customer</Label>
                <p className="font-medium">{selectedCustomer.name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Date</Label>
                <p className="font-medium">{new Date(date).toLocaleDateString()}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Service</Label>
                <p className="font-medium">{service}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Amount</Label>
                <p className="text-2xl font-bold">${parseFloat(amount).toFixed(2)}</p>
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleSaveAndEmail}
                  disabled={createMutation.isPending || emailMutation.isPending}
                  className="flex-1"
                  data-testid="button-send-invoice"
                >
                  {emailMutation.isPending ? "Sending..." : "Send Invoice"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={createMutation.isPending}
                  data-testid="button-save-draft"
                >
                  Save Draft
                </Button>
              </div>
            </CardContent>
          </Card>

          <InvoicePreview
            customer={selectedCustomer}
            date={date}
            service={service}
            amount={amount}
            invoiceNumber={1}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => setLocation("/invoices")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Create New Invoice</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="customer">Customer *</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger id="customer" className="h-11" data-testid="select-customer">
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers?.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-11"
                data-testid="input-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="service">Service Description *</Label>
              <Textarea
                id="service"
                value={service}
                onChange={(e) => setService(e.target.value)}
                placeholder="Describe the service provided..."
                rows={4}
                data-testid="input-service"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-7 h-11"
                  placeholder="0.00"
                  data-testid="input-amount"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={handlePreview}
                data-testid="button-preview"
              >
                Preview Invoice
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
