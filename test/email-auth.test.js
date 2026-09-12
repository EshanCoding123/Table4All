const test = require("node:test");
const assert = require("node:assert/strict");
const {
  EmailDeliveryError,
  createEmailService,
} = require("../services/emailService");
const {
  createAuthRouter,
  hashVerificationCode,
} = require("../routes/auth");

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    set(name, value) { this.headers[name] = value; return this; },
    json(body) { this.body = body; return this; },
  };
}

function authHandler(router, path) {
  return router.stack.find((layer) => layer.route?.path === path).route.stack[0].handle;
}

function sessionRecorder() {
  return {
    regenerate(callback) { callback(); },
    save(callback) { callback(); },
    destroy(callback) { callback(); },
  };
}

test("email service sends clean HTML and text through a mocked Resend client", async () => {
  let sent;
  const service = createEmailService({
    client: { emails: { send: async (message) => { sent = message; return { data: { id: "email-1" } }; } } },
    environment: { NODE_ENV: "production" },
    from: "TableForAll <verify@example.test>",
    appBaseUrl: "https://tableforall.example",
  });
  const expiresAt = new Date("2030-01-02T03:04:05.000Z");
  assert.deepEqual(await service.sendVerificationCode({
    email: "member@example.test", code: "123456", expiresAt,
  }), { id: "email-1" });
  assert.equal(sent.to, "member@example.test");
  assert.match(sent.subject, /TableForAll/);
  assert.match(sent.text, /123456/);
  assert.match(sent.text, /2030-01-02T03:04:05.000Z/);
  assert.match(sent.html, /TableForAll/);
  assert.match(sent.html, /123456/);
});

test("email service sends through Gmail SMTP when Gmail credentials are configured", async () => {
  let sent;
  const service = createEmailService({
    transporter: {
      sendMail: async (message) => {
        sent = message;
        return { messageId: "gmail-message-1" };
      },
    },
    environment: {
      NODE_ENV: "production",
      GMAIL_USER: "tableforall.sender@gmail.com",
      GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop",
    },
    appBaseUrl: "https://table4all.onrender.com",
  });

  const result = await service.sendVerificationCode({
    email: "guest@example.test",
    code: "123456",
    expiresAt: new Date("2030-01-02T03:04:05.000Z"),
  });

  assert.deepEqual(result, { id: "gmail-message-1" });
  assert.equal(sent.from, "TableForAll <tableforall.sender@gmail.com>");
  assert.equal(sent.to, "guest@example.test");
  assert.match(sent.text, /123456/);
  assert.match(sent.html, /123456/);
});

test("email service turns a provider rejection into a delivery error", async () => {
  const service = createEmailService({
    client: { emails: { send: async () => ({ error: { message: "provider detail" } }) } },
    environment: { NODE_ENV: "production" },
    from: "verify@example.test",
  });
  await assert.rejects(
    service.sendVerificationCode({ email: "member@example.test", code: "123456", expiresAt: new Date() }),
    EmailDeliveryError
  );
});

test("verification codes are never logged in production even when the debug flag is true", async (t) => {
  const log = t.mock.method(console, "log", () => {});
  const service = createEmailService({
    client: { emails: { send: async () => ({ data: { id: "email-1" } }) } },
    environment: { NODE_ENV: "production", DEV_LOG_VERIFICATION_CODES: "true" },
    from: "verify@example.test",
  });
  await service.sendVerificationCode({ email: "member@example.test", code: "123456", expiresAt: new Date() });
  assert.equal(log.mock.callCount(), 0);
});

test("verification codes are not logged in development unless the debug flag is explicitly true", async (t) => {
  const log = t.mock.method(console, "log", () => {});
  const client = { emails: { send: async () => ({ data: { id: "email-1" } }) } };
  const quietService = createEmailService({
    client, environment: { NODE_ENV: "development", DEV_LOG_VERIFICATION_CODES: "false" },
    from: "verify@example.test",
  });
  await quietService.sendVerificationCode({ email: "member@example.test", code: "123456", expiresAt: new Date() });
  assert.equal(log.mock.callCount(), 0);

  const debugService = createEmailService({
    client, environment: { NODE_ENV: "development", DEV_LOG_VERIFICATION_CODES: "true" },
    from: "verify@example.test",
  });
  await debugService.sendVerificationCode({ email: "member@example.test", code: "654321", expiresAt: new Date() });
  assert.equal(log.mock.callCount(), 1);
  assert.match(log.mock.calls[0].arguments[0], /654321/);
});

test("request-code sends email, stores only a hash, and returns no code", async () => {
  let created;
  let delivered;
  const VerificationCodeModel = {
    findOne: async () => null,
    deleteMany: async () => {},
    create: async (value) => { created = { _id: "verification-1", ...value }; return created; },
    findByIdAndDelete: async () => {},
  };
  const router = createAuthRouter({
    VerificationCodeModel,
    emailService: { sendVerificationCode: async (value) => { delivered = value; } },
    sessionSecret: "test-session-secret",
    now: () => new Date("2030-01-01T00:00:00.000Z"),
  });
  const req = {
    body: { name: " Member ", email: " MEMBER@Example.Test ", intent: "host" },
  };
  const res = responseRecorder();
  await authHandler(router, "/request-code")(req, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.deliveryMethod, "email");
  assert.doesNotMatch(JSON.stringify(res.body), /\b\d{6}\b/);
  assert.equal(created.email, "member@example.test");
  assert.match(created.codeHash, /^[a-f0-9]{64}$/);
  assert.equal(created.expiresAt.toISOString(), "2030-01-01T00:10:00.000Z");
  assert.equal(delivered.email, "member@example.test");
  assert.equal(delivered.expiresAt, created.expiresAt);
  assert.equal(delivered.code.length, 6);
  assert.notEqual(created.codeHash, delivered.code);
});

