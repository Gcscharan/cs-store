import React, { useState, useEffect } from "react";
import { usePincodeValidation } from "../hooks/usePincodeValidation";

interface PincodeInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange?: (isValid: boolean) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showValidationMessage?: boolean;
  validateOnChange?: boolean;
  validateAsync?: boolean;
}

const PincodeInput: React.FC<PincodeInputProps> = ({
  value,
  onChange,
  onValidationChange,
  placeholder = "Enter 6-digit pincode",
  disabled = false,
  className = "",
  showValidationMessage = true,
  validateOnChange = true,
  validateAsync = false,
}) => {
  const {
    isValid,
    errorMessage,
    isValidating,
    validatePincodeSync,
    validatePincodeAsync,
    clearValidation,
  } = usePincodeValidation();

  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    onValidationChange?.(isValid);
  }, [isValid, onValidationChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.replace(/\D/g, "").slice(0, 6); // Only digits, max 6
    setLocalValue(newValue);
    onChange(newValue);

    if (validateOnChange && newValue.length === 6) {
      if (validateAsync) {
        validatePincodeAsync(newValue);
      } else {
        validatePincodeSync(newValue);
      }
    } else if (newValue.length < 6) {
      clearValidation();
    }
  };

  const handleBlur = () => {
    if (localValue.length === 6) {
      if (validateAsync) {
        validatePincodeAsync(localValue);
      } else {
        validatePincodeSync(localValue);
      }
    }
  };

  const getInputClassName = () => {
    const baseClasses =
      "flex-1 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm";
    const errorClasses = errorMessage ? "border-red-500" : "border-gray-300";
    const disabledClasses = disabled ? "opacity-50 cursor-not-allowed" : "";

    return `${baseClasses} ${errorClasses} ${disabledClasses} ${className}`;
  };

  return (
    <div className="w-full">
      <input
        type="text"
        value={localValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={getInputClassName()}
        maxLength={6}
        disabled={disabled || isValidating}
      />

      {showValidationMessage && (
        <div className="mt-2">
          {isValidating && (
            <div className="flex items-center space-x-2 text-blue-600 text-sm">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span>Validating pincode...</span>
            </div>
          )}

          {errorMessage && !isValidating && (
            <div className="flex items-center space-x-2 text-red-600 text-sm">
              <svg
                className="w-4 h-4 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {isValid && !isValidating && localValue.length === 6 && (
            <div className="flex items-center space-x-2 text-green-600 text-sm">
              <svg
                className="w-4 h-4 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Valid pincode for delivery</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PincodeInput;
