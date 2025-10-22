# Render Deployment Notes

Use this directory to store deployment-specific documentation or scripts for the Render-hosted backend (Stripe & PayPal APIs).

## Required Environment Variables
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Store any additional per-environment secrets in Render dashboard, not in this repository.