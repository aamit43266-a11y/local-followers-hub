# Local Followers Hub — Barhaj, Deoria

Hindi + English public Instagram directory with district/category filters, profile submissions, admin approval and secure admin login.

## Stack
- Static site: HTML, CSS and browser JavaScript
- Hosting: Cloudflare Pages (free tier subject to provider limits)
- Database/Auth: Supabase
- Public profiles appear only after admin approval
- No fake followers, auto-following, or Instagram password collection

## 1. Create Supabase project
1. Create a project at https://supabase.com/.
2. Open **SQL Editor**, paste `supabase/schema.sql`, and run it.
3. In **Project Settings → API** (or Connect), copy the project URL and the **publishable key** (legacy `anon` key is also a public client key).
4. Never use the `service_role` / secret key in this frontend, Git repository, or Cloudflare Pages static assets.

## 2. Create the admin account
Recommended: in Supabase Dashboard → Authentication → Users, invite `amit43266@gmail.com` (or create the user and complete email verification). Ensure this is the inbox you control. Then run this SQL in SQL Editor:

```sql
insert into public.app_admins (user_id)
select id from auth.users
where lower(email) = lower('amit43266@gmail.com')
on conflict (user_id) do nothing;
```

Confirm one row was inserted:
```sql
select a.user_id, u.email
from public.app_admins a join auth.users u on u.id = a.user_id;
```
If no row appears, the Auth user has not been created yet or the email differs. Do not put this email into a browser-side "admin check" as the sole security boundary: the database allowlist and RLS are the authority.

## 3. Configure the frontend
Edit `public/app.js` and fill the two public client settings:

```js
const CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT_REF.supabase.co",
  supabaseAnonKey: "YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY"
};
```

These are intentionally public browser values. Do not add a service-role/secret key. The security boundary is Supabase RLS, not hiding the publishable key.

## 4. Configure Supabase Auth URLs
In Authentication → URL Configuration:
- Site URL: set to your deployed Cloudflare Pages URL after first deploy (for example, `https://your-project.pages.dev`).
- Add the same origin to Redirect URLs, e.g. `https://your-project.pages.dev/**`.
- For local testing, add `http://localhost:8788/**` if you use `wrangler pages dev`.
- Configure SMTP/email delivery if needed. Supabase's default email service has sending limits; production use may require custom SMTP.
- Admin magic-link login requires an existing Auth user. The app does not create admin users.

## 5. Run locally (optional)
Install Node.js, then from this folder:

```bash
npm install
npx wrangler pages dev public
```
Open the local URL shown in terminal. If you use a different port, add that exact origin to Supabase Auth Redirect URLs.

## 6. Deploy to Cloudflare Pages
Easy path:
1. Create a private GitHub repository and upload these project files.
2. In Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git.
3. Select the repository.
4. Framework preset: **None**.
5. Build command: leave blank.
6. Build output directory: `public`.
7. Deploy.
8. Add the deployed `https://...pages.dev` URL in Supabase Auth URL Configuration and test the admin magic link.

CLI alternative:
```bash
npm install
npx wrangler pages deploy public --project-name local-followers-hub
```
Authenticate Wrangler when prompted. Cloudflare CLI deployment needs your own Cloudflare account authorization.

## 7. First test checklist
- Open directory in a private/incognito browser: only approved profiles should be visible.
- Submit a test profile: it must remain pending and not appear publicly.
- Sign in with the allowlisted admin email; open the email magic link in the same browser.
- Approve the test profile: it should appear in the directory.
- Test rejecting a profile and removing a published listing.
- Test mobile width and all district/category filters.
- Check that anonymous users cannot select pending/rejected rows or update/delete rows.

## Security and operational notes
- `app_admins` has RLS enabled and no client insert/update/delete policies. Bootstrap admins only from SQL Editor.
- `profiles` has RLS policies: public reads approved rows; anonymous/authenticated visitors can insert pending rows; only allowlisted admins can update/delete.
- Never share database passwords, SMTP credentials, Supabase service-role keys or Cloudflare API tokens in chat or source control.
- Public submission forms can still be spammed. Before wider promotion, add rate limiting/CAPTCHA (e.g. a server-side Cloudflare Turnstile verification endpoint), a privacy/terms page, report-abuse process and database backups. A client-only CAPTCHA widget without server-side verification is not a security control.
- Profiles are public data. Submitters should have permission to list the profile. Do not collect Instagram passwords.
- The app links to the username's canonical Instagram profile; it does not access Instagram's private APIs or guarantee followers.
- Keep Supabase and Cloudflare free-tier usage within current limits and check their current terms.
