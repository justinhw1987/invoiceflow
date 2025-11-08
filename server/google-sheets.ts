// Google Sheets integration
// Supports both Railway (Service Account) and Replit (OAuth connector)
import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessTokenFromReplit() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
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
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-sheet',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Sheet not connected');
  }
  return accessToken;
}

export async function getUncachableGoogleSheetClient() {
  // Check for Railway/standard setup (Service Account)
  const hasServiceAccount = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY;
  
  if (hasServiceAccount) {
    // Use service account authentication (Railway/standard setup)
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      throw new Error('Both GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY must be set together');
    }
    
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    return google.sheets({ version: 'v4', auth });
  }
  
  // Check if Replit connector environment is available
  const hasReplitEnv = process.env.REPLIT_CONNECTORS_HOSTNAME && 
                       (process.env.REPL_IDENTITY || process.env.WEB_REPL_RENEWAL);
  
  if (!hasReplitEnv) {
    throw new Error(
      'Google Sheets credentials not configured. Please set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY ' +
      'environment variables, or configure Replit connector integration.'
    );
  }
  
  // Fall back to Replit connector integration (OAuth)
  const accessToken = await getAccessTokenFromReplit();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.sheets({ version: 'v4', auth: oauth2Client });
}

// Create or get spreadsheet for invoices
let cachedSpreadsheetId: string | null = null;

export async function getInvoiceSpreadsheet() {
  // If GOOGLE_SHEET_ID is set, use that (Railway/standard setup)
  if (process.env.GOOGLE_SHEET_ID) {
    return process.env.GOOGLE_SHEET_ID;
  }
  
  // Otherwise, create/cache dynamically (Replit connector setup)
  if (cachedSpreadsheetId) {
    return cachedSpreadsheetId;
  }

  const sheets = await getUncachableGoogleSheetClient();
  
  try {
    const response = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: 'Invoice Manager - Invoices',
        },
        sheets: [
          {
            properties: {
              title: 'Invoices',
            },
            data: [
              {
                rowData: [
                  {
                    values: [
                      { userEnteredValue: { stringValue: 'Invoice Number' } },
                      { userEnteredValue: { stringValue: 'Customer Name' } },
                      { userEnteredValue: { stringValue: 'Date' } },
                      { userEnteredValue: { stringValue: 'Service' } },
                      { userEnteredValue: { stringValue: 'Amount' } },
                      { userEnteredValue: { stringValue: 'Status' } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    cachedSpreadsheetId = response.data.spreadsheetId || null;
    return cachedSpreadsheetId;
  } catch (error) {
    console.error('Error creating spreadsheet:', error);
    throw error;
  }
}

export async function addInvoiceToSheet(invoice: {
  invoiceNumber: number;
  customerName: string;
  date: string;
  service: string;
  amount: string;
  isPaid: boolean;
}) {
  try {
    const sheets = await getUncachableGoogleSheetClient();
    const spreadsheetId = await getInvoiceSpreadsheet();

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId!,
      range: 'Invoices!A:F',
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          [
            invoice.invoiceNumber,
            invoice.customerName,
            invoice.date,
            invoice.service,
            invoice.amount,
            invoice.isPaid ? 'Paid' : 'Unpaid',
          ],
        ],
      },
    });

    return response.data.updates?.updatedRange;
  } catch (error) {
    console.error('Error adding invoice to sheet:', error);
    throw error;
  }
}

export async function updateInvoiceInSheet(rowId: string, isPaid: boolean) {
  try {
    const sheets = await getUncachableGoogleSheetClient();
    const spreadsheetId = await getInvoiceSpreadsheet();

    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId!,
      range: rowId,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[isPaid ? 'Paid' : 'Unpaid']],
      },
    });
  } catch (error) {
    console.error('Error updating invoice in sheet:', error);
    throw error;
  }
}
