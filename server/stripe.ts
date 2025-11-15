import Stripe from 'stripe';

// Initialize Stripe with API key
// Prefer testing key in development, fall back to production key
const stripeSecretKey = process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn('[Stripe] Warning: No Stripe API key configured. Payment links will not be created.');
}

export const stripe = new Stripe(stripeSecretKey || '', {
  apiVersion: '2025-10-29.clover',
});

/**
 * Creates a Stripe payment link for an invoice
 * @param invoiceNumber - The invoice number for display
 * @param customerName - Customer name for the product description
 * @param customerEmail - Customer email for prefilling checkout
 * @param items - Array of line items with description and amount
 * @param totalAmount - Total amount as a string (e.g., "100.00")
 * @param invoiceId - Invoice ID for metadata tracking
 * @returns Object with paymentLinkId and paymentLinkUrl
 */
export async function createInvoicePaymentLink(
  invoiceNumber: number,
  customerName: string,
  customerEmail: string,
  items: Array<{ description: string; amount: string }>,
  totalAmount: string,
  invoiceId: string
): Promise<{ paymentLinkId: string; paymentLinkUrl: string }> {
  if (!stripeSecretKey) {
    throw new Error('Stripe API key not configured');
  }

  // Create a product for this invoice
  const product = await stripe.products.create({
    name: `Invoice #${invoiceNumber} - ${customerName}`,
    description: items.map(item => `${item.description}: $${item.amount}`).join(', '),
  });

  // Convert amount to cents (Stripe uses smallest currency unit)
  const amountInCents = Math.round(parseFloat(totalAmount) * 100);

  // Create a price for the product
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: amountInCents,
    currency: 'usd',
  });

  // Create a payment link
  const paymentLink = await stripe.paymentLinks.create({
    line_items: [
      {
        price: price.id,
        quantity: 1,
      },
    ],
    // Enable multiple payment methods including ACH (US bank account)
    payment_method_types: ['card', 'us_bank_account'],
    after_completion: {
      type: 'hosted_confirmation',
      hosted_confirmation: {
        custom_message: `Thank you for your payment! Invoice #${invoiceNumber} has been marked as paid.`,
      },
    },
    // Store invoice ID in metadata for webhook tracking
    payment_intent_data: {
      metadata: {
        invoiceId: invoiceId,
        invoiceNumber: invoiceNumber.toString(),
      },
    },
    // Prefill customer email in checkout
    customer_creation: 'always',
    invoice_creation: {
      enabled: true,
    },
  });

  return {
    paymentLinkId: paymentLink.id,
    paymentLinkUrl: paymentLink.url,
  };
}
