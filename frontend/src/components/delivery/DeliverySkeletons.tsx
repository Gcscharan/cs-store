/**
 * Skeleton loaders for Delivery Partner Dashboard
 */

import React from "react";
import SkeletonBox from "../SkeletonBox";

export const OrderCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
    <div className="flex justify-between items-start">
      <div className="space-y-2 flex-1">
        <SkeletonBox height="1.25rem" width="40%" />
        <SkeletonBox height="1.5rem" width="30%" />
      </div>
      <SkeletonBox height="1.5rem" width="80px" className="rounded-full" />
    </div>
    <div className="space-y-2">
      <SkeletonBox height="0.75rem" width="100%" />
      <SkeletonBox height="0.75rem" width="80%" />
    </div>
    <SkeletonBox height="2.5rem" width="100%" className="rounded-lg" />
  </div>
);

export const ActiveOrderCardSkeleton: React.FC = () => (
  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">
    <div className="flex justify-between items-start">
      <div className="space-y-2 flex-1">
        <SkeletonBox height="1.25rem" width="35%" />
        <SkeletonBox height="1.75rem" width="25%" />
      </div>
      <SkeletonBox height="1.5rem" width="100px" className="rounded-full" />
    </div>
    <div className="space-y-1">
      <SkeletonBox height="0.5rem" width="100%" className="rounded-full" />
    </div>
    <div className="space-y-2">
      <SkeletonBox height="0.875rem" width="60%" />
      <SkeletonBox height="0.875rem" width="70%" />
      <SkeletonBox height="0.875rem" width="50%" />
    </div>
    <SkeletonBox height="2.75rem" width="100%" className="rounded-lg" />
  </div>
);

export const StatsCardSkeleton: React.FC = () => (
  <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 space-y-4">
    <SkeletonBox height="1.25rem" width="40%" className="bg-white/20" />
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 space-y-2">
        <SkeletonBox height="1.5rem" width="60%" className="bg-white/30" />
        <SkeletonBox height="2rem" width="50%" className="bg-white/30" />
      </div>
      <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 space-y-2">
        <SkeletonBox height="1.5rem" width="60%" className="bg-white/30" />
        <SkeletonBox height="2rem" width="50%" className="bg-white/30" />
      </div>
    </div>
  </div>
);

export const EarningsCardSkeleton: React.FC = () => (
  <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 space-y-4">
    <div className="flex justify-between items-start">
      <div className="space-y-2 flex-1">
        <SkeletonBox height="0.875rem" width="30%" className="bg-white/30" />
        <SkeletonBox height="2.5rem" width="50%" className="bg-white/30" />
      </div>
      <SkeletonBox height="3rem" width="3rem" className="rounded-full bg-white/20" />
    </div>
  </div>
);
