const test = require("node:test");
const assert = require("node:assert/strict");
const Event = require("../models/Event");
const router = require("../routes/events");

const route = router.stack.find((layer) => layer.route?.path === "/:code/optimization").route;
const [authenticate, analyze] = route.stack.map((layer) => layer.handle);

async function request(userId) {
  const req = { session: userId ? { userId } : {}, params: { code: " testab " } };
  const res = {
    statusCode: 200, headers: {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    set(key, value) { this.headers[key] = value; return this; },
  };
  let allowed = false;
  authenticate(req, res, () => { allowed = true; });
  if (allowed) await analyze(req, res);
  return res;
}

test("optimization rejects unauthenticated requests before reading MongoDB", async (t) => {
  const find = t.mock.method(Event, "findOne", () => { throw new Error("Should not read"); });
  assert.equal((await request()).statusCode, 401);
  assert.equal(find.mock.callCount(), 0);
});

test("optimization rejects a signed-in non-host member", async (t) => {
  t.mock.method(Event, "findOne", () => ({ lean: async () => ({ host: "host-id", members: [{ user: "member-id", role: "member" }] }) }));
  const res = await request("member-id");
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.optimization, undefined);
});

test("optimization allows only the actual host and reads the current event without caching", async (t) => {
  const find = t.mock.method(Event, "findOne", () => ({ lean: async () => ({ host: "host-id", members: [], dishes: [] }) }));
  const res = await request("host-id");
  assert.equal(res.statusCode, 200);
  assert.deepEqual(find.mock.calls[0].arguments, [{ code: "TESTAB" }]);
  assert.equal(res.headers["Cache-Control"], "no-store");
  assert.equal(res.body.optimization.profiledMembers, 0);
});

test("optimization returns a JSON not-found result for missing events", async (t) => {
  t.mock.method(Event, "findOne", () => ({ lean: async () => null }));
  assert.equal((await request("host-id")).statusCode, 404);
});

test("optimization database failures return a retryable message without leaking details", async (t) => {
  t.mock.method(Event, "findOne", () => ({ lean: async () => { throw new Error("private connection details"); } }));
  t.mock.method(console, "error", () => {});
  const res = await request("host-id");
  assert.equal(res.statusCode, 500);
  assert.match(res.body.message, /try again/);
  assert.doesNotMatch(JSON.stringify(res.body), /private connection/);
});
