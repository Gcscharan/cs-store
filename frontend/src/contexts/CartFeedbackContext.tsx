import React, { createContext, useContext, ReactNode } from 'react';

interface CartFeedbackContextType {
  triggerCartConfirmation: (productName: string, productImage?: string) => void;
  triggerGlobalConfirmation: (productName: string, productImage?: string, cartCount?: number, cartTotal?: number) => void;
}

const CartFeedbackContext = createContext<CartFeedbackContextType | null>(null);

interface CartFeedbackProviderProps {
  children: ReactNode;
  triggerCartConfirmation: (productName: string, productImage?: string) => void;
  triggerGlobalConfirmation: (productName: string, productImage?: string, cartCount?: number, cartTotal?: number) => void;
}

export const CartFeedbackProvider: React.FC<CartFeedbackProviderProps> = ({
  children,
  triggerCartConfirmation,
  triggerGlobalConfirmation
}) => {
  return (
    <CartFeedbackContext.Provider value={{ 
      triggerCartConfirmation, 
      triggerGlobalConfirmation 
    }}>
      {children}
    </CartFeedbackContext.Provider>
  );
};

export const useCartFeedback = (): CartFeedbackContextType => {
  const context = useContext(CartFeedbackContext);
  if (!context) {
    throw new Error('useCartFeedback must be used within a CartFeedbackProvider');
  }
  return context;
};

export default CartFeedbackContext;
