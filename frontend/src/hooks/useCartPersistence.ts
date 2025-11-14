import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store";
import { setCart } from "../store/slices/cartSlice";
import { useGetCartQuery } from "../store/api";

export const useCartPersistence = () => {
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector(
    (state: RootState) => state.auth
  );

  // Fetch cart from backend for authenticated users
  const {
    data: backendCart,
    isLoading: isLoadingCart,
    error: cartError,
  } = useGetCartQuery(undefined, {
    skip: !isAuthenticated,
  });

  // Load cart from backend when data is available
  useEffect(() => {
    if (isAuthenticated && backendCart && !isLoadingCart) {
      console.log("🛒 Loading cart from MongoDB backend:", backendCart);
      
      dispatch(
        setCart({
          items: backendCart.items.map((item: any) => ({
            id: item.productId._id || item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            image: item.image,
          })),
          total: backendCart.total,
          itemCount: backendCart.itemCount,
        })
      );
    }
  }, [isAuthenticated, backendCart, isLoadingCart, dispatch]);

  return {
    isLoadingCart,
    cartError,
  };
};
