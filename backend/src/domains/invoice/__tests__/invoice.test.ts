import mongoose from "mongoose";
import { Order } from "../../../models/Order";
import { InvoiceCounter, getNextInvoiceNumber, getFinancialYear } from "../../../models/InvoiceCounter";
import { generateInvoiceForOrder, isOrderEligibleForInvoice, getInvoiceData } from "../services/invoiceService";
import { Product } from "../../../models/Product";
import { User } from "../../../models/User";

describe("Invoice System", () => {
  let testUserId: mongoose.Types.ObjectId;
  let testProductId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    // Clear collections
    await Order.deleteMany({});
    await InvoiceCounter.deleteMany({});
    await Product.deleteMany({});
    await User.deleteMany({});

    // Create test user
    const user = await User.create({
      name: "Test User",
      email: "test@example.com",
      password: "hashedpassword",
      role: "customer",
    });
    testUserId = user._id;

    // Create test product
    const product = await Product.create({
      name: "Test Product",
      description: "Test Description",
      category: "chocolates",
      price: 100,
      stock: 50,
      weight: 100,
      images: [],
      tags: [],
    });
    testProductId = product._id;
  });

  describe("Invoice Number Generation", () => {
    it("should generate sequential invoice numbers", async () => {
      const num1 = await getNextInvoiceNumber();
      const num2 = await getNextInvoiceNumber();
      const num3 = await getNextInvoiceNumber();

      // Extract sequence numbers
      const seq1 = parseInt(num1.split("-")[2]);
      const seq2 = parseInt(num2.split("-")[2]);
      const seq3 = parseInt(num3.split("-")[2]);

      expect(seq2).toBe(seq1 + 1);
      expect(seq3).toBe(seq2 + 1);
    });

    it("should format invoice numbers correctly", async () => {
      const invoiceNumber = await getNextInvoiceNumber();
      
      // Format: INV-YYYY-000001
      expect(invoiceNumber).toMatch(/^INV-\d{4}-\d{6}$/);
    });

    it("should include correct financial year", async () => {
      const invoiceNumber = await getNextInvoiceNumber();
      const year = getFinancialYear();
      
      expect(invoiceNumber).toContain(`INV-${year}-`);
    });

    it("should not generate duplicate invoice numbers under concurrent load", async () => {
      const promises = Array.from({ length: 10 }, () => getNextInvoiceNumber());
      const numbers = await Promise.all(promises);
      
      const uniqueNumbers = new Set(numbers);
      expect(uniqueNumbers.size).toBe(10);
    });
  });

  describe("Invoice Eligibility", () => {
    it("should not allow invoice for unpaid order", () => {
      const order = {
        paymentStatus: "PENDING",
        invoiceNumber: undefined,
      } as any;

      expect(isOrderEligibleForInvoice(order)).toBe(false);
    });

    it("should not allow invoice for failed order", () => {
      const order = {
        paymentStatus: "FAILED",
        invoiceNumber: undefined,
      } as any;

      expect(isOrderEligibleForInvoice(order)).toBe(false);
    });

    it("should not allow duplicate invoice generation", () => {
      const order = {
        paymentStatus: "PAID",
        invoiceNumber: "INV-2024-000001",
      } as any;

      expect(isOrderEligibleForInvoice(order)).toBe(false);
    });

    it("should allow invoice for paid order without invoice", () => {
      const order = {
        paymentStatus: "PAID",
        invoiceNumber: undefined,
      } as any;

      expect(isOrderEligibleForInvoice(order)).toBe(true);
    });
  });

  describe("Invoice Generation", () => {
    it("should generate invoice for paid order", async () => {
      // Create paid order
      const order = await Order.create({
        userId: testUserId,
        items: [{
          productId: testProductId,
          name: "Test Product",
          price: 100,
          qty: 2,
          gstRate: 18,
        }],
        itemsTotal: 200,
        subtotalBeforeTax: 200,
        gstAmount: 36,
        gstBreakdown: {
          type: "CGST_SGST",
          cgst: 18,
          sgst: 18,
          totalGst: 36,
        },
        deliveryFee: 20,
        grandTotal: 256,
        totalAmount: 256,
        paymentMethod: "razorpay",
        paymentStatus: "PAID",
        orderStatus: "CONFIRMED",
        address: {
          label: "Home",
          addressLine: "123 Test Street",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
          lat: 12.9716,
          lng: 77.5946,
        },
        assignmentHistory: [],
        history: [],
      });

      const result = await generateInvoiceForOrder(order._id.toString());

      expect(result.success).toBe(true);
      expect(result.invoiceNumber).toBeDefined();
      expect(result.invoiceNumber).toMatch(/^INV-\d{4}-\d{6}$/);
    });

    it("should not generate invoice for unpaid order", async () => {
      const order = await Order.create({
        userId: testUserId,
        items: [{
          productId: testProductId,
          name: "Test Product",
          price: 100,
          qty: 1,
        }],
        totalAmount: 100,
        paymentMethod: "razorpay",
        paymentStatus: "PENDING",
        orderStatus: "CREATED",
        address: {
          label: "Home",
          addressLine: "123 Test Street",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
          lat: 12.9716,
          lng: 77.5946,
        },
        assignmentHistory: [],
        history: [],
      });

      const result = await generateInvoiceForOrder(order._id.toString());

      expect(result.success).toBe(false);
      expect(result.error).toContain("not paid");
    });

    it("should be idempotent - return same invoice number on repeated calls", async () => {
      const order = await Order.create({
        userId: testUserId,
        items: [{
          productId: testProductId,
          name: "Test Product",
          price: 100,
          qty: 1,
          gstRate: 18,
        }],
        subtotalBeforeTax: 100,
        gstAmount: 18,
        grandTotal: 118,
        totalAmount: 118,
        paymentMethod: "razorpay",
        paymentStatus: "PAID",
        orderStatus: "CONFIRMED",
        address: {
          label: "Home",
          addressLine: "123 Test Street",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
          lat: 12.9716,
          lng: 77.5946,
        },
        assignmentHistory: [],
        history: [],
      });

      // First generation
      const result1 = await generateInvoiceForOrder(order._id.toString());
      
      // Second generation (should return same invoice number)
      const result2 = await generateInvoiceForOrder(order._id.toString());

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.invoiceNumber).toBe(result2.invoiceNumber);
    });

    it("should attach invoice items with correct GST breakdown", async () => {
      const order = await Order.create({
        userId: testUserId,
        items: [{
          productId: testProductId,
          name: "Test Product",
          price: 100,
          qty: 2,
          gstRate: 18,
        }],
        subtotalBeforeTax: 200,
        gstAmount: 36,
        gstBreakdown: {
          type: "CGST_SGST",
          cgst: 18,
          sgst: 18,
          totalGst: 36,
        },
        grandTotal: 236,
        totalAmount: 236,
        paymentMethod: "razorpay",
        paymentStatus: "PAID",
        orderStatus: "CONFIRMED",
        address: {
          label: "Home",
          addressLine: "123 Test Street",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
          lat: 12.9716,
          lng: 77.5946,
        },
        assignmentHistory: [],
        history: [],
      });

      await generateInvoiceForOrder(order._id.toString());

      const updatedOrder = await Order.findById(order._id);

      expect(updatedOrder?.invoiceItems).toBeDefined();
      expect(updatedOrder?.invoiceItems).toHaveLength(1);
      
      const invoiceItem = updatedOrder?.invoiceItems?.[0];
      expect(invoiceItem?.productName).toBe("Test Product");
      expect(invoiceItem?.quantity).toBe(2);
      expect(invoiceItem?.unitPrice).toBe(100);
      expect(invoiceItem?.taxableValue).toBe(200);
      expect(invoiceItem?.gstRate).toBe(18);
      // Intra-state: CGST + SGST
      expect(invoiceItem?.cgstAmount).toBe(18);
      expect(invoiceItem?.sgstAmount).toBe(18);
      expect(invoiceItem?.igstAmount).toBe(0);
      expect(invoiceItem?.totalAmount).toBe(236);
    });

    it("should use IGST for inter-state orders", async () => {
      // Different state (not Karnataka)
      const order = await Order.create({
        userId: testUserId,
        items: [{
          productId: testProductId,
          name: "Test Product",
          price: 100,
          qty: 1,
          gstRate: 18,
        }],
        subtotalBeforeTax: 100,
        gstAmount: 18,
        grandTotal: 118,
        totalAmount: 118,
        paymentMethod: "razorpay",
        paymentStatus: "PAID",
        orderStatus: "CONFIRMED",
        address: {
          label: "Home",
          addressLine: "456 Test Street",
          city: "Mumbai",
          state: "Maharashtra", // Different state
          pincode: "400001",
          lat: 19.076,
          lng: 72.8777,
        },
        assignmentHistory: [],
        history: [],
      });

      await generateInvoiceForOrder(order._id.toString());

      const updatedOrder = await Order.findById(order._id);
      const invoiceItem = updatedOrder?.invoiceItems![0];

      // Inter-state: IGST only
      expect(invoiceItem?.cgstAmount).toBe(0);
      expect(invoiceItem?.sgstAmount).toBe(0);
      expect(invoiceItem?.igstAmount).toBe(18);
    });
  });

  describe("Invoice Data Retrieval", () => {
    it("should return null for order without invoice", async () => {
      const order = await Order.create({
        userId: testUserId,
        items: [{
          productId: testProductId,
          name: "Test Product",
          price: 100,
          qty: 1,
        }],
        totalAmount: 100,
        paymentMethod: "razorpay",
        paymentStatus: "PENDING",
        orderStatus: "CREATED",
        address: {
          label: "Home",
          addressLine: "123 Test Street",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
          lat: 12.9716,
          lng: 77.5946,
        },
        assignmentHistory: [],
        history: [],
      });

      const data = await getInvoiceData(order._id.toString());

      expect(data).toBeNull();
    });

    it("should return complete invoice data for invoiced order", async () => {
      const order = await Order.create({
        userId: testUserId,
        items: [{
          productId: testProductId,
          name: "Test Product",
          price: 100,
          qty: 2,
          gstRate: 18,
        }],
        subtotalBeforeTax: 200,
        gstAmount: 36,
        deliveryFee: 20,
        grandTotal: 256,
        totalAmount: 256,
        paymentMethod: "razorpay",
        paymentStatus: "PAID",
        orderStatus: "CONFIRMED",
        address: {
          name: "John Doe",
          label: "Home",
          addressLine: "123 Test Street",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
          phone: "+91-9876543210",
          lat: 12.9716,
          lng: 77.5946,
        },
        assignmentHistory: [],
        history: [],
      });

      await generateInvoiceForOrder(order._id.toString());

      const data = await getInvoiceData(order._id.toString());

      expect(data).not.toBeNull();
      expect(data?.invoiceNumber).toBeDefined();
      expect(data?.invoiceDate).toBeDefined();
      expect(data?.seller).toBeDefined();
      expect(data?.seller.gstin).toBeDefined();
      expect(data?.buyer.name).toBe("John Doe");
      expect(data?.buyer.state).toBe("Karnataka");
      expect(data?.items).toHaveLength(1);
      expect(data?.summary.subtotalBeforeTax).toBe(200);
      expect(data?.summary.totalTax).toBe(36);
      expect(data?.summary.deliveryFee).toBe(20);
      expect(data?.summary.grandTotal).toBe(256);
      expect(data?.summary.paymentMethod).toBe("RAZORPAY");
    });
  });

  describe("Currency Rounding", () => {
    it("should round all currency values to 2 decimal places", async () => {
      const order = await Order.create({
        userId: testUserId,
        items: [{
          productId: testProductId,
          name: "Test Product",
          price: 99.99,
          qty: 3,
          gstRate: 18,
        }],
        subtotalBeforeTax: 299.97,
        gstAmount: 53.9946, // Unrounded
        grandTotal: 353.9646, // Unrounded
        totalAmount: 353.9646,
        paymentMethod: "razorpay",
        paymentStatus: "PAID",
        orderStatus: "CONFIRMED",
        address: {
          label: "Home",
          addressLine: "123 Test Street",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560001",
          lat: 12.9716,
          lng: 77.5946,
        },
        assignmentHistory: [],
        history: [],
      });

      await generateInvoiceForOrder(order._id.toString());

      const data = await getInvoiceData(order._id.toString());

      // All values should be rounded to 2 decimals
      expect(data?.summary.subtotalBeforeTax).toBeCloseTo(299.97, 2);
      expect(data?.summary.totalTax).toBeCloseTo(54, 2); // Rounded

      const invoiceItem = data?.items[0];
      expect(invoiceItem?.taxableValue).toBeCloseTo(299.97, 2);
      expect(invoiceItem?.cgstAmount).toBeCloseTo(27, 2);
      expect(invoiceItem?.sgstAmount).toBeCloseTo(27, 2);
    });
  });
});
