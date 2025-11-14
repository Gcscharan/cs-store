// Simple pincode validator for Andhra Pradesh and Telangana
export const isValidPincode = (pincode: string): boolean => {
  const pin = parseInt(pincode, 10);
  return (
    (pin >= 500000 && pin <= 534000) || // Andhra Pradesh
    (pin >= 500001 && pin <= 509999) // Telangana
  );
};

// Get error message for invalid pincode
export const getPincodeError = (pincode: string): string => {
  if (!pincode || pincode.length !== 6) {
    return "Please enter a valid 6-digit pincode";
  }

  if (!/^\d{6}$/.test(pincode)) {
    return "Please enter a valid 6-digit pincode";
  }

  if (!isValidPincode(pincode)) {
    return "Please enter a valid pincode from Andhra Pradesh or Telangana.";
  }

  return "";
};

// Get city and state based on pincode
export const getCityAndStateFromPincode = (
  pincode: string
): { city: string; state: string } => {
  const pin = parseInt(pincode, 10);

  if (pin >= 500001 && pin <= 509999) {
    // Telangana (Hyderabad region)
    return {
      city: "Hyderabad",
      state: "Telangana",
    };
  } else if (pin >= 520000 && pin <= 534000) {
    // Andhra Pradesh (Vijayawada, Guntur, etc.)
    if (pin >= 520000 && pin <= 520999) {
      return { city: "Vijayawada", state: "Andhra Pradesh" };
    } else if (pin >= 522000 && pin <= 522999) {
      return { city: "Guntur", state: "Andhra Pradesh" };
    } else if (pin >= 530000 && pin <= 530999) {
      return { city: "Visakhapatnam", state: "Andhra Pradesh" };
    } else {
      return { city: "Andhra Pradesh", state: "Andhra Pradesh" };
    }
  } else if (pin >= 500000 && pin <= 500999) {
    // Hyderabad area (shared between AP and Telangana)
    return { city: "Hyderabad", state: "Telangana" };
  }

  // Default fallback
  return { city: "Unknown", state: "Unknown" };
};
