const express = require("express");
const Event = require("../models/Event");

const router = express.Router();

const CODE_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateEventCode() {
  let code = "";

  for (let i = 0; i < 6; i += 1) {
    const randomIndex = Math.floor(
      Math.random() * CODE_CHARACTERS.length
    );

    code += CODE_CHARACTERS[randomIndex];
  }

  return code;
}

async function createUniqueEventCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateEventCode();
    const existingEvent = await Event.exists({ code });

    if (!existingEvent) {
      return code;
    }
  }

  throw new Error("Unable to generate a unique event code.");
}

function formatEvent(event) {
  return {
    id: event._id,
    code: event.code,
    name: event.name,
    eventType: event.eventType,
    eventDate: event.eventDate,
    hostName: event.hostName,

    participants: event.participants.map((participant) => ({
      id: participant._id,
      name: participant.name,
      profileComplete: participant.profileComplete,
    })),

    dishes: event.dishes,

    createdAt: event.createdAt,
  };
}

// Create an event.
router.post("/", async (req, res) => {
  try {
    const {
      eventName,
      hostName,
      eventType = "potluck",
      eventDate,
    } = req.body;

    if (!eventName?.trim() || !hostName?.trim() || !eventDate) {
      return res.status(400).json({
        message: "Event name, host name, and date are required.",
      });
    }

    const parsedDate = new Date(`${eventDate}T12:00:00.000Z`);

    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        message: "Please provide a valid event date.",
      });
    }

    const code = await createUniqueEventCode();

    const event = await Event.create({
      code,
      name: eventName.trim(),
      hostName: hostName.trim(),
      eventType,
      eventDate: parsedDate,

      participants: [
        {
          name: hostName.trim(),
          allergies: [],
          otherAllergies: [],
          profileComplete: false,
        },
      ],
    });

    return res.status(201).json({
      message: "Event created.",
      event: formatEvent(event),
    });
  } catch (error) {
    console.error("Create event error:", error.message);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Some of the event information is invalid.",
      });
    }

    return res.status(500).json({
      message: "The event could not be created.",
    });
  }
});

// Get an event using its six-character code.
router.get("/:code", async (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const event = await Event.findOne({ code });

    if (!event) {
      return res.status(404).json({
        message: "No event was found with that code.",
      });
    }

    return res.json({
      event: formatEvent(event),
    });
  } catch (error) {
    console.error("Find event error:", error.message);

    return res.status(500).json({
      message: "The event could not be loaded.",
    });
  }
});

// Join an existing event.
router.post("/:code/join", async (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const guestName = req.body.guestName?.trim();

    if (!guestName) {
      return res.status(400).json({
        message: "Your name is required.",
      });
    }

    const event = await Event.findOne({ code });

    if (!event) {
      return res.status(404).json({
        message: "No event was found with that code.",
      });
    }

    const nameAlreadyExists = event.participants.some(
      (participant) =>
        participant.name.toLowerCase() === guestName.toLowerCase()
    );

    if (nameAlreadyExists) {
      return res.status(409).json({
        message:
          "That name is already being used for this event. Please enter a different name.",
      });
    }

    event.participants.push({
      name: guestName,
      allergies: [],
      otherAllergies: [],
      profileComplete: false,
    });

    await event.save();

    const newParticipant =
      event.participants[event.participants.length - 1];

    return res.status(201).json({
      message: "You joined the event.",
      participantId: newParticipant._id,
      event: formatEvent(event),
    });
  } catch (error) {
    console.error("Join event error:", error.message);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "The participant information is invalid.",
      });
    }

    return res.status(500).json({
      message: "The event could not be joined.",
    });
  }
});

module.exports = router;