import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useCallback, useEffect, useMemo, useState } from "react";

type StripeConfig = { publishableKey: string };

function PaymentForm({ onDone }: { onDone: (msg: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handlePay = useCallback(async () => {
    if (!stripe || !elements) {
      return;
    }
    setBusy(true);
    setErr(null);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    setBusy(false);
    if (error) {
      setErr(error.message ?? "Payment failed");
      return;
    }
    if (paymentIntent) {
      onDone(`PaymentIntent ${paymentIntent.status}: ${paymentIntent.id}`);
    }
  }, [stripe, elements, onDone]);

  return (
    <div>
      <div id="payment-element">
        <PaymentElement />
      </div>
      {err ? <div className="error">{err}</div> : null}
      <button type="button" className="primary" onClick={handlePay} disabled={!stripe || busy}>
        {busy ? "Processing…" : "Pay now"}
      </button>
    </div>
  );
}

export function App() {
  const [apiBase, setApiBase] = useState(() => "");
  const [tenantId, setTenantId] = useState("shop-a");
  const [paymentSessionId, setPaymentSessionId] = useState("");
  const [bearer, setBearer] = useState("");
  const [pk, setPk] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setApiBase(window.location.origin);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${apiBase || window.location.origin}/api/public/stripe-publishable-key`);
        const data = (await r.json()) as StripeConfig & { error?: { message?: string; code?: string } };
        if (!r.ok) {
          throw new Error(data.error?.message ?? data.error?.code ?? "Could not load Stripe config");
        }
        if (!cancelled) {
          setPk(data.publishableKey);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadErr(e instanceof Error ? e.message : "Config load failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  const stripePromise = useMemo(() => {
    if (!pk) {
      return null;
    }
    return loadStripe(pk);
  }, [pk]);

  const loadIntent = useCallback(async () => {
    setLoadErr(null);
    setSuccess(null);
    setClientSecret(null);
    if (!paymentSessionId.trim() || !tenantId.trim() || !bearer.trim()) {
      setLoadErr("Fill payment session id, tenant id, and bearer token.");
      return;
    }
    setBusy(true);
    try {
      const base = apiBase || window.location.origin;
      const url = new URL(
        `/internal/stripe/payment-intents/${encodeURIComponent(paymentSessionId.trim())}`,
        base,
      );
      url.searchParams.set("tenantId", tenantId.trim());
      const r = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${bearer.trim()}`,
          Accept: "application/json",
        },
      });
      const data = (await r.json()) as {
        error?: { message?: string; code?: string };
        stripePaymentIntent?: { client_secret?: string | null };
      };
      if (!r.ok) {
        const msg = data.error?.message ?? data.error?.code ?? `HTTP ${r.status}`;
        throw new Error(msg);
      }
      const secret = data.stripePaymentIntent?.client_secret;
      if (!secret) {
        throw new Error("No client_secret on PaymentIntent — create a new intent first.");
      }
      setLoadErr(null);
      setClientSecret(secret);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Failed to load intent");
    } finally {
      setBusy(false);
    }
  }, [apiBase, bearer, paymentSessionId, tenantId]);

  const onPaid = useCallback((msg: string) => {
    setSuccess(msg);
  }, []);

  return (
    <div className="app">
      <h1>Stripe test checkout</h1>
      <p className="muted">
        Enter your internal <strong>payment session id</strong> (UUID from{" "}
        <code>POST /internal/stripe/payment-intents</code>), tenant, and service bearer token. Then
        load the intent and pay with test card <code>4242 4242 4242 4242</code>.
      </p>
      <div className="warn">
        Dev-only: pasting the API token in the browser is insecure. Use only in local testing.
      </div>

      {loadErr ? <div className="error">{loadErr}</div> : null}

      <div className="field">
        <label htmlFor="apiBase">API base (same origin usually)</label>
        <input
          id="apiBase"
          type="text"
          value={apiBase}
          onChange={(e) => setApiBase(e.target.value)}
          placeholder="http://localhost:3000"
          autoComplete="off"
        />
      </div>
      <div className="field">
        <label htmlFor="tenant">Tenant id</label>
        <input
          id="tenant"
          type="text"
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="field">
        <label htmlFor="psid">Payment session id (UUID)</label>
        <input
          id="psid"
          type="text"
          value={paymentSessionId}
          onChange={(e) => setPaymentSessionId(e.target.value)}
          placeholder="94554bc0-0137-413f-b892-d85ed66bf2c6"
          autoComplete="off"
        />
      </div>
      <div className="field">
        <label htmlFor="bearer">Internal API bearer token</label>
        <input
          id="bearer"
          type="password"
          value={bearer}
          onChange={(e) => setBearer(e.target.value)}
          autoComplete="off"
        />
      </div>

      <button type="button" className="secondary" onClick={loadIntent} disabled={busy || !pk}>
        {busy ? "Loading…" : "Load PaymentIntent"}
      </button>

      {!pk ? (
        <p className="muted">Loading Stripe publishable key…</p>
      ) : null}

      {stripePromise && clientSecret ? (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <PaymentForm onDone={onPaid} />
        </Elements>
      ) : null}

      {success ? <div className="success">{success}</div> : null}
    </div>
  );
}
