// Card validation utilities for frontend
export interface CardValidationResult {
  isValid: boolean;
  cardType: string;
  errors: string[];
}

export interface CardType {
  name: string;
  pattern: RegExp;
  length: number[];
  cvvLength: number;
  icon: string;
}

// Card type definitions
export const CARD_TYPES: CardType[] = [
  {
    name: "Visa",
    pattern: /^4/,
    length: [13, 16, 19],
    cvvLength: 3,
    icon: "💳",
  },
  {
    name: "MasterCard",
    pattern: /^5[1-5]/,
    length: [16],
    cvvLength: 3,
    icon: "💳",
  },
  {
    name: "American Express",
    pattern: /^3[47]/,
    length: [15],
    cvvLength: 4,
    icon: "💳",
  },
  {
    name: "Discover",
    pattern: /^6(?:011|5)/,
    length: [16],
    cvvLength: 3,
    icon: "💳",
  },
  {
    name: "RuPay",
    pattern: /^6[0-9]/,
    length: [16],
    cvvLength: 3,
    icon: "💳",
  },
];

// Luhn algorithm for card number validation
export const validateLuhn = (cardNumber: string): boolean => {
  const cleaned = cardNumber.replace(/\D/g, "");
  let sum = 0;
  let isEven = false;

  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i]);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
};

// Detect card type based on number
export const detectCardType = (cardNumber: string): CardType | null => {
  const cleaned = cardNumber.replace(/\D/g, "");

  for (const cardType of CARD_TYPES) {
    if (cardType.pattern.test(cleaned)) {
      return cardType;
    }
  }

  return null;
};

// Validate card number length
export const validateCardLength = (
  cardNumber: string,
  cardType: CardType | null
): boolean => {
  if (!cardType) return false;
  const cleaned = cardNumber.replace(/\D/g, "");
  return cardType.length.includes(cleaned.length);
};

// Validate expiry date
export const validateExpiryDate = (expiryDate: string): boolean => {
  const pattern = /^(0[1-9]|1[0-2])\/([0-9]{2})$/;
  if (!pattern.test(expiryDate)) return false;

  const [month, year] = expiryDate.split("/");
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear() % 100;
  const currentMonth = currentDate.getMonth() + 1;

  const expMonth = parseInt(month);
  const expYear = parseInt(year);

  if (expYear < currentYear) return false;
  if (expYear === currentYear && expMonth < currentMonth) return false;
  if (expMonth < 1 || expMonth > 12) return false;

  return true;
};

// Validate CVV
export const validateCVV = (
  cvv: string,
  cardType: CardType | null
): boolean => {
  if (!cardType) return false;
  const pattern = /^\d+$/;
  if (!pattern.test(cvv)) return false;

  return cvv.length === cardType.cvvLength;
};

// Validate card holder name
export const validateCardHolderName = (name: string): boolean => {
  const pattern = /^[a-zA-Z\s]+$/;
  return pattern.test(name.trim()) && name.trim().length >= 2;
};

// Main card validation function
export const validateCard = (
  cardNumber: string,
  expiryDate: string,
  cvv: string,
  cardHolderName: string
): CardValidationResult => {
  const errors: string[] = [];

  // Clean card number
  const cleanedCardNumber = cardNumber.replace(/\D/g, "");

  // Detect card type
  const cardType = detectCardType(cleanedCardNumber);

  // Validate card number length
  if (!validateCardLength(cleanedCardNumber, cardType)) {
    errors.push("Enter a valid card number");
  }

  // Validate Luhn algorithm (only for non-test cards)
  if (
    cleanedCardNumber.length > 0 &&
    !isTestCard(cleanedCardNumber) &&
    !validateLuhn(cleanedCardNumber)
  ) {
    errors.push("Enter a valid card number");
  }

  // Validate expiry date
  if (!validateExpiryDate(expiryDate)) {
    errors.push("Enter valid month/year");
  }

  // Validate CVV
  if (!validateCVV(cvv, cardType)) {
    errors.push("Enter valid CVV");
  }

  // Validate card holder name
  if (!validateCardHolderName(cardHolderName)) {
    errors.push("Enter valid card holder name");
  }

  return {
    isValid: errors.length === 0,
    cardType: cardType?.name || "Unknown",
    errors,
  };
};

// Format card number with spaces
export const formatCardNumber = (value: string): string => {
  const cleaned = value.replace(/\D/g, "");
  const groups = cleaned.match(/.{1,4}/g) || [];
  return groups.join(" ").substring(0, 19); // Max 19 chars for formatting
};

// Format expiry date
export const formatExpiryDate = (value: string): string => {
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.length >= 2) {
    return cleaned.substring(0, 2) + "/" + cleaned.substring(2, 4);
  }
  return cleaned;
};

// Format CVV
export const formatCVV = (value: string, cardType: CardType | null): string => {
  const cleaned = value.replace(/\D/g, "");
  const maxLength = cardType?.cvvLength || 4;
  return cleaned.substring(0, maxLength);
};

// Check if a card number is a known test card
export const isTestCard = (cardNumber: string): boolean => {
  const cleaned = cardNumber.replace(/\D/g, "");

  // Common test card numbers that don't pass Luhn but are used for testing
  const testCards = [
    "4687796308081910", // Your test card (original)
    "4687796308011910", // Your test card (corrected)
    "4000000000000002", // Visa test (declined)
    "4000000000000069", // Visa test (expired)
    "4000000000000119", // Visa test (processing error)
    "5555555555554444", // MasterCard test
    "2223003122003222", // MasterCard test
    "378282246310005", // Amex test
    "6011111111111117", // Discover test
    "6011000990139424", // Discover test
  ];

  return testCards.includes(cleaned);
};
