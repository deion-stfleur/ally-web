# Google Sign-In on Netlify (fix Error 403: access_denied)

When testers see **"has not completed the Google verification process"** / **Error 403: access_denied**, the OAuth app is in **Testing** mode. Only emails listed as **Test users** can sign in until you publish.

## 1. Add Netlify to the OAuth client

[Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials** → your **Web client** (same ID as `VITE_GOOGLE_CLIENT_ID`).

**Authorized JavaScript origins**

- `https://resplendent-melba-7d820a.netlify.app`
- `http://localhost:5173` (local dev)

**Authorized redirect URIs**

- `https://resplendent-melba-7d820a.netlify.app`
- `http://localhost:5173`

The app uses Google Identity Services with `redirect_uri: window.location.origin`, so each deployed origin must be listed.

## 2. Let real users sign in (pick one)

### Option A — Test users (fastest for beta)

**OAuth consent screen** → **Test users** → **Add users** → add each tester’s Gmail address (up to 100).

Share the Netlify URL only with people on that list until you publish.

### Option B — Publish to Production

**OAuth consent screen** → **Publishing status** → **Publish app**.

- For **external** apps, Google may require **verification** if you use sensitive/restricted scopes (Gmail, Calendar, Drive).
- Until verified, users may see an "unverified app" warning but can still proceed if scopes are allowed.

## 3. Env on Netlify

Build env must include:

- `VITE_GOOGLE_CLIENT_ID` — same Web client as above
- `VITE_API_URL` — Heroku backend URL

Redeploy after changing env vars.

## 4. Phone SMS codes (separate issue)

Sendblue’s shared/free plan often blocks outbound SMS until the user has **texted Ally first**. Recommended flow:

1. **Sign in with Google** (no Sendblue contact requirement)
2. Link phone in app; show Ally’s number from `GET /api/auth/app-config`
3. For phone-first signup at scale: upgrade Sendblue or use Twilio Verify for OTP only
