import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, Database, Users, Clock, Cookie, Mail, AlertCircle } from "lucide-react";
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
              <div className="text-lg font-semibold text-gray-900">Privacy Policy</div>
              <div className="text-sm text-gray-600">Last updated: {new Date().toISOString().slice(0, 10)}</div>
            </div>
          </div>

          <div className="prose prose-sm max-w-none text-gray-700">
            {/* Introduction */}
            <p className="text-sm leading-6 mb-6">
              This Privacy Policy describes how we collect, use, store, and protect your personal information 
              when you use our e-commerce platform. By using our services, you agree to the practices described 
              in this policy. We are committed to protecting your privacy and handling your data in an open and 
              transparent manner.
            </p>

            {/* Section 1: Data Collection */}
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Database className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-gray-900">1. Data Collection</h2>
              </div>
              
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Personal Information</h3>
              <p className="text-sm leading-6 mb-3">
                When you create an account or place an order, we collect the following personal information:
              </p>
              <ul className="list-disc list-inside text-sm leading-6 mb-4 space-y-1">
                <li><strong>Identity:</strong> Full name, email address, phone number</li>
                <li><strong>Address:</strong> Delivery address including street, city, state, pincode, and location coordinates</li>
                <li><strong>Authentication:</strong> Password (stored in encrypted form), OTP verification records</li>
                <li><strong>Communication:</strong> Messages sent to customer support</li>
              </ul>

              <h3 className="text-sm font-semibold text-gray-800 mb-2">Order Data</h3>
              <p className="text-sm leading-6 mb-3">
                For each order, we collect and store:
              </p>
              <ul className="list-disc list-inside text-sm leading-6 mb-4 space-y-1">
                <li>Order items, quantities, and prices</li>
                <li>Payment method (COD, UPI, or card via Razorpay)</li>
                <li>Order status and delivery tracking information</li>
                <li>GST and tax records for invoicing</li>
                <li>Delivery confirmation and proof of delivery</li>
              </ul>

              <h3 className="text-sm font-semibold text-gray-800 mb-2">Payment Processing</h3>
              <p className="text-sm leading-6">
                All online payments are processed through <strong>Razorpay</strong>, a PCI-DSS compliant payment gateway. 
                We do not store your complete card number, CVV, or UPI PIN on our servers. Razorpay handles all 
                sensitive payment data in accordance with RBI guidelines and international security standards.
              </p>
            </section>

            {/* Section 2: Third Party Services */}
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-gray-900">2. Third-Party Services</h2>
              </div>
              
              <p className="text-sm leading-6 mb-3">
                We use the following third-party services to operate our platform:
              </p>
              
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-800">Razorpay (Payments)</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Processes all online payments including UPI, cards, and net banking. 
                    Razorpay may store transaction records as required by RBI regulations.
                    <a href="https://razorpay.com/privacy/" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline ml-1">
                      View their privacy policy
                    </a>
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-800">Cloudinary (Images)</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Hosts product images and other media content. No personal data is stored with Cloudinary.
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-800">Cloud Hosting Provider</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Our application and database are hosted on secure cloud infrastructure with encryption at rest 
                    and in transit. The hosting provider may have access to server logs for maintenance purposes.
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-800">Google Maps Platform</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Used for address validation and delivery route optimization. Location coordinates are shared 
                    with Google Maps API for distance calculations.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 3: Data Retention */}
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-gray-900">3. Data Retention</h2>
              </div>
              
              <p className="text-sm leading-6 mb-3">
                We retain your data for the following periods:
              </p>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3 border-b font-semibold text-gray-800">Data Type</th>
                      <th className="text-left p-3 border-b font-semibold text-gray-800">Retention Period</th>
                      <th className="text-left p-3 border-b font-semibold text-gray-800">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-3">Order Records & Invoices</td>
                      <td className="p-3">7 years</td>
                      <td className="p-3">GST/tax compliance (CGST Act, 2017)</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-3">Account Information</td>
                      <td className="p-3">Until account deletion + 30 days</td>
                      <td className="p-3">Service delivery, legal obligations</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-3">Payment Transaction Records</td>
                      <td className="p-3">7 years</td>
                      <td className="p-3">RBI guidelines, accounting requirements</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-3">Delivery Location Data</td>
                      <td className="p-3">Order completion + 1 year</td>
                      <td className="p-3">Dispute resolution, service improvement</td>
                    </tr>
                    <tr>
                      <td className="p-3">OTP & Verification Logs</td>
                      <td className="p-3">30 days</td>
                      <td className="p-3">Security and fraud prevention</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section 4: User Rights */}
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-gray-900">4. Your Rights</h2>
              </div>
              
              <p className="text-sm leading-6 mb-3">
                Under the Information Technology Act, 2000 and rules made thereunder, you have the following rights 
                regarding your personal data:
              </p>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-orange-600">1</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">Right to Access</h4>
                    <p className="text-sm text-gray-600">
                      You can request a copy of all personal data we hold about you. To make this request, 
                      contact us at <a href="mailto:support@yourstore.com" className="text-orange-600 hover:underline">support@yourstore.com</a>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-orange-600">2</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">Right to Correction</h4>
                    <p className="text-sm text-gray-600">
                      You can update your personal information through your account settings or by contacting us. 
                      We will correct inaccurate or incomplete data within 7 business days.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-orange-600">3</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">Right to Erasure (Account Deletion)</h4>
                    <p className="text-sm text-gray-600">
                      You can request deletion of your account and personal data. Note that order records will be 
                      retained for 7 years as required by tax laws. To delete your account, contact us at 
                      <a href="mailto:support@yourstore.com" className="text-orange-600 hover:underline ml-1">support@yourstore.com</a>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-orange-600">4</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">Right to Data Portability</h4>
                    <p className="text-sm text-gray-600">
                      You can request your data in a machine-readable format for transfer to another service provider.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-orange-600">5</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">Right to Withdraw Consent</h4>
                    <p className="text-sm text-gray-600">
                      You can withdraw consent for marketing communications at any time by updating your preferences 
                      or unsubscribing from emails. This will not affect the lawfulness of processing based on 
                      consent before its withdrawal.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 5: Cookies */}
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Cookie className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-gray-900">5. Cookies and Tracking</h2>
              </div>
              
              <p className="text-sm leading-6 mb-3">
                We use cookies and similar technologies to improve your experience on our platform:
              </p>
              
              <div className="space-y-3">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-800">Essential Cookies</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Required for the website to function properly. These include session tokens for keeping you 
                    logged in and cart data for storing items in your shopping cart. These cookies cannot be disabled.
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-800">Security Cookies</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Used to detect and prevent fraudulent activities, such as repeated failed login attempts 
                    or suspicious transactions.
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-800">Preference Cookies</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Remember your preferences such as delivery address, payment method selection, and UI preferences.
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-800">Analytics Cookies (Optional)</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Help us understand how visitors interact with our website. We may use anonymized analytics 
                    to improve our services. You can opt out of analytics cookies through your browser settings.
                  </p>
                </div>
              </div>

              <p className="text-sm leading-6 mt-3">
                You can manage cookie preferences through your browser settings. Disabling certain cookies may 
                affect website functionality.
              </p>
            </section>

            {/* Section 6: Grievance Officer */}
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-gray-900">6. Grievance Redressal</h2>
              </div>
              
              <p className="text-sm leading-6 mb-3">
                In accordance with the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) 
                Rules, 2021, we have appointed a Grievance Officer to address complaints regarding your personal data.
              </p>
              
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-800 mb-2">Grievance Officer Contact</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-orange-500" />
                    <span><strong>Email:</strong> <a href="mailto:support@yourstore.com" className="text-orange-600 hover:underline">support@yourstore.com</a></span>
                  </div>
                  <p className="text-gray-600">
                    <strong>Response Time:</strong> We will acknowledge your complaint within 24 hours and 
                    provide a resolution within 7 business days.
                  </p>
                </div>
              </div>

              <p className="text-sm leading-6 mt-3">
                When filing a grievance, please include:
              </p>
              <ul className="list-disc list-inside text-sm leading-6 space-y-1">
                <li>Your registered email address or phone number</li>
                <li>A clear description of your concern</li>
                <li>Any relevant order numbers or transaction IDs</li>
                <li>The specific remedy you are seeking</li>
              </ul>
            </section>

            {/* Section 7: Security */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Data Security</h2>
              <p className="text-sm leading-6 mb-3">
                We implement industry-standard security measures to protect your data:
              </p>
              <ul className="list-disc list-inside text-sm leading-6 space-y-1">
                <li><strong>Encryption:</strong> All data in transit is encrypted using TLS 1.2 or higher</li>
                <li><strong>Access Control:</strong> Strict role-based access to personal data</li>
                <li><strong>Secure Authentication:</strong> JWT tokens with expiration, OTP verification</li>
                <li><strong>Regular Audits:</strong> Periodic security assessments and vulnerability scans</li>
                <li><strong>Backup & Recovery:</strong> Point-in-time recovery for database with encrypted backups</li>
              </ul>
            </section>

            {/* Section 8: Children */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Children's Privacy</h2>
              <p className="text-sm leading-6">
                Our services are not intended for individuals under 18 years of age. We do not knowingly collect 
                personal information from children. If you believe we have inadvertently collected data from a 
                minor, please contact us immediately at <a href="mailto:support@yourstore.com" className="text-orange-600 hover:underline">support@yourstore.com</a>.
              </p>
            </section>

            {/* Section 9: Changes */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Changes to This Policy</h2>
              <p className="text-sm leading-6">
                We may update this Privacy Policy from time to time to reflect changes in our practices or legal 
                requirements. The "Last updated" date at the top indicates when the most recent changes were made. 
                We will notify you of significant changes via email or through a prominent notice on our website.
              </p>
            </section>

            {/* Contact Section */}
            <section className="border-t pt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Contact Us</h2>
              <p className="text-sm leading-6 mb-3">
                If you have questions about this Privacy Policy or wish to exercise your rights, please contact us:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm">
                  <strong>Email:</strong> <a href="mailto:support@yourstore.com" className="text-orange-600 hover:underline">support@yourstore.com</a>
                </p>
                <p className="text-sm mt-1">
                  <strong>Response Time:</strong> Within 7 business days
                </p>
              </div>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
