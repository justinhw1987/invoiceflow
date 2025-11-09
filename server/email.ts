// Resend email integration
// Supports both Railway (environment variables) and Replit (connector integration)
import { Resend } from 'resend';
import PDFDocument from 'pdfkit';

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
  // Debug logging to help diagnose Railway issues
  console.log('Environment check:', {
    hasResendApiKey: !!process.env.RESEND_API_KEY,
    hasFromEmail: !!process.env.FROM_EMAIL,
    hasReplitHostname: !!process.env.REPLIT_CONNECTORS_HOSTNAME,
    hasReplIdentity: !!process.env.REPL_IDENTITY,
    hasWebRenewal: !!process.env.WEB_REPL_RENEWAL,
    nodeEnv: process.env.NODE_ENV
  });
  
  // First, try to use environment variables (Railway/standard setup)
  const hasApiKey = !!process.env.RESEND_API_KEY;
  const hasFromEmail = !!process.env.FROM_EMAIL;
  
  // If either is set, both must be set
  if (hasApiKey || hasFromEmail) {
    if (!hasApiKey || !hasFromEmail) {
      const missingVars = [];
      if (!hasApiKey) missingVars.push('RESEND_API_KEY');
      if (!hasFromEmail) missingVars.push('FROM_EMAIL');
      throw new Error(`Missing environment variables: ${missingVars.join(', ')}. Both RESEND_API_KEY and FROM_EMAIL must be set together.`);
    }
    console.log('Using environment variables for Resend');
    return {
      apiKey: process.env.RESEND_API_KEY!,
      fromEmail: process.env.FROM_EMAIL!
    };
  }
  
  // Check if Replit connector environment is available
  const hasReplitEnv = process.env.REPLIT_CONNECTORS_HOSTNAME && 
                       (process.env.REPL_IDENTITY || process.env.WEB_REPL_RENEWAL);
  
  if (!hasReplitEnv) {
    console.error('No Resend credentials found in environment');
    throw new Error(
      'Resend credentials not configured. Please set RESEND_API_KEY and FROM_EMAIL environment variables, ' +
      'or configure Replit connector integration.'
    );
  }
  
  // Fall back to Replit connector integration
  console.log('Using Replit connector for Resend');
  return getCredentialsFromReplit();
}

export async function getUncachableResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return text.replace(/[&<>"'/]/g, (char) => map[char]);
}

export async function generateInvoicePDF(
  customerName: string,
  customerEmail: string,
  customerPhone: string,
  customerAddress: string,
  invoiceNumber: number,
  date: string,
  items: Array<{ description: string; amount: string }>,
  totalAmount: string,
  companyName?: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const senderName = companyName || 'Invoice Manager';

    // Header
    doc.fontSize(24).fillColor('#3b82f6').text('INVOICE', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#6b7280').text(`Invoice #${invoiceNumber}`, { align: 'center' });
    doc.moveDown(2);

    // Company name
    doc.fontSize(12).fillColor('#111827').text(senderName, { align: 'right' });
    doc.fontSize(10).fillColor('#6b7280').text('Professional Invoice Management', { align: 'right' });
    doc.moveDown(2);

    // Bill To section
    doc.fontSize(10).fillColor('#6b7280').text('BILL TO');
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#111827').text(customerName);
    doc.fontSize(10).fillColor('#6b7280').text(customerEmail);
    doc.text(customerPhone);
    doc.text(customerAddress);
    doc.moveDown(2);

    // Invoice details
    const currentY = doc.y;
    doc.fontSize(10).fillColor('#6b7280').text('INVOICE DATE', 50, currentY);
    doc.fontSize(11).fillColor('#111827').text(
      new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      50,
      currentY + 15
    );
    doc.moveDown(3);

    // Line separator
    doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(1);

    // Service details header
    doc.fontSize(10).fillColor('#6b7280').text('DESCRIPTION', 50, doc.y, { width: 350, continued: false });
    doc.text('AMOUNT', 400, doc.y - 12, { width: 150, align: 'right' });
    doc.moveDown(1);

    // Line items
    items.forEach((item) => {
      doc.fontSize(11).fillColor('#111827').text(item.description, 50, doc.y, { width: 350 });
      const itemY = doc.y - 12;
      doc.text(`$${parseFloat(item.amount).toFixed(2)}`, 400, itemY, { width: 150, align: 'right' });
      doc.moveDown(1);
    });

    doc.moveDown(1);

    // Total line
    doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(1);

    // Total
    doc.fontSize(14).fillColor('#111827').text('TOTAL', 400, doc.y, { width: 100, align: 'right' });
    doc.fontSize(18).fillColor('#3b82f6').text(`$${parseFloat(totalAmount).toFixed(2)}`, 400, doc.y, { width: 150, align: 'right' });
    doc.moveDown(4);

    // Footer message
    doc.fontSize(10).fillColor('#6b7280').text(
      'Thank you for your business!',
      { align: 'center' }
    );
    doc.moveDown(0.5);
    doc.fontSize(9).text(
      'If you have any questions about this invoice, please contact us.',
      { align: 'center' }
    );

    doc.end();
  });
}

