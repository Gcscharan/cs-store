import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store";
import { setCart } from "../store/slices/cartSlice";
import { useGetCartQuery } from "../store/api";

export const useCartPersistence = () => {
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector(
    (state: RootState) => state.auth
  );

  // Only fetch cart for customer and admin roles, not delivery
  const shouldFetchCart = isAuthenticated && user?.role === "customer" && !user?.isAdmin;

  // Fetch cart from backend for authenticated users (not delivery users)
  const {
    data: backendCart,
    isLoading: isLoadingCart,
    error: cartError,
  } = useGetCartQuery(undefined, {
    skip: !shouldFetchCart,
  });

  // Load cart from backend when data is available
  useEffect(() => {
    if (isAuthenticated && backendCart && !isLoadingCart) {
      console.log("🛒 Loading cart from MongoDB backend:", backendCart);
      
      // Backend returns { cart: { items, totalAmount, itemCount } }
      const cartData = backendCart.cart || backendCart;
      
      dispatch(
        setCart({
          items: (cartData.items || []).map((item: any) => ({
            id: item.productId._id || item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            image: item.image,
          })),
          total: cartData.totalAmount || 0,
          itemCount: cartData.itemCount || 0,
        })
      );
    }
  }, [isAuthenticated, backendCart, isLoadingCart, dispatch]);

  return {
    isLoadingCart,
    cartError,
  };
};
