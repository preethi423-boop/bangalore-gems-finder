type CheckoutOptions = {
  key: string;
  order_id?: string;
  subscription_id?: string;
  amount?: number;
  currency?: string;
  name: string;
  description: string;
  handler: () => void;
  modal: { ondismiss: () => void };
};
type Checkout = { open: () => void; on: (event: "payment.failed", callback: (result: { error: { description: string } }) => void) => void };
declare global { interface Window { Razorpay?: new (options: CheckoutOptions) => Checkout } }

let loading: Promise<void> | undefined;
export async function openRazorpay(options: CheckoutOptions, onError: (message: string) => void) {
  if (!window.Razorpay) {
    loading ??= new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve();
      script.onerror = () => { loading = undefined; script.remove(); reject(new Error("Could not open Razorpay. Please try again.")); };
      document.head.append(script);
    });
    await loading;
  }
  const Constructor = window.Razorpay;
  if (!Constructor) throw new Error("Razorpay did not load. Please try again.");
  const checkout = new Constructor(options);
  checkout.on("payment.failed", result => onError(result.error.description));
  checkout.open();
}