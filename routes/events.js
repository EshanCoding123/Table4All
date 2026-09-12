const crypto = require("crypto");
const express = require("express");

const Event = require("../models/Event");
const User = require("../models/User");
const {
  STANDARD_ALLERGENS,
  CROSS_CONTACT_STATUSES,
  normalizeList,
  getEventFoodBlacklist,
  findBlacklistMatches,
  reviewMeal,
} = require("../lib/meal-review");
const { optimizeMenu } = require("../lib/menuOptimizer");
const { requireUser } = require("../middleware/auth");

const router = express.Router();

const CODE_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function cleanText(value, maximumLength = 1000) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maximumLength);
}

function generateEventCode() {
  let code = "";

  for (let index = 0; index < 6; index += 1) {
    const randomIndex = crypto.randomInt(CODE_CHARACTERS.length);
    code += CODE_CHARACTERS[randomIndex];
  }

  return code;
}

async function createUniqueEventCode() {
  let code;
  let eventAlreadyExists = true;

  while (eventAlreadyExists) {
    code = generateEventCode();
    eventAlreadyExists = await Event.exists({ code });
  }

  return code;
}

function findMembership(event, userId) {
  return event.members.find(
    (member) => member.user.toString() === userId.toString()
  );
}

function userIsHost(event, userId) {
  return event.host.toString() === userId.toString();
}

async function removeUserFromEventRoom(req, event, userId) {
  const io = req.app?.get?.("io");
  if (!io) return;

  try {
    const roomName = `event:${event._id}`;
    const sockets = await io.in(roomName).fetchSockets();

    await Promise.all(
      sockets
        .filter((socket) => socket.data.userId === userId.toString())
        .map(async (socket) => {
          socket.emit("membership:removed", { code: event.code });
          await socket.leave(roomName);
          socket.data.eventId = null;
          socket.data.eventCode = null;
          socket.data.roomName = null;
          socket.data.role = null;
        })
    );
  } catch (error) {
    console.error("Remove member from chat error:", error.name);
  }
}

function formatDish(dish) {
  return {
    id: dish._id,
    name: dish.name,
    description: dish.description,
    category: dish.category,
    ingredients: dish.ingredients,
    containsAllergens: dish.containsAllergens,
    mayContainAllergens: dish.mayContainAllergens,
    ingredientListComplete: dish.ingredientListComplete,
    preparationInformation: dish.preparationInformation,
    crossContactStatus: dish.crossContactStatus,
    isPublished: dish.isPublished,
    addedAt: dish.addedAt,
  };
}

function formatProfile(member) {
  return {
    allergies: normalizeList(member.allergies),
    otherAllergies: normalizeList(member.otherAllergies),
    crossContactConcern: member.crossContactConcern === true,
    note: member.note || "",
    profileComplete: member.profileComplete === true,
  };
}

function formatEvent(event, userId) {
  const membership = findMembership(event, userId);
  const isHost = userIsHost(event, userId);
  const foodBlacklist = getEventFoodBlacklist(event);

  const visibleDishes = event.dishes
    .filter((dish) => isHost || dish.isPublished)
    .map((dish) => ({
      ...formatDish(dish),
      blacklistMatches: findBlacklistMatches(dish, foodBlacklist),
      review: membership ? reviewMeal(dish, membership, foodBlacklist) : undefined,
    }));

  const formattedEvent = {
    id: event._id,
    code: event.code,
    name: event.name,
    description: event.description,
    eventType: event.eventType,
    eventDate: event.eventDate,
    status: event.status,
    role: membership?.role || null,
    foodBlacklist,
    currentMember: membership ? formatProfile(membership) : null,
    dishes: visibleDishes,
    members: event.members.map((member) => ({
      id: member.user,
      displayName: member.displayName,
      role: member.role,
      allergies: isHost ? member.allergies : undefined,
      otherAllergies: isHost ? member.otherAllergies : undefined,
      crossContactConcern: isHost ? member.crossContactConcern : undefined,
      note: isHost ? member.note : undefined,
      profileComplete: member.profileComplete,
      joinedAt: member.joinedAt,
    })),
    createdAt: event.createdAt,
  };

  if (isHost) {
    formattedEvent.blockedEmails = event.blockedEmails || [];
  }

  return formattedEvent;
}

