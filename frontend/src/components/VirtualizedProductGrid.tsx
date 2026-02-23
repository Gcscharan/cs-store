import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useWindowVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import ProductCard from "./ProductCard";

type Props = {
  products: any[];
  overscan?: number;
};

function getColumns(width: number) {
  if (width >= 1280) return 4;
  if (width >= 1024) return 3;
  if (width >= 640) return 2;
  return 1;
}

const VirtualizedProductGrid = memo(function VirtualizedProductGrid({
  products,
  overscan = 3,
}: Props) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setContainerWidth(entry.contentRect.width);
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const columns = useMemo(() => getColumns(containerWidth || window.innerWidth), [containerWidth]);
  const rowCount = useMemo(() => Math.ceil((products?.length || 0) / columns), [products, columns]);

  const scrollMargin = parentRef.current?.offsetTop ?? 0;

  const rowVirtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => 460,
    overscan,
    scrollMargin,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <div ref={parentRef}>
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualRows.map((virtualRow: VirtualItem) => {
          const rowIndex = virtualRow.index;
          const startIndex = rowIndex * columns;
          const rowProducts = products.slice(startIndex, startIndex + columns);

          return (
            <div
              key={String(virtualRow.key)}
              data-index={rowIndex}
              ref={rowVirtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start - scrollMargin}px)`,
              }}
            >
              <div
                className={
                  columns === 4
                    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                    : columns === 3
                    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                    : columns === 2
                    ? "grid grid-cols-1 sm:grid-cols-2 gap-6"
                    : "grid grid-cols-1 gap-6"
                }
              >
                {rowProducts.map((product: any, colIndex: number) => {
                  const absoluteIndex = startIndex + colIndex;
                  return (
                  <ProductCard
                    key={product?._id || product?.id}
                    product={product}
                    disableInitialAnimation
                    imagePriority={absoluteIndex === 0}
                  />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default VirtualizedProductGrid;
