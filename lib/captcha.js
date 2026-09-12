const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const CAPTCHA_TIMEOUT_MS = 5000;

class CaptchaConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "CaptchaConfigurationError";
  }
}

class CaptchaVerificationError extends Error {
  constructor(message) {
    super(message);
    this.name = "CaptchaVerificationError";
  }
}

function createCaptchaService(options = {}) {
  const environment = options.environment || process.env;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const siteKey = String(options.siteKey ?? environment.TURNSTILE_SITE_KEY ?? "").trim();
  const secretKey = String(options.secretKey ?? environment.TURNSTILE_SECRET_KEY ?? "").trim();
  const required = String(environment.CAPTCHA_REQUIRED || "").toLowerCase() === "true";
  const expectedHostname = String(environment.TURNSTILE_EXPECTED_HOSTNAME || "").trim();
  const configured = Boolean(siteKey && secretKey);
  const partiallyConfigured = Boolean(siteKey) !== Boolean(secretKey);

  async function verify(token, remoteIp, expectedAction) {
    if (!configured) {
      if (required || partiallyConfigured) {
        throw new CaptchaConfigurationError(
          "The security check is not configured correctly."
        );
      }

      return { success: true, skipped: true };
    }

    const responseToken = String(token || "").trim();
    if (!responseToken || responseToken.length > 2048) {
      return { success: false, errorCodes: ["missing-input-response"] };
    }

    const body = new URLSearchParams({
      secret: secretKey,
      response: responseToken,
    });
    if (remoteIp) body.set("remoteip", remoteIp);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CAPTCHA_TIMEOUT_MS);

    try {
      const response = await fetchImpl(TURNSTILE_VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new CaptchaVerificationError("The security check provider was unavailable.");
      }

      const result = await response.json();
      const actionMatches = !expectedAction || result.action === expectedAction;
      const hostnameMatches = !expectedHostname || result.hostname === expectedHostname;
      return {
        success: result.success === true && actionMatches && hostnameMatches,
        errorCodes: [
          ...(Array.isArray(result["error-codes"]) ? result["error-codes"] : []),
          ...(actionMatches ? [] : ["action-mismatch"]),
          ...(hostnameMatches ? [] : ["hostname-mismatch"]),
        ],
      };
    } catch (error) {
      if (error instanceof CaptchaVerificationError) throw error;
      throw new CaptchaVerificationError("The security check could not be verified.");
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    configured,
    required: required || partiallyConfigured,
    siteKey: configured ? siteKey : null,
    verify,
  };
}

module.exports = {
  CAPTCHA_TIMEOUT_MS,
  TURNSTILE_VERIFY_URL,
  CaptchaConfigurationError,
  CaptchaVerificationError,
  createCaptchaService,
};
