# dashboard-visit-assistant

Supabase Edge Function for optional AI fallback in the dashboard visits assistant.

This function is **dashboard-only** and answers based on provided visit JSON data.

## Required Supabase secrets

Set these in your Supabase project:

- OPENROUTER_API_KEY
- OPENROUTER_MODEL (optional, default: `google/gemma-3-4b-it`)
- OPENROUTER_SITE_URL (optional)
- OPENROUTER_APP_NAME (optional)

Example:

```bash
supabase secrets set \
  OPENROUTER_API_KEY="YOUR_OPENROUTER_KEY" \
  OPENROUTER_MODEL="google/gemma-3-4b-it" \
  OPENROUTER_SITE_URL="https://nhc-mystery-shopper-live.vercel.app" \
  OPENROUTER_APP_NAME="NHC Mystery Shopper Dashboard"
```

## Deploy

```bash
supabase functions deploy dashboard-visit-assistant --no-verify-jwt
```

## Frontend toggle

Set in your frontend env:

```dotenv
VITE_VISITS_ASSISTANT_USE_LLM=true
```

When disabled (`false`), assistant works with zero-cost rule-based engine only.
