import { useCartPersistence } from "../hooks/useCartPersistence";

const CartInitializer = () => {
  // Use the cart persistence hook to handle cart loading from backend
  useCartPersistence();

  return null; // This component doesn't render anything
};

export default CartInitializer;
