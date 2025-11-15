import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCustomerSchema, insertInvoiceSchema, insertUserSchema, changePasswordSchema, updateProfileSchema, createInvoiceWithItemsSchema, createRecurringInvoiceWithItemsSchema } from "@shared/schema";
import bcrypt from "bcrypt";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { sendInvoiceEmail, generateInvoicePDF } from "./email";
import { createInvoicePaymentLink, stripe } from "./stripe";
import * as XLSX from "xlsx";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

const PgSession = connectPgSimple(session);

export async function registerRoutes(app: Express): Promise<Server> {
  // Trust proxy for Railway/production deployments
  app.set('trust proxy', 1);

  // Session middleware with PostgreSQL store
  app.use(
    session({
      store: new PgSession({
        pool,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "invoice-manager-secret-key-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production' ? 'auto' : false,
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      },
    })
  );

  // Stripe webhook endpoint (must be before body parsing middleware)
  app.post("/api/stripe/webhook", async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || process.env.TESTING_STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('[Stripe Webhook] No webhook secret configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    let event;

    try {
      // Verify webhook signature using raw body
      const rawBody = (req as any).rawBody;
      if (!rawBody) {
        throw new Error('Raw body not available');
      }
      
      event = stripe.webhooks.constructEvent(
        rawBody,
        sig as string,
        webhookSecret
      );
    } catch (err: any) {
      console.error('[Stripe Webhook] Signature verification failed:', err.message);
      return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }

    console.log('[Stripe Webhook] Received event:', event.type);

    // Handle the event
    try {
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as any;
        console.log('[Stripe Webhook] Payment completed for session:', session.id);

        // Extract invoice ID from payment intent metadata
        let invoiceId: string | undefined;
        
        // First try to get from session metadata
        if (session.metadata?.invoiceId) {
          invoiceId = session.metadata.invoiceId;
        } else if (session.payment_intent) {
          // If not in session, fetch the payment intent to get metadata
          const paymentIntentId = typeof session.payment_intent === 'string' 
            ? session.payment_intent 
            : session.payment_intent.id;
            
          console.log('[Stripe Webhook] Fetching payment intent:', paymentIntentId);
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
          invoiceId = paymentIntent.metadata?.invoiceId;
        }
        
        if (!invoiceId) {
          console.error('[Stripe Webhook] No invoice ID found in session or payment intent metadata');
          console.error('[Stripe Webhook] Session:', JSON.stringify(session, null, 2));
          return res.status(400).json({ error: 'No invoice ID in metadata' });
        }

        console.log('[Stripe Webhook] Marking invoice as paid:', invoiceId);

        // Mark invoice as paid
        const updated = await storage.updateInvoice(invoiceId, { isPaid: true });
        
        if (!updated) {
          console.error('[Stripe Webhook] Invoice not found:', invoiceId);
          return res.status(404).json({ error: 'Invoice not found' });
        }

        console.log('[Stripe Webhook] Successfully marked invoice as paid:', invoiceId);
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error('[Stripe Webhook] Error processing webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  // Auth middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      console.log('Login request body:', req.body);
      const { username, password } = insertUserSchema.parse(req.body);
      
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ ok: false, message: "Invalid credentials" });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ ok: false, message: "Invalid credentials" });
      }

      req.session.userId = user.id;
      
      // Save session before sending response
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({ ok: false, message: "Login failed" });
        }
        res.json({ ok: true, user: { id: user.id, username: user.username } });
      });
    } catch (error) {
      console.error('Login validation error:', error);
      return res.status(400).json({ ok: false, message: "Invalid request" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ id: user.id, username: user.username, companyName: user.companyName });
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword, confirmPassword } = changePasswordSchema.parse(req.body);
      
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Update password
      await storage.updateUserPassword(user.id, hashedPassword);

      // Rotate session for security (regenerate to prevent session fixation)
      const userId = user.id;
      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regeneration error:", err);
          return res.status(500).json({ message: "Password changed but session update failed" });
        }
        
        // Reassign userId to the new session
        req.session.userId = userId;
        res.json({ message: "Password changed successfully" });
      });
    } catch (error) {
      console.error("Password change error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  app.patch("/api/auth/update-profile", requireAuth, async (req, res) => {
    try {
      const { companyName } = updateProfileSchema.parse(req.body);
      
      const updatedUser = await storage.updateUserProfile(req.session.userId!, { companyName });
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ 
        id: updatedUser.id, 
        username: updatedUser.username,
        companyName: updatedUser.companyName,
        message: "Profile updated successfully" 
      });
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Customer routes
  app.get("/api/customers", requireAuth, async (req, res) => {
    try {
      const customers = await storage.getCustomers(req.session.userId!);
      res.json(customers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  app.post("/api/customers", requireAuth, async (req, res) => {
    try {
      const customerData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer({
        ...customerData,
        userId: req.session.userId!,
      });
      res.json(customer);
    } catch (error) {
      res.status(400).json({ message: "Invalid customer data" });
    }
  });

  app.patch("/api/customers/:id", requireAuth, async (req, res) => {
    try {
      const customerData = insertCustomerSchema.parse(req.body);
      const customer = await storage.updateCustomer(req.params.id, customerData);
      
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      res.json(customer);
    } catch (error) {
      res.status(400).json({ message: "Invalid customer data" });
    }
  });

  app.delete("/api/customers/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteCustomer(req.params.id);
      res.json({ message: "Customer deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete customer" });
    }
  });

  // Invoice routes
  app.get("/api/invoices", requireAuth, async (req, res) => {
    try {
      const invoices = await storage.getInvoices(req.session.userId!);
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.get("/api/invoices/export", requireAuth, async (req, res) => {
    try {
      const invoices = await storage.getInvoices(req.session.userId!);
      
      // Prepare data for Excel export - flatten invoice items
      const exportData: any[] = [];
      
      invoices.forEach(invoice => {
        if (invoice.items && invoice.items.length > 0) {
          // For invoices with items, create a row for each item
          invoice.items.forEach((item: any, index: number) => {
            exportData.push({
              'Invoice Number': index === 0 ? invoice.invoiceNumber : '',
              'Customer Name': index === 0 ? invoice.customer?.name || 'N/A' : '',
              'Customer Email': index === 0 ? invoice.customer?.email || 'N/A' : '',
              'Date': index === 0 ? new Date(invoice.date).toLocaleDateString() : '',
              'Description': item.description,
              'Amount': `$${parseFloat(item.amount).toFixed(2)}`,
              'Total': index === 0 ? `$${parseFloat(invoice.amount).toFixed(2)}` : '',
              'Status': index === 0 ? (invoice.isPaid ? 'Paid' : 'Unpaid') : '',
            });
          });
        } else {
          // For legacy invoices without items
          exportData.push({
            'Invoice Number': invoice.invoiceNumber,
            'Customer Name': invoice.customer?.name || 'N/A',
            'Customer Email': invoice.customer?.email || 'N/A',
            'Date': new Date(invoice.date).toLocaleDateString(),
            'Description': invoice.service || 'N/A',
            'Amount': `$${parseFloat(invoice.amount).toFixed(2)}`,
            'Total': `$${parseFloat(invoice.amount).toFixed(2)}`,
            'Status': invoice.isPaid ? 'Paid' : 'Unpaid',
          });
        }
      });

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Set column widths for better readability
      worksheet['!cols'] = [
        { wch: 15 }, // Invoice Number
        { wch: 25 }, // Customer Name
        { wch: 30 }, // Customer Email
        { wch: 12 }, // Date
        { wch: 40 }, // Description
        { wch: 12 }, // Amount
        { wch: 12 }, // Total
        { wch: 10 }, // Status
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Invoices');

      // Generate buffer
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      // Set headers for file download
      const timestamp = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=invoices-${timestamp}.xlsx`);
      
      res.send(excelBuffer);
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ message: "Failed to export invoices" });
    }
  });

  app.get("/api/invoices/:id", requireAuth, async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      res.json(invoice);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  app.post("/api/invoices", requireAuth, async (req, res) => {
    try {
      const invoiceData = createInvoiceWithItemsSchema.parse(req.body);
      const invoiceNumber = await storage.getNextInvoiceNumber(req.session.userId!);
      
      // Get customer details
      const customer = await storage.getCustomer(invoiceData.customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // Calculate total amount
      const totalAmount = invoiceData.items
        .reduce((sum, item) => sum + parseFloat(item.amount), 0)
        .toFixed(2);

      // Create invoice first
      const invoice = await storage.createInvoiceWithItems({
        ...invoiceData,
        userId: req.session.userId!,
        invoiceNumber,
      });

      let paymentLinkUrl: string | undefined;

      // Create Stripe payment link
      try {
        console.log(`[Invoice ${invoiceNumber}] Creating Stripe payment link for amount $${totalAmount}`);
        const { paymentLinkId, paymentLinkUrl: linkUrl } = await createInvoicePaymentLink(
          invoiceNumber,
          customer.name,
          customer.email,
          invoiceData.items,
          totalAmount,
          invoice.id
        );

        paymentLinkUrl = linkUrl;
        console.log(`[Invoice ${invoiceNumber}] Payment link created: ${paymentLinkId}`);

        // Update invoice with payment link
        await storage.updateInvoice(invoice.id, {
          stripePaymentLinkId: paymentLinkId,
          paymentLinkUrl: paymentLinkUrl,
        });

        console.log(`[Invoice ${invoiceNumber}] Updated invoice with payment link`);
      } catch (stripeError: any) {
        console.error(`[Invoice ${invoiceNumber}] Stripe payment link creation failed:`, stripeError.message || stripeError);
        console.error(`[Invoice ${invoiceNumber}] Stack trace:`, stripeError.stack);
      }

      // Automatically send email with payment link
      try {
        const user = await storage.getUser(req.session.userId!);
        console.log(`[Invoice ${invoiceNumber}] Sending email with payment link:`, paymentLinkUrl || 'NONE');
        
        await sendInvoiceEmail(
          customer.email,
          customer.name,
          customer.phone,
          customer.address,
          invoiceNumber,
          invoiceData.items.map((item: any) => `${item.description}: $${parseFloat(item.amount).toFixed(2)}`).join(', '),
          totalAmount,
          invoiceData.date,
          user?.companyName || undefined,
          invoiceData.items,
          paymentLinkUrl
        );

        console.log(`[Invoice ${invoiceNumber}] Email sent successfully`);
      } catch (emailError: any) {
        console.error(`[Invoice ${invoiceNumber}] Email sending failed:`, emailError.message || emailError);
      }

      // Fetch and return updated invoice
      const updatedInvoice = await storage.getInvoice(invoice.id);
      res.json(updatedInvoice);
    } catch (error) {
      console.error("Invoice creation error:", error);
      res.status(400).json({ message: "Invalid invoice data" });
    }
  });

  app.patch("/api/invoices/:id", requireAuth, async (req, res) => {
    try {
      const invoiceData = createInvoiceWithItemsSchema.parse(req.body);
      
      // Verify invoice exists and user owns it
      const existingInvoice = await storage.getInvoice(req.params.id);
      if (!existingInvoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      if (existingInvoice.userId !== req.session.userId) {
        return res.status(403).json({ message: "Unauthorized to edit this invoice" });
      }

      // Verify customer exists and belongs to user
      const customer = await storage.getCustomer(invoiceData.customerId);
      if (!customer || customer.userId !== req.session.userId) {
        return res.status(404).json({ message: "Customer not found" });
      }

      // Calculate total amount from items
      const totalAmount = invoiceData.items
        .reduce((sum, item) => sum + parseFloat(item.amount), 0)
        .toFixed(2);

      // Update invoice with items (amount is calculated automatically from items)
      const updated = await storage.updateInvoiceWithItems(
        req.params.id,
        {
          customerId: invoiceData.customerId,
          date: invoiceData.date,
          isPaid: invoiceData.isPaid,
        },
        invoiceData.items
      );

      res.json(updated);
    } catch (error) {
      console.error("Invoice update error:", error);
      res.status(400).json({ message: "Invalid invoice data" });
    }
  });

  app.patch("/api/invoices/:id/mark-paid", requireAuth, async (req, res) => {
    try {
      const { isPaid } = req.body;
      const invoice = await storage.getInvoice(req.params.id);
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      const updated = await storage.updateInvoice(req.params.id, { isPaid });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update invoice" });
    }
  });

  app.post("/api/invoices/:id/email", requireAuth, async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      
      if (!invoice || !invoice.customer) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      const user = await storage.getUser(req.session.userId!);

      // Debug logging for payment link
      console.log(`[Email Invoice ${invoice.invoiceNumber}] Payment link URL:`, invoice.paymentLinkUrl || 'NONE');
      console.log(`[Email Invoice ${invoice.invoiceNumber}] Payment link ID:`, invoice.stripePaymentLinkId || 'NONE');

      // Use items if available, otherwise use legacy service field
      const serviceDescription = invoice.items && invoice.items.length > 0
        ? invoice.items.map((item: any) => `${item.description}: $${parseFloat(item.amount).toFixed(2)}`).join(', ')
        : invoice.service;

      await sendInvoiceEmail(
        invoice.customer.email,
        invoice.customer.name,
        invoice.customer.phone,
        invoice.customer.address,
        invoice.invoiceNumber,
        serviceDescription,
        invoice.amount,
        invoice.date,
        user?.companyName || undefined,
        invoice.items || [],
        invoice.paymentLinkUrl || undefined
      );

      res.json({ message: "Invoice sent successfully" });
    } catch (error) {
      console.error("Email sending error:", error);
      res.status(500).json({ message: "Failed to send invoice email" });
    }
  });

  app.get("/api/invoices/:id/download", requireAuth, async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      
      if (!invoice || !invoice.customer) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      const user = await storage.getUser(req.session.userId!);

      // Use items if available, otherwise use legacy service field
      const invoiceItems = invoice.items && invoice.items.length > 0
        ? invoice.items.map((item: any) => ({ description: item.description, amount: item.amount }))
        : [{ description: invoice.service || "Service", amount: invoice.amount || "0" }];

      const pdfBuffer = await generateInvoicePDF(
        invoice.customer.name,
        invoice.customer.email,
        invoice.customer.phone,
        invoice.customer.address,
        invoice.invoiceNumber,
        invoice.date,
        invoiceItems,
        invoice.amount || "0",
        user?.companyName || undefined
      );

      // Set headers for file download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`);
      
      res.send(pdfBuffer);
    } catch (error) {
      console.error("PDF generation error:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  app.delete("/api/invoices/:id", requireAuth, async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Verify ownership
      if (invoice.userId !== req.session.userId) {
        return res.status(403).json({ message: "Unauthorized to delete this invoice" });
      }

      await storage.deleteInvoice(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete invoice:", error);
      res.status(500).json({ message: "Failed to delete invoice" });
    }
  });

  // Recurring Invoice routes
  app.get("/api/recurring-invoices", requireAuth, async (req, res) => {
    try {
      const recurringInvoices = await storage.getRecurringInvoices(req.session.userId!);
      res.json(recurringInvoices);
    } catch (error) {
      console.error("Failed to fetch recurring invoices:", error);
      res.status(500).json({ message: "Failed to fetch recurring invoices" });
    }
  });

  app.get("/api/recurring-invoices/:id", requireAuth, async (req, res) => {
    try {
      const recurringInvoice = await storage.getRecurringInvoice(req.params.id);
      
      if (!recurringInvoice) {
        return res.status(404).json({ message: "Recurring invoice not found" });
      }
      
      res.json(recurringInvoice);
    } catch (error) {
      console.error("Failed to fetch recurring invoice:", error);
      res.status(500).json({ message: "Failed to fetch recurring invoice" });
    }
  });

  app.post("/api/recurring-invoices", requireAuth, async (req, res) => {
    try {
      const recurringInvoiceData = createRecurringInvoiceWithItemsSchema.parse(req.body);
      
      // Verify customer exists
      const customer = await storage.getCustomer(recurringInvoiceData.customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      const recurringInvoice = await storage.createRecurringInvoiceWithItems({
        ...recurringInvoiceData,
        userId: req.session.userId!,
      });

      res.json(recurringInvoice);
    } catch (error) {
      console.error("Recurring invoice creation error:", error);
      res.status(400).json({ message: "Invalid recurring invoice data" });
    }
  });

  app.patch("/api/recurring-invoices/:id", requireAuth, async (req, res) => {
    try {
      const recurringInvoice = await storage.getRecurringInvoice(req.params.id);
      
      if (!recurringInvoice) {
        return res.status(404).json({ message: "Recurring invoice not found" });
      }

      const { items, ...invoiceData } = req.body;
      
      // Update recurring invoice with items if items are provided
      const updated = items 
        ? await storage.updateRecurringInvoiceWithItems(req.params.id, invoiceData, items)
        : await storage.updateRecurringInvoice(req.params.id, invoiceData);
      
      res.json(updated);
    } catch (error) {
      console.error("Failed to update recurring invoice:", error);
      res.status(500).json({ message: "Failed to update recurring invoice" });
    }
  });

  app.delete("/api/recurring-invoices/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteRecurringInvoice(req.params.id);
      res.json({ message: "Recurring invoice deleted" });
    } catch (error) {
      console.error("Failed to delete recurring invoice:", error);
      res.status(500).json({ message: "Failed to delete recurring invoice" });
    }
  });

  app.post("/api/recurring-invoices/:id/generate", requireAuth, async (req, res) => {
    try {
      const recurringInvoice = await storage.getRecurringInvoice(req.params.id);
      
      if (!recurringInvoice || !recurringInvoice.customer) {
        return res.status(404).json({ message: "Recurring invoice not found" });
      }

      if (!recurringInvoice.isActive) {
        return res.status(400).json({ message: "Recurring invoice is not active" });
      }

      // Get next invoice number
      const invoiceNumber = await storage.getNextInvoiceNumber(req.session.userId!);
      
      // Create invoice from recurring template
      const currentDate = new Date().toISOString().split('T')[0];
      const invoice = await storage.createInvoiceWithItems({
        customerId: recurringInvoice.customerId,
        recurringInvoiceId: req.params.id,
        date: currentDate,
        isPaid: false,
        items: recurringInvoice.items.map((item: any) => ({
          description: item.description,
          amount: item.amount,
        })),
        userId: req.session.userId!,
        invoiceNumber,
      });

      // Update recurring invoice with next invoice date
      const nextDate = calculateNextInvoiceDate(recurringInvoice.frequency, currentDate);
      await storage.updateRecurringInvoiceNextDate(req.params.id, nextDate, currentDate);

      // Send email if customer has email
      if (recurringInvoice.customer.email) {
        try {
          const user = await storage.getUser(req.session.userId!);
          await sendInvoiceEmail(
            recurringInvoice.customer.email,
            recurringInvoice.customer.name,
            recurringInvoice.customer.phone,
            recurringInvoice.customer.address,
            invoiceNumber,
            "", // service field not used
            recurringInvoice.amount,
            currentDate,
            user?.companyName || undefined,
            recurringInvoice.items.map((item: any) => ({
              description: item.description,
              amount: item.amount,
            }))
          );
        } catch (emailError) {
          console.error("Email sending error:", emailError);
          // Don't fail the request if email fails
        }
      }

      res.json(invoice);
    } catch (error) {
      console.error("Failed to generate invoice:", error);
      res.status(500).json({ message: "Failed to generate invoice" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to calculate next invoice date based on frequency
function calculateNextInvoiceDate(frequency: string, currentDate: string): string {
  const date = new Date(currentDate);
  
  switch (frequency) {
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }
  
  return date.toISOString().split('T')[0];
}
