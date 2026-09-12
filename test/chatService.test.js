const test = require("node:test");
const assert = require("node:assert/strict");
const { createChatService } = require("../services/chatService");

class FakeIO {
  constructor() {
    this.middleware = null;
    this.connectionHandler = null;
    this.broadcasts = [];
  }
  use(handler) { this.middleware = handler; }
  on(name, handler) { if (name === "connection") this.connectionHandler = handler; }
  to(room) {
    return { emit: (name, payload) => this.broadcasts.push({ room, name, payload }) };
  }
}

class FakeSocket {
  constructor(userId) {
    this.request = { session: userId ? { userId } : {} };
    this.data = {};
    this.handlers = {};
    this.joined = [];
  }
  on(name, handler) { this.handlers[name] = handler; }
  async join(room) { this.joined.push(room); }
  async leave(room) { this.joined = this.joined.filter((item) => item !== room); }
}

function eventFor(role = "member", userId = "user-1") {
  return {
    _id: "event-1",
    code: "ABC234",
    host: role === "host" ? userId : "host-1",
    members: [{ user: userId, role, displayName: role === "host" ? "Host" : "Member" }],
  };
}

function findQuery(messages = []) {
  return {
    sort() { return this; },
    limit() { return this; },
    async lean() { return messages; },
  };
}

async function connect(io, socket) {
  let error;
  await io.middleware(socket, (value) => { error = value; });
  if (!error) io.connectionHandler(socket);
  return error;
}

function emit(socket, name, payload) {
  return new Promise((resolve) => socket.handlers[name](payload, resolve));
}

function setup(options = {}) {
  const io = new FakeIO();
  const event = options.event || eventFor();
  const messages = options.messages || [];
  const created = [];
  const MessageModel = options.MessageModel || {
    find: () => findQuery(messages),
    create: async (value) => {
      const message = { _id: `message-${created.length + 1}`, createdAt: new Date("2030-01-01T00:00:00Z"), ...value };
      created.push(message);
      return message;
    },
    findById: async () => null,
  };
  createChatService(io, {
    UserModel: options.UserModel || { findById: async (id) => ({ _id: id, emailVerified: true }) },
    EventModel: options.EventModel || {
      findOne: async ({ code }) => code === event.code ? event : null,
      findById: async () => event,
    },
    MessageModel,
    now: options.now,
  });
  return { io, event, MessageModel, created };
}

test("socket authentication rejects users without a verified session", async () => {
  const { io } = setup();
  const noSession = await connect(io, new FakeSocket());
  assert.match(noSession.message, /confirm your email/i);

  const unverifiedSetup = setup({ UserModel: { findById: async (id) => ({ _id: id, emailVerified: false }) } });
  const unverified = await connect(unverifiedSetup.io, new FakeSocket("user-1"));
  assert.match(unverified.message, /verified session/i);
});

test("a verified nonmember cannot enter an event room", async () => {
  const { io } = setup({ event: eventFor("member", "different-user") });
  const socket = new FakeSocket("user-1");
  assert.equal(await connect(io, socket), undefined);
  const result = await emit(socket, "room:join", { code: "ABC234", role: "host", senderName: "Fake" });
  assert.equal(result.ok, false);
  assert.match(result.message, /do not have access/);
  assert.deepEqual(socket.joined, []);
});

test("joining loads only the latest persisted messages and exposes no email", async () => {
  const messages = [{
    _id: "message-1", sender: "user-1", senderDisplayName: "Member",
    body: "Hello", createdAt: new Date("2030-01-01T00:00:00Z"),
  }];
  const { io } = setup({ messages });
  const socket = new FakeSocket("user-1");
  await connect(io, socket);
  const result = await emit(socket, "room:join", { code: "abc234" });
  assert.equal(result.ok, true);
  assert.equal(result.messages[0].body, "Hello");
  assert.doesNotMatch(JSON.stringify(result), /email/i);
  assert.deepEqual(socket.joined, ["event:event-1"]);
});

test("a message is trimmed, persisted, and then broadcast with server identity and timestamp", async () => {
  const { io, created } = setup();
  const socket = new FakeSocket("user-1");
  await connect(io, socket);
  await emit(socket, "room:join", { code: "ABC234" });
  const result = await emit(socket, "message:send", {
    body: "  Hello room  ", senderName: "Impostor", senderId: "other-user", eventId: "other-event",
  });
  assert.equal(result.ok, true);
  assert.equal(created[0].body, "Hello room");
  assert.equal(created[0].sender, "user-1");
  assert.equal(created[0].senderDisplayName, "Member");
  assert.equal(io.broadcasts[0].name, "message:new");
  assert.equal(io.broadcasts[0].payload.body, "Hello room");
  assert.equal(io.broadcasts[0].payload.senderName, "Member");
});

test("chat rejects empty and overlong messages", async () => {
  const { io, created } = setup();
  const socket = new FakeSocket("user-1");
  await connect(io, socket);
  await emit(socket, "room:join", { code: "ABC234" });
  assert.equal((await emit(socket, "message:send", { body: "   " })).ok, false);
  assert.equal((await emit(socket, "message:send", { body: "x".repeat(1001) })).ok, false);
  assert.equal(created.length, 0);
});

test("per-user event rate limiting allows five messages and rejects the sixth", async () => {
  const { io, created } = setup({ now: () => 1_000_000 });
  const socket = new FakeSocket("user-1");
  await connect(io, socket);
  await emit(socket, "room:join", { code: "ABC234" });
  let result;
  for (let index = 0; index < 6; index += 1) {
    result = await emit(socket, "message:send", { body: `Message ${index}` });
  }
  assert.equal(created.length, 5);
  assert.equal(result.ok, false);
  assert.match(result.message, /too quickly/);
});

test("members may delete their own messages but cannot delete another member's", async () => {
  const event = eventFor();
  const own = {
    _id: "own-message", event: event._id, sender: "user-1", deleted: false,
    async save() { this.saved = true; },
  };
  const other = {
    _id: "other-message", event: event._id, sender: "user-2", deleted: false,
    async save() { this.saved = true; },
  };
  const byId = { "own-message": own, "other-message": other };
  const MessageModel = {
    find: () => findQuery(), create: async () => {},
    findById: async (id) => byId[id],
  };
  const { io } = setup({ event, MessageModel, now: () => 1_000_000 });
  const socket = new FakeSocket("user-1");
  await connect(io, socket);
  await emit(socket, "room:join", { code: event.code });
  assert.equal((await emit(socket, "message:delete", { messageId: "other-message" })).ok, false);
  assert.equal(other.deleted, false);
  assert.equal((await emit(socket, "message:delete", { messageId: "own-message" })).ok, true);
  assert.equal(own.deleted, true);
  assert.equal(own.saved, true);
  assert.equal(io.broadcasts.at(-1).name, "message:deleted");
});

test("an event host may delete another member's message from the same event", async () => {
  const event = eventFor("host");
  const message = {
    _id: "message-1", event: event._id, sender: "member-2", deleted: false,
    async save() { this.saved = true; },
  };
  const { io } = setup({
    event,
    MessageModel: {
      find: () => findQuery(), create: async () => {}, findById: async () => message,
    },
  });
  const socket = new FakeSocket("user-1");
  await connect(io, socket);
  await emit(socket, "room:join", { code: event.code });
  assert.equal((await emit(socket, "message:delete", { messageId: "message-1" })).ok, true);
  assert.equal(message.deleted, true);
  assert.equal(message.saved, true);
});
