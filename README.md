
# next-convex-clerk-template

This template integrates Next.js, Convex, and Clerk for authentication. Follow the steps below to get started.

## Setup

1. Install dependencies

```bash
npm install
```

2. Create a JWT Template

- In the Clerk Dashboard, navigate to the **JWT templates** page.
- Select **New template** and then choose **Convex** from the list of templates. You'll be redirected to the template's settings page.
- Do NOT rename the JWT token — it must be called `convex`.
- Copy and save the **Issuer URL** somewhere secure. This is the issuer domain for Clerk's JWT templates (your Clerk app's Frontend API URL). In development it will look like `https://verb-noun-00.clerk.accounts.dev`; in production it will look like `https://clerk.<your-domain>.com`.

3. Run Convex in development

```bash
npm convex dev
```

4. Add environment variables

Create a `.env` or `.env.local` file in the project root and add the following:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
CLERK_SECRET_KEY=YOUR_SECRET_KEY
CLERK_JWT_ISSUER_DOMAIN=YOUR_ISSUER_DOMAIN
```

5. Protect routes with `middleware.ts`

- Add the routes you want to protect in `middleware.ts`. Configure the middleware to check authentication for those routes and redirect or return 401/403 where appropriate.

6. Auth UI

- The authentication UI (sign-in, sign-up, profile, etc.) can be created as per your application's requirements using Clerk's React components or custom UI with Clerk's SDK.

---

If you need help wiring up `middleware.ts` or example pages/components for Clerk, tell me which routes or pages you want protected and I can add example code.

