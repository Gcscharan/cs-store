import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, Database, Users, Clock, Cookie, Mail, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";

const PrivacyPolicyPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

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
              <span>{t("legal.backToHome")}</span>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">{t("legal.privacyPolicy")}</h1>
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
              <div className="text-lg font-semibold text-gray-900">{t("legal.privacyPolicy")}</div>
              <div className="text-sm text-gray-600">{t("legal.lastUpdated")}: {new Date().toISOString().slice(0, 10)}</div>
            </div>
          </div>

          <div className="prose prose-sm max-w-none text-gray-700">
            {/* Introduction */}
            <p className="text-sm leading-6 mb-6">
              {t("privacy.intro")}
            </p>

            {/* Section 1: Data Collection */}
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Database className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-gray-900">{t("privacy.dataCollection")}</h2>
              </div>
              
              <h3 className="text-sm font-semibold text-gray-800 mb-2">{t("privacy.personalInfo")}</h3>
              <p className="text-sm leading-6 mb-3">
                {t("privacy.personalInfoText")}
              </p>
              <ul className="list-disc list-inside text-sm leading-6 mb-4 space-y-1">
                <li><strong>{t("privacy.identity")}:</strong> {t("privacy.identityText")}</li>
                <li><strong>{t("privacy.address")}:</strong> {t("privacy.addressText")}</li>
                <li><strong>{t("privacy.authentication")}:</strong> {t("privacy.authenticationText")}</li>
                <li><strong>{t("privacy.communication")}:</strong> {t("privacy.communicationText")}</li>
              </ul>

              <h3 className="text-sm font-semibold text-gray-800 mb-2">{t("privacy.orderData")}</h3>
              <p className="text-sm leading-6 mb-3">
                {t("privacy.orderDataText")}
              </p>
              <ul className="list-disc list-inside text-sm leading-6 mb-4 space-y-1">
                <li>{t("privacy.orderData1")}</li>
                <li>{t("privacy.orderData2")}</li>
                <li>{t("privacy.orderData3")}</li>
                <li>{t("privacy.orderData4")}</li>
                <li>{t("privacy.orderData5")}</li>
              </ul>

              <h3 className="text-sm font-semibold text-gray-800 mb-2">{t("privacy.paymentProcessing")}</h3>
              <p className="text-sm leading-6">
                {t("privacy.paymentProcessingText")}
              </p>
            </section>

            {/* Section 2: Third Party Services */}
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-gray-900">{t("privacy.thirdPartyServices")}</h2>
              </div>
              
              <p className="text-sm leading-6 mb-3">
                {t("privacy.thirdPartyText")}
              </p>
              
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-800">{t("privacy.razorpay")}</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {t("privacy.razorpayText")}
                    <a href="https://razorpay.com/privacy/" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline ml-1">
                      {t("privacy.viewPrivacyPolicy")}
                    </a>
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-800">{t("privacy.cloudinary")}</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {t("privacy.cloudinaryText")}
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-800">{t("privacy.cloudHosting")}</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {t("privacy.cloudHostingText")}
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-800">{t("privacy.googleMaps")}</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {t("privacy.googleMapsText")}
                  </p>
                </div>
              </div>
            </section>

            {/* Section 3: Data Retention */}
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-gray-900">{t("privacy.dataRetention")}</h2>
              </div>
              
              <p className="text-sm leading-6 mb-3">
                {t("privacy.dataRetentionText")}
              </p>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3 border-b font-semibold text-gray-800">{t("privacy.dataType")}</th>
                      <th className="text-left p-3 border-b font-semibold text-gray-800">{t("privacy.retentionPeriod")}</th>
                      <th className="text-left p-3 border-b font-semibold text-gray-800">{t("privacy.reason")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-3">{t("privacy.orderRecords")}</td>
                      <td className="p-3">{t("privacy.years7")}</td>
                      <td className="p-3">{t("privacy.gstCompliance")}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-3">{t("privacy.accountInfo")}</td>
                      <td className="p-3">{t("privacy.untilDeletion")}</td>
                      <td className="p-3">{t("privacy.serviceDelivery")}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-3">{t("privacy.paymentRecords")}</td>
                      <td className="p-3">{t("privacy.years7")}</td>
                      <td className="p-3">{t("privacy.rbiGuidelines")}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-3">{t("privacy.locationData")}</td>
                      <td className="p-3">{t("privacy.orderCompletion1Year")}</td>
                      <td className="p-3">{t("privacy.disputeResolution")}</td>
                    </tr>
                    <tr>
                      <td className="p-3">{t("privacy.otpLogs")}</td>
                      <td className="p-3">{t("privacy.days30")}</td>
                      <td className="p-3">{t("privacy.securityFraud")}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section 4: User Rights */}
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-gray-900">{t("privacy.yourRights")}</h2>
              </div>
              
              <p className="text-sm leading-6 mb-3">
                {t("privacy.rightsText")}
              </p>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-orange-600">1</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">{t("privacy.rightAccess")}</h4>
                    <p className="text-sm text-gray-600">
                      {t("privacy.rightAccessText")}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-orange-600">2</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">{t("privacy.rightCorrection")}</h4>
                    <p className="text-sm text-gray-600">
                      {t("privacy.rightCorrectionText")}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-orange-600">3</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">{t("privacy.rightErasure")}</h4>
                    <p className="text-sm text-gray-600">
                      {t("privacy.rightErasureText")}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-orange-600">4</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">{t("privacy.rightPortability")}</h4>
                    <p className="text-sm text-gray-600">
                      {t("privacy.rightPortabilityText")}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-orange-600">5</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">{t("privacy.rightWithdraw")}</h4>
                    <p className="text-sm text-gray-600">
                      {t("privacy.rightWithdrawText")}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 5: Cookies */}
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Cookie className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-gray-900">{t("privacy.cookiesTracking")}</h2>
              </div>
              
              <p className="text-sm leading-6 mb-3">
                {t("privacy.cookiesText")}
              </p>
              
              <div className="space-y-3">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-800">{t("privacy.essentialCookies")}</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {t("privacy.essentialCookiesText")}
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-800">{t("privacy.securityCookies")}</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {t("privacy.securityCookiesText")}
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-800">{t("privacy.preferenceCookies")}</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {t("privacy.preferenceCookiesText")}
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-800">{t("privacy.analyticsCookies")}</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {t("privacy.analyticsCookiesText")}
                  </p>
                </div>
              </div>

              <p className="text-sm leading-6 mt-3">
                {t("privacy.manageCookiesText")}
              </p>
            </section>

            {/* Section 6: Grievance Officer */}
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-gray-900">{t("privacy.grievanceRedressal")}</h2>
              </div>
              
              <p className="text-sm leading-6 mb-3">
                {t("privacy.grievanceText")}
              </p>
              
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-800 mb-2">{t("privacy.grievanceOfficerContact")}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-orange-500" />
                    <span><strong>{t("legal.email")}:</strong> <a href="mailto:support@yourstore.com" className="text-orange-600 hover:underline">support@yourstore.com</a></span>
                  </div>
                  <p className="text-gray-600">
                    <strong>{t("privacy.responseTime")}:</strong> {t("privacy.responseTimeText")}
                  </p>
                </div>
              </div>

              <p className="text-sm leading-6 mt-3">
                {t("privacy.filingGrievanceText")}
              </p>
              <ul className="list-disc list-inside text-sm leading-6 space-y-1">
                <li>{t("privacy.grievanceItem1")}</li>
                <li>{t("privacy.grievanceItem2")}</li>
                <li>{t("privacy.grievanceItem3")}</li>
                <li>{t("privacy.grievanceItem4")}</li>
              </ul>
            </section>

            {/* Section 7: Security */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">{t("privacy.dataSecurity")}</h2>
              <p className="text-sm leading-6 mb-3">
                {t("privacy.dataSecurityText")}
              </p>
              <ul className="list-disc list-inside text-sm leading-6 space-y-1">
                <li><strong>{t("privacy.encryption")}:</strong> {t("privacy.encryptionText")}</li>
                <li><strong>{t("privacy.accessControl")}:</strong> {t("privacy.accessControlText")}</li>
                <li><strong>{t("privacy.secureAuth")}:</strong> {t("privacy.secureAuthText")}</li>
                <li><strong>{t("privacy.regularAudits")}:</strong> {t("privacy.regularAuditsText")}</li>
                <li><strong>{t("privacy.backupRecovery")}:</strong> {t("privacy.backupRecoveryText")}</li>
              </ul>
            </section>

            {/* Section 8: Children */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">{t("privacy.childrenPrivacy")}</h2>
              <p className="text-sm leading-6">
                {t("privacy.childrenPrivacyText")}
              </p>
            </section>

            {/* Section 9: Changes */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">{t("privacy.changesToPolicy")}</h2>
              <p className="text-sm leading-6">
                {t("privacy.changesToPolicyText")}
              </p>
            </section>

            {/* Contact Section */}
            <section className="border-t pt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">{t("privacy.contactUs")}</h2>
              <p className="text-sm leading-6 mb-3">
                {t("privacy.contactUsText")}
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm">
                  <strong>{t("legal.email")}:</strong> <a href="mailto:support@yourstore.com" className="text-orange-600 hover:underline">support@yourstore.com</a>
                </p>
                <p className="text-sm mt-1">
                  <strong>{t("privacy.responseTime")}:</strong> {t("privacy.responseTime7Days")}
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
