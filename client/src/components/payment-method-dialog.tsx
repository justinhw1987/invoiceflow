import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Customer } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface PaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
}

function PaymentForm({ customer, onSuccess }: { customer: Customer; onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const savePaymentMethodMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      return await apiRequest("POST", `/api/customers/${customer.id}/save-payment-method`, {
        paymentMethodId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Payment method saved",
        description: "This payment method will be used for automatic recurring payments",
      });
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save payment method",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: window.location.origin,
        },
        redirect: "if_required",
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else if (setupIntent?.payment_method) {
        await savePaymentMethodMutation.mutateAsync(setupIntent.payment_method as string);
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to save payment method",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <div className="flex justify-end gap-2">
        <Button
          type="submit"
          disabled={!stripe || isProcessing}
          data-testid="button-save-payment-method"
        >
          {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isProcessing ? "Saving..." : "Save Payment Method"}
        </Button>
      </div>
    </form>
  );
}

export function PaymentMethodDialog({ open, onOpenChange, customer }: PaymentMethodDialogProps) {
  const { toast } = useToast();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && customer) {
      setIsLoading(true);
      apiRequest("POST", `/api/customers/${customer.id}/setup-payment-method`, undefined)
        .then((data: any) => {
          setClientSecret(data.clientSecret);
        })
        .catch(() => {
          toast({
            title: "Error",
            description: "Failed to initialize payment setup",
            variant: "destructive",
          });
          onOpenChange(false);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setClientSecret(null);
    }
  }, [open, customer, toast, onOpenChange]);

  const handleSuccess = () => {
    onOpenChange(false);
    setClientSecret(null);
  };

  const options: StripeElementsOptions = {
    clientSecret: clientSecret || undefined,
    appearance: {
      theme: "stripe",
    },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-payment-method">
        <DialogHeader>
          <DialogTitle>Add Payment Method</DialogTitle>
          <DialogDescription>
            Add a credit card or bank account for {customer?.name}. This will be used for automatic recurring payments.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : clientSecret && customer ? (
          <Elements stripe={stripePromise} options={options}>
            <PaymentForm customer={customer} onSuccess={handleSuccess} />
          </Elements>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
