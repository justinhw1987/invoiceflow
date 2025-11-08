// Resend email integration
// Supports both Railway (environment variables) and Replit (connector integration)
import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentialsFromReplit() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return {apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email};
}

async function getCredentials() {
  // First, try to use environment variables (Railway/standard setup)
  const hasApiKey = !!process.env.RESEND_API_KEY;
  const hasFromEmail = !!process.env.FROM_EMAIL;
  
  // If either is set, both must be set
  if (hasApiKey || hasFromEmail) {
    if (!hasApiKey || !hasFromEmail) {
      throw new Error('Both RESEND_API_KEY and FROM_EMAIL environment variables must be set together');
    }
    return {
      apiKey: process.env.RESEND_API_KEY!,
      fromEmail: process.env.FROM_EMAIL!
    };
  }
  
  // Check if Replit connector environment is available
  const hasReplitEnv = process.env.REPLIT_CONNECTORS_HOSTNAME && 
                       (process.env.REPL_IDENTITY || process.env.WEB_REPL_RENEWAL);
  
  if (!hasReplitEnv) {
    throw new Error(
      'Resend credentials not configured. Please set RESEND_API_KEY and FROM_EMAIL environment variables, ' +
      'or configure Replit connector integration.'
    );
  }
  
  // Fall back to Replit connector integration
  return getCredentialsFromReplit();
}

export async function getUncachableResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

export async function sendInvoiceEmail(
  customerEmail: string,
  customerName: string,
  invoiceNumber: number,
  service: string,
  amount: string,
  date: string
) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #3b82f6; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background: #f9fafb; }
            .invoice-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
            .total { font-size: 24px; font-weight: bold; color: #3b82f6; margin-top: 20px; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Invoice #${invoiceNumber}</h1>
            </div>
            <div class="content">
              <p>Dear ${customerName},</p>
              <p>Thank you for your business. Please find your invoice details below:</p>
              
              <div class="invoice-details">
                <div class="detail-row">
                  <span><strong>Invoice Date:</strong></span>
                  <span>${new Date(date).toLocaleDateString()}</span>
                </div>
                <div class="detail-row">
                  <span><strong>Service:</strong></span>
                  <span>${service}</span>
                </div>
                <div class="detail-row">
                  <span><strong>Amount:</strong></span>
                  <span class="total">$${parseFloat(amount).toFixed(2)}</span>
                </div>
              </div>
              
              <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>
              <p>Thank you for your business!</p>
            </div>
            <div class="footer">
              <p>Invoice Manager - Professional Invoice Management</p>
            </div>
          </div>
        </body>
      </html>
    `;

    await client.emails.send({
      from: fromEmail,
      to: customerEmail,
      subject: `Invoice #${invoiceNumber} from Invoice Manager`,
      html,
    });

    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}
