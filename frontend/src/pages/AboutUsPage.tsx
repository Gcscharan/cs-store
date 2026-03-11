import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Users, Target, Award, Heart, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";

const AboutUsPage: React.FC = () => {
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
            <h1 className="text-2xl font-bold text-gray-900">{t("about.title")}</h1>
            <div></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            {t("about.aboutVyaparaSetu")}
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {t("about.introText")}
          </p>
        </motion.div>

        {/* Our Story */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white rounded-lg shadow-lg p-8 mb-8"
        >
          <h3 className="text-3xl font-bold text-gray-900 mb-6">{t("about.ourStory")}</h3>
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-600 mb-4">
              {t("about.storyP1")}
            </p>
            <p className="text-gray-600 mb-4">
              {t("about.storyP2")}
            </p>
            <p className="text-gray-600">
              {t("about.storyP3")}
            </p>
          </div>
        </motion.div>

        {/* Mission & Vision */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="bg-white rounded-lg shadow-lg p-8"
          >
            <div className="flex items-center mb-4">
              <Target className="w-8 h-8 text-orange-500 mr-3" />
              <h3 className="text-2xl font-bold text-gray-900">{t("about.ourMission")}</h3>
            </div>
            <p className="text-gray-600">
              {t("about.missionText")}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="bg-white rounded-lg shadow-lg p-8"
          >
            <div className="flex items-center mb-4">
              <Award className="w-8 h-8 text-orange-500 mr-3" />
              <h3 className="text-2xl font-bold text-gray-900">{t("about.ourVision")}</h3>
            </div>
            <p className="text-gray-600">
              {t("about.visionText")}
            </p>
          </motion.div>
        </div>

        {/* Values */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="bg-white rounded-lg shadow-lg p-8 mb-8"
        >
          <h3 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            {t("corporate.ourValues")}
          </h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-orange-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <Heart className="w-10 h-10 text-orange-500" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-3">
                {t("about.customerFirst")}
              </h4>
              <p className="text-gray-600">
                {t("about.customerFirstText")}
              </p>
            </div>

            <div className="text-center">
              <div className="bg-orange-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <Users className="w-10 h-10 text-orange-500" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-3">
                {t("about.inclusivity")}
              </h4>
              <p className="text-gray-600">
                {t("about.inclusivityText")}
              </p>
            </div>

            <div className="text-center">
              <div className="bg-orange-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <Globe className="w-10 h-10 text-orange-500" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-3">
                {t("about.innovation")}
              </h4>
              <p className="text-gray-600">
                {t("about.innovationText")}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-lg p-8 text-white"
        >
          <h3 className="text-3xl font-bold mb-8 text-center">
            {t("about.byTheNumbers")}
          </h3>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">10M+</div>
              <div className="text-orange-100">{t("about.happyCustomers")}</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">50K+</div>
              <div className="text-orange-100">{t("about.products")}</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">500+</div>
              <div className="text-orange-100">{t("about.citiesServed")}</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">99.9%</div>
              <div className="text-orange-100">{t("about.uptime")}</div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AboutUsPage;
