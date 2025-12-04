import React from 'react';
import { useGetProductByIdQuery } from '../store/api';

/**
 * Poll for processed images after product creation
 * @param productId - Product ID to poll
 * @param onSuccess - Callback when images are processed
 * @param onError - Callback on error
 * @param maxAttempts - Maximum polling attempts (default: 10)
 * @param interval - Polling interval in ms (default: 3000)
 */
export const useImageProcessingPoll = (
  productId: string,
  onSuccess?: (product: any) => void,
  onError?: (error: any) => void,
  maxAttempts: number = 10,
  interval: number = 3000
) => {
  const { data: product } = useGetProductByIdQuery(productId);
  const [attempts, setAttempts] = React.useState(0);
  const [isPolling, setIsPolling] = React.useState(false);

  React.useEffect(() => {
    if (!productId || !isPolling) return;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setIsPolling(false);
        onError?.(new Error('Polling timeout: Images not processed'));
        return;
      }

      // Check if product has processed images
      if (product?.images && product.images.length > 0 && product.images[0]?.full && product.images[0]?.thumb) {
        setIsPolling(false);
        onSuccess?.(product);
        return;
      }

      setAttempts(prev => prev + 1);
    };

    const timeout = setTimeout(poll, interval);
    return () => clearTimeout(timeout);
  }, [productId, product, attempts, isPolling, maxAttempts, interval, onSuccess, onError]);

  const startPolling = () => {
    setAttempts(0);
    setIsPolling(true);
  };

  const stopPolling = () => {
    setIsPolling(false);
  };

  return {
    isPolling,
    attempts,
    startPolling,
    stopPolling,
    hasProcessedImages: product?.images?.length > 0 && product.images[0]?.full && product.images[0]?.thumb
  };
};
