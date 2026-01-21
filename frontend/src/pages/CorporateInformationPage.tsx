import React from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Building,
  Users,
  Award,
  Globe,
  FileText,
  Shield,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const CorporateInformationPage: React.FC = () => {
  const navigate = useNavigate();

  const leadership = [
    {
      name: "CS Store",
      position: "Proprietor",
      bio: "CS Store is operated by an individual proprietor in India.",
      image:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=face",
    },
  ];

  const documents = [
    {
      title: "Annual Report 2023",
      description:
        "Store information and updates",
      type: "PDF",
      size: "2.4 MB",
      date: "2024-01-15",
    },
    {
      title: "Sustainability Report",
      description: "How we aim to operate responsibly",
      type: "PDF",
      size: "1.8 MB",
      date: "2023-12-20",
    },
    {
      title: "Corporate Governance Guidelines",
      description: "Guidelines for ethical business practices and transparency",
      type: "PDF",
      size: "1.2 MB",
      date: "2023-11-10",
    },
    {
      title: "Privacy Policy",
      description: "How we collect, use, and protect customer data",
      type: "PDF",
      size: "0.8 MB",
      date: "2023-10-05",
    },
  ];

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
            <h1 className="text-2xl font-bold text-gray-900">
              Business Information
            </h1>
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
            Business Information
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Learn about CS Store and how we operate, with a commitment to
            transparency and ethical business practices.
          </p>
        </motion.div>

        {/* Company Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white rounded-lg shadow-lg p-8 mb-8"
        >
          <h3 className="text-3xl font-bold text-gray-900 mb-6">
            Company Overview
          </h3>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h4 className="text-xl font-semibold text-gray-900 mb-4">
                About CS Store
              </h4>
              <p className="text-gray-600 mb-4">
                CS Store is an online store operated by an individual proprietor
                in India.
              </p>
              <p className="text-gray-600">
                We aim to provide a smooth shopping experience and responsive
                customer support.
              </p>
            </div>
            <div>
              <h4 className="text-xl font-semibold text-gray-900 mb-4">
                Key Facts
              </h4>
              <div className="space-y-3">
                <div className="flex items-center">
                  <Building className="w-5 h-5 text-orange-500 mr-3" />
                  <span className="text-gray-600">Business type: Sole proprietorship</span>
                </div>
                <div className="flex items-center">
                  <Users className="w-5 h-5 text-orange-500 mr-3" />
                  <span className="text-gray-600">Operated in: India</span>
                </div>
                <div className="flex items-center">
                  <Globe className="w-5 h-5 text-orange-500 mr-3" />
                  <span className="text-gray-600">Location: Tiruvuru, Andhra Pradesh</span>
                </div>
                <div className="flex items-center">
                  <Award className="w-5 h-5 text-orange-500 mr-3" />
                  <span className="text-gray-600">Support: support@csstore.com</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Leadership Team */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="bg-white rounded-lg shadow-lg p-8 mb-8"
        >
          <h3 className="text-3xl font-bold text-gray-900 mb-8">About the operator</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {leadership.map((leader, index) => (
              <div key={index} className="text-center">
                <img
                  src={leader.image}
                  alt={leader.name}
                  className="w-32 h-32 rounded-full mx-auto mb-4 object-cover"
                />
                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                  {leader.name}
                </h4>
                <p className="text-orange-500 font-medium mb-2">
                  {leader.position}
                </p>
                <p className="text-sm text-gray-600">{leader.bio}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Corporate Values */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="bg-white rounded-lg shadow-lg p-8 mb-8"
        >
          <h3 className="text-3xl font-bold text-gray-900 mb-8">Our Values</h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-orange-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-10 h-10 text-orange-500" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-3">
                Integrity
              </h4>
              <p className="text-gray-600">
                We conduct business with the highest ethical standards and
                transparency in all our operations.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-orange-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <Users className="w-10 h-10 text-orange-500" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-3">
                Customer Focus
              </h4>
              <p className="text-gray-600">
                Every decision we make is guided by what's best for our
                customers and their experience.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-orange-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <Award className="w-10 h-10 text-orange-500" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-3">
                Excellence
              </h4>
              <p className="text-gray-600">
                We strive for excellence in everything we do, continuously
                improving and innovating.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Corporate Documents */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="bg-white rounded-lg shadow-lg p-8 mb-8"
        >
          <h3 className="text-3xl font-bold text-gray-900 mb-8">Documents</h3>
          <div className="grid md:grid-cols-2 gap-6">
            {documents.map((doc, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <FileText className="w-8 h-8 text-orange-500 mr-3" />
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">
                        {doc.title}
                      </h4>
                      <p className="text-gray-600 text-sm">{doc.description}</p>
                    </div>
                  </div>
                  <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-medium">
                    {doc.type}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>{doc.size}</span>
                  <span>{new Date(doc.date).toLocaleDateString()}</span>
                </div>
                <button className="w-full mt-4 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg transition-colors">
                  Download
                </button>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Contact Information */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-lg p-8 text-white"
        >
          <h3 className="text-3xl font-bold mb-6">Contact</h3>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h4 className="text-xl font-semibold mb-4">Mail Us</h4>
              <p className="mb-2">CS Store</p>
              <p className="mb-2">Tiruvuru, Krishna District</p>
              <p className="mb-2">Andhra Pradesh, India – 521235</p>
              <p className="mb-4">Phone: +91-9391795162</p>
            </div>
            <div>
              <h4 className="text-xl font-semibold mb-4">Support</h4>
              <p className="mb-2">Email: support@csstore.com</p>
              <p className="mb-2">Phone: +91-9391795162</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default CorporateInformationPage;
