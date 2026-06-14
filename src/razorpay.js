/** Load Razorpay Checkout script once. */
export function loadRazorpayScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay is only available in the browser."));
  }
  if (window.Razorpay) return Promise.resolve(window.Razorpay);

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Razorpay));
      existing.addEventListener("error", () => reject(new Error("Could not load Razorpay checkout.")));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error("Could not load Razorpay checkout."));
    document.body.appendChild(script);
  });
}

/**
 * Open Razorpay subscription checkout.
 * @param {object} checkout - from createCheckoutSession callable
 * @param {function} onSuccess - called with payment response
 * @param {function} onDismiss - modal closed without payment
 */
export function openRazorpaySubscriptionCheckout(checkout, { onSuccess, onDismiss } = {}) {
  return loadRazorpayScript().then((Razorpay) => {
    return new Promise((resolve, reject) => {
      const options = {
        key: checkout.keyId,
        subscription_id: checkout.subscriptionId,
        name: checkout.name || "NextOffer.ai",
        description: checkout.description || "Pro subscription",
        prefill: {
          name: checkout.customerName || "",
          email: checkout.email || "",
        },
        theme: { color: "#0F766E" },
        handler(response) {
          onSuccess?.(response);
          resolve(response);
        },
        modal: {
          ondismiss() {
            onDismiss?.();
            reject(new Error("Payment cancelled"));
          },
        },
      };

      const rzp = new Razorpay(options);
      rzp.on("payment.failed", (response) => {
        const msg = response?.error?.description || "Payment failed";
        reject(new Error(msg));
      });
      rzp.open();
    });
  });
}
