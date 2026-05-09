/**
 * Centralized email fallback utility
 * 
 * Ensures all systems have a valid email for external APIs (Razorpay, etc.)
 * while maintaining phone-only authentication for customers.
 */

export interface UserWithContact {
  email?: string;
  phone?: string;
}

export function getSafeEmail(user: UserWithContact): string {
  // Use real email if available and not empty
  if (user?.email && user.email.trim() !== "") {
    return user.email;
  }
  
  // Generate email from phone for customers
  if (user?.phone) {
    return `${user.phone}@noemail.vyaparsetu`;
  }
  
  // Final fallback (should rarely happen)
  return `unknown@noemail.vyaparsetu`;
}

/**
 * Check if email is system-generated (not real user email)
 */
export function isGeneratedEmail(email: string): boolean {
  return email.endsWith('@noemail.vyaparsetu');
}

/**
 * Extract phone from generated email
 */
export function extractPhoneFromGeneratedEmail(email: string): string | null {
  if (!isGeneratedEmail(email)) return null;
  
  const match = email.match(/^(\d+)@noemail\.vyaparsetu$/);
  return match ? match[1] : null;
}