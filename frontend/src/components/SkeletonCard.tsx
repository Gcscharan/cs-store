import SkeletonBox from "./SkeletonBox";

export default function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Skeleton Image */}
      <SkeletonBox height="200px" className="w-full" />
      
      {/* Skeleton Content */}
      <div className="p-4 space-y-3">
        {/* Skeleton Title */}
        <SkeletonBox height="1.25rem" className="w-3/4" />
        
        {/* Skeleton Price */}
        <SkeletonBox height="1rem" className="w-1/4" />
        
        {/* Skeleton Description */}
        <div className="space-y-1">
          <SkeletonBox height="0.75rem" className="w-full" />
          <SkeletonBox height="0.75rem" className="w-5/6" />
        </div>
        
        {/* Skeleton Button */}
        <SkeletonBox height="2.5rem" className="w-full mt-4" />
      </div>
    </div>
  );
}