/*
Create an event
POST /api/events
*/
router.post("/", requireUser, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.status(401).json({
        message: "Your account could not be found. Please sign in again.",
      });
    }

    const eventName = cleanText(
      req.body.eventName || req.body.name,
      120
    );

    const description = cleanText(req.body.description, 2000);
    const eventType = cleanText(req.body.eventType, 80) || "Potluck";
    const eventDate = new Date(req.body.eventDate);

    if (!eventName || !req.body.eventDate) {
      return res.status(400).json({
        message: "Event name and date are required.",
      });
    }

    if (Number.isNaN(eventDate.getTime())) {
      return res.status(400).json({
        message: "Please enter a valid event date.",
      });
    }

    const code = await createUniqueEventCode();

    const event = await Event.create({
      code,
      name: eventName,
      description,
      eventType,
      eventDate,
      host: user._id,
      status: "open",
      foodBlacklist: normalizeList(req.body.foodBlacklist),
      blockedEmails: [],
      dishes: [],
      members: [
        {
          user: user._id,
          displayName: user.name,
          role: "host",
          allergies: [],
          otherAllergies: [],
          profileComplete: false,
        },
      ],
    });

    res.status(201).json({
      message: "Event created successfully.",
      event: formatEvent(event, user._id),
    });
  } catch (error) {
    console.error("Create event error:", error);

    res.status(500).json({
      message: "The event could not be created.",
    });
  }
});

/*
Get every event the signed-in user belongs to
GET /api/events/mine
*/
router.get("/mine", requireUser, async (req, res) => {
  try {
    const events = await Event.find({
      "members.user": req.session.userId,
    }).sort({ eventDate: 1 });

    res.json({
      events: events.map((event) =>
        formatEvent(event, req.session.userId)
      ),
    });
  } catch (error) {
    console.error("Load events error:", error);

    res.status(500).json({
      message: "Your events could not be loaded.",
    });
  }
});

/*
Join an event
POST /api/events/:code/join
*/
router.post("/:code/join", requireUser, async (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();

    const [event, user] = await Promise.all([
      Event.findOne({ code }),
      User.findById(req.session.userId),
    ]);

    if (!event) {
      return res.status(404).json({
        message: "No event was found with that code.",
      });
    }

    if (!user) {
      return res.status(401).json({
        message: "Your account could not be found. Please sign in again.",
      });
    }

    if (event.status !== "open") {
      return res.status(403).json({
        message: "This event is not currently accepting members.",
      });
    }

    const blockedEmails = (event.blockedEmails || []).map((email) =>
      email.toLowerCase()
    );

    if (blockedEmails.includes(user.email.toLowerCase())) {
      return res.status(403).json({
        message: "You are unable to join this event.",
      });
    }

    if (userIsHost(event, user._id)) {
      return res.status(409).json({
        message: "This email belongs to the event host. Sign out and use a different verified email to join as a member.",
      });
    }

    const existingMembership = findMembership(event, user._id);

    if (!existingMembership) {
      event.members.push({
        user: user._id,
        displayName: user.name,
        role: "member",
        allergies: [],
        otherAllergies: [],
        profileComplete: false,
      });

      await event.save();
    }

    res.json({
      message: existingMembership
        ? "You are already a member of this event."
        : "You joined the event.",
      event: formatEvent(event, user._id),
    });
  } catch (error) {
    console.error("Join event error:", error);

    res.status(500).json({
      message: "The event could not be joined.",
    });
  }
});

/*
Leave an event as the signed-in member
DELETE /api/events/:code/members/me
*/
router.delete("/:code/members/me", requireUser, async (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const event = await Event.findOne({ code });

    if (!event) {
      return res.status(404).json({ message: "Event not found." });
    }

    const membership = findMembership(event, req.session.userId);

    if (!membership) {
      return res.status(403).json({ message: "You are not a member of this event." });
    }

    if (membership.role === "host" || userIsHost(event, req.session.userId)) {
      return res.status(403).json({
        message: "The event host cannot leave their own event.",
      });
    }

    const memberIndex = event.members.indexOf(membership);
    event.members.splice(memberIndex, 1);
    await event.save();
    await removeUserFromEventRoom(req, event, req.session.userId);

    res.json({ message: "You left the event." });
  } catch (error) {
    console.error("Leave event error:", error.name);
    res.status(500).json({ message: "The event could not be left." });
  }
});

