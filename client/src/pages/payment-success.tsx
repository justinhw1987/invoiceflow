import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function PaymentSuccess() {
  const [, setLocation] = useLocation();
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('invoice_id');
    setInvoiceId(id);
  }, []);

  const { data: paymentStatus, isLoading } = useQuery({
    queryKey: ['/api/payment-status', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return null;
      const response = await fetch(`/api/payment-status/${invoiceId}`);
      if (!response.ok) throw new Error('Failed to fetch payment status');
      return response.json();
    },
    enabled: !!invoiceId,
  });

  if (isLoading || !invoiceId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center" data-testid="loading-indicator">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!paymentStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <XCircle className="h-16 w-16 text-destructive" />
            </div>
            <CardTitle className="text-2xl" data-testid="text-error-title">Invoice Not Found</CardTitle>
            <CardDescription data-testid="text-error-message">
              We couldn't find the invoice you're looking for.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle2 className="h-16 w-16 text-green-600" data-testid="icon-success" />
          </div>
          <CardTitle className="text-2xl text-green-600" data-testid="text-success-title">
            {paymentStatus.isPaid ? 'Payment Completed!' : 'Payment Processing'}
          </CardTitle>
          <CardDescription data-testid="text-customer-name">
            Thank you, {paymentStatus.customerName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-muted-foreground">Invoice Number:</span>
              <span className="text-lg font-semibold" data-testid="text-invoice-number">#{paymentStatus.invoiceNumber}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">Amount Paid:</span>
              <span className="text-2xl font-bold text-green-600" data-testid="text-amount">
                ${parseFloat(paymentStatus.amount).toFixed(2)}
              </span>
            </div>
          </div>

          {paymentStatus.isPaid && (
            <div className="bg-white border rounded-lg p-4 space-y-2" data-testid="card-payment-confirmation">
              <p className="text-sm text-muted-foreground">
                ✓ Your payment has been successfully processed
              </p>
              <p className="text-sm text-muted-foreground">
                ✓ A receipt has been sent to your email
              </p>
              <p className="text-sm text-muted-foreground">
                ✓ Invoice marked as PAID
              </p>
            </div>
          )}

          {!paymentStatus.isPaid && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4" data-testid="card-payment-pending">
              <p className="text-sm text-muted-foreground">
                Your payment is being processed. You will receive a confirmation email shortly.
              </p>
            </div>
          )}

          <p className="text-xs text-center text-muted-foreground">
            You can safely close this window
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
