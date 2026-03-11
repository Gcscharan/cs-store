import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, User, Tag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";

const CSStoreStoriesPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const stories = [
    {
      id: 1,
      title: t("stories.story1Title"),
      excerpt: t("stories.story1Excerpt"),
      author: t("stories.story1Author"),
      date: "2024-01-15",
      category: t("stories.impact"),
      image:
        "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=400&fit=crop",
      readTime: t("stories.minRead", { min: "5" }),
    },
    {
      id: 2,
      title: t("stories.story2Title"),
      excerpt: t("stories.story2Excerpt"),
      author: t("stories.story2Author"),
      date: "2024-01-10",
      category: t("stories.successStories"),
      image:
        "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=400&fit=crop",
      readTime: t("stories.minRead", { min: "7" }),
    },
    {
      id: 3,
      title: t("stories.story3Title"),
      excerpt: t("stories.story3Excerpt"),
      author: t("stories.story3Author"),
      date: "2024-01-05",
      category: t("stories.sustainability"),
      image:
        "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&h=400&fit=crop",
      readTime: t("stories.minRead", { min: "6" }),
    },
    {
      id: 4,
      title: t("stories.story4Title"),
      excerpt: t("stories.story4Excerpt"),
      author: t("stories.story4Author"),
      date: "2023-12-28",
      category: t("stories.technology"),
      image:
        "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&h=400&fit=crop",
      readTime: t("stories.minRead", { min: "8" }),
    },
    {
      id: 5,
      title: t("stories.story5Title"),
      excerpt: t("stories.story5Excerpt"),
      author: t("stories.story5Author"),
      date: "2023-12-20",
      category: t("stories.customerService"),
      image:
        "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=400&fit=crop",
      readTime: t("stories.minRead", { min: "4" }),
    },
    {
      id: 6,
      title: t("stories.story6Title"),
      excerpt: t("stories.story6Excerpt"),
      author: t("stories.story6Author"),
      date: "2023-12-15",
      category: t("stories.companyNews"),
      image:
        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=400&fit=crop",
      readTime: t("stories.minRead", { min: "9" }),
    },
  ];

  const categories = [
    t("stories.all"),
    t("stories.impact"),
    t("stories.successStories"),
    t("stories.sustainability"),
    t("stories.technology"),
    t("stories.customerService"),
    t("stories.companyNews"),
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
              <span>{t("legal.backToHome")}</span>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              {t("stories.title")}
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
            {t("stories.title")}
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {t("stories.subtitle")}
          </p>
        </motion.div>

        {/* Categories */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-wrap justify-center gap-4 mb-12"
        >
          {categories.map((category) => (
            <button
              key={category}
              className="px-6 py-3 bg-white border border-gray-300 rounded-full hover:bg-orange-500 hover:text-white hover:border-orange-500 transition-colors duration-200"
            >
              {category}
            </button>
          ))}
        </motion.div>

        {/* Featured Story */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="bg-white rounded-lg shadow-lg overflow-hidden mb-12"
        >
          <div className="md:flex">
            <div className="md:w-1/2">
              <img
                src={stories[0].image}
                alt={stories[0].title}
                className="w-full h-64 md:h-full object-cover"
              />
            </div>
            <div className="md:w-1/2 p-8">
              <div className="flex items-center mb-4">
                <Tag className="w-4 h-4 text-orange-500 mr-2" />
                <span className="text-orange-500 font-medium">
                  {stories[0].category}
                </span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                {stories[0].title}
              </h3>
              <p className="text-gray-600 mb-6">{stories[0].excerpt}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span className="flex items-center">
                    <User className="w-4 h-4 mr-1" />
                    {stories[0].author}
                  </span>
                  <span className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    {new Date(stories[0].date).toLocaleDateString()}
                  </span>
                  <span>{stories[0].readTime}</span>
                </div>
                <button className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg transition-colors">
                  {t("stories.readMore")}
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stories Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {stories.slice(1).map((story, index) => (
            <motion.div
              key={story.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 + index * 0.1 }}
              className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
            >
              <img
                src={story.image}
                alt={story.title}
                className="w-full h-48 object-cover"
              />
              <div className="p-6">
                <div className="flex items-center mb-3">
                  <Tag className="w-4 h-4 text-orange-500 mr-2" />
                  <span className="text-orange-500 font-medium text-sm">
                    {story.category}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2">
                  {story.title}
                </h3>
                <p className="text-gray-600 mb-4 line-clamp-3">
                  {story.excerpt}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 text-sm text-gray-500">
                    <span className="flex items-center">
                      <User className="w-4 h-4 mr-1" />
                      {story.author}
                    </span>
                    <span className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      {new Date(story.date).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {story.readTime}
                  </span>
                </div>
                <button className="w-full mt-4 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg transition-colors">
                  {t("stories.readStory")}
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Newsletter Signup */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg shadow-lg p-8 mt-12 text-white text-center"
        >
          <h3 className="text-3xl font-bold mb-4">
            {t("stories.stayUpdated")}
          </h3>
          <p className="text-xl mb-6 text-orange-100">
            {t("stories.stayUpdatedDesc")}
          </p>
          <div className="max-w-md mx-auto flex gap-4">
            <input
              type="email"
              placeholder={t("stories.enterEmail")}
              className="flex-1 px-4 py-3 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-white"
            />
            <button className="bg-white text-orange-500 px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors">
              {t("stories.subscribe")}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default CSStoreStoriesPage;
