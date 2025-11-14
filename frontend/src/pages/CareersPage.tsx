import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  MapPin,
  Clock,
  Users,
  Briefcase,
  GraduationCap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const CareersPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedDepartment, setSelectedDepartment] = useState("all");

  const departments = [
    { id: "all", name: "All Departments" },
    { id: "engineering", name: "Engineering" },
    { id: "marketing", name: "Marketing" },
    { id: "sales", name: "Sales" },
    { id: "operations", name: "Operations" },
    { id: "design", name: "Design" },
  ];

  const jobOpenings = [
    {
      id: 1,
      title: "Senior Software Engineer",
      department: "engineering",
      location: "New Delhi",
      type: "Full-time",
      experience: "3-5 years",
      description:
        "We're looking for a passionate Senior Software Engineer to join our team and help build scalable e-commerce solutions.",
      requirements: [
        "Bachelor's degree in Computer Science or related field",
        "3+ years of experience with React, Node.js, and TypeScript",
        "Experience with cloud platforms (AWS, Azure, or GCP)",
        "Strong problem-solving and communication skills",
      ],
    },
    {
      id: 2,
      title: "Product Manager",
      department: "engineering",
      location: "Mumbai",
      type: "Full-time",
      experience: "4-6 years",
      description:
        "Lead product strategy and execution for our core e-commerce platform features.",
      requirements: [
        "MBA or Bachelor's degree in related field",
        "4+ years of product management experience",
        "Experience in e-commerce or consumer tech",
        "Strong analytical and leadership skills",
      ],
    },
    {
      id: 3,
      title: "Digital Marketing Specialist",
      department: "marketing",
      location: "Bangalore",
      type: "Full-time",
      experience: "2-4 years",
      description:
        "Drive our digital marketing initiatives and help grow our customer base.",
      requirements: [
        "Bachelor's degree in Marketing or related field",
        "2+ years of digital marketing experience",
        "Proficiency in Google Ads, Facebook Ads, and SEO",
        "Strong analytical and creative thinking skills",
      ],
    },
    {
      id: 4,
      title: "UX/UI Designer",
      department: "design",
      location: "Hyderabad",
      type: "Full-time",
      experience: "2-4 years",
      description:
        "Create intuitive and beautiful user experiences for our e-commerce platform.",
      requirements: [
        "Bachelor's degree in Design or related field",
        "2+ years of UX/UI design experience",
        "Proficiency in Figma, Sketch, or Adobe Creative Suite",
        "Portfolio demonstrating strong design skills",
      ],
    },
    {
      id: 5,
      title: "Customer Success Manager",
      department: "operations",
      location: "Chennai",
      type: "Full-time",
      experience: "3-5 years",
      description:
        "Ensure our customers have the best possible experience with our platform.",
      requirements: [
        "Bachelor's degree in Business or related field",
        "3+ years of customer success experience",
        "Excellent communication and problem-solving skills",
        "Experience with CRM tools",
      ],
    },
    {
      id: 6,
      title: "Sales Executive",
      department: "sales",
      location: "Pune",
      type: "Full-time",
      experience: "1-3 years",
      description:
        "Drive sales growth by building relationships with merchants and partners.",
      requirements: [
        "Bachelor's degree in Business or related field",
        "1+ years of sales experience",
        "Strong communication and negotiation skills",
        "Self-motivated and results-oriented",
      ],
    },
  ];

  const filteredJobs =
    selectedDepartment === "all"
      ? jobOpenings
      : jobOpenings.filter((job) => job.department === selectedDepartment);

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
            <h1 className="text-2xl font-bold text-gray-900">Careers</h1>
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
            Join Our Team
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Be part of India's fastest-growing e-commerce platform. We're
            looking for talented, passionate individuals to help us build the
            future of online shopping.
          </p>
        </motion.div>

        {/* Why Work With Us */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white rounded-lg shadow-lg p-8 mb-8"
        >
          <h3 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Why Work With Us?
          </h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-orange-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <Users className="w-10 h-10 text-orange-500" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-3">
                Great Culture
              </h4>
              <p className="text-gray-600">
                Work in a collaborative, inclusive environment where your ideas
                matter and your voice is heard.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-orange-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <GraduationCap className="w-10 h-10 text-orange-500" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-3">
                Learning & Growth
              </h4>
              <p className="text-gray-600">
                Continuous learning opportunities, mentorship programs, and
                career development support.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-orange-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                <Briefcase className="w-10 h-10 text-orange-500" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-3">
                Impact
              </h4>
              <p className="text-gray-600">
                Make a real difference in millions of lives by building products
                that matter.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Benefits */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-lg p-8 mb-8 text-white"
        >
          <h3 className="text-3xl font-bold mb-8 text-center">
            Benefits & Perks
          </h3>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h4 className="text-xl font-semibold mb-4">
                Compensation & Benefits
              </h4>
              <ul className="space-y-2">
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-white rounded-full mr-3"></span>
                  Competitive salary and equity
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-white rounded-full mr-3"></span>
                  Health insurance for you and your family
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-white rounded-full mr-3"></span>
                  Flexible work arrangements
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-white rounded-full mr-3"></span>
                  Generous paid time off
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xl font-semibold mb-4">Work Environment</h4>
              <ul className="space-y-2">
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-white rounded-full mr-3"></span>
                  Modern office spaces
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-white rounded-full mr-3"></span>
                  Free meals and snacks
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-white rounded-full mr-3"></span>
                  Team building activities
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-white rounded-full mr-3"></span>
                  Professional development budget
                </li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Job Openings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="bg-white rounded-lg shadow-lg p-8"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
            <h3 className="text-3xl font-bold text-gray-900 mb-4 md:mb-0">
              Open Positions
            </h3>
            <div className="flex flex-wrap gap-2">
              {departments.map((dept) => (
                <button
                  key={dept.id}
                  onClick={() => setSelectedDepartment(dept.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedDepartment === dept.id
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {dept.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-4">
                  <div>
                    <h4 className="text-xl font-semibold text-gray-900 mb-2">
                      {job.title}
                    </h4>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <span className="flex items-center">
                        <MapPin className="w-4 h-4 mr-1" />
                        {job.location}
                      </span>
                      <span className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {job.type}
                      </span>
                      <span className="flex items-center">
                        <Briefcase className="w-4 h-4 mr-1" />
                        {job.experience}
                      </span>
                    </div>
                  </div>
                  <button className="mt-4 md:mt-0 bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg transition-colors">
                    Apply Now
                  </button>
                </div>
                <p className="text-gray-600 mb-4">{job.description}</p>
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">
                    Requirements:
                  </h5>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    {job.requirements.map((req, index) => (
                      <li key={index}>{req}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {filteredJobs.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                No positions found in this department.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default CareersPage;
