import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store";
import { clearCart } from "../store/slices/cartSlice";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import RazorpayCheckout from "../components/RazorpayCheckout";
import AddressForm from "../components/AddressForm";
import toast from "react-hot-toast";

const CheckoutPage = () => {
  const { cart } = useSelector((state: RootState) => state);
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);

  const MINIMUM_ORDER = 2000;
  const isMinimumMet = cart.total >= MINIMUM_ORDER;
  const remainingAmount = MINIMUM_ORDER - cart.total;

  // Redirect if minimum order not met
  useEffect(() => {
    if (cart.items.length > 0 && !isMinimumMet) {
      toast.error(`Minimum order is ₹${MINIMUM_ORDER}. Add ₹${remainingAmount.toFixed(2)} more to checkout.`);
      navigate('/cart');
    }
  }, [cart.total, isMinimumMet, remainingAmount, navigate]);

  const handlePaymentSuccess = (order: any) => {
    dispatch(clearCart());
    toast.success("Order placed successfully!");
    navigate(`/orders/${order._id}`);
  };

  const handlePaymentError = (error: string) => {
    toast.error(error);
  };

  if (cart.items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen bg-gray-50 py-8 px-4"
      >
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🛒</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Your cart is empty
            </h3>
            <p className="text-gray-600 mb-6">Add some products to checkout</p>
            <Link
              to="/products"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </motion.div>
    );
  }

  // Show minimum order warning if not met
  if (!isMinimumMet) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen bg-gray-50 py-8 px-4"
      >
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>
          
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Minimum Order Not Met
            </h2>
            <p className="text-gray-600 mb-6">
              Your current order total is ₹{cart.total.toFixed(2)}, but the minimum order is ₹{MINIMUM_ORDER}.
            </p>
            <p className="text-lg font-medium text-red-600 mb-8">
              Add ₹{remainingAmount.toFixed(2)} more to proceed with checkout.
            </p>
            
            <div className="space-y-4">
              <Link
                to="/cart"
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors mr-4"
              >
                Back to Cart
              </Link>
              <Link
                to="/products"
                className="inline-block bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gray-50 py-8 px-4"
    >
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Address & Payment */}
          <div className="space-y-6">
            {/* Address Selection */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Delivery Address
              </h2>

              {user?.addresses && user.addresses.length > 0 ? (
                <div className="space-y-3">
                  {user.addresses.map((address: any) => (
                    <label
                      key={address._id}
                      className={`block p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedAddress?._id === address._id
                          ? "border-primary-500 bg-primary-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="address"
                        value={address._id}
                        checked={selectedAddress?._id === address._id}
                        onChange={() => setSelectedAddress(address)}
                        className="sr-only"
                      />
                      <div>
                        <div className="font-medium text-gray-900">
                          {address.label}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {address.addressLine}, {address.city},{" "}
                          {address.pincode}
                        </div>
                      </div>
                    </label>
                  ))}

                  <button
                    onClick={() => setShowAddressForm(true)}
                    className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-primary-500 hover:text-primary-600 transition-colors"
                  >
                    + Add New Address
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">📍</div>
                  <p className="text-gray-600 mb-4">No addresses found</p>
                  <button
                    onClick={() => setShowAddressForm(true)}
                    className="btn btn-primary"
                  >
                    Add Address
                  </button>
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Payment Method
              </h2>
              <div className="flex items-center space-x-3 p-4 border border-primary-500 bg-primary-50 rounded-lg">
                <div className="text-2xl">💳</div>
                <div>
                  <div className="font-medium text-gray-900">Razorpay</div>
                  <div className="text-sm text-gray-600">
                    Secure payment gateway
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Order Summary */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Order Summary
            </h2>

            {/* Cart Items */}
            <div className="space-y-4 mb-6">
              {cart.items.map((item) => (
                <div key={item.id} className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                    <span className="text-xl">📦</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{item.name}</h3>
                    <p className="text-sm text-gray-600">
                      Qty: {item.quantity}
                    </p>
                  </div>
                  <div className="font-semibold text-gray-900">
                    ₹{(item.price * item.quantity).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            {/* Order Total */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Total:</span>
                <span>₹{cart.total.toFixed(2)}</span>
              </div>

              {cart.total < 2000 && (
                <div className="mt-2 p-3 bg-warning-50 border border-warning-200 rounded-lg">
                  <div className="text-sm text-warning-800">
                    Minimum order is ₹2000. Add ₹
                    {(2000 - cart.total).toFixed(2)} more to checkout.
                  </div>
                </div>
              )}
            </div>

            {/* Place Order Button */}
            <div className="mt-6">
              <RazorpayCheckout
                orderData={{
                  items: cart.items,
                  totalAmount: cart.total,
                  address: selectedAddress,
                }}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
              />
            </div>
          </div>
        </div>

        {/* Address Form Modal */}
        {showAddressForm && (
          <AddressForm
            onClose={() => setShowAddressForm(false)}
            onSave={(address) => {
              setSelectedAddress(address);
              setShowAddressForm(false);
            }}
          />
        )}
      </div>
    </motion.div>
  );
};

export default CheckoutPage;
