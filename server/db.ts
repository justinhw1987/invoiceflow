// Database connection supporting both Replit (Neon) and Railway (standard PostgreSQL)
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure SSL for production environments like Railway
const isProduction = process.env.NODE_ENV === 'production';
const connectionString = process.env.DATABASE_URL;

export const pool = new Pool({ 
  connectionString,
  ssl: isProduction ? { rejectUnauthorized: false } : undefined
});

export const db = drizzle(pool, { schema });