/*
Remove a member as the event host
DELETE /api/events/:code/members/:memberId
*/
router.delete("/:code/members/:memberId", requireUser, async (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const event = await Event.findOne({ code });

    if (!event) {
      return res.status(404).json({ message: "Event not found." });
    }

    if (!userIsHost(event, req.session.userId)) {
      return res.status(403).json({
        message: "Only the host can remove event members.",
      });
    }

    const membership = findMembership(event, req.params.memberId);

    if (!membership) {
      return res.status(404).json({ message: "Event member not found." });
    }

    if (membership.role === "host" || userIsHost(event, membership.user)) {
      return res.status(400).json({
        message: "The event host cannot be removed.",
      });
    }

    const memberIndex = event.members.indexOf(membership);
    event.members.splice(memberIndex, 1);
    await event.save();
    await removeUserFromEventRoom(req, event, membership.user);

    res.json({
      message: "Member removed from the event.",
      event: formatEvent(event, req.session.userId),
    });
  } catch (error) {
    console.error("Remove event member error:", error.name);
    res.status(500).json({ message: "The member could not be removed." });
  }
});

// Save only the signed-in member's profile. Never accept a target user ID.
router.patch("/:code/members/me", requireUser, async (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const event = await Event.findOne({ code });
    if (!event) {
      return res.status(404).json({ message: "Event not found." });
    }
    const membership = findMembership(event, req.session.userId);
    if (!membership || membership.role !== "member") {
      return res.status(403).json({ message: "Only a member of this event can edit their own profile." });
    }

    const allowedFields = ["allergies", "otherAllergies", "crossContactConcern", "note"];
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        !Object.keys(body).length || Object.keys(body).some((key) => !allowedFields.includes(key))) {
      return res.status(400).json({ message: "Submit only your allergy profile fields." });
    }
    if (!membership.profileComplete &&
        ["allergies", "otherAllergies", "crossContactConcern"].some((key) => !Object.hasOwn(body, key))) {
      return res.status(400).json({ message: "Complete the allergy and cross-contact fields before saving your profile." });
    }

    const updates = { "members.$.profileComplete": true };
    for (const field of ["allergies", "otherAllergies"]) {
      if (!Object.hasOwn(body, field)) continue;
      const value = body[field];
      const validList = Array.isArray(value)
        ? value.length <= 50 && value.every((item) => typeof item === "string" && item.length <= 100)
        : field === "otherAllergies" && typeof value === "string" && value.length <= 1000;
      if (!validList) {
        return res.status(400).json({ message: "Enter allergies as a list of names (up to 100 characters each)." });
      }
      const list = normalizeList(value);
      if (list.length > 50 || list.some((item) => item.length > 100) ||
          (field === "allergies" && list.some((item) => !STANDARD_ALLERGENS.includes(item)))) {
        return res.status(400).json({ message: "Choose the listed allergens and put additional allergies in Other allergies." });
      }
      updates[`members.$.${field}`] = list;
    }
    if (Object.hasOwn(body, "crossContactConcern")) {
      if (typeof body.crossContactConcern !== "boolean") {
        return res.status(400).json({ message: "Choose whether you are concerned about cross-contact." });
      }
      updates["members.$.crossContactConcern"] = body.crossContactConcern;
    }
    if (Object.hasOwn(body, "note")) {
      if (typeof body.note !== "string" || body.note.length > 500) {
        return res.status(400).json({ message: "Keep your note to the host within 500 characters." });
      }
      updates["members.$.note"] = body.note.trim();
    }

    const updatedEvent = await Event.findOneAndUpdate(
      { code, members: { $elemMatch: { user: req.session.userId, role: "member" } } },
      { $set: updates },
      { returnDocument: "after", runValidators: true }
    );
    if (!updatedEvent) {
      return res.status(403).json({ message: "Your membership could not be found." });
    }
    res.json({ message: "Allergy profile saved.", event: formatEvent(updatedEvent, req.session.userId) });
  } catch (error) {
    console.error("Save member profile error:", error.name);
    res.status(500).json({ message: "Your allergy profile could not be saved." });
  }
});

