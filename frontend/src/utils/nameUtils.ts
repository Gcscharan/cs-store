/**
 * Utility functions for handling user names
 */

/**
 * Extracts the first name from a full name
 * @param fullName - The full name string
 * @param maxLength - Maximum length for the first name (default: 15)
 * @returns The first name, truncated if necessary
 */
export const getFirstName = (
  fullName: string | undefined | null,
  maxLength: number = 15
): string => {
  if (!fullName) return "User";

  // Split by spaces and take the first part
  const firstName = fullName.trim().split(" ")[0];

  // Truncate if too long
  if (firstName.length > maxLength) {
    return firstName.substring(0, maxLength) + "...";
  }

  return firstName;
};

/**
 * Gets a display name for the user, showing first name with fallback
 * @param fullName - The full name string
 * @param maxLength - Maximum length for the display name (default: 15)
 * @returns A display-friendly name
 */
export const getDisplayName = (
  fullName: string | undefined | null,
  maxLength: number = 15
): string => {
  return getFirstName(fullName, maxLength);
};