export async function sendInvoiceEmail(
  customerEmail: string,
  customerName: string,
  customerPhone: string,
  customerAddress: string,
  invoiceNumber: number,
  service: string,
  amount: string,
  date: string,
  companyName?: string,
  items?: Array<{ description: string; amount: string }>
) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    const rawSenderName = companyName || 'Invoice Manager';
    const senderName = escapeHtml(rawSenderName);
    const escapedCustomerName = escapeHtml(customerName);
    
    // Use items if provided, otherwise fall back to legacy service field
    const invoiceItems = items && items.length > 0
      ? items
      : [{ description: service, amount }];
    
    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      invoiceNumber,
      date,
      invoiceItems,
      amount,
      companyName
    );

    // Convert PDF buffer to base64 for email attachment
    const pdfBase64 = pdfBuffer.toString('base64');

    // Generate item rows for email using table layout (more reliable across email clients)
    const itemRows = invoiceItems.map(item => {
      const escapedDescription = escapeHtml(item.description);
      return `
        <tr>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: left;">${escapedDescription}</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; white-space: nowrap;">$${parseFloat(item.amount).toFixed(2)}</td>
        </tr>
      `;
    }).join('');

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
            .invoice-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .table-header { background: #f3f4f6; font-weight: bold; }
            .total-row { border-top: 2px solid #3b82f6; }
            .total { font-size: 24px; font-weight: bold; color: #3b82f6; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Invoice #${invoiceNumber}</h1>
            </div>
            <div class="content">
              <p>Dear ${escapedCustomerName},</p>
              <p>Thank you for your business. Please find your invoice attached as a PDF.</p>
              
              <div class="invoice-details">
                <table style="width: 100%; margin-bottom: 15px;">
                  <tr>
                    <td style="padding: 8px 0;"><strong>Invoice Date:</strong></td>
                    <td style="padding: 8px 0; text-align: right;">${new Date(date).toLocaleDateString()}</td>
                  </tr>
                </table>
                
                <table class="invoice-table">
                  <thead>
                    <tr class="table-header">
                      <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #d1d5db;">Description</th>
                      <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #d1d5db; white-space: nowrap;">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemRows}
                  </tbody>
                  <tfoot>
                    <tr class="total-row">
                      <td style="padding: 15px 8px; text-align: left;"><strong>Total:</strong></td>
                      <td style="padding: 15px 8px; text-align: right;"><span class="total">$${parseFloat(amount).toFixed(2)}</span></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              
              <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>
              <p>Thank you for your business!</p>
            </div>
            <div class="footer">
              <p>${senderName} - Professional Invoice Management</p>
            </div>
          </div>
        </body>
      </html>
    `;

    await client.emails.send({
      from: fromEmail,
      to: customerEmail,
      subject: `Invoice #${invoiceNumber} from ${rawSenderName}`,
      html,
      attachments: [
        {
          filename: `invoice-${invoiceNumber}.pdf`,
          content: pdfBase64,
        },
      ],
    });

    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}
