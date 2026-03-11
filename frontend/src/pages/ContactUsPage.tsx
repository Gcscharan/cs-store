import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Phone, MapPin, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";

const ContactUsPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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
            <h1 className="text-2xl font-bold text-gray-900">{t("legal.contactUs")}</h1>
            <div></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-white rounded-lg shadow-lg p-8"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              {t("legal.getInTouch")}
            </h2>
            <p className="text-lg text-gray-600">
              {t("legal.getInTouchText")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Contact Information */}
            <div className="space-y-6">
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                {t("legal.contactInformation")}
              </h3>

              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Mail className="w-6 h-6 text-orange-500" />
                  <div>
                    <p className="font-medium text-gray-900">{t("legal.email")}</p>
                    <p className="text-gray-600">support@csstore.com</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Phone className="w-6 h-6 text-orange-500" />
                  <div>
                    <p className="font-medium text-gray-900">{t("legal.phone")}</p>
                    <p className="text-gray-600">+91-9391795162</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <MapPin className="w-6 h-6 text-orange-500" />
                  <div>
                    <p className="font-medium text-gray-900">{t("legal.address")}</p>
                    <p className="text-gray-600">
                      Vyapara Setu
                      <br />
                      Tiruvuru, Krishna District,
                      <br />
                      Andhra Pradesh, India – 521235
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Clock className="w-6 h-6 text-orange-500" />
                  <div>
                    <p className="font-medium text-gray-900">{t("legal.businessHours")}</p>
                    <p className="text-gray-600">
                      {t("legal.monFri")}
                    </p>
                    <p className="text-gray-600">
                      {t("legal.sat")}
                    </p>
                    <p className="text-gray-600">{t("legal.sunClosed")}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                {t("legal.sendMessage")}
              </h3>

              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("legal.fullName")}
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder={t("legal.enterFullName")}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("legal.email")}
                  </label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder={t("legal.enterEmail")}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("legal.subject")}
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder={t("legal.enterSubject")}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("legal.message")}
                  </label>
                  <textarea
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder={t("legal.enterMessage")}
                  ></textarea>
                </div>

                <button
                  type="submit"
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
                >
                  {t("legal.sendMessageBtn")}
                </button>
              </form>
            </div>
          </div>

          {/* Additional Information */}
          <div className="mt-12 bg-gray-50 rounded-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              {t("legal.customerSupport")}
            </h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="bg-orange-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                  <Mail className="w-8 h-8 text-orange-500" />
                </div>
                <h4 className="font-medium text-gray-900 mb-2">
                  {t("legal.emailSupport")}
                </h4>
                <p className="text-sm text-gray-600">
                  {t("legal.emailSupportText")}
                </p>
              </div>

              <div className="text-center">
                <div className="bg-orange-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                  <Phone className="w-8 h-8 text-orange-500" />
                </div>
                <h4 className="font-medium text-gray-900 mb-2">
                  {t("legal.phoneSupport")}
                </h4>
                <p className="text-sm text-gray-600">
                  {t("legal.phoneSupportText")}
                </p>
              </div>

              <div className="text-center">
                <div className="bg-orange-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-8 h-8 text-orange-500" />
                </div>
                <h4 className="font-medium text-gray-900 mb-2">{t("legal.liveChat")}</h4>
                <p className="text-sm text-gray-600">
                  {t("legal.liveChatText")}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ContactUsPage;
