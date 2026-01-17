import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import { motion } from "framer-motion";
import { CheckCircle, MapPin, User, ArrowLeft } from "lucide-react";
import OrderTimeline from "../components/OrderTimeline";
import { buildCustomerOrderTimeline } from "../utils/customerOrderTimeline";
import { shouldShowDeliveryPartner } from "../utils/deliveryPartnerVisibility";

interface OrderItem {
  productId?: {
    _id?: string;
    name?: string;
    images?: string[];
    price?: number;
    mrp?: number;
  };
  product?: {
    _id?: string;
    name?: string;
    images?: string[];
    price?: number;
    mrp?: number;
  };
  name?: string;
  price: number;
  qty?: number;
  quantity?: number;
}

interface Order {
  _id: string;
  orderNumber?: string;
  items: OrderItem[];
  totalAmount: number;
  status?: string;
  orderStatus?: string;
  address?: {
    label?: string;
    addressLine?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  userId?: {
    _id?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  paymentMethod?: string;
  paymentStatus?: string;
  paymentReceivedAt?: string;
  createdAt: string;
  updatedAt: string;
  timeline?: any[];
  deliveryPartner?: {
    name?: string;
    phone?: string;
    vehicleType?: string;
  } | null;
}

const OrderDetailsPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { tokens, isAuthenticated } = useSelector(
    (state: RootState) => state.auth
  );
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    if (!orderId) {
      setError("Order not found");
      setIsLoading(false);
      return;
    }
    fetchOrderDetails();
  }, [isAuthenticated, orderId]);

  const fetchOrderDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!orderId) {
        setOrder(null);
        setError("Order not found");
        return;
      }

      const response = await fetch(`/api/orders/${orderId}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens?.accessToken}`,
        },
      });

      if (response.status === 404) {
        setOrder(null);
        setError("Order not found");
        return;
      }

      if (response.status === 400) {
        setOrder(null);
        setError("Invalid order link");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch order details");
      }

      const data = await response.json();
      const orderData = (data as any)?.order ?? data;
      setOrder(orderData);
    } catch (err) {
      console.error("Error fetching order details:", err);
      setError("Failed to load order details. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading order details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="text-red-500 text-lg font-medium mb-2">
              {error || "Order not found"}
            </div>
            <button
              onClick={() => navigate("/orders")}
              className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Back to Orders
            </button>
          </div>
        </div>
      </div>
    );
  }
  const backendTimeline = Array.isArray((order as any)?.timeline) ? ((order as any).timeline as any[]) : [];
  const timeline = buildCustomerOrderTimeline(backendTimeline);
  const failedStep = timeline.find((s: any) => String(s?.state || "") === "failed");
  const currentStep = timeline.find((s: any) => String(s?.state || "") === "current");
  const showPartner = shouldShowDeliveryPartner({
    currentCustomerStepKey: String((currentStep as any)?.key || ""),
    hasDeliveryPartner: Boolean((order as any)?.deliveryPartner),
  });

  // Calculate price breakdown
  const calculatePriceDetails = () => {
    let listingPrice = 0;
    let sellingPriceBeforeDelivery = 0;

    const items = order?.items || [];
    if (items.length === 0) {
      return {
        listingPrice: 0,
        sellingPrice: 0,
        discount: 0,
        deliveryFee: order?.totalAmount || 0,
        totalAmount: order?.totalAmount || 0,
      };
    }

    items.forEach((item) => {
      const product =
        typeof item.productId === "object" ? item.productId : item.product;
      const quantity = item.qty || item.quantity || 1;
      const mrp = product?.mrp || 0;
      const price = item.price || product?.price || 0;

      // Listing price should be MRP total (highest)
      listingPrice += (mrp > 0 ? mrp : price) * quantity;
      // Selling price is actual price without delivery
      sellingPriceBeforeDelivery += price * quantity;
    });

    // Delivery fee is the difference between total and selling price
    const deliveryFee = Math.max(
      0,
      order.totalAmount - sellingPriceBeforeDelivery
    );
    const discount =
      listingPrice > sellingPriceBeforeDelivery
        ? listingPrice - sellingPriceBeforeDelivery
        : 0;

    return {
      listingPrice,
      sellingPrice: sellingPriceBeforeDelivery,
      discount,
      deliveryFee,
      totalAmount: order.totalAmount,
    };
  };

  const priceDetails = calculatePriceDetails();

  const formatPaymentInfo = (order: Order) => {
    const method = order.paymentMethod || "cod";
    const status = order.paymentStatus || "pending";
    
    if (status === "paid" && order.paymentReceivedAt) {
      if (method === "cod") {
        return `Paid via UPI on ${new Date(order.paymentReceivedAt).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}`;
      } else {
        return `Paid via Razorpay on ${new Date(order.paymentReceivedAt || order.createdAt).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}`;
      }
    } else if (status === "paid") {
      return method === "cod" ? "Paid via UPI" : "Paid via Razorpay";
    } else {
      return "Payment Pending";
    }
  };

  const address = order.address;
  const addressLine = address?.addressLine?.trim();
  const cityStateLine = [address?.city, address?.state]
    .filter(Boolean)
    .join(", ");
  const cityStatePincodeLine = [cityStateLine, address?.pincode]
    .filter(Boolean)
    .join(" ");
  const addressLineLower = addressLine?.toLowerCase();
  const containsCityState =
    cityStateLine && addressLineLower
      ? addressLineLower.includes(cityStateLine.toLowerCase())
      : false;
  const containsPincode =
    address?.pincode && addressLine
      ? addressLine.includes(String(address.pincode))
      : false;
  const shouldShowCityStatePincodeLine =
    Boolean(cityStateLine || address?.pincode) &&
    (!addressLine ||
      (cityStateLine && !containsCityState) ||
      (address?.pincode && !containsPincode));

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate("/orders")}
          className="flex items-center text-blue-600 hover:text-blue-800 mb-6"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Orders
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Cancellation Message */}
            {failedStep && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-600 font-semibold text-center">
                  {String((failedStep as any)?.label || "Order update")}
                </p>
                {String((failedStep as any)?.description || "").trim() && (
                  <p className="text-red-700 text-sm text-center mt-1">
                    {String((failedStep as any)?.description || "").trim()}
                  </p>
                )}
              </div>
            )}

            {showPartner && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Delivery Partner</h3>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {String((order as any)?.deliveryPartner?.name || "Delivery partner")}
                    </p>
                    {(order as any)?.deliveryPartner?.vehicleType && (
                      <p className="text-xs text-gray-600 mt-0.5">
                        {String((order as any)?.deliveryPartner?.vehicleType)}
                      </p>
                    )}
                    {(order as any)?.deliveryPartner?.phone && (
                      <p className="text-sm text-gray-700 mt-2">{String((order as any)?.deliveryPartner?.phone)}</p>
                    )}
                  </div>

                  {(order as any)?.deliveryPartner?.phone && (
                    <a
                      href={`tel:${String((order as any)?.deliveryPartner?.phone)}`}
                      className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      Call
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Product Details */}
            {(order.items || []).map((item, index) => {
              const product =
                typeof item.productId === "object"
                  ? item.productId
                  : item.product;
              const productName = item.name || product?.name || "Product";
              const productPrice = item.price || product?.price || 0;
              const quantity = item.qty || item.quantity || 1;
              const rawImage = product?.images && product.images.length > 0 ? (product.images as any)[0] : undefined;
              let imageUrl: string = "/placeholder-product.png";
              if (rawImage) {
                if (typeof rawImage === "string") {
                  imageUrl = rawImage;
                } else if (typeof rawImage === "object") {
                  imageUrl =
                    String(
                      (rawImage as any)?.url ||
                        (rawImage as any)?.full ||
                        (rawImage as any)?.variants?.original ||
                        (rawImage as any)?.variants?.thumbnail ||
                        ""
                    ) || "/placeholder-product.png";
                }
              }
              
              // Replace via.placeholder.com URLs with inline SVG
              if (typeof imageUrl === "string" && imageUrl.includes("via.placeholder.com")) {
                imageUrl = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTVlN2ViIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5Y2EzYWYiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+";
              }
              
              // Get product ID for navigation
              const productId = (typeof item.productId === 'object' ? (item.productId as any)?._id : item.productId) || 
                               (product as any)?._id || 
                               (product as any)?.id;

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => productId && navigate(`/product/${productId}`)}
                >
                  <div className="flex items-start space-x-4">
                    <img
                      src={imageUrl}
                      alt={productName}
                      className="w-24 h-24 object-cover rounded-lg"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "/placeholder-product.png";
                      }}
                    />
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {productName}
                      </h3>
                      <div className="flex items-center space-x-3 mb-1">
                        {product?.mrp && product.mrp > productPrice && (
                          <span className="text-lg text-gray-500 line-through">
                            ₹{product.mrp}
                          </span>
                        )}
                        <p className="text-2xl font-bold text-gray-900">
                          ₹{productPrice}
                        </p>
                      </div>
                      <p className="text-sm text-gray-600">
                        Quantity: {quantity}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Order Status Timeline */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Order Status
              </h3>
              <OrderTimeline steps={timeline as any} />
            </div>
          </div>

          {/* Right Column - Delivery & Price Details */}
          <div className="space-y-6">
            {/* Delivery Details */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Delivery Details
              </h3>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <MapPin className="h-5 w-5 text-gray-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">
                      {order.address?.label || "Home"}
                    </p>
                    {addressLine && (
                      <p className="text-sm text-gray-600">{addressLine}</p>
                    )}
                    {shouldShowCityStatePincodeLine && (
                      <p className="text-sm text-gray-600">
                        {cityStatePincodeLine}
                      </p>
                    )}
                  </div>
                </div>
                {order.userId?.name && (
                  <div className="flex items-center space-x-3">
                    <User className="h-5 w-5 text-gray-500" />
                    <p className="text-sm text-gray-900">{order.userId.name}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Price Details */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Price Details
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Listing price</span>
                  <span className="text-gray-500 line-through">
                    ₹{priceDetails.listingPrice}
                  </span>
                </div>
                {priceDetails.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600">Discount</span>
                    <span className="text-green-600">
                      -₹{priceDetails.discount}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 flex items-center">
                    Selling price
                    <CheckCircle className="h-4 w-4 text-green-500 ml-1" />
                  </span>
                  <span className="text-gray-900">
                    ₹{priceDetails.sellingPrice}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Delivery fees</span>
                  <span className="text-gray-900">
                    {priceDetails.deliveryFee > 0
                      ? `₹${priceDetails.deliveryFee}`
                      : "FREE"}
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-900">
                      Total amount
                    </span>
                    <span className="font-bold text-xl text-gray-900">
                      ₹{priceDetails.totalAmount}
                    </span>
                  </div>
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Payment Status</span>
                    <span className="text-gray-900 font-medium">
                      {order.paymentStatus === "paid" ? "Paid" : "Pending"}
                    </span>
                  </div>
                  {order.paymentMethod === "cod" && order.paymentReceivedAt && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Payment received on</span>
                      <span className="text-green-600 font-medium">
                        {new Date(order.paymentReceivedAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Payment method</span>
                    <span className="text-gray-900 font-medium">
                      {formatPaymentInfo(order)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailsPage;
