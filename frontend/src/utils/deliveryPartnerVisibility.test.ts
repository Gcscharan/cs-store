import { describe, expect, it } from "vitest";
import { shouldShowDeliveryPartner } from "./deliveryPartnerVisibility";

describe("shouldShowDeliveryPartner", () => {
  it("shows partner only at Out for delivery stage", () => {
    expect(
      shouldShowDeliveryPartner({
        currentCustomerStepKey: "CUSTOMER_OUT_FOR_DELIVERY",
        hasDeliveryPartner: true,
      })
    ).toBe(true);

    expect(
      shouldShowDeliveryPartner({
        currentCustomerStepKey: "CUSTOMER_SHIPPED",
        hasDeliveryPartner: true,
      })
    ).toBe(false);

    expect(
      shouldShowDeliveryPartner({
        currentCustomerStepKey: "CUSTOMER_OUT_FOR_DELIVERY",
        hasDeliveryPartner: false,
      })
    ).toBe(false);

    expect(
      shouldShowDeliveryPartner({
        currentCustomerStepKey: "CUSTOMER_DELIVERED",
        hasDeliveryPartner: true,
      })
    ).toBe(false);
  });
});
