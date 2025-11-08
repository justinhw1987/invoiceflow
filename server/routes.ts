import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCustomerSchema, insertInvoiceSchema, insertUserSchema, changePasswordSchema } from "@shared/schema";
import bcrypt from "bcrypt";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { sendInvoiceEmail } from "./email";
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
      res.json({ ok: true, user: { id: user.id, username: user.username } });
    } catch (error) {
      console.error('Login validation error:', error);
      res.status(400).json({ ok: false, message: "Invalid request" });
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

    res.json({ id: user.id, username: user.username });
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
      
      // Prepare data for Excel export
      const exportData = invoices.map(invoice => ({
        'Invoice Number': invoice.invoiceNumber,
        'Customer Name': invoice.customer?.name || 'N/A',
        'Customer Email': invoice.customer?.email || 'N/A',
        'Date': new Date(invoice.date).toLocaleDateString(),
        'Service': invoice.service,
        'Amount': `$${parseFloat(invoice.amount).toFixed(2)}`,
        'Status': invoice.isPaid ? 'Paid' : 'Unpaid',
      }));

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Set column widths for better readability
      worksheet['!cols'] = [
        { wch: 15 }, // Invoice Number
        { wch: 25 }, // Customer Name
        { wch: 30 }, // Customer Email
        { wch: 12 }, // Date
        { wch: 40 }, // Service
        { wch: 12 }, // Amount
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
      const invoiceData = insertInvoiceSchema.parse(req.body);
      const invoiceNumber = await storage.getNextInvoiceNumber(req.session.userId!);
      
      // Get customer details for Google Sheets
      const customer = await storage.getCustomer(invoiceData.customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      const invoice = await storage.createInvoice({
        ...invoiceData,
        userId: req.session.userId!,
        invoiceNumber,
      });

      res.json(invoice);
    } catch (error) {
      console.error("Invoice creation error:", error);
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

      await sendInvoiceEmail(
        invoice.customer.email,
        invoice.customer.name,
        invoice.invoiceNumber,
        invoice.service,
        invoice.amount,
        invoice.date
      );

      res.json({ message: "Invoice sent successfully" });
    } catch (error) {
      console.error("Email sending error:", error);
      res.status(500).json({ message: "Failed to send invoice email" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
