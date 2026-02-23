import SkeletonBox from "./SkeletonBox";

export function RouteShellSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50" aria-hidden="true">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <SkeletonBox height={28} width={240} className="mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function HomePageSkeleton() {
  return (
    <div className="min-h-screen bg-neutral-50" aria-hidden="true">
      <div className="bg-gradient-to-r from-secondary-50 via-orange-50 to-yellow-50 py-8 px-4 shadow-flipkart relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <SkeletonBox height={28} width={220} className="mb-3" />
              <SkeletonBox height={16} width={260} />
            </div>
            <div className="hidden sm:flex space-x-2">
              <SkeletonBox height={40} width={40} className="rounded-lg" />
              <SkeletonBox height={40} width={40} className="rounded-lg" />
            </div>
          </div>
          <div className="flex space-x-4 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-48 sm:w-52 md:w-56 lg:w-60 bg-white rounded-lg shadow-flipkart overflow-hidden">
                <SkeletonBox height={128} className="w-full rounded-none" />
                <div className="p-4 space-y-2">
                  <SkeletonBox height={14} width="80%" />
                  <SkeletonBox height={12} width="60%" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white shadow-sm py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <SkeletonBox height={24} width={260} />
            <SkeletonBox height={14} width={320} />
          </div>
          <div className="flex gap-3">
            <SkeletonBox height={40} width={140} className="rounded-lg" />
            <SkeletonBox height={40} width={140} className="rounded-lg" />
          </div>
        </div>
      </div>

      <div className="bg-gray-50 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center mb-8">
            <SkeletonBox height={32} width={260} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden" aria-hidden="true">
      <div className="relative aspect-square bg-gray-100">
        <SkeletonBox className="w-full h-full rounded-none" height="100%" />
      </div>
      <div className="p-4 space-y-3">
        <SkeletonBox height={18} width="90%" />
        <SkeletonBox height={14} width="70%" />
        <SkeletonBox height={18} width="40%" />
        <SkeletonBox height={40} className="w-full rounded-md" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function CartPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 pt-2 px-4 pb-4" aria-hidden="true">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center mb-2">
          <SkeletonBox height={32} width={220} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="p-4 border-b border-gray-200">
                <SkeletonBox height={20} width={200} />
              </div>
              <div className="divide-y divide-gray-200">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="p-4 flex items-center space-x-4">
                    <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                      <SkeletonBox className="w-full h-full rounded-none" height="100%" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <SkeletonBox height={14} width="70%" />
                      <SkeletonBox height={12} width="40%" />
                      <SkeletonBox height={12} width="55%" />
                    </div>
                    <div className="w-24 flex items-center justify-between">
                      <SkeletonBox height={32} width={32} className="rounded-full" />
                      <SkeletonBox height={14} width={24} />
                      <SkeletonBox height={32} width={32} className="rounded-full" />
                    </div>
                    <div className="w-20 text-right">
                      <SkeletonBox height={18} width={70} className="ml-auto" />
                    </div>
                    <SkeletonBox height={32} width={32} className="rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <SkeletonBox height={20} width={160} className="mb-4" />
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <SkeletonBox height={14} width={140} />
                    <SkeletonBox height={14} width={80} />
                  </div>
                  <div className="flex justify-between">
                    <SkeletonBox height={14} width={120} />
                    <SkeletonBox height={14} width={60} />
                  </div>
                  <div className="border-t border-gray-200 pt-3 flex justify-between">
                    <SkeletonBox height={18} width={120} />
                    <SkeletonBox height={18} width={90} />
                  </div>
                </div>
                <SkeletonBox height={48} className="w-full rounded-lg mt-4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CheckoutPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50" aria-hidden="true">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <SkeletonBox height={32} width={220} className="mb-2" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <SkeletonBox height={22} width={220} className="mb-6" />
              <SkeletonBox height={84} className="w-full rounded-lg" />
              <div className="mt-4 flex space-x-3">
                <SkeletonBox height={36} width={140} className="rounded-lg" />
                <SkeletonBox height={36} width={200} className="rounded-lg" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <SkeletonBox height={22} width={180} className="mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonBox key={i} height={64} className="w-full rounded-lg" />
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <SkeletonBox height={18} width={160} className="mb-6" />
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <SkeletonBox height={14} width={140} />
                    <SkeletonBox height={14} width={70} />
                  </div>
                  <div className="flex justify-between">
                    <SkeletonBox height={14} width={120} />
                    <SkeletonBox height={14} width={60} />
                  </div>
                  <div className="flex justify-between">
                    <SkeletonBox height={14} width={110} />
                    <SkeletonBox height={14} width={80} />
                  </div>
                  <div className="border-t pt-3 flex justify-between">
                    <SkeletonBox height={18} width={120} />
                    <SkeletonBox height={18} width={90} />
                  </div>
                </div>
                <SkeletonBox height={12} width={160} className="mt-6 mx-auto" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
