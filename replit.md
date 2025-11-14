# Invoice Management Application

## Overview

This is a professional invoice management system built with React, Express, and PostgreSQL. The application enables users to create, track, and manage customer invoices with automated email delivery and Excel export functionality for invoice data.

**Core Purpose:** Streamline invoice workflows for small businesses and freelancers by providing a centralized platform for customer management, invoice creation, payment tracking, and automated communications.

**Key Features:**
- Customer relationship management (CRM) with full CRUD operations
- Invoice generation with sequential numbering and PDF preview
- **Invoice editing:** Update invoice details, customer, date, and line items after creation
- **Invoice deletion:** Delete invoices with confirmation dialog and warnings for paid/recurring invoices
- PDF download functionality available in both invoice table and invoice view dialog
- Payment status tracking with Excel export capability
- Automatic email delivery of invoices to customers via Resend when created
- Manual email resend option available from invoices page (resends PDF to customer)
- Customizable company name in account settings (used in outbound emails and PDFs)
- Password change functionality with secure validation
- Session-based authentication with bcrypt password hashing
- Responsive design following Material Design principles with Linear-inspired aesthetics

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework:** React 18 with TypeScript in SPA mode

**UI Component Strategy:**
- shadcn/ui component library built on Radix UI primitives
- Tailwind CSS for styling with custom design tokens
- Component structure follows atomic design principles (ui components, composed components, pages)
- Form validation using React Hook Form with Zod schemas
- State management via TanStack Query (React Query) for server state

**Routing:**
- Client-side routing with Wouter (lightweight alternative to React Router)
- Route protection via AuthGuard component that checks session validity
- Routes: /login, / (dashboard), /customers, /invoices, /invoices/new, /invoices/:id/edit
- Invoice viewing handled via modal dialog (InvoiceViewDialog) rather than separate detail route
- Invoice editing reuses CreateInvoice component with edit mode (pre-populates form, changes title/buttons)

**Design System:**
- Typography: Inter font family from Google Fonts
- Color scheme: Neutral base with primary blue accent (defined in CSS custom properties)
- Spacing: Tailwind's default scale (2, 4, 6, 8 units)
- Components styled with "new-york" variant of shadcn/ui
- Responsive grid layouts with mobile-first breakpoints

### Backend Architecture

**Framework:** Express.js with TypeScript

**API Structure:**
- RESTful endpoints under `/api` prefix
- Authentication endpoints: POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me, PATCH /api/auth/change-password, PATCH /api/auth/update-profile
- Customer endpoints: GET/POST /api/customers, GET/PATCH/DELETE /api/customers/:id
- Invoice endpoints: GET/POST /api/invoices, GET /api/invoices/:id, PATCH /api/invoices/:id, DELETE /api/invoices/:id, GET /api/invoices/export, GET /api/invoices/:id/download, PATCH /api/invoices/:id/mark-paid, POST /api/invoices/:id/email
- **Invoice edit/delete:** PATCH and DELETE endpoints validate ownership, PATCH atomically updates invoice and replaces line items, DELETE includes safeguards for paid/recurring invoices
- **Note:** Specific routes (like /export and /download) are placed before parameterized routes (like /:id) to prevent route matching conflicts

**Session Management:**
- express-session middleware with PostgreSQL session store (connect-pg-simple)
- Session secret configured via environment variable
- 7-day cookie expiration with httpOnly flag
- Authentication middleware (requireAuth) protects all non-auth routes

**Data Validation:**
- Shared Zod schemas between client and server for type safety
- Request body validation using drizzle-zod insert schemas

**Error Handling:**
- Centralized error responses with appropriate HTTP status codes
- Request/response logging middleware for API calls

### Data Storage

**Database:** PostgreSQL (via Neon serverless driver)

**ORM:** Drizzle ORM with type-safe query builder

**Schema Design:**
```
users
  - id (UUID, primary key)
  - username (text, unique)
  - password (text, bcrypt hashed)
  - companyName (text, nullable)

customers
  - id (UUID, primary key)
  - userId (foreign key to users)
  - name, email, phone, address (text fields)
  - createdAt (timestamp)
  - Cascade delete when user is deleted

invoices
  - id (UUID, primary key)
  - userId (foreign key to users)
  - customerId (foreign key to customers)
  - invoiceNumber (integer, sequential per user)
  - date, service (text)
  - amount (decimal 10,2)
  - isPaid (boolean, default false)
  - createdAt, updatedAt (timestamps)
  - Cascade delete when user or customer is deleted
```

**Migration Strategy:**
- Drizzle Kit for schema migrations
- Push-based deployment (drizzle-kit push)
- Schema defined in shared/schema.ts for cross-environment consistency

**Database Access Pattern:**
- Storage abstraction layer (IStorage interface in server/storage.ts)
- DatabaseStorage implementation using Drizzle ORM
- All queries filtered by userId for multi-tenant data isolation
- Connection pooling via @neondatabase/serverless Pool

### External Dependencies

**Email Service: Resend**
- Integration via Replit Connectors API
- Dynamic credential retrieval using REPLIT_CONNECTORS_HOSTNAME
- Authentication via REPL_IDENTITY or WEB_REPL_RENEWAL tokens
- Uncachable client pattern (getUncachableResendClient) to handle credential rotation
- Sends invoice details in HTML email format with PDF attachment
- Email body uses HTML table layout (not flexbox) for reliable rendering across all email clients
- Table format mirrors PDF layout: description column (left-aligned), amount column (right-aligned)
- PDF generation using pdfkit library with professional formatting
- PDF includes company name, customer details, invoice number, date, line items, and total
- PDF attached to email as `invoice-{invoiceNumber}.pdf` (base64 encoded)
- Configured with from_email and api_key from connector settings
- Uses user's company name if set, otherwise defaults to "Invoice Manager"
- **Security:** All user-controlled fields (companyName, customerName, descriptions) are HTML-escaped to prevent injection attacks

**Excel Export: xlsx Library**
- Client-side download of invoice data in Excel format (.xlsx)
- Triggered via GET /api/invoices/export endpoint
- Generated file includes:
  - Invoice Number
  - Customer Name and Email
  - Date, Service, and Amount
  - Payment Status (Paid/Unpaid)
- Filename format: invoices-YYYY-MM-DD.xlsx
- Excel files generated server-side using xlsx library with formatted columns and proper headers

**Authentication:**
- bcrypt for password hashing (10 rounds)
- Session tokens stored in PostgreSQL via connect-pg-simple

**Build Tooling:**
- Vite for frontend bundling with React plugin
- esbuild for server-side bundling (ESM format)
- TypeScript compiler for type checking (noEmit mode)
- Development: tsx for running TypeScript directly
- Production: Compiled to dist/ directory

**Development Tools:**
- @replit/vite-plugin-runtime-error-modal for error overlay
- @replit/vite-plugin-cartographer for code navigation
- @replit/vite-plugin-dev-banner for development indicators
- Hot module replacement (HMR) enabled in development

**Deployment Environment:**
- Designed for Replit deployment infrastructure
- Environment variables: DATABASE_URL, SESSION_SECRET, REPLIT_CONNECTORS_HOSTNAME
- Node.js runtime with ESM module system
- Static file serving for production build