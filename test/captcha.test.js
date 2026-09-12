const test = require("node:test");
const assert = require("node:assert/strict");

const {
  CaptchaConfigurationError,
  CaptchaVerificationError,
  TURNSTILE_VERIFY_URL,
  createCaptchaService,
} = require("../lib/captcha");
const { createRateLimiter } = require("../lib/rateLimiter");

test("captcha is bypassed only when it is not configured or required", async () => {
  const captcha = createCaptchaService({ environment: {} });
  assert.equal(captcha.configured, false);
  assert.deepEqual(await captcha.verify(""), { success: true, skipped: true });
});

test("required captcha fails closed when keys are missing", async () => {
  const captcha = createCaptchaService({
    environment: { CAPTCHA_REQUIRED: "true" },
  });

  await assert.rejects(() => captcha.verify("token"), CaptchaConfigurationError);
});

test("captcha sends the token and remote IP to Turnstile over HTTPS", async () => {
  let request;
  const captcha = createCaptchaService({
    environment: {
      TURNSTILE_SITE_KEY: "public-site-key",
      TURNSTILE_SECRET_KEY: "private-secret-key",
    },
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        json: async () => ({ success: true, action: "login" }),
      };
    },
  });

  const result = await captcha.verify("response-token", "203.0.113.4", "login");

  assert.equal(result.success, true);
  assert.equal(request.url, TURNSTILE_VERIFY_URL);
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.body.get("secret"), "private-secret-key");
  assert.equal(request.options.body.get("response"), "response-token");
  assert.equal(request.options.body.get("remoteip"), "203.0.113.4");
});

test("captcha rejects a token issued for a different action", async () => {
  const captcha = createCaptchaService({
    environment: {
      TURNSTILE_SITE_KEY: "public-site-key",
      TURNSTILE_SECRET_KEY: "private-secret-key",
    },
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ success: true, action: "signup" }),
    }),
  });

  const result = await captcha.verify("response-token", "203.0.113.4", "login");
  assert.equal(result.success, false);
  assert.deepEqual(result.errorCodes, ["action-mismatch"]);
});

test("captcha rejects missing tokens without contacting Turnstile", async () => {
  let requests = 0;
  const captcha = createCaptchaService({
    environment: {
      TURNSTILE_SITE_KEY: "public-site-key",
      TURNSTILE_SECRET_KEY: "private-secret-key",
    },
    fetchImpl: async () => { requests += 1; },
  });

  const result = await captcha.verify("");
  assert.equal(result.success, false);
  assert.equal(requests, 0);
});

test("captcha provider failures do not permit authentication", async () => {
  const captcha = createCaptchaService({
    environment: {
      TURNSTILE_SITE_KEY: "public-site-key",
      TURNSTILE_SECRET_KEY: "private-secret-key",
    },
    fetchImpl: async () => ({ ok: false }),
  });

  await assert.rejects(() => captcha.verify("response-token"), CaptchaVerificationError);
});

test("rate limiter uses a fixed window and reports retry timing", () => {
  let currentTime = 1000;
  const limiter = createRateLimiter({
    limit: 2,
    windowMs: 1000,
    now: () => currentTime,
  });

  assert.equal(limiter.consume("account").allowed, true);
  assert.equal(limiter.consume("account").allowed, true);
  assert.deepEqual(limiter.consume("account"), {
    allowed: false,
    retryAfterSeconds: 1,
  });

  currentTime = 2001;
  assert.equal(limiter.consume("account").allowed, true);
});
