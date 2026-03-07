/**
 * Sanitize User Object
 * 
 * Removes sensitive fields from user objects before sending in API responses.
 * This ensures passwordHash and other sensitive data are never exposed.
 */

/**
 * Fields that should never be exposed in API responses
 */
const SENSITIVE_FIELDS = [
  "passwordHash",
  "pendingEmailToken",
  "oauthProviders", // Contains provider tokens/IDs
  "__v",
];

/**
 * Sanitizes a user object by removing sensitive fields
 * 
 * @param user - Mongoose user document or plain object
 * @returns Sanitized user object without sensitive fields
 */
export function sanitizeUser(user: any): any {
  if (!user) return null;

  // Handle Mongoose document
  let obj: any;
  if (typeof user.toObject === "function") {
    obj = user.toObject();
  } else if (typeof user.toJSON === "function") {
    obj = user.toJSON();
  } else {
    obj = { ...user };
  }

  // Remove sensitive fields
  for (const field of SENSITIVE_FIELDS) {
    delete obj[field];
  }

  return obj;
}

/**
 * Sanitizes an array of user objects
 * 
 * @param users - Array of user documents or objects
 * @returns Array of sanitized user objects
 */
export function sanitizeUsers(users: any[]): any[] {
  if (!users || !Array.isArray(users)) return [];
  return users.map(sanitizeUser);
}

/**
 * Creates a safe user response object with standard fields
 * 
 * @param user - Mongoose user document
 * @returns Sanitized user object with standard API response fields
 */
export function toSafeUserResponse(user: any): any {
  const sanitized = sanitizeUser(user);
  if (!sanitized) return null;

  return {
    id: sanitized._id?.toString() || sanitized.id,
    name: sanitized.name,
    email: sanitized.email,
    phone: sanitized.phone,
    role: sanitized.role,
    isAdmin: sanitized.role === "admin",
    status: sanitized.status,
    addresses: sanitized.addresses || [],
    profileCompleted: sanitized.profileCompleted || sanitized.isProfileComplete || false,
    mobileVerified: sanitized.mobileVerified || false,
    isProfileComplete: sanitized.isProfileComplete || false,
    createdAt: sanitized.createdAt,
    updatedAt: sanitized.updatedAt,
  };
}
