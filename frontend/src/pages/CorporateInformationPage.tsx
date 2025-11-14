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
      name: "Rajesh Kumar",
      position: "Chief Executive Officer",
      bio: "15+ years of experience in e-commerce and technology leadership.",
      image:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=face",
    },
    {
      name: "Priya Sharma",
      position: "Chief Technology Officer",
      bio: "Expert in scalable systems and digital transformation.",
      image:
        "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=300&h=300&fit=crop&crop=face",
    },
    {
      name: "Amit Patel",
      position: "Chief Operating Officer",
      bio: "Operations specialist with focus on customer experience.",
      image:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&h=300&fit=crop&crop=face",
    },
    {
      name: "Sarah Johnson",
      position: "Chief Financial Officer",
      bio: "Financial strategy and growth management expert.",
      image:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300&h=300&fit=crop&crop=face",
    },
  ];

  const documents = [
    {
      title: "Annual Report 2023",
      description:
        "Complete financial and operational overview for fiscal year 2023",
      type: "PDF",
      size: "2.4 MB",
      date: "2024-01-15",
    },
    {
      title: "Sustainability Report",
      description: "Our environmental and social impact initiatives",
      type: "PDF",
      size: "1.8 MB",
      date: "2023-12-20",
    },
    {
      title: "Corporate Governance Guidelines",
      description: "Framework for ethical business practices and transparency",
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
              Corporate Information
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
            Corporate Information
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Learn about CS Store's corporate structure, leadership team, and
            commitment to transparency and ethical business practices.
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
                CS Store is India's leading e-commerce platform, founded in 2020
                with a mission to democratize commerce and make quality products
                accessible to every Indian. We operate as a technology-driven
                marketplace connecting millions of customers with thousands of
                sellers across the country.
              </p>
              <p className="text-gray-600">
                Our platform offers a wide range of products including
                electronics, fashion, home goods, groceries, and more, all
                delivered with exceptional customer service and competitive
                pricing.
              </p>
            </div>
            <div>
              <h4 className="text-xl font-semibold text-gray-900 mb-4">
                Key Facts
              </h4>
              <div className="space-y-3">
                <div className="flex items-center">
                  <Building className="w-5 h-5 text-orange-500 mr-3" />
                  <span className="text-gray-600">Founded: 2020</span>
                </div>
                <div className="flex items-center">
                  <Users className="w-5 h-5 text-orange-500 mr-3" />
                  <span className="text-gray-600">Employees: 5,000+</span>
                </div>
                <div className="flex items-center">
                  <Globe className="w-5 h-5 text-orange-500 mr-3" />
                  <span className="text-gray-600">Cities Served: 500+</span>
                </div>
                <div className="flex items-center">
                  <Award className="w-5 h-5 text-orange-500 mr-3" />
                  <span className="text-gray-600">Customers: 10M+</span>
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
          <h3 className="text-3xl font-bold text-gray-900 mb-8">
            Leadership Team
          </h3>
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
          <h3 className="text-3xl font-bold text-gray-900 mb-8">
            Corporate Documents
          </h3>
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
          <h3 className="text-3xl font-bold mb-6">Corporate Contact</h3>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h4 className="text-xl font-semibold mb-4">Headquarters</h4>
              <p className="mb-2">CS Store Private Limited</p>
              <p className="mb-2">123 Business Park, Sector 5</p>
              <p className="mb-2">New Delhi, 110001, India</p>
              <p className="mb-4">Phone: +91 11 1234 5678</p>
            </div>
            <div>
              <h4 className="text-xl font-semibold mb-4">Investor Relations</h4>
              <p className="mb-2">Email: investors@csstore.com</p>
              <p className="mb-2">Phone: +91 11 1234 5679</p>
              <p className="mb-4">Website: investors.csstore.com</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default CorporateInformationPage;
