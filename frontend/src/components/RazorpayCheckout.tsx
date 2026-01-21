const RazorpayCheckout = (props: {
  disabled: boolean;
  label: string;
  onClick: () => void;
}): JSX.Element => {
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      className={`w-full py-3 px-4 font-medium rounded-lg transition-colors ${
        props.disabled
          ? "bg-gray-400 text-gray-600 cursor-not-allowed"
          : "bg-amber-500 text-white hover:bg-amber-600"
      }`}
    >
      {props.label}
    </button>
  );
};

export default RazorpayCheckout;
