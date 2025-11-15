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
/**
 * Creates or retrieves a Stripe customer for a given email
 * @param customerId - Database customer ID
 * @param customerEmail - Customer email
 * @param customerName - Customer name
 * @returns Stripe customer ID
 */
export async function getOrCreateStripeCustomer(
  customerId: string,
  customerEmail: string,
  customerName: string,
  existingStripeCustomerId?: string | null
): Promise<string> {
  if (!stripeSecretKey) {
    throw new Error('Stripe API key not configured');
  }

  // Return existing Stripe customer if available
  if (existingStripeCustomerId) {
    return existingStripeCustomerId;
  }

  // Create new Stripe customer
  const stripeCustomer = await stripe.customers.create({
    email: customerEmail,
    name: customerName,
    metadata: {
      dbCustomerId: customerId,
    },
  });

  return stripeCustomer.id;
}

/**
 * Creates a SetupIntent for collecting payment method
 * @param stripeCustomerId - Stripe customer ID
 * @returns Client secret for frontend setup
 */
export async function createSetupIntent(stripeCustomerId: string): Promise<string> {
  if (!stripeSecretKey) {
    throw new Error('Stripe API key not configured');
  }

  const setupIntent = await stripe.setupIntents.create({
    customer: stripeCustomerId,
    payment_method_types: ['card', 'us_bank_account'],
    usage: 'off_session', // Allow charging when customer is not present
  });

  return setupIntent.client_secret!;
}

/**
 * Charges a customer's saved payment method
 * @param stripeCustomerId - Stripe customer ID
 * @param paymentMethodId - Saved payment method ID
 * @param amount - Amount in dollars (e.g., "100.00")
 * @param invoiceId - Invoice ID for metadata
 * @param invoiceNumber - Invoice number for description
 * @returns Payment intent ID
 */
export async function chargePaymentMethod(
  stripeCustomerId: string,
  paymentMethodId: string,
  amount: string,
  invoiceId: string,
  invoiceNumber: number
): Promise<string> {
  if (!stripeSecretKey) {
    throw new Error('Stripe API key not configured');
  }

  const amountInCents = Math.round(parseFloat(amount) * 100);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: 'usd',
    customer: stripeCustomerId,
    payment_method: paymentMethodId,
    off_session: true, // Customer is not present
    confirm: true, // Immediately attempt payment
    description: `Invoice #${invoiceNumber}`,
    metadata: {
      invoiceId: invoiceId,
      invoiceNumber: invoiceNumber.toString(),
    },
  });

  return paymentIntent.id;
}

export async function createInvoicePaymentLink(
  invoiceNumber: number,
  customerName: string,
  customerEmail: string,
  items: Array<{ description: string; amount: string }>,
  totalAmount: string,
  invoiceId: string,
  dbCustomerId: string
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

  // Determine success URL - use production domain if available, fallback to localhost
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.NODE_ENV === 'production'
    ? 'https://casitasvalleymedicine.com'
    : 'http://localhost:5000';
  
  const successUrl = `${baseUrl}/payment-success?invoice_id=${invoiceId}`;

  // Create a payment link that saves the payment method for future use
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
      type: 'redirect',
      redirect: {
        url: successUrl,
      },
    },
    // Store invoice ID and customer ID in metadata for webhook tracking
    payment_intent_data: {
      metadata: {
        invoiceId: invoiceId,
        invoiceNumber: invoiceNumber.toString(),
        dbCustomerId: dbCustomerId,
      },
      // Save payment method for future off-session use
      setup_future_usage: 'off_session',
    },
    // Create Stripe customer during checkout (we'll link it in webhook)
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
