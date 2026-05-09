/**
 * Generate a customer email address for payment gateways and external services
 * 
 * This utility provides a centralized way to generate email addresses for customers
 * who sign up with phone-only authentication. It ensures consistency across the
 * application and provides a fallback for services that require email addresses.
 * 
 * @module generateCustomerEmail
 */

interface User {
  email?: string;
  phone?: string;
  _id?: string;
}

/**
 * Generate an email address for a customer
 * 
 * Priority:
 * 1. Use existing email if available (OAuth users, legacy users)
 * 2. Generate from phone number: {phone}@customer.internal
 * 3. Fallback to user ID if no phone: user-{id}@customer.internal
 * 
 * @param user - User object with optional email, phone, and _id
 * @returns Email address string
 * 
 * @example
 * // User with email (OAuth or legacy)
 * generateCustomerEmail({ email: 'john@gmail.com', phone: '9876543210' })
 * // Returns: 'john@gmail.com'
 * 
 * @example
 * // User with phone only (new customer)
 * generateCustomerEmail({ phone: '9876543210' })
 * // Returns: '9876543210@customer.internal'
 * 
 * @example
 * // User with neither email nor phone (edge case)
 * generateCustomerEmail({ _id: '507f1f77bcf86cd799439011' })
 * // Returns: 'user-507f1f77bcf86cd799439011@customer.internal'
 */
export function generateCustomerEmail(user: User): string {
  // Priority 1: Use existing email if available
  if (user.email && user.email.trim()) {
    return user.email.trim();
  }

  // Priority 2: Generate from phone number
  if (user.phone && user.phone.trim()) {
    const phoneDigits = user.phone.replace(/\D/g, '');
    return `${phoneDigits}@customer.internal`;
  }

  // Priority 3: Fallback to user ID (should rarely happen)
  if (user._id) {
    return `user-${user._id}@customer.internal`;
  }

  // Ultimate fallback (should never happen in production)
  return 'unknown@customer.internal';
}

/**
 * Check if an email is a generated internal email
 * 
 * @param email - Email address to check
 * @returns True if email is a generated internal email
 * 
 * @example
 * isInternalEmail('9876543210@customer.internal') // Returns: true
 * isInternalEmail('john@gmail.com') // Returns: false
 */
export function isInternalEmail(email: string): boolean {
  return email.endsWith('@customer.internal');
}

/**
 * Extract phone number from a generated internal email
 * 
 * @param email - Generated internal email address
 * @returns Phone number if email is internal, null otherwise
 * 
 * @example
 * extractPhoneFromEmail('9876543210@customer.internal') // Returns: '9876543210'
 * extractPhoneFromEmail('john@gmail.com') // Returns: null
 */
export function extractPhoneFromEmail(email: string): string | null {
  if (!isInternalEmail(email)) {
    return null;
  }

  const match = email.match(/^(\d+)@customer\.internal$/);
  return match ? match[1] : null;
}
