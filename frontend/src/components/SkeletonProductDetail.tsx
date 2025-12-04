import SkeletonBox from "./SkeletonBox";

export default function SkeletonProductDetail() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Skeleton Image */}
          <div className="space-y-4">
            <SkeletonBox height="400px" className="w-full rounded-xl" />
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <SkeletonBox key={index} height="80px" className="rounded-lg" />
              ))}
            </div>
          </div>

          {/* Skeleton Content */}
          <div className="space-y-6">
            {/* Skeleton Title */}
            <SkeletonBox height="2rem" className="w-3/4" />
            
            {/* Skeleton Price */}
            <SkeletonBox height="1.5rem" className="w-1/3" />
            
            {/* Skeleton Description */}
            <div className="space-y-2">
              <SkeletonBox height="1rem" className="w-full" />
              <SkeletonBox height="1rem" className="w-5/6" />
              <SkeletonBox height="1rem" className="w-4/5" />
            </div>

            {/* Skeleton Actions */}
            <div className="space-y-4">
              <SkeletonBox height="3rem" className="w-full" />
              <SkeletonBox height="3rem" className="w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
