import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Volume2,
  VolumeX,
} from "lucide-react";

interface MediaItem {
  id: string;
  type: "image" | "video";
  url: string;
  thumbnail?: string;
  alt?: string;
}

interface ProductMediaCarouselProps {
  media: MediaItem[];
  className?: string;
}

const ProductMediaCarousel: React.FC<ProductMediaCarouselProps> = ({
  media,
  className = "",
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState<{
    [key: string]: boolean;
  }>({});
  const [isVideoMuted, setIsVideoMuted] = useState<{ [key: string]: boolean }>(
    {}
  );

  const currentMedia = media[currentIndex];

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % media.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + media.length) % media.length);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const toggleVideoPlay = (videoId: string) => {
    setIsVideoPlaying((prev) => ({
      ...prev,
      [videoId]: !prev[videoId],
    }));
  };

  const toggleVideoMute = (videoId: string) => {
    setIsVideoMuted((prev) => ({
      ...prev,
      [videoId]: !prev[videoId],
    }));
  };

  if (!media || media.length === 0) {
    return (
      <div
        className={`w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center ${className}`}
      >
        <p className="text-gray-500">No media available</p>
      </div>
    );
  }

  return (
    <div className={`relative w-full ${className}`}>
      {/* Main Media Display */}
      <div className="relative w-full h-64 md:h-80 lg:h-96 bg-gray-100 rounded-lg overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className="w-full h-full"
          >
            {currentMedia.type === "image" ? (
              <img
                src={currentMedia.url}
                alt={currentMedia.alt || "Product image"}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="relative w-full h-full">
                <video
                  className="w-full h-full object-cover"
                  poster={currentMedia.thumbnail}
                  muted={isVideoMuted[currentMedia.id]}
                  controls={isVideoPlaying[currentMedia.id]}
                  loop
                  playsInline
                >
                  <source src={currentMedia.url} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>

                {/* Video Controls Overlay */}
                {!isVideoPlaying[currentMedia.id] && (
                  <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => toggleVideoPlay(currentMedia.id)}
                      className="bg-white bg-opacity-90 rounded-full p-4 shadow-lg"
                      aria-label="Play video"
                    >
                      <Play className="h-8 w-8 text-gray-800 ml-1" />
                    </motion.button>
                  </div>
                )}

                {/* Video Control Buttons */}
                <div className="absolute bottom-4 right-4 flex space-x-2">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => toggleVideoPlay(currentMedia.id)}
                    className="bg-black bg-opacity-50 text-white rounded-full p-2"
                    aria-label={
                      isVideoPlaying[currentMedia.id]
                        ? "Pause video"
                        : "Play video"
                    }
                  >
                    {isVideoPlaying[currentMedia.id] ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4 ml-0.5" />
                    )}
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => toggleVideoMute(currentMedia.id)}
                    className="bg-black bg-opacity-50 text-white rounded-full p-2"
                    aria-label={
                      isVideoMuted[currentMedia.id]
                        ? "Unmute video"
                        : "Mute video"
                    }
                  >
                    {isVideoMuted[currentMedia.id] ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </motion.button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows */}
        {media.length > 1 && (
          <>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={prevSlide}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 shadow-lg transition-all"
              aria-label="Previous media"
            >
              <ChevronLeft className="h-5 w-5 text-gray-800" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={nextSlide}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 shadow-lg transition-all"
              aria-label="Next media"
            >
              <ChevronRight className="h-5 w-5 text-gray-800" />
            </motion.button>
          </>
        )}

        {/* Media Type Indicator */}
        <div className="absolute top-4 left-4">
          <div className="bg-black bg-opacity-50 text-white px-2 py-1 rounded-full text-xs font-medium">
            {currentMedia.type === "video" ? "Video" : "Image"}
          </div>
        </div>

        {/* Slide Counter */}
        {media.length > 1 && (
          <div className="absolute top-4 right-4">
            <div className="bg-black bg-opacity-50 text-white px-2 py-1 rounded-full text-xs font-medium">
              {currentIndex + 1} / {media.length}
            </div>
          </div>
        )}
      </div>

      {/* Thumbnail Navigation */}
      {media.length > 1 && (
        <div className="mt-4">
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {media.map((item, index) => (
              <motion.button
                key={item.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => goToSlide(index)}
                className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                  index === currentIndex
                    ? "border-blue-500 ring-2 ring-blue-200"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                aria-label={`Go to ${item.type} ${index + 1}`}
              >
                {item.type === "image" ? (
                  <img
                    src={item.url}
                    alt={item.alt || `Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="relative w-full h-full bg-gray-200">
                    <img
                      src={item.thumbnail || item.url}
                      alt={item.alt || `Video thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                      <Play className="h-4 w-4 text-white" />
                    </div>
                  </div>
                )}

                {/* Active indicator */}
                {index === currentIndex && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center"
                  >
                    <div className="w-2 h-2 bg-white rounded-full" />
                  </motion.div>
                )}
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductMediaCarousel;
