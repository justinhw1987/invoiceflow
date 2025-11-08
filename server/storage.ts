// Reference: javascript_database integration blueprint
import { users, customers, invoices, invoiceItems, type User, type InsertUser, type Customer, type InsertCustomer, type Invoice, type InsertInvoice, type InvoiceItem, type InsertInvoiceItem, type CreateInvoiceWithItems } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<void>;
  updateUserProfile(userId: string, data: { companyName: string }): Promise<User | undefined>;

  // Customer methods
  getCustomers(userId: string): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer & { userId: string }): Promise<Customer>;
  updateCustomer(id: string, customer: InsertCustomer): Promise<Customer | undefined>;
  deleteCustomer(id: string): Promise<void>;

  // Invoice methods
  getInvoices(userId: string): Promise<any[]>;
  getInvoice(id: string): Promise<any | undefined>;
  createInvoice(invoice: InsertInvoice & { userId: string; invoiceNumber: number }): Promise<Invoice>;
  createInvoiceWithItems(invoice: CreateInvoiceWithItems & { userId: string; invoiceNumber: number }): Promise<Invoice>;
  updateInvoice(id: string, data: Partial<Invoice>): Promise<Invoice | undefined>;
  getNextInvoiceNumber(userId: string): Promise<number>;
  getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId));
  }

  async updateUserProfile(userId: string, data: { companyName: string }): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ companyName: data.companyName })
      .where(eq(users.id, userId))
      .returning();
    return updated || undefined;
  }

  // Customer methods
  async getCustomers(userId: string): Promise<Customer[]> {
    return await db.select().from(customers).where(eq(customers.userId, userId)).orderBy(desc(customers.createdAt));
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer || undefined;
  }

  async createCustomer(customer: InsertCustomer & { userId: string }): Promise<Customer> {
    const [newCustomer] = await db
      .insert(customers)
      .values(customer)
      .returning();
    return newCustomer;
  }

  async updateCustomer(id: string, customer: InsertCustomer): Promise<Customer | undefined> {
    const [updated] = await db
      .update(customers)
      .set(customer)
      .where(eq(customers.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCustomer(id: string): Promise<void> {
    await db.delete(customers).where(eq(customers.id, id));
  }

  // Invoice methods
  async getInvoices(userId: string): Promise<any[]> {
    const results = await db
      .select({
        id: invoices.id,
        userId: invoices.userId,
        customerId: invoices.customerId,
        invoiceNumber: invoices.invoiceNumber,
        date: invoices.date,
        service: invoices.service,
        amount: invoices.amount,
        isPaid: invoices.isPaid,
        googleSheetRowId: invoices.googleSheetRowId,
        createdAt: invoices.createdAt,
        updatedAt: invoices.updatedAt,
        customer: customers,
      })
      .from(invoices)
      .leftJoin(customers, eq(invoices.customerId, customers.id))
      .where(eq(invoices.userId, userId))
      .orderBy(desc(invoices.createdAt));

    // Fetch items for each invoice
    const invoicesWithItems = await Promise.all(
      results.map(async (invoice) => {
        const items = await this.getInvoiceItems(invoice.id);
        // Calculate total from items if they exist
        const total = items.length > 0 
          ? items.reduce((sum, item) => sum + parseFloat(item.amount), 0).toFixed(2)
          : invoice.amount;
        return {
          ...invoice,
          items,
          amount: total,
        };
      })
    );

    return invoicesWithItems;
  }

  async getInvoice(id: string): Promise<any | undefined> {
    const [result] = await db
      .select({
        id: invoices.id,
        userId: invoices.userId,
        customerId: invoices.customerId,
        invoiceNumber: invoices.invoiceNumber,
        date: invoices.date,
        service: invoices.service,
        amount: invoices.amount,
        isPaid: invoices.isPaid,
        googleSheetRowId: invoices.googleSheetRowId,
        createdAt: invoices.createdAt,
        updatedAt: invoices.updatedAt,
        customer: customers,
      })
      .from(invoices)
      .leftJoin(customers, eq(invoices.customerId, customers.id))
      .where(eq(invoices.id, id));

    if (!result) return undefined;

    // Fetch items for the invoice
    const items = await this.getInvoiceItems(result.id);
    // Calculate total from items if they exist
    const total = items.length > 0 
      ? items.reduce((sum, item) => sum + parseFloat(item.amount), 0).toFixed(2)
      : result.amount;

    return {
      ...result,
      items,
      amount: total,
    };
  }

  async createInvoice(invoice: InsertInvoice & { userId: string; invoiceNumber: number }): Promise<Invoice> {
    const [newInvoice] = await db
      .insert(invoices)
      .values(invoice)
      .returning();
    return newInvoice;
  }

  async updateInvoice(id: string, data: Partial<Invoice>): Promise<Invoice | undefined> {
    const [updated] = await db
      .update(invoices)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    return updated || undefined;
  }

  async createInvoiceWithItems(invoice: CreateInvoiceWithItems & { userId: string; invoiceNumber: number }): Promise<Invoice> {
    const { items, ...invoiceData } = invoice;
    
    // Create invoice
    const [newInvoice] = await db
      .insert(invoices)
      .values(invoiceData)
      .returning();

    // Create invoice items
    if (items && items.length > 0) {
      await db
        .insert(invoiceItems)
        .values(items.map(item => ({
          ...item,
          invoiceId: newInvoice.id,
        })));
    }

    return newInvoice;
  }

  async getNextInvoiceNumber(userId: string): Promise<number> {
    const userInvoices = await db
      .select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(eq(invoices.userId, userId))
      .orderBy(desc(invoices.invoiceNumber))
      .limit(1);

    return userInvoices.length > 0 ? userInvoices[0].invoiceNumber + 1 : 1001;
  }

  async getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
    return await db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, invoiceId));
  }
}

export const storage = new DatabaseStorage();
