import { lazy, Suspense } from "react";
import { HomePageSkeleton } from "../components/PageSkeletons";

// Lazy load heavy section for better code splitting
const ProductSection = lazy(() => import("./home/ProductSection"));

const HomePage = () => {
  return (
    <Suspense fallback={<HomePageSkeleton />}>
      <ProductSection />
    </Suspense>
  );
};

export default HomePage;
