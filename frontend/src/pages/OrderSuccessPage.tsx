import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle } from "lucide-react";

const OrderSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();

  const id = String(orderId || "").trim();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="flex justify-center">
          <CheckCircle className="h-20 w-20 text-green-500" />
        </div>

        <h1 className="mt-4 text-2xl font-bold text-gray-900">Order Placed Successfully!</h1>

        <div className="mt-4 text-sm text-gray-700">
          <div className="text-gray-500">Order ID</div>
          <div className="mt-1 font-mono font-semibold break-all">{id || "—"}</div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="w-full py-3 px-4 rounded-lg font-semibold bg-orange-500 text-white hover:bg-orange-600 transition-colors"
          >
            Continue Shopping
          </button>

          <button
            type="button"
            onClick={() => {
              if (!id) return;
              navigate(`/orders/${id}`);
            }}
            disabled={!id}
            className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors border ${
              !id
                ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                : "bg-white text-gray-900 border-gray-300 hover:bg-gray-50"
            }`}
          >
            View Order
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccessPage;
