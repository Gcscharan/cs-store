import { useState, useRef } from 'react';
import { Upload, X, Play, Loader2 } from 'lucide-react';
import apiClient from '../api/axiosInstance';

interface VideoMetadata {
  url: string;
  thumbnail: string;
  publicId: string;
  hash: string;
  duration: number;
}

interface VideoUploadProps {
  video: VideoMetadata | null;
  onChange: (video: VideoMetadata | null) => void;
}

const VideoUpload = ({ video, onChange }: VideoUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (file.type !== 'video/mp4') {
      setError('Only MP4 format is supported');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError('Video file size exceeds 20MB limit');
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('video', file);

      const response = await apiClient.post('/admin/upload/video', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      onChange(response.data);
    } catch (err: any) {
      console.error('Video upload failed:', err);
      setError(err.response?.data?.message || 'Video upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    onChange(null);
    setError(null);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {!video ? (
        <div>
          <button
            type="button"
            onClick={handleUploadClick}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                <span>Upload Video</span>
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4"
            onChange={handleFileSelect}
            className="hidden"
          />
          <p className="mt-2 text-xs text-gray-500">
            MP4 format only, max 20MB, max 30 seconds
          </p>
        </div>
      ) : (
        <div className="relative group">
          <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden">
            <img
              src={video.thumbnail}
              alt="Video thumbnail"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
              <div className="flex items-center gap-2 text-white">
                <Play className="w-8 h-8" />
                <span className="text-sm font-medium">{video.duration.toFixed(1)}s</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleUploadClick}
            className="mt-2 w-full px-4 py-2 text-sm text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Replace Video
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
};

export default VideoUpload;
