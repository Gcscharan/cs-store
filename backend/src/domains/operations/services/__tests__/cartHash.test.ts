/**
 * Cart Hash Unit Tests - Task 7.1
 * 
 * Tests for cart hash generation to ensure deterministic hashing
 * and proper deduplication behavior.
 */

import crypto from "crypto";

/**
 * Generate deterministic hash of cart contents
 * (Copied from orderBuilder.ts for testing)
 */
function generateCartHash(
  cartItems: Array<{ productId: string; qty: number; price: number }>,
  address: { pincode: string; lat: number; lng: number },
  total: number
): string {
  const payload = JSON.stringify({
    items: cartItems
      .map(i => ({
        productId: i.productId.toString(),
        qty: i.qty,
        price: i.price,
      }))
      .sort((a, b) => a.productId.localeCompare(b.productId)),
    address: {
      pincode: address.pincode,
      lat: Math.round(address.lat * 1000000) / 1000000,
      lng: Math.round(address.lng * 1000000) / 1000000,
    },
    total: Math.round(total * 100) / 100,
  });
  
  return crypto.createHash('sha256').update(payload).digest('hex');
}

describe("Cart Hash Generation", () => {
  const baseCart = [
    { productId: "prod_123", qty: 2, price: 100 },
    { productId: "prod_456", qty: 1, price: 200 },
  ];

  const baseAddress = {
    pincode: "560001",
    lat: 12.971599,
    lng: 77.594566,
  };

  const baseTotal = 400;

  describe("Same cart produces same hash", () => {
    it("should generate identical hash for identical cart", () => {
      const hash1 = generateCartHash(baseCart, baseAddress, baseTotal);
      const hash2 = generateCartHash(baseCart, baseAddress, baseTotal);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex characters
    });

    it("should generate identical hash when called multiple times", () => {
      const hashes = Array.from({ length: 10 }, () =>
        generateCartHash(baseCart, baseAddress, baseTotal)
      );

      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(1);
    });
  });

  describe("Different items produce different hash", () => {
    it("should generate different hash when product ID changes", () => {
      const cart1 = [{ productId: "prod_123", qty: 1, price: 100 }];
      const cart2 = [{ productId: "prod_456", qty: 1, price: 100 }];

      const hash1 = generateCartHash(cart1, baseAddress, baseTotal);
      const hash2 = generateCartHash(cart2, baseAddress, baseTotal);

      expect(hash1).not.toBe(hash2);
    });

    it("should generate different hash when adding items", () => {
      const cart1 = [{ productId: "prod_123", qty: 1, price: 100 }];
      const cart2 = [
        { productId: "prod_123", qty: 1, price: 100 },
        { productId: "prod_456", qty: 1, price: 200 },
      ];

      const hash1 = generateCartHash(cart1, baseAddress, 100);
      const hash2 = generateCartHash(cart2, baseAddress, 300);

      expect(hash1).not.toBe(hash2);
    });

    it("should generate different hash when removing items", () => {
      const cart1 = [
        { productId: "prod_123", qty: 1, price: 100 },
        { productId: "prod_456", qty: 1, price: 200 },
      ];
      const cart2 = [{ productId: "prod_123", qty: 1, price: 100 }];

      const hash1 = generateCartHash(cart1, baseAddress, 300);
      const hash2 = generateCartHash(cart2, baseAddress, 100);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("Different quantities produce different hash", () => {
    it("should generate different hash when quantity changes", () => {
      const cart1 = [{ productId: "prod_123", qty: 1, price: 100 }];
      const cart2 = [{ productId: "prod_123", qty: 2, price: 100 }];

      const hash1 = generateCartHash(cart1, baseAddress, 100);
      const hash2 = generateCartHash(cart2, baseAddress, 200);

      expect(hash1).not.toBe(hash2);
    });

    it("should generate different hash when quantity increases", () => {
      const cart1 = [{ productId: "prod_123", qty: 1, price: 100 }];
      const cart2 = [{ productId: "prod_123", qty: 5, price: 100 }];

      const hash1 = generateCartHash(cart1, baseAddress, 100);
      const hash2 = generateCartHash(cart2, baseAddress, 500);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("Different addresses produce different hash", () => {
    it("should generate different hash when pincode changes", () => {
      const address1 = { pincode: "560001", lat: 12.971599, lng: 77.594566 };
      const address2 = { pincode: "560002", lat: 12.971599, lng: 77.594566 };

      const hash1 = generateCartHash(baseCart, address1, baseTotal);
      const hash2 = generateCartHash(baseCart, address2, baseTotal);

      expect(hash1).not.toBe(hash2);
    });

    it("should generate different hash when latitude changes", () => {
      const address1 = { pincode: "560001", lat: 12.971599, lng: 77.594566 };
      const address2 = { pincode: "560001", lat: 13.971599, lng: 77.594566 };

      const hash1 = generateCartHash(baseCart, address1, baseTotal);
      const hash2 = generateCartHash(baseCart, address2, baseTotal);

      expect(hash1).not.toBe(hash2);
    });

    it("should generate different hash when longitude changes", () => {
      const address1 = { pincode: "560001", lat: 12.971599, lng: 77.594566 };
      const address2 = { pincode: "560001", lat: 12.971599, lng: 78.594566 };

      const hash1 = generateCartHash(baseCart, address1, baseTotal);
      const hash2 = generateCartHash(baseCart, address2, baseTotal);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("Different totals produce different hash", () => {
    it("should generate different hash when total changes", () => {
      const hash1 = generateCartHash(baseCart, baseAddress, 400);
      const hash2 = generateCartHash(baseCart, baseAddress, 500);

      expect(hash1).not.toBe(hash2);
    });

    it("should generate different hash for small total differences", () => {
      const hash1 = generateCartHash(baseCart, baseAddress, 400.00);
      const hash2 = generateCartHash(baseCart, baseAddress, 400.01);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("Item order doesn't affect hash (sorted)", () => {
    it("should generate same hash regardless of item order", () => {
      const cart1 = [
        { productId: "prod_123", qty: 2, price: 100 },
        { productId: "prod_456", qty: 1, price: 200 },
      ];
      const cart2 = [
        { productId: "prod_456", qty: 1, price: 200 },
        { productId: "prod_123", qty: 2, price: 100 },
      ];

      const hash1 = generateCartHash(cart1, baseAddress, baseTotal);
      const hash2 = generateCartHash(cart2, baseAddress, baseTotal);

      expect(hash1).toBe(hash2);
    });

    it("should generate same hash for shuffled items", () => {
      const cart1 = [
        { productId: "prod_aaa", qty: 1, price: 100 },
        { productId: "prod_bbb", qty: 2, price: 200 },
        { productId: "prod_ccc", qty: 3, price: 300 },
      ];
      const cart2 = [
        { productId: "prod_ccc", qty: 3, price: 300 },
        { productId: "prod_aaa", qty: 1, price: 100 },
        { productId: "prod_bbb", qty: 2, price: 200 },
      ];
      const cart3 = [
        { productId: "prod_bbb", qty: 2, price: 200 },
        { productId: "prod_ccc", qty: 3, price: 300 },
        { productId: "prod_aaa", qty: 1, price: 100 },
      ];

      const hash1 = generateCartHash(cart1, baseAddress, 1400);
      const hash2 = generateCartHash(cart2, baseAddress, 1400);
      const hash3 = generateCartHash(cart3, baseAddress, 1400);

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });
  });

  describe("Floating point precision handling", () => {
    it("should handle coordinates with high precision", () => {
      const address1 = {
        pincode: "560001",
        lat: 12.9715987654321,
        lng: 77.5945667654321,
      };
      const address2 = {
        pincode: "560001",
        lat: 12.9715987654321,
        lng: 77.5945667654321,
      };

      const hash1 = generateCartHash(baseCart, address1, baseTotal);
      const hash2 = generateCartHash(baseCart, address2, baseTotal);

      expect(hash1).toBe(hash2);
    });

    it("should round coordinates to 6 decimal places", () => {
      const address1 = {
        pincode: "560001",
        lat: 12.9715987654321, // Will be rounded to 12.971599
        lng: 77.5945667654321, // Will be rounded to 77.594567
      };
      const address2 = {
        pincode: "560001",
        lat: 12.971599,
        lng: 77.594567,
      };

      const hash1 = generateCartHash(baseCart, address1, baseTotal);
      const hash2 = generateCartHash(baseCart, address2, baseTotal);

      expect(hash1).toBe(hash2);
    });

    it("should treat coordinates differing beyond 6 decimals as same", () => {
      const address1 = {
        pincode: "560001",
        lat: 12.9715991111111, // Rounds to 12.971599
        lng: 77.5945661111111, // Rounds to 77.594566
      };
      const address2 = {
        pincode: "560001",
        lat: 12.9715992222222, // Also rounds to 12.971599
        lng: 77.5945662222222, // Also rounds to 77.594566
      };

      const hash1 = generateCartHash(baseCart, address1, baseTotal);
      const hash2 = generateCartHash(baseCart, address2, baseTotal);

      expect(hash1).toBe(hash2);
    });

    it("should round total to 2 decimal places", () => {
      const hash1 = generateCartHash(baseCart, baseAddress, 400.123456);
      const hash2 = generateCartHash(baseCart, baseAddress, 400.12);

      expect(hash1).toBe(hash2);
    });

    it("should treat totals differing beyond 2 decimals as same", () => {
      const hash1 = generateCartHash(baseCart, baseAddress, 400.12111); // Rounds to 400.12
      const hash2 = generateCartHash(baseCart, baseAddress, 400.12222); // Also rounds to 400.12

      expect(hash1).toBe(hash2);
    });

    it("should handle floating point arithmetic errors", () => {
      // 0.1 + 0.2 = 0.30000000000000004 in JavaScript
      const total1 = 0.1 + 0.2;
      const total2 = 0.3;

      const hash1 = generateCartHash(baseCart, baseAddress, total1);
      const hash2 = generateCartHash(baseCart, baseAddress, total2);

      expect(hash1).toBe(hash2);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty cart", () => {
      const hash = generateCartHash([], baseAddress, 0);
      expect(hash).toHaveLength(64);
    });

    it("should handle single item cart", () => {
      const cart = [{ productId: "prod_123", qty: 1, price: 100 }];
      const hash = generateCartHash(cart, baseAddress, 100);
      expect(hash).toHaveLength(64);
    });

    it("should handle large quantities", () => {
      const cart = [{ productId: "prod_123", qty: 1000, price: 100 }];
      const hash = generateCartHash(cart, baseAddress, 100000);
      expect(hash).toHaveLength(64);
    });

    it("should handle zero price items", () => {
      const cart = [{ productId: "prod_123", qty: 1, price: 0 }];
      const hash = generateCartHash(cart, baseAddress, 0);
      expect(hash).toHaveLength(64);
    });

    it("should handle negative coordinates", () => {
      const address = {
        pincode: "560001",
        lat: -12.971599,
        lng: -77.594566,
      };
      const hash = generateCartHash(baseCart, address, baseTotal);
      expect(hash).toHaveLength(64);
    });
  });
});
