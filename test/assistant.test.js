const test = require("node:test");
const assert = require("node:assert/strict");
const User = require("../models/User");
const Event = require("../models/Event");
const {
  ASSISTANT_INSTRUCTIONS,
  AssistantResponseError,
  buildAssistantContext,
  createAssistantService,
} = require("../services/assistantService");
const { createAssistantRouter } = require("../routes/assistant");

const member = {
  user: "user-1", role: "member", displayName: "Member",
  allergies: ["peanuts"], otherAllergies: ["kiwi"],
  crossContactConcern: true, profileComplete: true,
};

function sampleEvent(role = "member") {
  return {
    _id: "event-1", code: "ABC234", host: "host-1", foodBlacklist: ["sesame"],
    members: [{ ...member, role }],
    dishes: [
      {
        name: "Published noodles", isPublished: true, ingredients: ["noodles", "peanuts"],
        containsAllergens: ["peanuts"], mayContainAllergens: [],
        ingredientListComplete: true, preparationInformation: "Shared kitchen",
        crossContactStatus: "possible",
      },
      {
        name: "Private host draft", isPublished: false, ingredients: ["private ingredient"],
        containsAllergens: [], mayContainAllergens: [], ingredientListComplete: true,
        crossContactStatus: "reported-separate",
      },
    ],
    privateHostNote: "do not send this",
  };
}

test("assistant context includes published meal facts and only the requesting profile", () => {
  const event = sampleEvent();
  event.members.push({
    user: "other-user", displayName: "Private Person", email: "private@example.test",
    allergies: ["milk"], otherAllergies: ["mustard"], note: "Private medical note",
  });
  const context = buildAssistantContext(event, member);
  const serialized = JSON.stringify(context);
  assert.equal(context.event.publishedMeals.length, 1);
  assert.equal(context.event.publishedMeals[0].name, "Published noodles");
  assert.equal(context.event.publishedMeals[0].deterministicResult.status, "HIGH RISK");
  assert.deepEqual(context.requestingMemberProfile.allergies, ["peanuts"]);
  assert.doesNotMatch(serialized, /Private host draft|private ingredient|Private Person|private@example|milk|mustard|medical note|do not send this/);
});

test("assistant uses the Responses API with bounded history and safety instructions", async () => {
  let request;
  const service = createAssistantService({
    client: { responses: { create: async (value) => { request = value; return { output_text: "Ask the host about the shared kitchen. Confirm ingredients and preparation directly with the host." }; } } },
    model: "test-model",
    environment: {},
  });
  const history = Array.from({ length: 12 }, (_, index) => ({
    role: index % 2 ? "assistant" : "user", text: `history-${index}`,
  }));
  const answer = await service.ask({ question: "Can I eat it?", event: sampleEvent(), membership: member, history });
  assert.match(answer, /Confirm ingredients/);
  assert.equal(request.model, "test-model");
  assert.equal(request.store, false);
  assert.deepEqual(request.reasoning, { effort: "minimal" });
  assert.equal(request.max_output_tokens, 700);
  assert.equal(request.input.length, 10);
  assert.doesNotMatch(JSON.stringify(request), /"history-[0-3]"/);
  assert.match(request.instructions, /Never claim or imply that a meal is safe/);
  assert.match(ASSISTANT_INSTRUCTIONS, /Never recommend eating a meal marked HIGH RISK/);
});

test("assistant rejects an unsafe model claim instead of showing it", async () => {
  const service = createAssistantService({
    client: { responses: { create: async () => ({ output_text: "This meal is definitely safe to eat." }) } },
    model: "test-model", environment: {},
  });
  await assert.rejects(
    service.ask({ question: "Is it safe?", event: sampleEvent(), membership: member }),
    AssistantResponseError
  );
});

test("assistant appends the direct-confirmation reminder when the model omits it", async () => {
  const service = createAssistantService({
    client: { responses: { create: async () => ({ output_text: "The meal has an incomplete ingredient list." }) } },
    model: "test-model", environment: {},
  });
  const answer = await service.ask({ question: "What is missing?", event: sampleEvent(), membership: member });
  assert.match(answer, /Confirm ingredients and preparation directly with the host\.$/);
});

function responseRecorder() {
  return {
    statusCode: 200, headers: {},
    status(code) { this.statusCode = code; return this; },
    set(name, value) { this.headers[name] = value; return this; },
    json(body) { this.body = body; return this; },
  };
}

function endpointHandlers(router, method) {
  const layer = router.stack.find((item) => item.route?.path === "/:code/assistant" && item.route.methods[method]);
  return layer.route.stack.map((item) => item.handle);
}

async function invoke(router, method, req) {
  const res = responseRecorder();
  const handlers = endpointHandlers(router, method);
  for (const handler of handlers) {
    let nextCalled = false;
    await handler(req, res, () => { nextCalled = true; });
    if (!nextCalled && handler !== handlers.at(-1)) return res;
  }
  return res;
}

