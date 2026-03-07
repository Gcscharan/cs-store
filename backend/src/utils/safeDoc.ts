/**
 * Safe document conversion utilities
 * Prevents leaking Mongoose internal properties when returning documents in API responses
 */

/**
 * Convert a Mongoose document or subdocument to a plain object.
 * Safely handles null/undefined and non-Mongoose objects.
 * 
 * @param doc - Mongoose document, subdocument, or any object
 * @returns Plain JavaScript object without Mongoose internals
 * 
 * @example
 * // Safe conversion
 * const cleanAddress = safeDoc(address);
 * res.json({ address: cleanAddress });
 * 
 * @example
 * // With versionKey removal
 * const cleanUser = safeDoc(user); // __v removed automatically
 */
export const safeDoc = <T = any>(doc: T): T => {
  if (!doc) return doc;
  
  // Check if it's a Mongoose document with toObject method
  if (typeof (doc as any).toObject === "function") {
    return (doc as any).toObject({ versionKey: false }) as T;
  }
  
  // Return as-is if it's already a plain object
  return doc;
};

/**
 * Convert multiple Mongoose documents to plain objects.
 * 
 * @param docs - Array of Mongoose documents
 * @returns Array of plain JavaScript objects
 */
export const safeDocs = <T = any>(docs: T[]): T[] => {
  if (!Array.isArray(docs)) return docs;
  return docs.map(safeDoc);
};

/**
 * Safely extract and convert a subdocument from a parent document.
 * Ensures no parent document reference leaks.
 * 
 * @param doc - Parent Mongoose document
 * @param path - Path to subdocument (e.g., 'address', 'profile.settings')
 * @returns Plain object or null if not found
 */
export const safeSubdoc = <T = any>(doc: any, path: string): T | null => {
  if (!doc) return null;
  
  const parts = path.split(".");
  let current: any = doc;
  
  for (const part of parts) {
    if (!current || typeof current !== "object") return null;
    current = current[part];
    if (current === undefined) return null;
  }
  
  return safeDoc<T>(current);
};
