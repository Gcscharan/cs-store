import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, RefreshCw, Clock, XCircle, Package, CreditCard, Mail, AlertCircle, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const CancellationReturnsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate("/")}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Home</span>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Refund & Cancellation Policy</h1>
            <div />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-full bg-orange-50 flex items-center justify-center">
              <RefreshCw className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">Refund & Cancellation Policy</div>
              <div className="text-sm text-gray-600">Last updated: {new Date().toISOString().slice(0, 10)}</div>
            </div>
          </div>

          <div className="prose prose-sm max-w-none text-gray-700">
            {/* Introduction */}
            <p className="text-sm leading-6 mb-6">
              We want you to be completely satisfied with your purchase. This policy explains our cancellation, 
              return, and refund processes. Please read it carefully before placing an order.
            </p>

            {/* Section 1: Order Cancellation */}
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <XCircle className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-gray-900">1. Order Cancellation</h2>
              </div>
              
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-gray-800">Before Shipping</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        You can cancel your order before it is shipped and receive a <strong>full refund</strong>. 
                        Orders are typically processed within 2-4 hours of placement. To cancel, contact us 
                        immediately at <a href="mailto:support@yourstore.com" className="text-orange-600 hover:underline">support@yourstore.com</a> 
                        with your order number.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-gray-800">After Shipping</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Once an order has been shipped, cancellation is not possible. You may request a return 
                        after delivery following our return process outlined below.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 2: Returns */}
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-gray-900">2. Returns</h2>
              </div>
              
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Return Window</h3>
              <p className="text-sm leading-6 mb-3">
                You may request a return within <strong>7 days</strong> from the date of delivery.
              </p>

              <h3 className="text-sm font-semibold text-gray-800 mb-2">Conditions for Return</h3>
              <p className="text-sm leading-6 mb-3">
                To be eligible for a return, items must meet the following conditions:
              </p>
              <ul className="list-disc list-inside text-sm leading-6 mb-4 space-y-1">
                <li>Item is unused and in its original condition</li>
                <li>Item is in its original packaging with all tags attached</li>
                <li>Item has not been tampered with or altered</li>
                <li>Receipt or proof of purchase is available</li>
              </ul>

              <h3 className="text-sm font-semibold text-gray-800 mb-2">Return Process</h3>
              <ol className="list-decimal list-inside text-sm leading-6 space-y-1">
                <li>Contact us at <a href="mailto:support@yourstore.com" className="text-orange-600 hover:underline">support@yourstore.com</a> with your order number and reason for return</li>
                <li>We will review your request within 1-2 business days</li>
                <li>If approved, we will arrange pickup or provide return instructions</li>
                <li>Once we receive and inspect the item, we will process your refund</li>
              </ol>
            </section>

            {/* Section 3: Non-Refundable Items */}
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-gray-900">3. Non-Returnable Items</h2>
              </div>
              
              <p className="text-sm leading-6 mb-3">
                The following items cannot be returned or refunded:
              </p>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-sm">
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Perishable goods:</strong> Food items, dairy products, vegetables, fruits, and bakery items</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Personal care items:</strong> Items that have been opened or used for hygiene reasons</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Customized products:</strong> Items made to order or personalized</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Gift cards and vouchers:</strong> Digital products once delivered</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Items on clearance or final sale:</strong> Marked as non-returnable at purchase</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* Section 4: Refund Timeline */}
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-gray-900">4. Refund Timeline</h2>
              </div>
              
              <p className="text-sm leading-6 mb-3">
                Once your return is approved and received, refunds are processed as follows:
              </p>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3 border-b font-semibold text-gray-800">Payment Method</th>
                      <th className="text-left p-3 border-b font-semibold text-gray-800">Refund Timeline</th>
                      <th className="text-left p-3 border-b font-semibold text-gray-800">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-3">UPI</td>
                      <td className="p-3">5-7 business days</td>
                      <td className="p-3">Refunded to the same UPI ID</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-3">Credit/Debit Card</td>
                      <td className="p-3">7-10 business days</td>
                      <td className="p-3">Refunded to the same card; bank processing time applies</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-3">Net Banking</td>
                      <td className="p-3">7-10 business days</td>
                      <td className="p-3">Refunded to the source bank account</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-3">Razorpay Wallet</td>
                      <td className="p-3">3-5 business days</td>
                      <td className="p-3">Refunded to your Razorpay wallet</td>
                    </tr>
                    <tr>
                      <td className="p-3">Cash on Delivery (COD)</td>
                      <td className="p-3">5 business days</td>
                      <td className="p-3">Bank transfer to your account (details required)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="text-sm leading-6 mt-3">
                <strong>Note:</strong> The timeline starts after we receive and approve your returned item. 
                Delivery partners typically take 2-3 days to deliver returns to our warehouse.
              </p>
            </section>

            {/* Section 5: Partial Refunds */}
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-gray-900">5. Partial Refunds</h2>
              </div>
              
              <p className="text-sm leading-6 mb-3">
                In certain situations, we may issue a partial refund:
              </p>
              <ul className="list-disc list-inside text-sm leading-6 space-y-1">
                <li>Item returned with missing parts or accessories</li>
                <li>Item returned in a condition different from what was shipped</li>
                <li>Item returned after the return window has closed (at our discretion)</li>
                <li>Only part of the order is being returned</li>
              </ul>
            </section>

            {/* Section 6: Damaged or Wrong Items */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Damaged or Incorrect Items</h2>
              <p className="text-sm leading-6 mb-3">
                If you received a damaged or incorrect item, please contact us immediately:
              </p>
              <ul className="list-disc list-inside text-sm leading-6 space-y-1">
                <li>Report the issue within <strong>24 hours</strong> of delivery</li>
                <li>Include photos of the damaged item or wrong product received</li>
                <li>We will arrange a free pickup and send a replacement or full refund</li>
              </ul>
            </section>

            {/* Section 7: Shipping Costs */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Shipping Costs</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <p className="text-sm leading-6">
                    <strong>Free return shipping:</strong> If the item is defective, damaged, or incorrect
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <p className="text-sm leading-6">
                    <strong>Customer bears shipping cost:</strong> If returning for change of mind or personal preference
                  </p>
                </div>
              </div>
            </section>

            {/* Section 8: Exchanges */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Exchanges</h2>
              <p className="text-sm leading-6">
                We do not offer direct exchanges. If you would like a different item, please return the original 
                item for a refund and place a new order for the desired item.
              </p>
            </section>

            {/* Section 9: Contact */}
            <section className="border-t pt-6">
              <div className="flex items-center gap-2 mb-3">
                <Mail className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-gray-900">Need Help?</h2>
              </div>
              
              <p className="text-sm leading-6 mb-3">
                For any questions about cancellations, returns, or refunds, please contact us:
              </p>
              
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="space-y-2">
                  <p className="text-sm">
                    <strong>Email:</strong> <a href="mailto:support@yourstore.com" className="text-orange-600 hover:underline">support@yourstore.com</a>
                  </p>
                  <p className="text-sm">
                    <strong>Response Time:</strong> Within 24 hours (business days)
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    Please include your order number and a brief description of your concern for faster assistance.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default CancellationReturnsPage;
