# Web app: demo accounts only (2026-11-04)

The desktop React app is also published as a web app under a secret path on `https://schoolasist.com`. For now only the publicly shared demo accounts can use it.

## Rule (enforced on the server; `WebDemoAccessPolicy`)

- **Web channel:** a request whose `Origin` header is listed in `WebDemo:Origins` (`https://schoolasist.com`, `https://www.schoolasist.com`).
  - Login (`/api/auth/login`): any username not in `WebDemo:Usernames` is rejected before the password is checked (403 `WEB_DEMO_ONLY`). This leaks nothing about the password and does not touch the lockout counter of real accounts.
  - Login, refresh and PKCE code exchange: tokens are issued only to listed usernames whose `TenantId == WebDemo:TenantId`. **If TenantId is empty, web login is fully closed (fail-closed).**
  - Every authenticated request, including SignalR: `WebDemoChannelMiddleware` returns 403 for non-demo tokens.
  - Unaffected: anonymous public endpoints (contact, support, site content) and `pkce/authorize`. The desktop app's browser login uses the latter from the same origin.
- **Demo account protection (every channel: web, mobile, desktop):**
  - These cannot be changed for accounts in `WebDemo:Usernames`: password, username/email, status, role, tenant, `MustChangePassword`.
  - The accounts cannot be deleted, and no account or institution deletion request can be opened for them.
  - Password reset requests are silently ignored, with the same response as for other accounts.
  - The service level rejects these (`ChangePasswordAsync`, `RequestPasswordResetAsync`). The last line of defence is `CourseIntellectDbContext.GuardProtectedDemoAccounts` (403 `DEMO_ACCOUNT_PROTECTED`).
- **Limit:** the Origin header cannot be forged from a browser, but a non-browser client may omit it. This rule narrows the web surface only. Data isolation is still provided by the tenant checks.

## Build and publishing

- `desktop`: `WEB_BASE_PATH=/<secret> REACT_APP_COURSE_INTELLECT_API_URL=https://maydanozasist.schoolasist.com npm run build:web`.
  - No inline script.
  - No source map.
  - Session in `sessionStorage`: dropped when the tab closes.
  - "Remember me" and "Forgot password" are hidden.
- Release script:
  - Copies the build to `<marketing-release>/.webapp<secret>/`.
  - Installs `desktop/deploy/nginx-web-demo.conf` into `/etc/nginx/snippets/schoolasist-web-demo.conf` with the secret path substituted.
  - `nginx-security.conf` includes that file and returns 404 for `/.webapp`.
  - The web app has its own CSP and `noindex` headers.

## Production setup (not yet done)

Add to `/etc/courseintellect/backend-secrets.env`:

```
COURSE_INTELLECT_WEB_BASE_PATH=/<openssl rand -hex 24>
WebDemo__TenantId=<id of the Demo Kurum tenant>
```

Before deploying, check that the 8 usernames in `WebDemo:Usernames` (appsettings.json) match production exactly. The "İ" username bug was fixed earlier.
