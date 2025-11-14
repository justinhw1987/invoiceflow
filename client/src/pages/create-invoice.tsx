import { useState, useEffect } from "react";
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
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import type { Customer, Invoice } from "@shared/schema";
import { InvoicePreview } from "@/components/invoice-preview";
import { apiRequest, queryClient } from "@/lib/queryClient";

type LineItem = {
  description: string;
  amount: string;
};

type InvoiceWithItems = Invoice & {
  customer: Customer;
  items: Array<{ description: string; amount: string }>;
};

export default function CreateInvoice({ id }: { id?: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [customerId, setCustomerId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [items, setItems] = useState<LineItem[]>([{ description: "", amount: "" }]);
  const [showPreview, setShowPreview] = useState(false);
  const [isPaid, setIsPaid] = useState(false);

  const isEditing = !!id;

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: invoice, isLoading: isLoadingInvoice } = useQuery<InvoiceWithItems>({
    queryKey: ["/api/invoices", id],
    enabled: isEditing,
  });

  useEffect(() => {
    if (invoice) {
      setCustomerId(invoice.customerId);
      setDate(invoice.date);
      setIsPaid(invoice.isPaid);
      if (invoice.items && invoice.items.length > 0) {
        setItems(invoice.items.map(item => ({
          description: item.description,
          amount: item.amount,
        })));
      }
    }
  }, [invoice]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEditing) {
        const response = await apiRequest("PATCH", `/api/invoices/${id}`, data);
        return await response.json();
      } else {
        const response = await apiRequest("POST", "/api/invoices", data);
        return await response.json();
      }
    },
    onSuccess: async (invoice: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      
      if (!isEditing) {
        // Automatically send email only after creating new invoice
        if (invoice?.id) {
          try {
            await apiRequest("POST", `/api/invoices/${invoice.id}/email`, undefined);
            toast({
              title: "Invoice created and sent",
              description: "Invoice has been saved and emailed to the customer",
            });
          } catch (error) {
            toast({
              title: "Invoice created",
              description: "Invoice saved, but failed to send email. You can resend from the invoices page.",
              variant: "destructive",
            });
          }
        }
      } else {
        toast({
          title: "Invoice updated",
          description: "Invoice has been updated successfully",
        });
      }
      
      setLocation("/invoices");
    },
    onError: () => {
      toast({
        title: "Error",
        description: isEditing ? "Failed to update invoice" : "Failed to create invoice",
        variant: "destructive",
      });
    },
  });

  const addLineItem = () => {
    setItems([...items, { description: "", amount: "" }]);
  };

  const removeLineItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((total, item) => {
      const amount = parseFloat(item.amount) || 0;
      return total + amount;
    }, 0).toFixed(2);
  };

  const handlePreview = () => {
    const hasEmptyItems = items.some(item => !item.description || !item.amount);
    if (!customerId || hasEmptyItems) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    setShowPreview(true);
  };

  const handleSaveInvoice = () => {
    saveMutation.mutate({
      customerId,
      date,
      items: items.map(item => ({
        description: item.description,
        amount: item.amount,
      })),
      isPaid,
    });
  };

  const selectedCustomer = customers?.find((c) => c.id === customerId);

  if (showPreview && selectedCustomer) {
    const total = calculateTotal();
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
                <Label className="text-muted-foreground">Line Items</Label>
                <div className="space-y-2 mt-2">
                  {items.map((item, index) => (
                    <div key={index} className="flex justify-between items-start p-3 bg-muted/50 rounded-md">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.description}</p>
                      </div>
                      <p className="font-semibold ml-4">${parseFloat(item.amount).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <Label className="text-muted-foreground text-base">Total Amount</Label>
                  <p className="text-2xl font-bold">${total}</p>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleSaveInvoice}
                  disabled={saveMutation.isPending}
                  className="flex-1"
                  data-testid="button-save-invoice"
                >
                  {saveMutation.isPending ? "Saving..." : (isEditing ? "Update Invoice" : "Save & Send Invoice")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <InvoicePreview
            customer={selectedCustomer}
            date={date}
            service={items.map(i => i.description).join(", ")}
            amount={total}
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
          <CardTitle className="text-2xl">{isEditing ? "Edit Invoice" : "Create New Invoice"}</CardTitle>
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

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Line Items *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLineItem}
                  data-testid="button-add-item"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>

              {items.map((item, index) => (
                <div key={index} className="flex gap-3 items-start p-4 border rounded-lg bg-muted/30" data-testid={`line-item-${index}`}>
                  <div className="flex-1 space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`description-${index}`} className="text-xs text-muted-foreground">
                        Description
                      </Label>
                      <Textarea
                        id={`description-${index}`}
                        value={item.description}
                        onChange={(e) => updateLineItem(index, "description", e.target.value)}
                        placeholder="Service or product description..."
                        rows={2}
                        data-testid={`input-description-${index}`}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`amount-${index}`} className="text-xs text-muted-foreground">
                        Amount
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          $
                        </span>
                        <Input
                          id={`amount-${index}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.amount}
                          onChange={(e) => updateLineItem(index, "amount", e.target.value)}
                          className="pl-7 h-11"
                          placeholder="0.00"
                          data-testid={`input-amount-${index}`}
                        />
                      </div>
                    </div>
                  </div>
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLineItem(index)}
                      className="mt-8"
                      data-testid={`button-remove-item-${index}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}

              <div className="flex justify-between items-center p-4 bg-primary/5 rounded-lg border-2 border-primary/20">
                <span className="font-semibold text-lg">Total</span>
                <span className="text-2xl font-bold text-primary">${calculateTotal()}</span>
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
