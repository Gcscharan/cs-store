export interface CardValidationResult {
    isValid: boolean;
    cardType: string;
    errors: string[];
}
export declare const validateLuhn: (cardNumber: string) => boolean;
export declare const detectCardType: (cardNumber: string) => string;
export declare const validateCardLength: (cardNumber: string, cardType: string) => boolean;
export declare const validateExpiryDate: (expiryDate: string) => boolean;
export declare const validateCVV: (cvv: string, cardType: string) => boolean;
export declare const validateCardHolderName: (name: string) => boolean;
export declare const validateCard: (cardNumber: string, expiryDate: string, cvv: string, cardHolderName: string) => CardValidationResult;
export declare const formatCardNumber: (cardNumber: string) => string;
export declare const isTestCard: (cardNumber: string) => boolean;
//# sourceMappingURL=cardValidation.d.ts.map