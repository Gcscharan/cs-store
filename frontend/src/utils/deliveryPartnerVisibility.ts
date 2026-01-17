export function shouldShowDeliveryPartner(params: {
  currentCustomerStepKey?: string;
  hasDeliveryPartner?: boolean;
}): boolean {
  return (
    String(params.currentCustomerStepKey || "") === "CUSTOMER_OUT_FOR_DELIVERY" &&
    Boolean(params.hasDeliveryPartner)
  );
}
