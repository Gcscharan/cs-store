import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, RefreshCw } from "lucide-react";
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
            <h1 className="text-2xl font-bold text-gray-900">Refund / Cancellation Policy</h1>
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
              <div className="text-lg font-semibold text-gray-900">Cancellations, returns, and refunds</div>
              <div className="text-sm text-gray-600">Last updated: {new Date().toISOString().slice(0, 10)}</div>
            </div>
          </div>

          <div className="space-y-6 text-gray-700">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Order cancellation</h2>
              <p className="text-sm leading-6">
                You may be able to cancel an order before it is shipped. Once shipped, cancellation may not be available.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Returns</h2>
              <p className="text-sm leading-6">
                If a return is accepted, items must be returned in the original condition. Eligibility and timelines may
                vary by product category.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Refunds</h2>
              <p className="text-sm leading-6">
                Refunds (where applicable) will be processed to the original payment method after the return is approved.
                For COD orders, refunds may be issued through an alternative method.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Contact</h2>
              <p className="text-sm leading-6">For help, please use the Contact Us page.</p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default CancellationReturnsPage;
