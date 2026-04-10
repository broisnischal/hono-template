/**
 * List of supported payment gateways
 */
const gateway = {
  esewa: "esewa",
  khalti: "khalti",
  cybersource: "cybersource",
  paypal: "paypal",
  stripe: "stripe",
  razorpay: "razorpay",
} as const;

export type Gateway = (typeof gateway)[keyof typeof gateway];
