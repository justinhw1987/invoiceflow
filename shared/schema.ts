import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, boolean, integer, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enum for recurring invoice frequency
export const frequencyEnum = pgEnum("frequency", ["weekly", "monthly", "quarterly", "yearly"]);

// Users table for authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  companyName: text("company_name"),
});

// Customers table
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Recurring Invoices table
export const recurringInvoices = pgTable("recurring_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  customerId: varchar("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // User-friendly name for the recurring invoice
  frequency: frequencyEnum("frequency").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"), // nullable - no end date means indefinite
  nextInvoiceDate: text("next_invoice_date").notNull(),
  lastInvoiceDate: text("last_invoice_date"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Invoices table
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  customerId: varchar("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  recurringInvoiceId: varchar("recurring_invoice_id").references(() => recurringInvoices.id, { onDelete: "set null" }),
  invoiceNumber: integer("invoice_number").notNull(),
  date: text("date").notNull(),
  service: text("service"),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  isPaid: boolean("is_paid").notNull().default(false),
  googleSheetRowId: text("google_sheet_row_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Recurring Invoice Items table (line items for recurring invoices)
export const recurringInvoiceItems = pgTable("recurring_invoice_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recurringInvoiceId: varchar("recurring_invoice_id").notNull().references(() => recurringInvoices.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Invoice Items table (line items for each invoice)
export const invoiceItems = pgTable("invoice_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  customers: many(customers),
  invoices: many(invoices),
  recurringInvoices: many(recurringInvoices),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  user: one(users, {
    fields: [customers.userId],
    references: [users.id],
  }),
  invoices: many(invoices),
  recurringInvoices: many(recurringInvoices),
}));

export const recurringInvoicesRelations = relations(recurringInvoices, ({ one, many }) => ({
  user: one(users, {
    fields: [recurringInvoices.userId],
    references: [users.id],
  }),
  customer: one(customers, {
    fields: [recurringInvoices.customerId],
    references: [customers.id],
  }),
  items: many(recurringInvoiceItems),
  generatedInvoices: many(invoices),
}));

export const recurringInvoiceItemsRelations = relations(recurringInvoiceItems, ({ one }) => ({
  recurringInvoice: one(recurringInvoices, {
    fields: [recurringInvoiceItems.recurringInvoiceId],
    references: [recurringInvoices.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  user: one(users, {
    fields: [invoices.userId],
    references: [users.id],
  }),
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  recurringInvoice: one(recurringInvoices, {
    fields: [invoices.recurringInvoiceId],
    references: [recurringInvoices.id],
  }),
  items: many(invoiceItems),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  userId: true,
  invoiceNumber: true,
  googleSheetRowId: true,
  createdAt: true,
  updatedAt: true,
  service: true,
  amount: true,
});

export const insertInvoiceItemSchema = createInsertSchema(invoiceItems).omit({
  id: true,
  invoiceId: true,
  createdAt: true,
});

export const insertRecurringInvoiceSchema = createInsertSchema(recurringInvoices).omit({
  id: true,
  userId: true,
  nextInvoiceDate: true,
  lastInvoiceDate: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRecurringInvoiceItemSchema = createInsertSchema(recurringInvoiceItems).omit({
  id: true,
  recurringInvoiceId: true,
  createdAt: true,
});

// Password change schema with validation
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string()
    .min(10, "Password must be at least 10 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

// Update profile schema
export const updateProfileSchema = z.object({
  companyName: z.string().min(1, "Company name is required").max(255, "Company name is too long"),
});

// Schema for creating invoice with items
export const createInvoiceWithItemsSchema = insertInvoiceSchema.extend({
  items: z.array(insertInvoiceItemSchema).min(1, "At least one line item is required"),
});

// Schema for creating recurring invoice with items
export const createRecurringInvoiceWithItemsSchema = insertRecurringInvoiceSchema.extend({
  items: z.array(insertRecurringInvoiceItemSchema).min(1, "At least one line item is required"),
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type InvoiceItem = typeof invoiceItems.$inferSelect;

export type InsertRecurringInvoice = z.infer<typeof insertRecurringInvoiceSchema>;
export type RecurringInvoice = typeof recurringInvoices.$inferSelect;

export type InsertRecurringInvoiceItem = z.infer<typeof insertRecurringInvoiceItemSchema>;
export type RecurringInvoiceItem = typeof recurringInvoiceItems.$inferSelect;

export type CreateInvoiceWithItems = z.infer<typeof createInvoiceWithItemsSchema>;
export type CreateRecurringInvoiceWithItems = z.infer<typeof createRecurringInvoiceWithItemsSchema>;

export type ChangePassword = z.infer<typeof changePasswordSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