function mockAuthorization(t, role = "member", includeMembership = true) {
  t.mock.method(User, "findById", async () => ({ _id: "user-1", emailVerified: true }));
  const event = sampleEvent(role);
  if (!includeMembership) event.members = [];
  t.mock.method(Event, "findOne", async () => event);
  return event;
}

class MemoryThread {
  static current = null;
  static async findOne() { return MemoryThread.current; }
  constructor(value) { Object.assign(this, value); }
  async save() { MemoryThread.current = this; }
}

test("assistant endpoint requires an authenticated session", async () => {
  const router = createAssistantRouter({
    service: { isConfigured: () => true, ask: async () => "answer" },
    ThreadModel: MemoryThread,
  });
  const res = await invoke(router, "post", { session: {}, params: { code: "ABC234" }, body: { question: "Question" } });
  assert.equal(res.statusCode, 401);
});

test("assistant endpoint rejects verified users who are not event members", async (t) => {
  mockAuthorization(t, "member", false);
  const router = createAssistantRouter({
    service: { isConfigured: () => true, ask: async () => "answer" },
    ThreadModel: MemoryThread,
  });
  const res = await invoke(router, "post", {
    session: { userId: "user-1" }, params: { code: "ABC234" }, body: { question: "Question" },
  });
  assert.equal(res.statusCode, 403);
});

test("assistant is available to members but not event hosts", async (t) => {
  mockAuthorization(t, "host");
  const router = createAssistantRouter({
    service: { isConfigured: () => true, ask: async () => "answer" },
    ThreadModel: MemoryThread,
  });
  const res = await invoke(router, "post", {
    session: { userId: "user-1" }, params: { code: "ABC234" }, body: { question: "Question" },
  });
  assert.equal(res.statusCode, 403);
});

test("assistant endpoint works with a mocked OpenAI Responses client and stores bounded history", async (t) => {
  MemoryThread.current = null;
  mockAuthorization(t);
  const service = createAssistantService({
    client: { responses: { create: async () => ({ output_text: "The known peanut label makes this High risk. Confirm ingredients and preparation directly with the host." }) } },
    model: "test-model", environment: {},
  });
  const router = createAssistantRouter({ service, ThreadModel: MemoryThread });
  const res = await invoke(router, "post", {
    session: { userId: "user-1" }, params: { code: "abc234" }, body: { question: "Why is this high risk?" },
  });
  assert.equal(res.statusCode, 200);
  assert.match(res.body.answer, /peanut/);
  assert.deepEqual(res.body.history.map((item) => item.role), ["user", "assistant"]);
  assert.equal(MemoryThread.current.event, "event-1");
  assert.equal(MemoryThread.current.user, "user-1");
});

test("assistant history lookup is scoped to the signed-in user and event", async (t) => {
  mockAuthorization(t);
  let query;
  const ThreadModel = {
    findOne(value) {
      query = value;
      return { lean: async () => ({ messages: [{ role: "assistant", text: "Your history" }] }) };
    },
  };
  const router = createAssistantRouter({
    service: { isConfigured: () => true }, ThreadModel,
  });
  const res = await invoke(router, "get", {
    session: { userId: "user-1" }, params: { code: "ABC234" }, body: {},
  });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(query, { event: "event-1", user: "user-1" });
  assert.equal(res.body.history[0].text, "Your history");
});

test("missing OpenAI configuration returns a clear 503 without disrupting authorization", async (t) => {
  MemoryThread.current = null;
  mockAuthorization(t);
  const router = createAssistantRouter({
    service: createAssistantService({ environment: {} }), ThreadModel: MemoryThread,
  });
  const res = await invoke(router, "post", {
    session: { userId: "user-1" }, params: { code: "ABC234" }, body: { question: "Question" },
  });
  assert.equal(res.statusCode, 503);
  assert.match(res.body.message, /not been configured/);
  assert.equal(MemoryThread.current, null);
});

test("assistant endpoint rejects overlong questions before calling OpenAI", async (t) => {
  mockAuthorization(t);
  let calls = 0;
  const router = createAssistantRouter({
    service: { isConfigured: () => true, ask: async () => { calls += 1; return "answer"; } },
    ThreadModel: MemoryThread,
  });
  const res = await invoke(router, "post", {
    session: { userId: "user-1" }, params: { code: "ABC234" }, body: { question: "x".repeat(501) },
  });
  assert.equal(res.statusCode, 400);
  assert.equal(calls, 0);
});

test("assistant endpoint rate limits the sixth request in a minute", async (t) => {
  MemoryThread.current = { messages: [], async save() {} };
  mockAuthorization(t);
  let calls = 0;
  const router = createAssistantRouter({
    service: { isConfigured: () => true, ask: async () => { calls += 1; return "answer"; } },
    ThreadModel: MemoryThread,
    now: () => 1_000_000,
  });
  let res;
  for (let index = 0; index < 6; index += 1) {
    res = await invoke(router, "post", {
      session: { userId: "user-1" }, params: { code: "ABC234" }, body: { question: `Question ${index}` },
    });
  }
  assert.equal(calls, 5);
  assert.equal(res.statusCode, 429);
  assert.equal(res.headers["Retry-After"], "60");
});