test("email delivery failure removes the unusable code and returns JSON failure", async () => {
  let deletedId;
  const VerificationCodeModel = {
    findOne: async () => null,
    deleteMany: async () => {},
    create: async (value) => ({ _id: "failed-code", ...value }),
    findByIdAndDelete: async (id) => { deletedId = id; },
  };
  const router = createAuthRouter({
    VerificationCodeModel,
    emailService: { sendVerificationCode: async () => { throw new EmailDeliveryError("private provider detail"); } },
    sessionSecret: "test-session-secret",
  });
  const res = responseRecorder();
  await authHandler(router, "/request-code")({
    body: { name: "Member", email: "member@example.test", intent: "host" },
  }, res);
  assert.equal(res.statusCode, 502);
  assert.equal(deletedId, "failed-code");
  assert.doesNotMatch(JSON.stringify(res.body), /private provider detail/);
});

test("request-code enforces the resend cooldown before sending or replacing a code", async () => {
  let deliveries = 0;
  let replacements = 0;
  const router = createAuthRouter({
    VerificationCodeModel: {
      findOne: async () => ({ createdAt: new Date("2030-01-01T00:00:30.000Z") }),
      deleteMany: async () => { replacements += 1; },
      create: async () => { replacements += 1; },
    },
    emailService: { sendVerificationCode: async () => { deliveries += 1; } },
    sessionSecret: "test-session-secret",
    now: () => new Date("2030-01-01T00:01:00.000Z"),
  });
  const res = responseRecorder();
  await authHandler(router, "/request-code")({
    body: { name: "Member", email: "member@example.test", intent: "host" },
  }, res);
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.retryAfterSeconds, 30);
  assert.equal(res.headers["Retry-After"], "30");
  assert.equal(deliveries, 0);
  assert.equal(replacements, 0);
});

function verificationRouter(verification, now = () => new Date("2030-01-01T00:05:00.000Z")) {
  let deleted = 0;
  const VerificationCodeModel = {
    findOne: () => ({ sort: async () => verification }),
    findByIdAndDelete: async () => { deleted += 1; },
  };
  const router = createAuthRouter({
    VerificationCodeModel,
    UserModel: {
      findOneAndUpdate: async () => ({ _id: "user-1", name: "Member", email: verification.email }),
    },
    emailService: { sendVerificationCode: async () => {} },
    sessionSecret: "test-session-secret",
    now,
  });
  return { router, deleted: () => deleted };
}

test("expired codes are rejected and invalidated", async () => {
  const verification = {
    _id: "code-1", email: "member@example.test", name: "Member", attempts: 0,
    codeHash: hashVerificationCode("member@example.test", "123456", "test-session-secret"),
    expiresAt: new Date("2030-01-01T00:04:59.000Z"),
  };
  const setup = verificationRouter(verification);
  const res = responseRecorder();
  await authHandler(setup.router, "/verify-code")({
    body: { email: verification.email, code: "123456", intent: "host" },
    session: sessionRecorder(),
  }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /expired/);
  assert.equal(setup.deleted(), 1);
});

test("five incorrect attempts invalidate the verification code", async () => {
  const verification = {
    _id: "code-1", email: "member@example.test", name: "Member", attempts: 4,
    codeHash: hashVerificationCode("member@example.test", "123456", "test-session-secret"),
    expiresAt: new Date("2030-01-01T00:10:00.000Z"),
    save: async () => {},
  };
  const setup = verificationRouter(verification);
  const res = responseRecorder();
  await authHandler(setup.router, "/verify-code")({
    body: { email: verification.email, code: "654321", intent: "host" },
    session: sessionRecorder(),
  }, res);
  assert.equal(res.statusCode, 429);
  assert.match(res.body.message, /Too many attempts/);
  assert.equal(verification.attempts, 5);
  assert.equal(setup.deleted(), 1);
});

test("successful verification invalidates the code and preserves the regenerated session", async () => {
  const verification = {
    _id: "code-1", email: "member@example.test", name: "Member", attempts: 0,
    codeHash: hashVerificationCode("member@example.test", "123456", "test-session-secret"),
    expiresAt: new Date("2030-01-01T00:10:00.000Z"),
  };
  const setup = verificationRouter(verification);
  const session = sessionRecorder();
  const res = responseRecorder();
  await authHandler(setup.router, "/verify-code")({
    body: { email: verification.email, code: "123456", intent: "host" }, session,
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(session.userId, "user-1");
  assert.equal(session.email, verification.email);
  assert.equal(setup.deleted(), 1);
});
