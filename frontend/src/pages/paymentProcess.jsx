import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

import { loadStripe } from "@stripe/stripe-js";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5050";

const stripePublishableKey =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

const stripePromise = stripePublishableKey
  ? loadStripe(stripePublishableKey)
  : null;


// Payment form
function ManualCardEntry({ sessionId }) {
  const stripe = useStripe();
  const elements = useElements();

  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [billingDetails, setBillingDetails] = useState({
    name: "",
    email: "",
    address: "",
    city: "",
    province: "",
    postalCode: "",
    country: "CA",
  });

  function handleChange(event) {
    const { name, value } = event.target;

    setBillingDetails((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!stripe || !elements) {
      setError("Payment system is not ready yet.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Validate Stripe's payment fields.
      const { error: submitError } = await elements.submit();

      if (submitError) {
        throw new Error(submitError.message);
      }

      // Confirm the payment with Stripe.
      const { error: paymentError, paymentIntent } =
        await stripe.confirmPayment({
          elements,
          redirect: "if_required",
          confirmParams: {
            return_url: `${window.location.origin}/receipt`,

            payment_method_data: {
              billing_details: {
                name: billingDetails.name,
                email: billingDetails.email,
                address: {
                  line1: billingDetails.address,
                  city: billingDetails.city,
                  state: billingDetails.province,
                  postal_code: billingDetails.postalCode,
                  country: billingDetails.country,
                },
              },
            },
          },
        });

      if (paymentError) {
        throw new Error(paymentError.message);
      }

      if (paymentIntent?.status !== "succeeded") {
        throw new Error("The payment has not been completed.");
      }

      // Backend to verifies/completes transaction.
      const response = await fetch(
        `${API_URL}/checkout/complete-stripe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            session_id: sessionId,
            payment_intent_id: paymentIntent.id,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to complete the transaction."
        );
      }

      // Receipt data for receipt page.
      sessionStorage.setItem(
        "receiptData",
        JSON.stringify(result)
      );

      navigate("/receipt");
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="manual-card-form" onSubmit={handleSubmit}>

      {/* Card Info */}
      <div className="manual-card-fields">

        <h3>Card Information</h3>

        {/* Stripe gives card number, expiration and CVV */}
        <div className="manual-card-field">
          <label>Card Number, Expiration & Security Code</label>

          <PaymentElement
            options={{
              layout: "tabs",
            }}
          />
        </div>

        <div className="manual-card-field">
          <label htmlFor="cardholder-name">
            Name on Card
          </label>

          <input
            id="cardholder-name"
            type="text"
            name="name"
            placeholder="Name as displayed on card"
            value={billingDetails.name}
            onChange={handleChange}
            autoComplete="cc-name"
            required
          />
        </div>

      </div>

      <div className="manual-card-fields">

        <h3>Billing Information</h3>

        <div className="manual-card-field">
          <label htmlFor="billing-email">
            Email Address
          </label>

          <input
            id="billing-email"
            type="email"
            name="email"
            placeholder="example@email.com"
            value={billingDetails.email}
            onChange={handleChange}
            autoComplete="email"
            required
          />
        </div>

        <div className="manual-card-field">
          <label htmlFor="billing-address">
            Street Address
          </label>

          <input
            id="billing-address"
            type="text"
            name="address"
            placeholder="Street address"
            value={billingDetails.address}
            onChange={handleChange}
            autoComplete="address-line1"
            required
          />
        </div>

        <div className="manual-card-field">
          <label htmlFor="billing-city">
            City
          </label>

          <input
            id="billing-city"
            type="text"
            name="city"
            placeholder="City"
            value={billingDetails.city}
            onChange={handleChange}
            autoComplete="address-level2"
            required
          />
        </div>

        <div className="manual-card-field">
          <label htmlFor="billing-province">
            Province / State
          </label>

          <input
            id="billing-province"
            type="text"
            name="province"
            placeholder="Province or state"
            value={billingDetails.province}
            onChange={handleChange}
            autoComplete="address-level1"
            required
          />
        </div>

        <div className="manual-card-field">
          <label htmlFor="billing-postal">
            Postal / ZIP Code
          </label>

          <input
            id="billing-postal"
            type="text"
            name="postalCode"
            placeholder="Postal or ZIP code"
            value={billingDetails.postalCode}
            onChange={handleChange}
            autoComplete="postal-code"
            required
          />
        </div>

        <div className="manual-card-field">
          <label htmlFor="billing-country">
            Country
          </label>

          <select
            id="billing-country"
            name="country"
            value={billingDetails.country}
            onChange={handleChange}
            autoComplete="country"
            required
          >
            <option value="CA">Canada</option>
            <option value="US">United States</option>
            <option value="GB">United Kingdom</option>
            <option value="AU">Australia</option>
          </select>
        </div>

      </div>


      {/* error message */}
      {error && (
        <div className="manual-card-error">
          {error}
        </div>
      )}

      <button
        type="submit"
        className="manual-card-submit"
        disabled={!stripe || loading}
      >
        {loading ? "Processing Payment..." : "Pay Now"}
      </button>

    </form>
  );
}


// Payment Process page
function PaymentProcess() {
  const location = useLocation();
  const navigate = useNavigate();

  const sessionId = location.state?.sessionId;

  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function createPaymentIntent() {
      if (!sessionId) {
        setError("Checkout session not found. Please start checkout again.");
        setLoading(false);
        return;
      }

      if (!stripePublishableKey) {
        setError("Stripe publishable key is missing.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/checkout/create-payment-intent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              session_id: sessionId,
            }),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Unable to initialize payment."
          );
        }

        setClientSecret(result.client_secret);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    createPaymentIntent();
  }, [sessionId]);

  return (
    <div className="manual-card-page">

      <div className="manual-card-container">

        <div className="manual-card-header">
          <h2>Credit / Debit Card Payment</h2>
          <p>Enter your payment and billing information below.</p>
        </div>

        {loading && (
          <div className="manual-card-status">
            Preparing secure payment form...
          </div>
        )}

        {error && (
          <div className="manual-card-error">
            {error}
          </div>
        )}

        {!loading && clientSecret && (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: "stripe",
              },
            }}
          >
            <ManualCardEntry sessionId={sessionId} />
          </Elements>
        )}

        <div className="manual-card-footer">
          <button
            type="button"
            className="manual-card-cancel"
            onClick={() =>
              navigate("/self-checkout/transaction-options", {
                state: { sessionId },
              })
            }
          >
            Cancel Payment
          </button>
        </div>

      </div>

    </div>
  );
}

export default PaymentProcess;
