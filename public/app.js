const createEventForm = document.querySelector("#create-event-form");
const joinEventForm = document.querySelector("#join-event-form");
const demoEventButton = document.querySelector("#demo-event-button");
const eventCodeInput = document.querySelector("#event-code");
const eventDateInput = document.querySelector("#event-date");
const formMessage = document.querySelector("#form-message");

function formatInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function setDefaultDate() {
  const today = new Date();
  const oneWeekFromNow = new Date();

  oneWeekFromNow.setDate(today.getDate() + 7);

  eventDateInput.min = formatInputDate(today);

  if (!eventDateInput.value) {
    eventDateInput.value = formatInputDate(oneWeekFromNow);
  }
}

function showError(message) {
  formMessage.textContent = message;
  formMessage.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
}

function clearError() {
  formMessage.textContent = "";
}

function setButtonLoading(button, isLoading, loadingText) {
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText;
    button.disabled = false;
  }
}

async function sendRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }

  return data;
}

function saveCurrentSession(event, participantId) {
  const session = {
    eventCode: event.code,
    participantId,
  };

  sessionStorage.setItem(
    "tableForAllSession",
    JSON.stringify(session)
  );
}

function showEventCard(event, headingText, shouldFocus = true) {
  let card = document.querySelector("#current-event");

  if (!card) {
    card = document.createElement("section");
    card.id = "current-event";
    card.className = "form-card";
    card.tabIndex = -1;

    formMessage.insertAdjacentElement("afterend", card);
  }

  card.replaceChildren();

  const heading = document.createElement("h2");
  heading.textContent = headingText;

  const name = document.createElement("h3");
  name.textContent = event.name;

  const date = document.createElement("p");
  date.textContent = new Date(event.eventDate).toLocaleDateString(
    undefined,
    {
      timeZone: "UTC",
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );

  const codeLabel = document.createElement("p");
  codeLabel.textContent = "Event code";

  const code = document.createElement("h3");
  code.textContent = event.code;

  const participantCount = document.createElement("p");
  const totalParticipants = event.participants.length;

  participantCount.textContent = `${totalParticipants} ${
    totalParticipants === 1 ? "person" : "people"
  } currently joined.`;


  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "secondary-button";
  copyButton.textContent = "Copy event code";

  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(event.code);
      copyButton.textContent = "Code copied";
    } catch {
      copyButton.textContent = `Code: ${event.code}`;
    }
  });

  card.append(
    heading,
    name,
    date,
    codeLabel,
    code,
    participantCount,
    copyButton
  );

  if (shouldFocus) {
    card.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    card.focus();
  }
}

createEventForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();

  const submitButton = createEventForm.querySelector(
    'button[type="submit"]'
  );

  const formData = new FormData(createEventForm);

  const eventInformation = {
    eventName: formData.get("eventName"),
    hostName: formData.get("hostName"),
    eventType: formData.get("eventType"),
    eventDate: formData.get("eventDate"),
  };

  setButtonLoading(submitButton, true, "Creating event...");

  try {
    const data = await sendRequest("/api/events", {
      method: "POST",
      body: JSON.stringify(eventInformation),
    });

    const hostParticipant = data.event.participants[0];

    saveCurrentSession(
      data.event,
      hostParticipant ? hostParticipant.id : null
    );

    showEventCard(data.event, "Event created");

    createEventForm.reset();
    setDefaultDate();
  } catch (error) {
    showError(error.message);
  } finally {
    setButtonLoading(submitButton, false);
  }
});

joinEventForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();

  const submitButton = joinEventForm.querySelector(
    'button[type="submit"]'
  );

  const formData = new FormData(joinEventForm);
  const guestName = formData.get("guestName");
  const eventCode = formData
    .get("eventCode")
    .trim()
    .toUpperCase();

  setButtonLoading(submitButton, true, "Joining event...");

  try {
    const data = await sendRequest(
      `/api/events/${eventCode}/join`,
      {
        method: "POST",
        body: JSON.stringify({ guestName }),
      }
    );

    saveCurrentSession(data.event, data.participantId);
    showEventCard(data.event, "You joined the event");

    joinEventForm.reset();
  } catch (error) {
    showError(error.message);
  } finally {
    setButtonLoading(submitButton, false);
  }
});

eventCodeInput.addEventListener("input", () => {
  eventCodeInput.value = eventCodeInput.value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
});

demoEventButton.addEventListener("click", () => {
  document.querySelector("#event-name").value =
    "Community Potluck";

  document.querySelector("#host-name").value = "Demo Host";
  document.querySelector("#event-type").value = "potluck";

  createEventForm.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });

  document.querySelector("#event-name").focus();
});

async function restoreCurrentEvent() {
  const savedSession = sessionStorage.getItem(
    "tableForAllSession"
  );

  if (!savedSession) {
    return;
  }

  try {
    const session = JSON.parse(savedSession);

    if (!session.eventCode) {
      return;
    }

    const data = await sendRequest(
      `/api/events/${session.eventCode}`
    );

    showEventCard(data.event, "Current event", false);
  } catch {
    sessionStorage.removeItem("tableForAllSession");
  }
}

setDefaultDate();
restoreCurrentEvent();