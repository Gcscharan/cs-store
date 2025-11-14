import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Users, Target, Award, Heart, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";

const AboutUsPage: React.FC = () => {
  const navigate = useNavigate();

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
              <span>Back to Home</span>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">About Us</h1>
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
            About CS Store
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            We are India's leading e-commerce platform, dedicated to bringing
            you the best products at unbeatable prices with exceptional customer
            service.
          </p>
        </motion.div>

        {/* Our Story */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white rounded-lg shadow-lg p-8 mb-8"
        >
          <h3 className="text-3xl font-bold text-gray-900 mb-6">Our Story</h3>
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-600 mb-4">
              Founded in 2020, CS Store began as a small startup with a big
              dream: to make quality products accessible to everyone across
              India. What started as a simple online marketplace has grown into
              one of the country's most trusted e-commerce platforms.
            </p>
            <p className="text-gray-600 mb-4">
              Our journey has been marked by innovation, customer-centricity,
              and an unwavering commitment to excellence. We believe that
              shopping should be simple, enjoyable, and accessible to everyone,
              regardless of their location or budget.
            </p>
            <p className="text-gray-600">
              Today, we serve millions of customers across India, offering
              everything from electronics and fashion to home goods and
              groceries, all delivered with the same care and attention that has
              defined us from day one.
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
              <h3 className="text-2xl font-bold text-gray-900">Our Mission</h3>
            </div>
            <p className="text-gray-600">
              To democratize commerce by making quality products accessible to
              every Indian, while fostering a sustainable and inclusive
              marketplace that benefits customers, sellers, and communities
              alike.
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
              <h3 className="text-2xl font-bold text-gray-900">Our Vision</h3>
            </div>
            <p className="text-gray-600">
              To become India's most trusted and innovative e-commerce platform,
              setting new standards for customer experience, technological
              advancement, and social impact in the digital commerce space.
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
            Our Values
          </h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-orange-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <Heart className="w-10 h-10 text-orange-500" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-3">
                Customer First
              </h4>
              <p className="text-gray-600">
                Every decision we make is guided by what's best for our
                customers. Their satisfaction is our greatest reward.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-orange-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <Users className="w-10 h-10 text-orange-500" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-3">
                Inclusivity
              </h4>
              <p className="text-gray-600">
                We believe in creating an inclusive platform where everyone
                feels welcome and valued, regardless of background or
                circumstances.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-orange-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <Globe className="w-10 h-10 text-orange-500" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-3">
                Innovation
              </h4>
              <p className="text-gray-600">
                We continuously innovate to improve our platform, making
                shopping more convenient, efficient, and enjoyable for everyone.
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
            CS Store by the Numbers
          </h3>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">10M+</div>
              <div className="text-orange-100">Happy Customers</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">50K+</div>
              <div className="text-orange-100">Products</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">500+</div>
              <div className="text-orange-100">Cities Served</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">99.9%</div>
              <div className="text-orange-100">Uptime</div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AboutUsPage;
