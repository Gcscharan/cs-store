import { PropsWithChildren } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";

import { store } from "@/store";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { OtpModalProvider } from "@/contexts/OtpModalContext";
import { CartFeedbackProvider } from "@/contexts/CartFeedbackContext";

export function TestAppProviders({
  children,
  initialEntries = ["/"],
}: PropsWithChildren<{ initialEntries?: string[] }>) {
  return (
    <Provider store={store}>
      <CurrencyProvider>
        <LanguageProvider>
          <OtpModalProvider>
            <CartFeedbackProvider
              triggerCartConfirmation={() => {
              }}
              triggerGlobalConfirmation={() => {
              }}
            >
              <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
            </CartFeedbackProvider>
          </OtpModalProvider>
        </LanguageProvider>
      </CurrencyProvider>
    </Provider>
  );
}
