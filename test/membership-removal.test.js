const test = require("node:test");
const assert = require("node:assert/strict");
const Event = require("../models/Event");
const router = require("../routes/events");

const leaveRoute = router.stack.find(
  (layer) => layer.route?.path === "/:code/members/me" && layer.route.methods.delete
).route;
const removeRoute = router.stack.find(
  (layer) => layer.route?.path === "/:code/members/:memberId" && layer.route.methods.delete
).route;

const [authenticateLeave, leaveEvent] = leaveRoute.stack.map((layer) => layer.handle);
const [authenticateRemove, removeMember] = removeRoute.stack.map((layer) => layer.handle);

function id(value) {
  return { toString: () => value };
}

function eventWithMembers() {
  return {
    _id: id("event-id"),
    code: "ABC234",
    name: "Community potluck",
    description: "",
    eventType: "potluck",
    eventDate: new Date("2030-01-01T12:00:00.000Z"),
    status: "open",
    host: id("host-id"),
    blockedEmails: [],
    foodBlacklist: [],
    dishes: [],
    members: [
      { _id: id("host-membership"), user: id("host-id"), displayName: "Host", role: "host", profileComplete: false },
      { _id: id("guest-membership"), user: id("guest-id"), displayName: "Guest", role: "member", profileComplete: true },
    ],
    createdAt: new Date("2029-01-01T12:00:00.000Z"),
    saved: false,
    async save() { this.saved = true; },
  };
}

async function request(routeMiddleware, routeHandler, userId, memberId) {
  const req = {
    session: userId ? { userId } : {},
    params: { code: " abc234 ", memberId },
  };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let allowed = false;
  routeMiddleware(req, res, () => { allowed = true; });
  if (allowed) await routeHandler(req, res);
  return res;
}

test("a signed-in member can leave only their own event membership", async (t) => {
  const event = eventWithMembers();
  t.mock.method(Event, "findOne", async () => event);

  const res = await request(authenticateLeave, leaveEvent, "guest-id");

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.message, "You left the event.");
  assert.equal(event.saved, true);
  assert.deepEqual(event.members.map((member) => member.role), ["host"]);
});

test("the host cannot leave their own event through the member route", async (t) => {
  const event = eventWithMembers();
  t.mock.method(Event, "findOne", async () => event);

  const res = await request(authenticateLeave, leaveEvent, "host-id");

  assert.equal(res.statusCode, 403);
  assert.equal(event.saved, false);
  assert.equal(event.members.length, 2);
});

test("only the host can remove another member", async (t) => {
  const event = eventWithMembers();
  t.mock.method(Event, "findOne", async () => event);

  const denied = await request(authenticateRemove, removeMember, "guest-id", "host-id");
  assert.equal(denied.statusCode, 403);
  assert.equal(event.members.length, 2);

  const allowed = await request(authenticateRemove, removeMember, "host-id", "guest-id");
  assert.equal(allowed.statusCode, 200);
  assert.equal(allowed.body.message, "Member removed from the event.");
  assert.equal(event.saved, true);
  assert.deepEqual(event.members.map((member) => member.role), ["host"]);
});

test("the host membership cannot be removed", async (t) => {
  const event = eventWithMembers();
  t.mock.method(Event, "findOne", async () => event);

  const res = await request(authenticateRemove, removeMember, "host-id", "host-id");

  assert.equal(res.statusCode, 400);
  assert.equal(event.saved, false);
  assert.equal(event.members.length, 2);
});

test("membership removal routes require a signed-in account", async (t) => {
  const find = t.mock.method(Event, "findOne", () => {
    throw new Error("should not query");
  });

  assert.equal((await request(authenticateLeave, leaveEvent)).statusCode, 401);
  assert.equal((await request(authenticateRemove, removeMember, undefined, "guest-id")).statusCode, 401);
  assert.equal(find.mock.callCount(), 0);
});
