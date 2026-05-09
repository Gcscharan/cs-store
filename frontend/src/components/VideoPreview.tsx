import { useState } from 'react';
import { Play, X } from 'lucide-react';

interface VideoPreviewProps {
  url: string;
  thumbnail: string;
  duration: number;
}

const VideoPreview = ({ url, thumbnail, duration }: VideoPreviewProps) => {
  const [isPlaying, setIsPlaying] = useState(false);

  if (!isPlaying) {
    return (
      <div className="relative w-full aspect-video bg-gray-100 rounded-lg overflow-hidden cursor-pointer group"
        onClick={() => setIsPlaying(true)}
      >
        <img
          src={thumbnail}
          alt="Video thumbnail"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 group-hover:bg-opacity-40 transition-all">
          <div className="flex flex-col items-center gap-2 text-white">
            <div className="w-16 h-16 flex items-center justify-center bg-white bg-opacity-90 rounded-full group-hover:scale-110 transition-transform">
              <Play className="w-8 h-8 text-gray-900 ml-1" />
            </div>
            <span className="text-sm font-medium">{duration.toFixed(1)}s</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      <video
        src={url}
        controls
        autoPlay
        className="w-full h-full"
      />
      <button
        onClick={() => setIsPlaying(false)}
        className="absolute top-2 right-2 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
};

export default VideoPreview;
