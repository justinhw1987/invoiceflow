import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { Customer } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

type LineItem = {
  description: string;
  amount: string;
};

export default function CreateRecurringInvoice() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [frequency, setFrequency] = useState<"weekly" | "monthly" | "quarterly" | "yearly">("monthly");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [items, setItems] = useState<LineItem[]>([{ description: "", amount: "" }]);

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/recurring-invoices", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-invoices"] });
      toast({
        title: "Recurring invoice created",
        description: "Recurring invoice template has been saved successfully",
      });
      setLocation("/recurring-invoices");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create recurring invoice",
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const hasEmptyItems = items.some(item => !item.description || !item.amount);
    if (!name || !customerId || hasEmptyItems) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      name,
      customerId,
      frequency,
      startDate,
      endDate: endDate || undefined,
      isActive,
      items: items.map(item => ({
        description: item.description,
        amount: item.amount,
      })),
    });
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/recurring-invoices")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-3xl font-bold">Create Recurring Invoice</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Recurring Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Monthly Subscription"
                  data-testid="input-name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer">Customer *</Label>
                <Select value={customerId} onValueChange={setCustomerId} required>
                  <SelectTrigger data-testid="select-customer">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.map((customer) => (
                      <SelectItem
                        key={customer.id}
                        value={customer.id}
                        data-testid={`option-customer-${customer.id}`}
                      >
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="frequency">Frequency *</Label>
                <Select value={frequency} onValueChange={(value: any) => setFrequency(value)} required>
                  <SelectTrigger data-testid="select-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly" data-testid="option-frequency-weekly">Weekly</SelectItem>
                    <SelectItem value="monthly" data-testid="option-frequency-monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly" data-testid="option-frequency-quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly" data-testid="option-frequency-yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="input-start-date"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date (Optional)</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  data-testid="input-end-date"
                />
              </div>
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
                <div key={index} className="flex gap-4 items-end" data-testid={`row-item-${index}`}>
                  <div className="flex-1 space-y-2">
                    <Label htmlFor={`description-${index}`}>Description</Label>
                    <Input
                      id={`description-${index}`}
                      value={item.description}
                      onChange={(e) => updateLineItem(index, "description", e.target.value)}
                      placeholder="Service description"
                      data-testid={`input-description-${index}`}
                      required
                    />
                  </div>
                  <div className="w-32 space-y-2">
                    <Label htmlFor={`amount-${index}`}>Amount ($)</Label>
                    <Input
                      id={`amount-${index}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.amount}
                      onChange={(e) => updateLineItem(index, "amount", e.target.value)}
                      placeholder="0.00"
                      data-testid={`input-amount-${index}`}
                      required
                    />
                  </div>
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLineItem(index)}
                      data-testid={`button-remove-item-${index}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              <div className="flex justify-end pt-4 border-t">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total per Invoice</p>
                  <p className="text-2xl font-bold" data-testid="text-total">${calculateTotal()}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation("/recurring-invoices")}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-save"
              >
                {createMutation.isPending ? "Creating..." : "Create Recurring Invoice"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
