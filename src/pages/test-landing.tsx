/** Hono JSX landing — links to the React Stripe tester and API docs. */
export function TestLanding() {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Payment service — test</title>
        <style>{`body{font-family:system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem;line-height:1.5;color:#0f172a}a{color:#2563eb}`}</style>
      </head>
      <body>
        <h1>Payment service</h1>
        <p>
          <a href="/test/pay/">Stripe test checkout (React) →</a>
        </p>
        <p>
          <a href="/docs">OpenAPI docs →</a>
        </p>
        <p>
          <a href="/health">Health →</a>
        </p>
      </body>
    </html>
  );
}
