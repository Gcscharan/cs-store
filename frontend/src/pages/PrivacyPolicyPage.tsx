import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PrivacyPolicyPage: React.FC = () => {
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
            <h1 className="text-2xl font-bold text-gray-900">Privacy Policy</h1>
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
              <Shield className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">Your privacy matters</div>
              <div className="text-sm text-gray-600">Last updated: {new Date().toISOString().slice(0, 10)}</div>
            </div>
          </div>

          <div className="space-y-6 text-gray-700">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Information we collect</h2>
              <p className="text-sm leading-6">
                We collect information you provide during account creation, checkout, and customer support, such as your
                name, email, phone number, delivery address, and order details.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">How we use information</h2>
              <p className="text-sm leading-6">
                We use your information to operate the service, process orders, provide customer support, improve the
                platform, and comply with legal obligations.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Payments</h2>
              <p className="text-sm leading-6">
                Payments are processed through third-party payment gateways. We do not store full card details on our
                servers.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Contact</h2>
              <p className="text-sm leading-6">
                If you have questions about this policy, please reach out via the Contact Us page.
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
