import React, { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Home, Zap, ShieldCheck, BarChart2 } from "lucide-react";

const ComingSoonPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    // Basic email validation
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email address.");
      setIsSubmitting(false);
      return;
    }

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      console.log(`Subscribed email: ${email}`);
      setIsSubmitted(true);
      setEmail(""); // Clear email after successful submission
    } catch (err) {
      setError("Failed to subscribe. Please try again.");
      console.error("Subscription error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden"
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full"></div>
        <div className="absolute top-32 right-16 w-24 h-24 bg-white rounded-full"></div>
        <div className="absolute bottom-20 left-20 w-16 h-16 bg-white rounded-full"></div>
        <div className="absolute bottom-32 right-10 w-20 h-20 bg-white rounded-full"></div>
      </div>

      <div className="relative z-10 w-full">
        {/* Header */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex justify-between items-center mb-12 px-4"
        >
          <h1 className="text-2xl font-bold">CS Store</h1>
          <Link
            to="/"
            className="flex items-center text-white hover:text-blue-200 transition-colors"
          >
            <Home className="h-5 w-5 mr-2" />
            Back to Home
          </Link>
        </motion.div>

        {/* Main Content Container */}
        <div className="max-w-3xl mx-auto">
          {/* Main Content */}
          <div className="text-center">
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <h2 className="text-5xl md:text-6xl font-extrabold mb-4 leading-tight">
                Become a Seller
              </h2>
              <p className="text-xl md:text-2xl text-blue-100 mb-8">
                Launch your store with us. Get ready for a seamless selling
                experience!
              </p>

              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.6, type: "spring", stiffness: 100 }}
                className="inline-flex items-center bg-yellow-400 text-blue-900 px-6 py-2 rounded-full text-lg font-semibold shadow-lg animate-pulse"
              >
                <Zap className="h-6 w-6 mr-2" />
                Coming Soon!
              </motion.div>

              <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
                <motion.div
                  initial={{ x: -50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="bg-white bg-opacity-10 p-6 rounded-lg shadow-md backdrop-blur-sm"
                >
                  <ShieldCheck className="h-10 w-10 text-yellow-400 mb-4 mx-auto" />
                  <h3 className="text-xl font-semibold mb-2">Easy Setup</h3>
                  <p className="text-blue-100 text-sm">
                    Quickly set up your store with our intuitive onboarding
                    process.
                  </p>
                </motion.div>
                <motion.div
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 1 }}
                  className="bg-white bg-opacity-10 p-6 rounded-lg shadow-md backdrop-blur-sm"
                >
                  <BarChart2 className="h-10 w-10 text-yellow-400 mb-4 mx-auto" />
                  <h3 className="text-xl font-semibold mb-2">
                    Manage Products
                  </h3>
                  <p className="text-blue-100 text-sm">
                    Effortlessly add, update, and track your product listings.
                  </p>
                </motion.div>
                <motion.div
                  initial={{ x: 50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 1.2 }}
                  className="bg-white bg-opacity-10 p-6 rounded-lg shadow-md backdrop-blur-sm"
                >
                  <Zap className="h-10 w-10 text-yellow-400 mb-4 mx-auto" />
                  <h3 className="text-xl font-semibold mb-2">
                    Real-time Updates
                  </h3>
                  <p className="text-blue-100 text-sm">
                    Stay informed with live sales data and inventory alerts.
                  </p>
                </motion.div>
              </div>

              {/* Email Subscription */}
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.4 }}
                className="mt-16 bg-white bg-opacity-10 p-8 rounded-lg shadow-xl max-w-md mx-auto"
              >
                <h3 className="text-2xl font-semibold mb-4">
                  Join Our Waitlist
                </h3>
                <p className="text-blue-100 mb-6">
                  Be the first to know when we launch!
                </p>
                {!isSubmitted ? (
                  <form
                    onSubmit={handleSubmit}
                    className="flex flex-col space-y-4"
                  >
                    <input
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full p-3 rounded-lg bg-white bg-opacity-20 border border-blue-300 placeholder-blue-100 text-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                      disabled={isSubmitting}
                    />
                    {error && <p className="text-red-300 text-sm">{error}</p>}
                    <button
                      type="submit"
                      className="w-full bg-yellow-400 text-blue-900 font-bold py-3 rounded-lg hover:bg-yellow-300 transition-colors flex items-center justify-center"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <svg
                          className="animate-spin h-5 w-5 text-blue-900 mr-3"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                      ) : (
                        "Notify Me!"
                      )}
                    </button>
                  </form>
                ) : (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center text-green-300 font-semibold"
                  >
                    <p>🎉 Thanks for your interest!</p>
                    <p>We'll notify you when we launch.</p>
                  </motion.div>
                )}
              </motion.div>
            </motion.div>

            {/* Footer */}
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.6 }}
              className="mt-20 text-sm text-blue-200"
            >
              <p>
                &copy; {new Date().getFullYear()} CS Store. All rights reserved.
              </p>
              <p className="mt-2">
                For seller inquiries, please contact{" "}
                <a
                  href="mailto:sellers@csstore.com"
                  className="underline hover:text-white"
                >
                  sellers@csstore.com
                </a>
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ComingSoonPage;
