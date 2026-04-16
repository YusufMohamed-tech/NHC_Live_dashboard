# send-visit-notification

Supabase Edge Function to send Arabic visit notifications through Resend.

## Required Supabase secrets

Set these in your Supabase project (do not store API keys in source files):

- RESEND_API_KEY
- RESEND_FROM_EMAIL
- RESEND_REPLY_TO (optional)

Example:

```bash
supabase secrets set \
  RESEND_API_KEY="YOUR_RESEND_API_KEY" \
  RESEND_FROM_EMAIL="NHC Mystery Shopper <notifications@yourdomain.com>" \
  RESEND_REPLY_TO="support@yourdomain.com"
```

## Deploy function

```bash
supabase functions deploy send-visit-notification --no-verify-jwt
```

## Notes

- The frontend invokes this function after visit lifecycle actions.
- This function is deployed with `--no-verify-jwt` because the frontend uses Supabase publishable key flow and does not rely on Supabase Auth sessions.
- CTA links are role-aware:
  - shopper: /shopper/visits/:visitId
  - superadmin: /superadmin/visits
  - admin: /admin/visits
  - ops: /ops/visits
