import { loadStripe } from "@stripe/stripe-js";

// Publishable key (test/live) provided via env. Loaded once and reused.
const key = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
export const stripePromise = key ? loadStripe(key) : Promise.resolve(null);
