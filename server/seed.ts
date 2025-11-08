import { db } from "./db";
import { users } from "@shared/schema";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";

async function seed() {
  try {
    const username = "admin";
    
    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.username, username));
    
    if (existingUser.length === 0) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      
      await db.insert(users).values({
        username,
        password: hashedPassword,
      });
      
      console.log("✓ Default user created");
      console.log("  Username: admin");
      console.log("  Password: admin123");
    } else {
      console.log("✓ Default user already exists");
    }
    
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

seed();
