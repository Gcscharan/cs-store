import React from "react";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { X, Copy, CheckCircle, ArrowLeft } from "lucide-react";
import { toast } from "react-hot-toast";

interface PaymentQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  amount: number;
  onPaymentConfirmed?: () => void;
}

const PaymentQRModal: React.FC<PaymentQRModalProps> = ({
  isOpen,
  onClose,
  orderId,
  amount,
  onPaymentConfirmed,
}) => {
  const [isPaymentConfirmed, setIsPaymentConfirmed] = React.useState(false);
  const [isUpdatingPayment, setIsUpdatingPayment] = React.useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = React.useState(false);

  // Handle ESC key to close modal
  React.useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      return () => {
        document.removeEventListener('keydown', handleEscKey);
      };
    }
  }, [isOpen, onClose]);

  // Generate UPI payment link
  const upiPaymentLink = `upi://pay?pa=9391795162@ibl&pn=CS Store&am=${amount}&cu=INR&tn=Payment for Order #${orderId.slice(-6)}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(upiPaymentLink);
    toast.success("UPI link copied to clipboard!");
  };

  const handlePaymentConfirmation = React.useCallback(async (confirmed: boolean) => {
    if (!confirmed) {
      setIsPaymentConfirmed(false);
      return;
    }

    setIsUpdatingPayment(true);
    
    try {
      const authStr = localStorage.getItem("auth");
      const accessToken = authStr ? JSON.parse(authStr)?.tokens?.accessToken : null;
      
      if (!accessToken) {
        toast.error("Authentication required");
        return;
      }

      const response = await fetch(`/api/orders/${orderId}/payment-status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update payment status");
      }

      await response.json();
      setIsPaymentConfirmed(true);
      toast.success("Payment marked as received successfully ✅");
      
      // Notify parent component
      if (onPaymentConfirmed) {
        onPaymentConfirmed();
      }
      
    } catch (error: any) {
      console.error("Payment confirmation error:", error);
      toast.error(error.message || "Failed to confirm payment");
      setIsPaymentConfirmed(false);
    } finally {
      setIsUpdatingPayment(false);
    }
  }, [orderId, onPaymentConfirmed]);

  // Automatic payment detection
  React.useEffect(() => {
    if (!isOpen || isPaymentConfirmed) return;

    const checkPaymentStatus = async () => {
      try {
        setIsCheckingPayment(true);
        
        const authStr = localStorage.getItem("auth");
        const accessToken = authStr ? JSON.parse(authStr)?.tokens?.accessToken : null;
        
        if (!accessToken) return;

        const response = await fetch(`/api/orders/${orderId}/payment-status`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.paymentStatus === "paid" && !isPaymentConfirmed) {
            // Automatically trigger payment confirmation
            await handlePaymentConfirmation(true);
          }
        }
      } catch (error) {
        console.error("Payment status check error:", error);
      } finally {
        setIsCheckingPayment(false);
      }
    };

    // Check payment status every 3 seconds
    const interval = setInterval(checkPaymentStatus, 3000);
    
    // Check immediately when modal opens
    checkPaymentStatus();

    return () => {
      clearInterval(interval);
    };
  }, [isOpen, isPaymentConfirmed, orderId, handlePaymentConfirmation]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto max-h-[90vh] md:max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-12 sm:px-16 py-4 sm:py-6 border-b border-gray-200 relative bg-white rounded-t-2xl">
          {/* Left Arrow Button */}
          <button
            onClick={onClose}
            className="p-2 hover:bg-blue-50 hover:text-blue-600 rounded-full transition-colors border border-gray-200 hover:border-blue-200 absolute left-4 top-1/2 transform -translate-y-1/2"
            title="Go Back"
          >
            <ArrowLeft className="h-5 w-5 text-gray-700 hover:text-blue-600" />
          </button>
          
          {/* Centered Title */}
          <h3 className="text-lg font-bold text-gray-900 flex-1 text-center">Payment QR Code</h3>
          
          {/* Right Close Button */}
          <button
            onClick={onClose}
            className="p-2 hover:bg-red-50 hover:text-red-600 rounded-full transition-colors border border-gray-200 hover:border-red-200 absolute right-4 top-1/2 transform -translate-y-1/2"
            title="Close Payment Modal"
          >
            <X className="h-5 w-5 text-gray-700 hover:text-red-600" />
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 scroll-smooth">
          <div className="p-4 sm:p-6 text-center">
          {/* Order Details */}
          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-1">Order #{orderId.slice(-6)}</p>
            <p className="text-2xl font-bold text-green-600">₹{amount}</p>
          </div>

          {/* QR Code */}
          <div className="bg-white p-6 rounded-xl border-2 border-gray-200 mb-6 inline-block">
            <QRCodeSVG
              value={upiPaymentLink}
              size={200}
              level="M"
              includeMargin={true}
              bgColor="#FFFFFF"
              fgColor="#000000"
            />
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-center mb-2">
              <CheckCircle className="h-5 w-5 text-blue-600 mr-2" />
              <p className="text-sm font-semibold text-blue-800">
                Ask customer to scan and pay the exact amount
              </p>
            </div>
            <p className="text-xs text-blue-600">
              Compatible with Google Pay, PhonePe, Paytm, BHIM & all UPI apps
            </p>
          </div>

          {/* UPI Details */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <p className="text-xs text-gray-600 mb-1">UPI ID:</p>
            <div className="flex items-center justify-between">
              <p className="text-sm font-mono font-semibold text-gray-800">
                9391795162@ibl
              </p>
              <button
                onClick={copyToClipboard}
                className="text-blue-600 hover:text-blue-700 p-1"
                title="Copy UPI link"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>

        </div>
        </div>

        {/* Fixed Footer */}
        <div className="flex-shrink-0 p-4 sm:p-6 border-t border-gray-200 bg-white rounded-b-2xl">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors flex items-center justify-center"
          >
            <X className="h-4 w-4 mr-2" />
            Close Payment Modal
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default PaymentQRModal;