/*
Update event settings
PATCH /api/events/:code/settings
*/
router.patch("/:code/settings", requireUser, async (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const event = await Event.findOne({ code });

    if (!event) {
      return res.status(404).json({
        message: "Event not found.",
      });
    }

    if (!userIsHost(event, req.session.userId)) {
      return res.status(403).json({
        message: "Only the host can change event settings.",
      });
    }

    if (
      Object.hasOwn(req.body, "eventName") ||
      Object.hasOwn(req.body, "name")
    ) {
      const updatedName = cleanText(
        req.body.eventName || req.body.name,
        120
      );

      if (!updatedName) {
        return res.status(400).json({
          message: "The event name cannot be empty.",
        });
      }

      event.name = updatedName;
    }

    if (Object.hasOwn(req.body, "description")) {
      event.description = cleanText(req.body.description, 2000);
    }

    if (Object.hasOwn(req.body, "eventType")) {
      const updatedType = cleanText(req.body.eventType, 80);

      if (!updatedType) {
        return res.status(400).json({
          message: "The meal type cannot be empty.",
        });
      }

      event.eventType = updatedType;
    }

    if (Object.hasOwn(req.body, "eventDate")) {
      const updatedDate = new Date(req.body.eventDate);

      if (Number.isNaN(updatedDate.getTime())) {
        return res.status(400).json({
          message: "Please enter a valid event date.",
        });
      }

      event.eventDate = updatedDate;
    }

    if (Object.hasOwn(req.body, "foodBlacklist")) {
      event.foodBlacklist = normalizeList(req.body.foodBlacklist);
    }

    if (Object.hasOwn(req.body, "status")) {
      const allowedStatuses = ["draft", "open", "closed"];

      if (!allowedStatuses.includes(req.body.status)) {
        return res.status(400).json({
          message: "That event status is not valid.",
        });
      }

      event.status = req.body.status;
    }

    await event.save();

    res.json({
      message: "Event settings updated.",
      event: formatEvent(event, req.session.userId),
    });
  } catch (error) {
    console.error("Update event error:", error);

    res.status(500).json({
      message: "The event settings could not be updated.",
    });
  }
});

/*
Add a meal option
POST /api/events/:code/dishes
*/
router.post("/:code/dishes", requireUser, async (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const event = await Event.findOne({ code });

    if (!event) {
      return res.status(404).json({
        message: "Event not found.",
      });
    }

    if (!userIsHost(event, req.session.userId)) {
      return res.status(403).json({
        message: "Only the host can add meal options.",
      });
    }

    const dishName = cleanText(req.body.name, 120);

    if (Object.hasOwn(req.body, "crossContactStatus") &&
        !CROSS_CONTACT_STATUSES.includes(req.body.crossContactStatus)) {
      return res.status(400).json({ message: "Choose a valid cross-contact status." });
    }

    if (!dishName) {
      return res.status(400).json({
        message: "Enter a name for the meal option.",
      });
    }

    event.dishes.push({
      name: dishName,
      description: cleanText(req.body.description, 1000),
      category: cleanText(req.body.category, 80) || "Other",
      addedBy: req.session.userId,
      ingredients: normalizeList(req.body.ingredients),
      containsAllergens: normalizeList(req.body.containsAllergens),
      mayContainAllergens: normalizeList(
        req.body.mayContainAllergens
      ),
      ingredientListComplete:
        req.body.ingredientListComplete === true,
      preparationInformation: cleanText(
        req.body.preparationInformation,
        1000
      ),
      crossContactStatus: req.body.crossContactStatus || "unknown",
      isPublished: req.body.isPublished !== false,
    });

    await event.save();

    const newDish = event.dishes[event.dishes.length - 1];

    res.status(201).json({
      message: "Meal option added.",
      dish: formatDish(newDish),
      event: formatEvent(event, req.session.userId),
    });
  } catch (error) {
    console.error("Add dish error:", error);

    res.status(500).json({
      message: "The meal option could not be added.",
    });
  }
});

