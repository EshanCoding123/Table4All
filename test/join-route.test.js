const test = require("node:test");
const assert = require("node:assert/strict");
const Event = require("../models/Event");
const User = require("../models/User");
const router = require("../routes/events");

const route = router.stack.find((layer) => layer.route?.path === "/:code/join").route;
const [authenticate, joinEvent] = route.stack.map((layer) => layer.handle);

function id(value) {
  return { toString: () => value };
}

function eventFor(hostId, members = []) {
  return {
    _id: id("event-id"),
    code: "ABC234",
    name: "Community potluck",
    description: "",
    eventType: "potluck",
    eventDate: new Date("2030-01-01T12:00:00.000Z"),
    status: "open",
    host: id(hostId),
    blockedEmails: [],
    dishes: [],
    members,
    createdAt: new Date("2029-01-01T12:00:00.000Z"),
    async save() {},
  };
}

async function request(userId) {
  const req = { session: { userId }, params: { code: " abc234 " }, body: {} };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let allowed = false;
  authenticate(req, res, () => { allowed = true; });
  if (allowed) await joinEvent(req, res);
  return res;
}

test("the event host cannot rejoin their own event as a member", async (t) => {
  const hostId = "host-id";
  const event = eventFor(hostId, [
    { user: id(hostId), displayName: "Host", role: "host", profileComplete: false },
  ]);
  t.mock.method(Event, "findOne", async () => event);
  t.mock.method(User, "findById", async () => ({ _id: id(hostId), name: "Host", email: "host@example.test" }));

  const res = await request(hostId);

  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /different verified email/i);
  assert.equal(event.members.length, 1);
});

test("a distinct verified user joins with the member role", async (t) => {
  const event = eventFor("host-id", [
    { user: id("host-id"), displayName: "Host", role: "host", profileComplete: false },
  ]);
  t.mock.method(Event, "findOne", async () => event);
  t.mock.method(User, "findById", async () => ({
    _id: id("guest-id"), name: "Guest", email: "guest@example.test",
  }));

  const res = await request("guest-id");

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.event.role, "member");
  assert.equal(res.body.event.currentMember.profileComplete, false);
  assert.equal(event.members.at(-1).role, "member");
});
