import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store";
import {
  removeFromCart,
  updateCartItem,
  clearCartOnLogout,
} from "../store/slices/cartSlice";
import {
  useUpdateCartItemMutation,
  useRemoveFromCartMutation,
  useGetAddressesQuery,
} from "../store/api";
import { Link, useNavigate } from "react-router-dom";
import {
  calculateDeliveryFee,
} from "../utils/deliveryFeeCalculator";
import { calculatePriceBreakdown, formatPrice } from "../utils/priceCalculator";
import { getProductImage, handleImageError } from "../utils/image";
import ConfirmationDialog from "../components/ConfirmationDialog";

const CartPage = () => {
  const cart = useSelector((state: RootState) => state.cart);
  const auth = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [addressUpdateTrigger, setAddressUpdateTrigger] = useState(0);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    itemId: string | null;
    itemName: string;
  }>({
    isOpen: false,
    itemId: null,
    itemName: "",
  });

  const navigate = useNavigate();

  // API mutations
  const [updateCartItemMutation] = useUpdateCartItemMutation();
  const [removeFromCartMutation] = useRemoveFromCartMutation();

  // Fetch addresses using RTK Query
  const { data: addressesData } = useGetAddressesQuery(undefined, {
    skip: !auth.isAuthenticated,
  });

  // Removed minimum order requirement - delivery charges will apply for all orders

  // Get user's default address for delivery fee calculation (using RTK Query data)
  const userAddress = useMemo(() => {
    // Get addresses and defaultAddressId from RTK Query response
    const addresses = addressesData?.addresses || [];
    const defaultAddressId = addressesData?.defaultAddressId;

    // First, try to find default address by defaultAddressId
    if (defaultAddressId && addresses.length > 0) {
      const defaultAddr = addresses.find((addr: any) => addr._id === defaultAddressId);
      if (defaultAddr) {
        return {
          _id: defaultAddr._id,
          label: defaultAddr.label || "",
          pincode: defaultAddr.pincode || "",
          city: defaultAddr.city || "",
          state: defaultAddr.state || "",
          addressLine: defaultAddr.addressLine || "",
          lat: (defaultAddr.location?.lat ?? defaultAddr.lat ?? 0),
          lng: (defaultAddr.location?.lng ?? defaultAddr.lng ?? 0),
          isDefault: true,
        };
      }
    }

    // NO FALLBACK: Only use default address - strict rule
    // If no default address exists, return null to trigger requiresAddress state
    return null;
  }, [addressesData, addressUpdateTrigger]);

  // Calculate delivery fee using the same logic as CheckoutPage
  const calculatedDeliveryFeeDetails = calculateDeliveryFee(
    userAddress || undefined, // Pass undefined instead of null to satisfy IAddress type
    cart.total
  );

  // Calculate price breakdown using shared utility (same as CheckoutPage)
  const priceBreakdown = calculatePriceBreakdown(
    cart.items,
    calculatedDeliveryFeeDetails
  );

  // Clear cart when user is not authenticated
  useEffect(() => {
    if (!auth.isAuthenticated && cart.items.length > 0) {
      dispatch(clearCartOnLogout());
    }
  }, [auth.isAuthenticated, cart.items.length, dispatch]);

  // Listen for address updates to recalculate delivery fees
  useEffect(() => {
    const handleAddressUpdate = () => {
      setAddressUpdateTrigger((prev) => prev + 1);
    };

    window.addEventListener("addressesUpdated", handleAddressUpdate);
    return () =>
      window.removeEventListener("addressesUpdated", handleAddressUpdate);
  }, []);

  const handleQuantityChange = async (
    productId: string,
    newQuantity: number
  ) => {
    if (newQuantity < 1) return;

    const prevQuantity = cart.items.find((item) => item.id === productId)?.quantity;

    setIsUpdating(productId);
    try {
      // Update in Redux store first for immediate UI feedback
      dispatch(updateCartItem({ id: productId, quantity: newQuantity }));

      // Update on server if user is authenticated
      if (auth.isAuthenticated) {
        await updateCartItemMutation({
          productId,
          quantity: newQuantity,
        }).unwrap();
      }
    } catch (error) {
      console.error("Failed to update quantity:", error);
      // Revert Redux state on error
      if (typeof prevQuantity === "number") {
        dispatch(updateCartItem({ id: productId, quantity: prevQuantity }));
      }
    } finally {
      setIsUpdating(null);
    }
  };

  const handleRemoveItem = async (productId: string) => {
    try {
      // Remove from Redux store first for immediate UI feedback
      dispatch(removeFromCart(productId));

      // Remove from server if user is authenticated
      if (auth.isAuthenticated) {
        await removeFromCartMutation(productId).unwrap();
      }
    } catch (error) {
      console.error("Failed to remove item:", error);
      // Note: For remove operations, we don't revert as the item is already removed from UI
    }
  };

  const handleDeleteClick = (productId: string, productName: string) => {
    setDeleteDialog({
      isOpen: true,
      itemId: productId,
      itemName: productName,
    });
  };

  const handleDeleteConfirm = () => {
    if (deleteDialog.itemId) {
      handleRemoveItem(deleteDialog.itemId);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialog({
      isOpen: false,
      itemId: null,
      itemName: "",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gray-50 pt-2 px-4 pb-4"
    >
      <div className="max-w-7xl mx-auto">
        {/* Shopping Cart Header and Enter Address Button - Same Line */}
        <div className="flex items-center mb-2">
          <h1 className="text-3xl font-bold text-gray-900">Shopping Cart</h1>
          {cart.items.length > 0 && (
            <div className="flex-1 flex justify-center">
              <div className="ml-16">
                <Link
                  to="/addresses"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2 text-sm font-medium"
                >
                  <span>📍</span>
                  <span>Enter Address</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {!auth.isAuthenticated ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Please Sign In
            </h2>
            <p className="text-gray-600 mb-6">
              You need to be signed in to view your cart and place orders.
            </p>
            <div className="space-x-4">
              <Link
                to="/login"
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="inline-block bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Sign Up
              </Link>
            </div>
          </div>
        ) : cart.items.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🛒</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Your cart is empty
            </h3>
            <p className="text-gray-600 mb-6">
              Add some products to get started
            </p>
            <button
              onClick={() => navigate("/")}
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Continue Shopping
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Cart Items - Left Section */}
            <div className="lg:col-span-2">
              <div className="bg-white border border-gray-200 rounded-lg">
                {/* Cart Items Header */}
                <div className="p-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Cart Items ({cart.items.length})
                  </h2>
                </div>

                {/* Cart Items List */}
                <div className="divide-y divide-gray-200">
                  {cart.items.map((item, index) => {
                    const isOutOfStock = item.price === 0;

                    return (
                      <motion.div
                        key={item.id || `deleted-${index}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="p-4 flex items-center space-x-4 border-b border-gray-100 last:border-b-0"
                      >
                      {/* Product Image */}
                      <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                        <img
                          src={getProductImage(item)}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          onError={(e) => handleImageError(e)}
                        />
                      </div>

                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate text-sm">
                          {item.name}
                        </h3>
                        {isOutOfStock ? (
                          <p className="text-xs mt-1 text-red-600">Out of stock</p>
                        ) : (
                          <p className="text-gray-600 text-xs mt-1">
                            ₹{item.price.toFixed(2)} each
                          </p>
                        )}
                        <div className="flex items-center space-x-2 mt-2">
                          <span className="text-xs text-gray-500">Seller:</span>
                          <span className="text-xs font-medium text-blue-600">
                            CS Store
                          </span>
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            Assured
                          </span>
                        </div>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center space-x-2">
                        {isOutOfStock ? (
                          <span className="text-xs font-medium text-gray-400">--</span>
                        ) : (
                          <>
                            <button
                              onClick={() =>
                                handleQuantityChange(item.id, item.quantity - 1)
                              }
                              disabled={
                                isUpdating === item.id || item.quantity <= 1
                              }
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-lg font-medium"
                            >
                              -
                            </button>

                            <span className="w-12 text-center font-medium text-sm">
                              {isUpdating === item.id ? "..." : item.quantity}
                            </span>

                            <button
                              onClick={() =>
                                handleQuantityChange(item.id, item.quantity + 1)
                              }
                              disabled={isUpdating === item.id}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-lg font-medium"
                            >
                              +
                            </button>
                          </>
                        )}
                      </div>

                      {/* Item Total */}
                      <div className="text-right">
                        {isOutOfStock ? (
                          <div className="text-sm font-medium text-red-500">
                            Out of stock
                          </div>
                        ) : (
                          <>
                            <div className="text-lg font-semibold text-gray-900">
                              ₹{(item.price * item.quantity).toFixed(2)}
                            </div>
                            {item.price > 0 && (
                              <div className="text-xs text-gray-500 line-through">
                                ₹{(item.price * 1.2 * item.quantity).toFixed(2)}
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Delete Button */}
                      <div className="flex items-center">
                        <button
                          onClick={() => handleDeleteClick(item.id, item.name)}
                          className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 transition-colors duration-200"
                          title="Delete item"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </motion.div>
                  );
                  })}
                </div>
              </div>
            </div>

            {/* Price Details - Right Section */}
            <div className="lg:col-span-1">
              <div className="sticky top-8">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    PRICE DETAILS
                  </h3>

                  {/* Price Breakdown */}
                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        Price ({priceBreakdown.itemCount} items)
                      </span>
                      <span className="font-medium">
                        {formatPrice(priceBreakdown.subtotal)}
                      </span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Discount</span>
                      <span className="font-medium text-green-600">
                        - {formatPrice(priceBreakdown.discount)}
                      </span>
                    </div>


                    <div className="border-t border-gray-200 pt-3">
                      <div className="flex justify-between text-lg font-semibold">
                        <span>Total Amount</span>
                        <span>{formatPrice(priceBreakdown.total)}</span>
                      </div>
                    </div>
                  </div>


                  {/* Security Message */}
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center space-x-2 text-xs text-gray-600">
                      <svg
                        className="w-4 h-4 text-green-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>
                        Safe and Secure Payments. Easy returns. 100% Authentic
                        products.
                      </span>
                    </div>
                  </div>

                  
                  {/* Pincode Fallback Warning Banner */}
                  {userAddress?.lat && userAddress?.lng && userAddress.lat !== 0 && userAddress.lng !== 0 && 
                   (userAddress as any).coordsSource === 'pincode' && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-400 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-xs text-yellow-900">
                            <strong>Estimated Delivery Fee:</strong> Using pincode centroid. Update your address with exact location for accurate fee calculation.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Place Order Button */}
                  <div className="mt-4">
                    {!userAddress ? (
                      <button
                        disabled
                        className="w-full py-3 px-4 rounded-lg font-medium text-center bg-amber-400 text-amber-800 cursor-not-allowed text-lg"
                      >
                        ADD DELIVERY ADDRESS TO PLACE ORDER
                      </button>
                    ) : (!userAddress?.lat || !userAddress?.lng || userAddress.lat === 0 || userAddress.lng === 0) ? (
                      <button
                        disabled
                        className="w-full py-3 px-4 rounded-lg font-medium text-center bg-gray-400 text-gray-700 cursor-not-allowed text-lg"
                      >
                        CANNOT PLACE ORDER - INVALID ADDRESS
                      </button>
                    ) : (
                      <Link
                        to="/checkout"
                        className="w-full py-3 px-4 rounded-lg font-medium text-center transition-colors bg-orange-500 text-white hover:bg-orange-600 text-lg block"
                      >
                        PLACE ORDER
                      </Link>
                    )}
                  </div>

                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Remove Item"
        message={`Are you sure you want to remove "${deleteDialog.itemName}" from your cart?`}
        confirmText="Remove"
        cancelText="Cancel"
        confirmButtonColor="bg-red-600 hover:bg-red-700"
      />
    </motion.div>
  );
};

export default CartPage;