/*
Edit a meal option
PATCH /api/events/:code/dishes/:dishId
*/
router.patch(
  "/:code/dishes/:dishId",
  requireUser,
  async (req, res) => {
    try {
      const code = req.params.code.trim().toUpperCase();
      const event = await Event.findOne({ code });

      if (!event) {
        return res.status(404).json({
          message: "Event not found.",
        });
      }

      if (!userIsHost(event, req.session.userId)) {
        return res.status(403).json({
          message: "Only the host can edit meal options.",
        });
      }

      const dish = event.dishes.id(req.params.dishId);

      if (!dish) {
        return res.status(404).json({
          message: "Meal option not found.",
        });
      }

      if (Object.hasOwn(req.body, "name")) {
        const updatedName = cleanText(req.body.name, 120);

        if (!updatedName) {
          return res.status(400).json({
            message: "The meal name cannot be empty.",
          });
        }

        dish.name = updatedName;
      }

      if (Object.hasOwn(req.body, "description")) {
        dish.description = cleanText(req.body.description, 1000);
      }

      if (Object.hasOwn(req.body, "category")) {
        dish.category =
          cleanText(req.body.category, 80) || "Other";
      }

      if (Object.hasOwn(req.body, "ingredients")) {
        dish.ingredients = normalizeList(req.body.ingredients);
      }

      if (Object.hasOwn(req.body, "containsAllergens")) {
        dish.containsAllergens = normalizeList(
          req.body.containsAllergens
        );
      }

      if (Object.hasOwn(req.body, "mayContainAllergens")) {
        dish.mayContainAllergens = normalizeList(
          req.body.mayContainAllergens
        );
      }

      if (Object.hasOwn(req.body, "ingredientListComplete")) {
        dish.ingredientListComplete =
          req.body.ingredientListComplete === true;
      }

      if (Object.hasOwn(req.body, "preparationInformation")) {
        dish.preparationInformation = cleanText(
          req.body.preparationInformation,
          1000
        );
      }

      if (Object.hasOwn(req.body, "isPublished")) {
        dish.isPublished = req.body.isPublished === true;
      }

      if (Object.hasOwn(req.body, "crossContactStatus")) {
        if (!CROSS_CONTACT_STATUSES.includes(req.body.crossContactStatus)) {
          return res.status(400).json({ message: "Choose a valid cross-contact status." });
        }
        dish.crossContactStatus = req.body.crossContactStatus;
      }

      await event.save();

      res.json({
        message: "Meal option updated.",
        dish: formatDish(dish),
        event: formatEvent(event, req.session.userId),
      });
    } catch (error) {
      console.error("Update dish error:", error);

      res.status(500).json({
        message: "The meal option could not be updated.",
      });
    }
  }
);

/*
Delete a meal option
DELETE /api/events/:code/dishes/:dishId
*/
router.delete(
  "/:code/dishes/:dishId",
  requireUser,
  async (req, res) => {
    try {
      const code = req.params.code.trim().toUpperCase();
      const event = await Event.findOne({ code });

      if (!event) {
        return res.status(404).json({
          message: "Event not found.",
        });
      }

      if (!userIsHost(event, req.session.userId)) {
        return res.status(403).json({
          message: "Only the host can delete meal options.",
        });
      }

      const dish = event.dishes.id(req.params.dishId);

      if (!dish) {
        return res.status(404).json({
          message: "Meal option not found.",
        });
      }

      event.dishes.pull({ _id: dish._id });
      await event.save();

      res.json({
        message: "Meal option deleted.",
        event: formatEvent(event, req.session.userId),
      });
    } catch (error) {
      console.error("Delete dish error:", error);

      res.status(500).json({
        message: "The meal option could not be deleted.",
      });
    }
  }
);

// Always analyze the latest stored event, and never expose guest data to non-hosts.
router.get("/:code/optimization", requireUser, async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const code = req.params.code.trim().toUpperCase();
    const event = await Event.findOne({ code }).lean();
    if (!event) {
      return res.status(404).json({ message: "Event not found." });
    }
    if (!userIsHost(event, req.session.userId)) {
      return res.status(403).json({ message: "Only the host can view menu coverage analysis." });
    }
    res.json({ optimization: optimizeMenu(event) });
  } catch (error) {
    console.error("Menu optimization error:", error.name);
    res.status(500).json({ message: "Menu coverage could not be calculated. Please try again." });
  }
});

/*
Open one event
GET /api/events/:code
*/
router.get("/:code", requireUser, async (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const event = await Event.findOne({ code });

    if (!event) {
      return res.status(404).json({
        message: "Event not found.",
      });
    }

    const membership = findMembership(event, req.session.userId);

    if (!membership) {
      return res.status(403).json({
        message: "You are not a member of this event.",
      });
    }

    res.json({
      event: formatEvent(event, req.session.userId),
    });
  } catch (error) {
    console.error("Open event error:", error);

    res.status(500).json({
      message: "The event could not be loaded.",
    });
  }
});

module.exports = router;
