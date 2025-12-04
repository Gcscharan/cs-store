import { useState, useCallback } from "react";
import { validatePincode as validatePincodeApi, PincodeData } from "../utils/pincodeValidation";

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

  const buildValidationResult = (result: PincodeData | null, pincode: string) => {
    // If not a full 6-digit pincode yet, treat as not validated
    if (!pincode || pincode.length !== 6) {
      return { isValid: false, errorMessage: "" };
    }

    if (!result) {
      return {
        isValid: false,
        errorMessage: "Invalid pincode. Please enter a valid 6-digit pincode.",
      };
    }

    if (!result.isDeliverable) {
      return {
        isValid: false,
        errorMessage: "Delivery is not available to this pincode.",
      };
    }

    return { isValid: true, errorMessage: "" };
  };

  const validatePincodeSync = useCallback(
    async (pincode: string): Promise<boolean> => {
      const result = await validatePincodeApi(pincode);
      const { isValid, errorMessage } = buildValidationResult(result, pincode);

      setValidationState({
        isValid,
        errorMessage,
        isValidating: false,
      });

      return isValid;
    },
    []
  );

  const validatePincodeAsync = useCallback(
    async (pincode: string): Promise<boolean> => {
      setValidationState((prev) => ({
        ...prev,
        isValidating: true,
        errorMessage: "",
      }));

      try {
        const result = await validatePincodeApi(pincode);
        const { isValid, errorMessage } = buildValidationResult(result, pincode);

        setValidationState({
          isValid,
          errorMessage,
          isValidating: false,
        });

        return isValid;
      } catch (error) {
        console.error("Pincode validation error:", error);

        setValidationState({
          isValid: false,
          errorMessage:
            "Unable to validate pincode at the moment. Please try again.",
          isValidating: false,
        });

        return false;
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
