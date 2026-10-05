import app from '../../../src/app.js';

// Let Express parse JSON and Stripe webhook bodies itself. This preserves the raw
// request body required by Stripe signature verification.
export const config = {
  api: { bodyParser: false },
  maxDuration: 60,
};

export default function handler(req, res) {
  return app(req, res);
}
