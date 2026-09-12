# TableForAll

TableForAll is an Express and MongoDB application for planning event meals around guests' self-reported allergy information. It includes verified host and member sessions, deterministic meal reviews, menu coverage analysis, event room chat, and an optional member meal-information assistant.

## Local setup

1. Install Node.js and make a MongoDB deployment available.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and replace every placeholder you use. Keep `.env` private.
4. Run `node server.js`.
5. Open `http://localhost:3000`.

The server requires `MONGODB_URI` and `SESSION_SECRET`. Set `NODE_ENV=production` when deploying behind HTTPS so the session cookie is secure.

## Resend email verification

1. Create a Resend account and API key.
2. In Resend, verify a sending domain, or use another sender address that Resend has approved for your account.
3. Set `RESEND_API_KEY` to the server-side API key.
4. Set `EMAIL_FROM` to an approved sender, for example `TableForAll <verify@example.com>`. The domain in this address must match your verified sending domain unless Resend has explicitly approved the address another way.
5. Set `APP_BASE_URL` to the public origin of the application, with no trailing path.
6. Leave `DEV_LOG_VERIFICATION_CODES=false`. If local debugging requires terminal codes, set it to `true` only in a non-production environment. Codes are never logged when `NODE_ENV=production`.

When Resend rejects a delivery, TableForAll removes the newly created verification record and reports the delivery failure to the browser. Codes are hashed in MongoDB, expire after 10 minutes, allow five attempts, and have a one-minute resend cooldown.

### Gmail SMTP alternative

For local use or hosting plans that allow SMTP, enable two-step verification on a personal Google account and create a Google App Password for TableForAll. Set `GMAIL_USER` to that Gmail address, `GMAIL_APP_PASSWORD` to the generated app password, and `EMAIL_FROM` to `TableForAll <the-same-address@gmail.com>`. Never use the normal Google account password or commit an app password. Render free web services block outbound SMTP ports, so use SendGrid on that plan.

### SendGrid alternative for Render free services

SendGrid Single Sender Verification can verify an individual sender address without a custom domain. Create a SendGrid API key, set `SENDGRID_API_KEY`, and set `EMAIL_FROM` to the exact verified sender, for example `TableForAll <your-address@gmail.com>`. SendGrid uses HTTPS and takes priority over Gmail and Resend when configured.

## OpenAI meal assistant

The assistant is optional. Set `OPENAI_API_KEY` and `OPENAI_MODEL` on the server to enable it. It uses the official OpenAI Node SDK and Responses API. If either value is absent, the host and member flows, deterministic meal statuses, optimization, and chat remain available, while the Member Portal explains that the assistant is not configured.

The server loads the current event and member profile from MongoDB for each request. It sends only published meals, the event food blacklist, and the requesting member's allergy profile to OpenAI. It does not send other members' details or chat messages. Deterministic meal statuses remain authoritative.

## Room chat

Socket.IO shares the existing Mongo-backed Express session. A verified user must be a member of the requested event before the server joins the socket to that room. The most recent 50 undeleted messages are loaded when the portal opens.

## Tests

Run all tests with:

```sh
npm test
```

Run syntax checks with:

```sh
node --check server.js
node --check public/app.js
```
