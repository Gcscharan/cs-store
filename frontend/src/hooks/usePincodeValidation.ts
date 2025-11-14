import { useState, useCallback } from "react";
import {
  validatePincode,
  getPincodeErrorMessage,
  validatePincodeAsync,
} from "../utils/pincodeValidation";

interface PincodeValidationState {
  isValid: boolean;
  errorMessage: string;
  isValidating: boolean;
}

export const usePincodeValidation = () => {
  const [validationState, setValidationState] =
    useState<PincodeValidationState>({
      isValid: false,
      errorMessage: "",
      isValidating: false,
    });

  const validatePincodeSync = useCallback((pincode: string): boolean => {
    const isValid = validatePincode(pincode);
    const errorMessage = isValid ? "" : getPincodeErrorMessage(pincode);

    setValidationState({
      isValid,
      errorMessage,
      isValidating: false,
    });

    return isValid;
  }, []);

  const validatePincodeAsync = useCallback(
    async (pincode: string): Promise<boolean> => {
      setValidationState((prev) => ({
        ...prev,
        isValidating: true,
        errorMessage: "",
      }));

      try {
        const isValid = await validatePincodeAsync(pincode);
        const errorMessage = isValid ? "" : getPincodeErrorMessage(pincode);

        setValidationState({
          isValid,
          errorMessage,
          isValidating: false,
        });

        return isValid;
      } catch (error) {
        console.error("Pincode validation error:", error);

        // Fallback to sync validation
        const isValid = validatePincode(pincode);
        const errorMessage = isValid ? "" : getPincodeErrorMessage(pincode);

        setValidationState({
          isValid,
          errorMessage,
          isValidating: false,
        });

        return isValid;
      }
    },
    []
  );

  const clearValidation = useCallback(() => {
    setValidationState({
      isValid: false,
      errorMessage: "",
      isValidating: false,
    });
  }, []);

  const setError = useCallback((message: string) => {
    setValidationState({
      isValid: false,
      errorMessage: message,
      isValidating: false,
    });
  }, []);

  return {
    ...validationState,
    validatePincodeSync,
    validatePincodeAsync,
    clearValidation,
    setError,
  };
};
