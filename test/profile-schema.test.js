const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Event = require("../models/Event");
const VerificationCode = require("../models/VerificationCode");
const { getEventFoodBlacklist } = require("../lib/meal-review");

test("membership profile and blacklist fields survive Mongoose strict mode", async () => {
  const user = new mongoose.Types.ObjectId();
  const event = new Event({
    code: "TESTAB", name: "Profile test", eventDate: new Date(), host: user,
    foodBlacklist: ["Sesame"],
    members: [{ user, displayName: "Member", role: "member", allergies: ["Milk"], otherAllergies: ["Kiwi"], crossContactConcern: true, note: " Please discuss preparation. ", profileComplete: true }],
  });
  await event.validate();
  const saved = event.toObject();
  assert.deepEqual(saved.foodBlacklist, ["sesame"]);
  assert.deepEqual(saved.members[0].allergies, ["milk"]);
  assert.deepEqual(saved.members[0].otherAllergies, ["kiwi"]);
  assert.equal(saved.members[0].crossContactConcern, true);
  assert.equal(saved.members[0].note, "Please discuss preparation.");
  assert.equal(saved.members[0].profileComplete, true);
});

test("old events retain their blacklist and unknown cross-contact defaults", () => {
  const user = new mongoose.Types.ObjectId();
  const event = Event.hydrate({
    host: user, foodAllergenBlacklist: ["milk"], ingredientBlacklist: ["sesame"],
    dishes: [{ name: "Old meal", addedBy: user }],
  });
  assert.deepEqual(getEventFoodBlacklist(event), ["milk", "sesame"]);
  assert.equal(event.dishes[0].crossContactStatus, "unknown");
});

test("join verification accepts and retains the event code", async () => {
  const verification = new VerificationCode({
    email: "schema-check@example.invalid", name: "Member", intent: "join",
    eventCode: "testab", codeHash: "test-only", expiresAt: new Date(Date.now() + 600000),
  });
  await verification.validate();
  assert.equal(verification.toObject().eventCode, "TESTAB");
  verification.eventCode = null;
  await assert.rejects(verification.validate(), /eventCode/);
});
