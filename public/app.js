const appMessage = document.querySelector("#app-message");
const homeButton = document.querySelector("#home-button");
const signOutButton = document.querySelector("#sign-out-button");

const chooseHostButton = document.querySelector(
  "#choose-host-button"
);

const chooseMemberButton = document.querySelector(
  "#choose-member-button"
);

const hostLoginForm = document.querySelector("#host-login-form");
const memberLoginForm = document.querySelector(
  "#member-login-form"
);

const verificationForm = document.querySelector(
  "#verification-form"
);

const resendCodeButton = document.querySelector(
  "#resend-code-button"
);
const resendCodeStatus = document.querySelector("#resend-code-status");

const newEventForm = document.querySelector("#new-event-form");
const verificationInput = document.querySelector(
  "#verification-code"
);

const verificationInstructions = document.querySelector(
  "#verification-instructions"
);

const memberCodeInput = document.querySelector("#member-code");
const eventDateInput = document.querySelector("#event-date");

const hostEventHeading = document.querySelector(
  "#host-event-heading"
);

const hostEventSummary = document.querySelector(
  "#host-event-summary"
);

const hostEventCode = document.querySelector(
  "#host-event-code"
);

const copyEventCodeButton = document.querySelector(
  "#copy-event-code-button"
);

const hostPortalMessage = document.querySelector(
  "#host-portal-message"
);

const hostEventSettingsForm = document.querySelector(
  "#host-event-settings-form"
);

const mealOptionForm = document.querySelector(
  "#meal-option-form"
);

const hostMealOptionsList = document.querySelector(
  "#host-meal-options-list"
);

const hostMembersList = document.querySelector(
  "#host-members-list"
);

const hostMemberCount = document.querySelector(
  "#host-member-count"
);

const memberProfileForm = document.querySelector("#member-profile-form");
const memberProfileSummary = document.querySelector("#member-profile-summary");
const memberMealsPanel = document.querySelector("#member-meals-panel");
const memberMealOptionsList = document.querySelector("#member-meal-options-list");
const memberPortalMessage = document.querySelector("#member-portal-message");
const editMemberProfileButton = document.querySelector("#edit-member-profile-button");
const cancelMemberProfileButton = document.querySelector("#cancel-member-profile-button");
const refreshMemberMealsButton = document.querySelector("#refresh-member-meals-button");
const refreshMenuAnalysisButton = document.querySelector("#refresh-menu-analysis-button");
const menuCoverageResults = document.querySelector("#menu-coverage-results");
const menuCoverageMessage = document.querySelector("#menu-coverage-message");
const menuOptimizationSuggestions = document.querySelector("#menu-optimization-suggestions");
const assistantStatus = document.querySelector("#assistant-status");
const assistantHistory = document.querySelector("#assistant-history");
const assistantForm = document.querySelector("#assistant-form");
const assistantQuestion = document.querySelector("#assistant-question");
const assistantSuggestions = document.querySelectorAll(".assistant-suggestion");

const chatElements = {
  host: {
    status: document.querySelector("#host-chat-status"),
    messages: document.querySelector("#host-chat-messages"),
    live: document.querySelector("#host-chat-live"),
    form: document.querySelector("#host-chat-form"),
    input: document.querySelector("#host-chat-input"),
  },
  member: {
    status: document.querySelector("#member-chat-status"),
    messages: document.querySelector("#member-chat-messages"),
    live: document.querySelector("#member-chat-live"),
    form: document.querySelector("#member-chat-form"),
    input: document.querySelector("#member-chat-input"),
  },
};

let activeEvent = null;
let menuAnalysisRequest = 0;
let menuAnalysisPending = false;
let menuAnalysisEventCode = null;
let resendAvailableAt = 0;
let resendCountdownTimer = null;
let assistantRequest = 0;
let assistantConfigured = false;
let chatContext = null;
let chatMessages = [];
let chatCurrentUserId = null;
const roomSocket = typeof window.io === "function"
  ? window.io({ autoConnect: false })
  : null;

let pendingAuthentication = loadPendingAuthentication();

function showView(viewId) {
  document.querySelectorAll(".app-view").forEach((view) => {
    view.classList.add("hidden");
  });

  const selectedView = document.querySelector(`#${viewId}`);

  if (selectedView) {
    selectedView.classList.remove("hidden");

    const heading = selectedView.querySelector("h1");

    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus();
    }
  }

  clearMessage();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showMessage(message, type = "error") {
  const label = type === "success" ? "Success" : "Error";

  appMessage.textContent = `${label}: ${message}`;
  appMessage.style.color =
    type === "success" ? "var(--safe)" : "var(--danger)";
}

function clearMessage() {
  appMessage.textContent = "";
}

function showHostMessage(message, type = "success") {
  const label = type === "success" ? "Success" : "Error";

  hostPortalMessage.hidden = false;
  hostPortalMessage.textContent = `${label}: ${message}`;

  hostPortalMessage.style.color =
    type === "success"
      ? "var(--safe)"
      : "var(--danger)";
}

function setButtonLoading(button, loading, loadingText) {
  if (loading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
  } else {
    button.textContent =
      button.dataset.originalText || button.textContent;

    button.disabled = false;
  }
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,

    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error(
      "The server returned an unexpected response. Make sure you opened http://localhost:3000 and restarted the server."
    );
  }

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.message || "Something went wrong.");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function savePendingAuthentication(authentication) {
  pendingAuthentication = authentication;

  sessionStorage.setItem(
    "tableForAllPendingAuthentication",
    JSON.stringify(authentication)
  );
}

function loadPendingAuthentication() {
  const storedAuthentication = sessionStorage.getItem(
    "tableForAllPendingAuthentication"
  );

  if (!storedAuthentication) {
    return null;
  }

  try {
    return JSON.parse(storedAuthentication);
  } catch {
    sessionStorage.removeItem(
      "tableForAllPendingAuthentication"
    );

    return null;
  }
}

function saveCurrentEvent(eventCode, role) {
  sessionStorage.setItem(
    "tableForAllCurrentEvent",
    JSON.stringify({
      eventCode,
      role,
    })
  );
}

async function restoreCurrentEvent() {
  const storedEvent = sessionStorage.getItem(
    "tableForAllCurrentEvent"
  );

  if (!storedEvent) {
    return;
  }

  let currentEvent;

  try {
    currentEvent = JSON.parse(storedEvent);
  } catch {
    sessionStorage.removeItem("tableForAllCurrentEvent");
    return;
  }

  if (!/^[A-Z0-9]{6}$/.test(currentEvent?.eventCode || "")) {
    sessionStorage.removeItem("tableForAllCurrentEvent");
    return;
  }

  try {
    const data = await apiRequest(
      `/api/events/${currentEvent.eventCode}`
    );

    if (
      sessionStorage.getItem("tableForAllCurrentEvent") !== storedEvent
    ) {
      return;
    }

    if (data.event.role === "host") {
      showHostPortal(data.event);
    } else {
      showMemberPortal(data.event);
    }
  } catch (error) {
    showMessage(error.message);
  }
}

function splitCommaSeparatedList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function formatInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function setDefaultEventDate() {
  const today = new Date();
  const oneWeekFromNow = new Date();

  oneWeekFromNow.setDate(today.getDate() + 7);

  eventDateInput.min = formatInputDate(today);

  if (!eventDateInput.value) {
    eventDateInput.value = formatInputDate(oneWeekFromNow);
  }
}

async function requestVerification(authentication) {
  let data;

  try {
    data = await apiRequest("/api/auth/request-code", {
      method: "POST",
      body: JSON.stringify(authentication),
    });
  } catch (error) {
    if (error.status === 429 && error.data?.retryAfterSeconds) {
      startResendCooldown(error.data.retryAfterSeconds);
    }
    throw error;
  }

  savePendingAuthentication(authentication);
  showView("verification-view");
  verificationInstructions.textContent =
    "Check your email for the six-digit confirmation code. It expires in 10 minutes.";
  startResendCooldown(data.cooldownSeconds || 60);

  showMessage(data.message, "success");
}

function updateResendCooldown() {
  const secondsRemaining = Math.max(
    0,
    Math.ceil((resendAvailableAt - Date.now()) / 1000)
  );

  resendCodeButton.disabled = secondsRemaining > 0;
  resendCodeButton.textContent = secondsRemaining > 0
    ? `Send another code in ${secondsRemaining}s`
    : "Send another code";
  resendCodeStatus.textContent = secondsRemaining > 0
    ? `You can request another code in ${secondsRemaining} seconds.`
    : "You can request another code now.";

  if (secondsRemaining === 0 && resendCountdownTimer) {
    window.clearInterval(resendCountdownTimer);
    resendCountdownTimer = null;
  }
}

function startResendCooldown(seconds) {
  resendAvailableAt = Date.now() + Math.max(1, Number(seconds) || 60) * 1000;
  if (resendCountdownTimer) window.clearInterval(resendCountdownTimer);
  updateResendCooldown();
  resendCountdownTimer = window.setInterval(updateResendCooldown, 1000);
  window.setTimeout(updateResendCooldown, 0);
}
function setSelectValue(selectElement, value) {
  const valueText = String(value || "").toLowerCase();

  const matchingOption = Array.from(
    selectElement.options
  ).find((option) => {
    return option.value.toLowerCase() === valueText;
  });

  if (matchingOption) {
    selectElement.value = matchingOption.value;
  }
}

function formatEventDate(dateValue) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function createInformationLine(label, value) {
  const paragraph = document.createElement("p");
  const strong = document.createElement("strong");

  strong.textContent = `${label}: `;

  paragraph.append(
    strong,
    document.createTextNode(value)
  );

  return paragraph;
}

function crossContactLabel(status) {
  if (status === "possible") return "Possible cross-contact reported";
  if (status === "reported-separate") return "Separate preparation and equipment reported by the host; not independently verified";
  return "Unknown or not confirmed";
}

function appendBlacklistWarning(card, dish) {
  if (!dish.blacklistMatches?.length) return;
  const warning = document.createElement("p");
  warning.className = "blacklist-warning";
  warning.textContent = `⚠ Event food blacklist match: ${dish.blacklistMatches.join(", ")}. Listed in ingredients, known allergens, or possible allergens. Speak with the host.`;
  card.append(warning);
}

function renderHostMeals(event) {
  hostMealOptionsList.replaceChildren();

  if (!event.dishes || event.dishes.length === 0) {
    const emptyMessage = document.createElement("p");

    emptyMessage.textContent =
      "No meal options have been added yet.";

    hostMealOptionsList.append(emptyMessage);
    return;
  }

  event.dishes.forEach((dish) => {
    const mealCard = document.createElement("article");
    mealCard.className = "meal-option-card";

    const mealName = document.createElement("h3");
    mealName.textContent = dish.name;

    const visibility = document.createElement("p");

    visibility.textContent = dish.isPublished
      ? "✓ Published for members"
      : "⚠ Hidden from members";

    visibility.className = dish.isPublished
      ? "status-safe"
      : "status-review";

    mealCard.append(mealName, visibility);

    if (dish.description) {
      const description = document.createElement("p");
      description.textContent = dish.description;
      mealCard.append(description);
    }

    mealCard.append(
      createInformationLine(
        "Category",
        dish.category || "Other"
      ),
      createInformationLine(
        "Ingredients",
        dish.ingredients?.length
          ? dish.ingredients.join(", ")
          : "Not provided"
      ),
      createInformationLine(
        "Known allergens",
        dish.containsAllergens?.length
          ? dish.containsAllergens.join(", ")
          : "None listed"
      ),
      createInformationLine(
        "Possible cross-contact",
        dish.mayContainAllergens?.length
          ? dish.mayContainAllergens.join(", ")
          : "None listed"
      )
    );

    const ingredientStatus = document.createElement("p");

    ingredientStatus.textContent =
      dish.ingredientListComplete
        ? "✓ Ingredient list marked complete"
        : "⚠ Ingredient list needs review";

    ingredientStatus.className =
      dish.ingredientListComplete
        ? "status-safe"
        : "status-review";

    mealCard.append(
      ingredientStatus,
      createInformationLine("Preparation information", dish.preparationInformation || "Not provided"),
      createInformationLine("Cross-contact information", crossContactLabel(dish.crossContactStatus))
    );
    appendBlacklistWarning(mealCard, dish);
    hostMealOptionsList.append(mealCard);
  });
}

function renderHostMembers(event) {
  hostMembersList.replaceChildren();

  const members = event.members || [];
  const memberWord =
    members.length === 1 ? "member" : "members";

  hostMemberCount.textContent =
    `${members.length} ${memberWord}`;

  members.forEach((member) => {
    const memberCard = document.createElement("article");
    memberCard.className = "member-card";

    const memberName = document.createElement("h3");
    memberName.textContent = member.displayName;

    const memberRole = document.createElement("p");

    memberRole.textContent =
      member.role === "host" ? "Host" : "Member";

    const profileStatus = document.createElement("p");

    profileStatus.textContent = member.profileComplete
      ? "✓ Allergy profile completed"
      : "⚠ Allergy profile not completed";

    profileStatus.className = member.profileComplete
      ? "status-safe"
      : "status-review";

    memberCard.append(
      memberName,
      memberRole,
      profileStatus
    );

    if (member.profileComplete) {
      memberCard.append(
        createInformationLine("Allergies", (member.allergies || []).join(", ") || "None listed"),
        createInformationLine("Other allergies", (member.otherAllergies || []).join(", ") || "None listed"),
        createInformationLine("Concern about cross-contact", member.crossContactConcern ? "Yes" : "Not selected"),
        createInformationLine("Note for the host", member.note || "Not provided")
      );
    }

    hostMembersList.append(memberCard);
  });
}

function hostPortalIsVisible() {
  return activeEvent?.role === "host" &&
    !document.querySelector("#host-portal-view").classList.contains("hidden");
}

function renderMenuOptimization(analysis) {
  const { profiledMembers, coveredMembers, uncoveredMembers, coveragePercentage, missingProfiles } = analysis;
  document.querySelector("#menu-coverage-result").textContent =
    `${coveredMembers} of ${profiledMembers} ${profiledMembers === 1 ? "member has" : "members have"} an option`;
  const status = document.querySelector("#menu-coverage-status");
  if (!profiledMembers) {
    status.dataset.tone = "information";
    status.textContent = "ℹ Profiles needed: coverage cannot be calculated until a guest completes a profile.";
  } else if (!uncoveredMembers) {
    status.dataset.tone = "complete";
    status.textContent = "✓ All profiled members have a listed option. Ingredients and preparation still need direct confirmation.";
  } else {
    status.dataset.tone = coveredMembers ? "review" : "uncovered";
    status.textContent = `⚠ ${uncoveredMembers} profiled ${uncoveredMembers === 1 ? "member has" : "members have"} no published option with a NO LISTED CONFLICT result.`;
  }
  const percentText = coveragePercentage === null
    ? "Coverage percentage: not calculated (no completed profiles)"
    : `${coveragePercentage}% of profiled members have a listed option`;
  document.querySelector("#menu-coverage-percent").textContent = percentText;
  const progress = document.querySelector("#menu-coverage-progress");
  progress.value = coveragePercentage ?? 0;
  progress.setAttribute("aria-valuetext", percentText);
  document.querySelector("#menu-profiled-count").textContent = profiledMembers;
  document.querySelector("#menu-covered-count").textContent = coveredMembers;
  document.querySelector("#menu-uncovered-count").textContent = uncoveredMembers;
  document.querySelector("#menu-missing-profiles").textContent = missingProfiles
    ? `⚠ ${missingProfiles} ${missingProfiles === 1 ? "member still needs" : "members still need"} to complete an allergy profile. They are excluded from the coverage percentage and all estimated gains.`
    : "✓ No guest members are missing an allergy profile.";
  document.querySelector("#menu-published-count").textContent = `${analysis.publishedMeals} published meal ${analysis.publishedMeals === 1 ? "option analyzed" : "options analyzed"}.`;
  document.querySelector("#menu-coverage-disclaimer").textContent = analysis.disclaimer;
  document.querySelector("#menu-estimate-note").textContent = analysis.estimateNote;

  const blockers = document.querySelector("#menu-blocking-allergens");
  blockers.replaceChildren();
  analysis.blockingAllergens.forEach((blocker) => {
    const item = document.createElement("li");
    item.textContent = `⚠ ${blocker.allergen}: ${blocker.affectedMembers} uncovered ${blocker.affectedMembers === 1 ? "member" : "members"} (${blocker.knownMatchMembers} with known matches; ${blocker.possibleMatchMembers} with possible matches).`;
    blockers.append(item);
  });
  if (!analysis.blockingAllergens.length) {
    const item = document.createElement("li");
    item.textContent = uncoveredMembers
      ? "ℹ No exact allergen matches were found for uncovered members. Missing information, blacklist conflicts, or a lack of published meals may be limiting coverage."
      : "ℹ No allergen blockers among currently uncovered members.";
    blockers.append(item);
  }

  document.querySelector("#menu-blacklist-conflicts").hidden = !analysis.blacklistConflicts.length;
  const blacklistList = document.querySelector("#menu-blacklist-list");
  blacklistList.replaceChildren();
  analysis.blacklistConflicts.forEach((conflict) => {
    const item = document.createElement("li");
    item.textContent = `${conflict.dishName}: ${conflict.allergens.join(", ")}. Confirm a recipe and preparation change that respects the event blacklist.`;
    blacklistList.append(item);
  });

  menuOptimizationSuggestions.replaceChildren();
  analysis.suggestions.forEach((suggestion) => {
    const item = document.createElement("li");
    item.className = "coverage-suggestion";
    item.dataset.type = suggestion.type;
    const heading = document.createElement("h4");
    heading.textContent = `${suggestion.rank}. ${suggestion.title}`;
    const estimate = document.createElement("p");
    estimate.className = "coverage-estimate";
    estimate.textContent = suggestion.estimatedAdditionalMembers === null
      ? "ℹ Additional members helped: not estimated. Information needs review."
      : `⚠ Conditional estimate: ${suggestion.estimatedAdditionalMembers} additional ${suggestion.estimatedAdditionalMembers === 1 ? "member" : "members"} could gain an option.`;
    const action = document.createElement("p");
    action.textContent = suggestion.action;
    const reasons = document.createElement("ul");
    suggestion.reasons.forEach((reason) => {
      const reasonItem = document.createElement("li");
      reasonItem.textContent = reason;
      reasons.append(reasonItem);
    });
    const caution = document.createElement("p");
    caution.className = "coverage-caution";
    caution.textContent = suggestion.caution;
    item.append(heading, estimate, action, reasons, caution);
    menuOptimizationSuggestions.append(item);
  });
  const empty = document.querySelector("#menu-no-suggestions");
  empty.hidden = analysis.suggestions.length > 0;
  empty.textContent = profiledMembers
    ? "✓ No additional coverage changes are suggested for the current profiles. Recheck after meal or profile changes."
    : "ℹ Invite guests to complete their profiles before estimating menu changes.";
  document.querySelector("#menu-analysis-updated").textContent = `Last refreshed at ${new Date().toLocaleTimeString()}.`;
  menuCoverageResults.hidden = false;
}

async function refreshMenuOptimization(automatic = false) {
  if (!hostPortalIsVisible() || (automatic && (document.hidden || menuAnalysisPending))) return;
  const code = activeEvent.code;
  const request = ++menuAnalysisRequest;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  if (menuAnalysisEventCode !== code) {
    menuCoverageResults.hidden = true;
    menuAnalysisEventCode = code;
  }
  menuAnalysisPending = true;
  refreshMenuAnalysisButton.disabled = true;
  refreshMenuAnalysisButton.textContent = "Refreshing analysis…";
  if (!automatic || menuCoverageResults.hidden) {
    menuCoverageMessage.hidden = false;
    menuCoverageMessage.dataset.tone = "information";
    menuCoverageMessage.textContent = "ℹ Calculating coverage using the latest saved meals and profiles…";
  }
  try {
    const data = await apiRequest(`/api/events/${code}/optimization`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (request !== menuAnalysisRequest || activeEvent?.code !== code || !hostPortalIsVisible()) return;
    renderMenuOptimization(data.optimization);
    menuCoverageMessage.hidden = automatic;
    menuCoverageMessage.dataset.tone = "information";
    menuCoverageMessage.textContent = "✓ Analysis updated using saved meals and profiles.";
  } catch (error) {
    if (request !== menuAnalysisRequest || activeEvent?.code !== code || !hostPortalIsVisible()) return;
    menuCoverageMessage.hidden = false;
    menuCoverageMessage.dataset.tone = "error";
    menuCoverageMessage.textContent = `⚠ Analysis could not be refreshed. ${error.message} Any displayed results may be out of date. Use Refresh analysis to try again.`;
  } finally {
    window.clearTimeout(timeout);
    if (request === menuAnalysisRequest) {
      menuAnalysisPending = false;
      refreshMenuAnalysisButton.disabled = false;
      refreshMenuAnalysisButton.textContent = "Refresh analysis";
    }
  }
}

refreshMenuAnalysisButton.addEventListener("click", () => refreshMenuOptimization());

function setChatStatus(message, state = "connecting") {
  if (!chatContext) return;
  const elements = chatElements[chatContext.role];
  elements.status.textContent = message;
  elements.status.dataset.state = state;
  const submitButton = elements.form.querySelector('button[type="submit"]');
  submitButton.disabled = state !== "connected";
  elements.input.disabled = state !== "connected";
}

function showChatActionError(message) {
  if (!chatContext) return;
  const elements = chatElements[chatContext.role];
  elements.status.textContent = `⚠ ${message}`;
  elements.status.dataset.state = "error";
  elements.input.disabled = !roomSocket?.connected;
  elements.form.querySelector('button[type="submit"]').disabled = !roomSocket?.connected;
}

function formatMessageTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function renderChatMessages() {
  if (!chatContext) return;
  const elements = chatElements[chatContext.role];
  elements.messages.replaceChildren();

  if (!chatMessages.length) {
    const empty = document.createElement("p");
    empty.className = "chat-empty";
    empty.textContent = "No messages yet. Start the conversation.";
    elements.messages.append(empty);
    return;
  }

  chatMessages.forEach((message) => {
    const article = document.createElement("article");
    article.className = "chat-message";
    article.dataset.messageId = message.id;

    const header = document.createElement("div");
    header.className = "chat-message-header";
    const sender = document.createElement("strong");
    sender.textContent = message.senderName;
    const time = document.createElement("time");
    time.dateTime = message.createdAt;
    time.textContent = formatMessageTime(message.createdAt);
    header.append(sender, time);

    const body = document.createElement("p");
    body.className = "chat-message-body";
    body.textContent = message.body;
    article.append(header, body);

    if (chatContext.role === "host" || message.senderId === chatCurrentUserId) {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "chat-delete-button";
      deleteButton.textContent = "Delete message";
      deleteButton.addEventListener("click", () => deleteChatMessage(message.id, deleteButton));
      article.append(deleteButton);
    }

    elements.messages.append(article);
  });
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function emitWithAcknowledgement(eventName, payload) {
  return new Promise((resolve, reject) => {
    if (!roomSocket?.connected) {
      reject(new Error("Room chat is disconnected. It will reconnect automatically."));
      return;
    }
    roomSocket.timeout(8000).emit(eventName, payload, (error, response) => {
      if (error) reject(new Error("Room chat did not respond. Try again."));
      else resolve(response);
    });
  });
}

async function joinCurrentChat() {
  if (!chatContext || !roomSocket?.connected) return;
  setChatStatus("Loading recent room messages…");
  try {
    const response = await emitWithAcknowledgement("room:join", { code: chatContext.code });
    if (!response?.ok) throw new Error(response?.message || "Room chat could not be opened.");
    chatMessages = response.messages || [];
    chatCurrentUserId = response.currentUserId;
    renderChatMessages();
    setChatStatus("● Connected — messages are shared live with this event.", "connected");
  } catch (error) {
    setChatStatus(`⚠ ${error.message}`, "error");
  }
}

function openRoomChat(event) {
  chatContext = { code: event.code, role: event.role };
  chatMessages = [];
  chatCurrentUserId = null;
  renderChatMessages();

  if (!roomSocket) {
    setChatStatus("⚠ Room chat is unavailable because its browser client did not load.", "error");
    return;
  }
  setChatStatus("Connecting to room chat…");
  if (roomSocket.connected) joinCurrentChat();
  else roomSocket.connect();
}

function closeRoomChat() {
  chatContext = null;
  chatMessages = [];
  chatCurrentUserId = null;
  if (roomSocket?.connected) roomSocket.disconnect();
}

async function deleteChatMessage(messageId, button) {
  button.disabled = true;
  try {
    const response = await emitWithAcknowledgement("message:delete", { messageId });
    if (!response?.ok) throw new Error(response?.message || "That message could not be deleted.");
  } catch (error) {
    showChatActionError(error.message);
    button.disabled = false;
  }
}

if (roomSocket) {
  roomSocket.on("connect", joinCurrentChat);
  roomSocket.on("disconnect", () => {
    if (chatContext) setChatStatus("○ Disconnected — reconnecting to room chat…", "connecting");
  });
  roomSocket.on("connect_error", (error) => {
    if (chatContext) setChatStatus(`⚠ ${error.message || "Room chat could not connect."}`, "error");
  });
  roomSocket.on("message:new", (message) => {
    if (!chatContext || chatMessages.some((item) => item.id === message.id)) return;
    chatMessages.push(message);
    chatMessages = chatMessages.slice(-50);
    renderChatMessages();
    const elements = chatElements[chatContext.role];
    elements.live.textContent = `${message.senderName} sent a new room message.`;
  });
  roomSocket.on("message:deleted", ({ id }) => {
    if (!chatContext) return;
    chatMessages = chatMessages.filter((message) => message.id !== id);
    renderChatMessages();
    chatElements[chatContext.role].live.textContent = "A room message was deleted.";
  });
}

Object.values(chatElements).forEach((elements) => {
  elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = elements.input.value.trim();
    const button = elements.form.querySelector('button[type="submit"]');
    if (!body || button.disabled) return;
    setButtonLoading(button, true, "Sending…");
    try {
      const response = await emitWithAcknowledgement("message:send", { body });
      if (!response?.ok) throw new Error(response?.message || "Your message could not be sent.");
      elements.input.value = "";
      if (response.message && !chatMessages.some((item) => item.id === response.message.id)) {
        chatMessages.push(response.message);
        renderChatMessages();
      }
    } catch (error) {
      showChatActionError(error.message);
    } finally {
      setButtonLoading(button, false);
      button.disabled = !roomSocket?.connected;
    }
  });
});

function setAssistantAvailability(configured, message) {
  assistantConfigured = configured;
  assistantStatus.textContent = configured ? `✓ ${message}` : `⚠ ${message}`;
  assistantStatus.dataset.state = configured ? "ready" : "error";
  assistantQuestion.disabled = !configured;
  assistantForm.querySelector('button[type="submit"]').disabled = !configured;
  assistantSuggestions.forEach((button) => {
    button.disabled = !configured;
  });
}

function showAssistantError(message, configurationMissing = false) {
  if (configurationMissing) assistantConfigured = false;
  assistantStatus.textContent = `⚠ ${message}`;
  assistantStatus.dataset.state = "error";
  assistantQuestion.disabled = !assistantConfigured;
  assistantForm.querySelector('button[type="submit"]').disabled = !assistantConfigured;
  assistantSuggestions.forEach((button) => {
    button.disabled = !assistantConfigured;
  });
}

function renderAssistantHistory(history) {
  assistantHistory.replaceChildren();
  if (!history?.length) {
    const empty = document.createElement("p");
    empty.className = "assistant-empty";
    empty.textContent = "No assistant questions yet.";
    assistantHistory.append(empty);
    return;
  }
  history.forEach((message) => {
    const article = document.createElement("article");
    article.className = "assistant-message";
    article.dataset.role = message.role;
    const label = document.createElement("strong");
    label.textContent = message.role === "user" ? "You" : "TableForAll";
    const text = document.createElement("p");
    text.textContent = message.text;
    article.append(label, text);
    assistantHistory.append(article);
  });
  assistantHistory.scrollTop = assistantHistory.scrollHeight;
}

async function loadAssistant(code) {
  const request = ++assistantRequest;
  setAssistantAvailability(false, "Checking assistant availability…");
  try {
    const data = await apiRequest(`/api/events/${code}/assistant`, { cache: "no-store" });
    if (request !== assistantRequest || activeEvent?.code !== code || activeEvent.role !== "member") return;
    renderAssistantHistory(data.history);
    setAssistantAvailability(data.configured, data.message);
  } catch (error) {
    if (request !== assistantRequest) return;
    setAssistantAvailability(false, error.message);
  }
}

assistantSuggestions.forEach((button) => {
  button.addEventListener("click", () => {
    assistantQuestion.value = button.textContent;
    assistantQuestion.focus();
  });
});

assistantForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!assistantConfigured || activeEvent?.role !== "member") return;
  const question = assistantQuestion.value.trim();
  const code = activeEvent.code;
  const button = assistantForm.querySelector('button[type="submit"]');
  if (!question || button.disabled) return;
  setButtonLoading(button, true, "Answering…");
  assistantQuestion.disabled = true;
  assistantStatus.textContent = "ℹ Reviewing the saved event information…";
  assistantStatus.dataset.state = "loading";
  try {
    const data = await apiRequest(`/api/events/${code}/assistant`, {
      method: "POST",
      body: JSON.stringify({ question }),
    });
    if (activeEvent?.code !== code || activeEvent.role !== "member") return;
    assistantQuestion.value = "";
    renderAssistantHistory(data.history);
    setAssistantAvailability(true, "Answer added. Deterministic meal statuses remain authoritative.");
  } catch (error) {
    showAssistantError(error.message, error.status === 503);
  } finally {
    setButtonLoading(button, false);
    button.disabled = !assistantConfigured;
    assistantQuestion.disabled = !assistantConfigured;
  }
});

function showHostPortal(event) {
  activeEvent = event;

  saveCurrentEvent(event.code, "host");

  hostEventHeading.textContent = event.name;
  hostEventCode.textContent = event.code;

  hostEventSummary.textContent =
    `${event.eventType} on ${formatEventDate(event.eventDate)}`;

  hostEventSettingsForm.elements.eventName.value =
    event.name || "";

  hostEventSettingsForm.elements.description.value =
    event.description || "";

  setSelectValue(
    hostEventSettingsForm.elements.eventType,
    event.eventType
  );

  hostEventSettingsForm.elements.eventDate.value =
    event.eventDate
      ? String(event.eventDate).slice(0, 10)
      : "";

  hostEventSettingsForm.elements.foodBlacklist.value =
    (event.foodBlacklist || []).join(", ");

  setSelectValue(
    hostEventSettingsForm.elements.status,
    event.status || "open"
  );

  renderHostMeals(event);
  renderHostMembers(event);

  signOutButton.classList.remove("hidden");
  showView("host-portal-view");
  openRoomChat(event);
  refreshMenuOptimization();
}
function showMemberMessage(message, type = "success") {
  memberPortalMessage.hidden = false;
  memberPortalMessage.textContent = `${type === "error" ? "Error" : "Success"}: ${message}`;
  memberPortalMessage.style.color = type === "error" ? "var(--danger)" : "var(--safe)";
}

function setMemberProfileEditing(editing) {
  const complete = activeEvent?.currentMember?.profileComplete === true;
  memberProfileForm.hidden = !editing;
  memberProfileSummary.hidden = editing;
  editMemberProfileButton.hidden = editing || !complete;
  cancelMemberProfileButton.hidden = !editing || !complete;
  memberMealsPanel.hidden = editing || !complete;
}

function renderMemberMeals(event) {
  memberMealOptionsList.replaceChildren();
  const dishes = (event.dishes || []).filter((dish) => dish.isPublished);
  if (!dishes.length) {
    const empty = document.createElement("p");
    empty.textContent = "No meal options have been published yet. Check back or ask the host.";
    memberMealOptionsList.append(empty);
    return;
  }

  dishes.forEach((dish) => {
    const card = document.createElement("article");
    card.className = "meal-option-card";
    const name = document.createElement("h3");
    name.textContent = dish.name;
    card.append(name);
    const description = document.createElement("p");
    description.textContent = dish.description || "No description provided.";
    card.append(description);

    const review = dish.review || {
      status: "REVIEW NEEDED",
      reasons: ["A personalized result is unavailable. Refresh the meal options or speak with the host."],
      action: "Ask the host about ingredients and preparation.",
      disclaimer: "This is based only on information entered by participants. Confirm ingredients and preparation directly.",
    };
    const panel = document.createElement("div");
    panel.className = "meal-review-panel";
    panel.dataset.status = review.status;
    const heading = document.createElement("p");
    heading.className = "meal-review-heading";
    const icon = document.createElement("span");
    icon.className = "meal-review-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = review.status === "HIGH RISK" ? "⊗" : review.status === "REVIEW NEEDED" ? "⚠" : "✓";
    heading.append(icon, document.createTextNode(review.status));
    const reasons = document.createElement("ul");
    review.reasons.forEach((reason) => {
      const item = document.createElement("li");
      item.textContent = reason;
      reasons.append(item);
    });
    const action = document.createElement("p");
    action.className = "meal-review-action";
    action.textContent = review.action;
    const disclaimer = document.createElement("p");
    disclaimer.className = "meal-review-disclaimer";
    disclaimer.textContent = review.disclaimer;
    panel.append(heading, reasons, action, disclaimer);
    card.append(panel);
    appendBlacklistWarning(card, dish);
    card.append(
      createInformationLine("Category", dish.category || "Other"),
      createInformationLine("Ingredients", dish.ingredients?.join(", ") || "Not provided"),
      createInformationLine("Ingredient list", dish.ingredientListComplete ? "Marked complete by the host" : "Incomplete or not confirmed"),
      createInformationLine("Known allergens", dish.containsAllergens?.join(", ") || "None listed; not independently verified"),
      createInformationLine("Possible allergens", dish.mayContainAllergens?.join(", ") || "None listed; not independently verified"),
      createInformationLine("Preparation information", dish.preparationInformation || "Not provided"),
      createInformationLine("Cross-contact information", crossContactLabel(dish.crossContactStatus))
    );
    memberMealOptionsList.append(card);
  });
}

function showMemberPortal(event) {
  activeEvent = event;
  saveCurrentEvent(event.code, "member");
  document.querySelector("#member-event-heading").textContent = event.name;
  document.querySelector("#member-event-description").textContent = event.description || "The host has not added a description yet.";
  document.querySelector("#member-event-date").textContent = `${event.eventType} on ${formatEventDate(event.eventDate)}`;
  document.querySelector("#member-event-code").textContent = event.code;
  document.querySelector("#member-food-blacklist").textContent = `Event food blacklist: ${(event.foodBlacklist || []).join(", ") || "None listed"}`;
  memberPortalMessage.hidden = true;

  const profile = event.currentMember || {};
  memberProfileForm.querySelectorAll('[name="allergies"]').forEach((checkbox) => {
    checkbox.checked = (profile.allergies || []).includes(checkbox.value);
  });
  memberProfileForm.elements.otherAllergies.value = (profile.otherAllergies || []).join(", ");
  memberProfileForm.elements.crossContactConcern.checked = profile.crossContactConcern === true;
  memberProfileForm.elements.note.value = profile.note || "";
  memberProfileSummary.replaceChildren(
    createInformationLine("Allergies", (profile.allergies || []).join(", ") || "None listed"),
    createInformationLine("Other allergies", (profile.otherAllergies || []).join(", ") || "None listed"),
    createInformationLine("Concern about cross-contact", profile.crossContactConcern ? "Yes" : "Not selected"),
    createInformationLine("Note for the host", profile.note || "Not provided")
  );
  setMemberProfileEditing(!profile.profileComplete);
  if (profile.profileComplete) renderMemberMeals(event);
  else memberMealOptionsList.replaceChildren();
  signOutButton.classList.remove("hidden");
  showView("member-portal-view");
  openRoomChat(event);
  loadAssistant(event.code);
}

editMemberProfileButton.addEventListener("click", () => {
  setMemberProfileEditing(true);
  memberProfileForm.querySelector("input").focus();
});

cancelMemberProfileButton.addEventListener("click", () => {
  if (activeEvent?.role === "member") showMemberPortal(activeEvent);
});

memberProfileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (activeEvent?.role !== "member") return;
  const code = activeEvent.code;
  const button = memberProfileForm.querySelector('button[type="submit"]');
  if (button.disabled) return;
  const formData = new FormData(memberProfileForm);
  setButtonLoading(button, true, "Saving profile...");
  cancelMemberProfileButton.disabled = true;
  try {
    const data = await apiRequest(`/api/events/${code}/members/me`, {
      method: "PATCH",
      body: JSON.stringify({
        allergies: formData.getAll("allergies"),
        otherAllergies: formData.get("otherAllergies"),
        crossContactConcern: formData.get("crossContactConcern") === "on",
        note: formData.get("note").trim(),
      }),
    });
    if (activeEvent?.code !== code || activeEvent.role !== "member") return;
    showMemberPortal(data.event);
    showMemberMessage(data.message);
  } catch (error) {
    showMemberMessage(error.message, "error");
  } finally {
    setButtonLoading(button, false);
    cancelMemberProfileButton.disabled = false;
  }
});

refreshMemberMealsButton.addEventListener("click", async () => {
  if (activeEvent?.role !== "member" || refreshMemberMealsButton.disabled) return;
  const code = activeEvent.code;
  setButtonLoading(refreshMemberMealsButton, true, "Refreshing...");
  editMemberProfileButton.disabled = true;
  try {
    const data = await apiRequest(`/api/events/${code}`);
    if (activeEvent?.code !== code || activeEvent.role !== "member") return;
    showMemberPortal(data.event);
    showMemberMessage("Meal options refreshed using your saved profile.");
  } catch (error) {
    showMemberMessage(error.message, "error");
  } finally {
    setButtonLoading(refreshMemberMealsButton, false);
    editMemberProfileButton.disabled = false;
  }
});

chooseHostButton.addEventListener("click", () => {
  showView("host-login-view");
});

chooseMemberButton.addEventListener("click", () => {
  showView("member-login-view");
});

document.querySelectorAll(".back-button").forEach((button) => {
  button.addEventListener("click", () => {
    const currentView = button.closest(".app-view");

    if (
      currentView.id === "verification-view" &&
      pendingAuthentication
    ) {
      showView(
        pendingAuthentication.intent === "host"
          ? "host-login-view"
          : "member-login-view"
      );

      return;
    }

    showView("role-view");
  });
});

hostLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  const button = hostLoginForm.querySelector(
    'button[type="submit"]'
  );

  const formData = new FormData(hostLoginForm);

  const authentication = {
    name: formData.get("name").trim(),
    email: formData.get("email").trim().toLowerCase(),
    intent: "host",
  };

  setButtonLoading(button, true, "Sending code...");

  try {
    await requestVerification(authentication);
  } catch (error) {
    showMessage(error.message);
  } finally {
    setButtonLoading(button, false);
  }
});

memberLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  const button = memberLoginForm.querySelector(
    'button[type="submit"]'
  );

  const formData = new FormData(memberLoginForm);

  const authentication = {
    eventCode: formData
      .get("eventCode")
      .trim()
      .toUpperCase(),

    name: formData.get("name").trim(),
    email: formData.get("email").trim().toLowerCase(),
    intent: "join",
  };

  setButtonLoading(button, true, "Sending code...");

  try {
    await requestVerification(authentication);
  } catch (error) {
    showMessage(error.message);
  } finally {
    setButtonLoading(button, false);
  }
});

verificationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  if (!pendingAuthentication) {
    showMessage("Start by choosing whether to host or join.");
    showView("role-view");
    return;
  }

  const button = verificationForm.querySelector(
    'button[type="submit"]'
  );

  const formData = new FormData(verificationForm);

  setButtonLoading(button, true, "Confirming...");

  try {
    const verification = await apiRequest(
      "/api/auth/verify-code",
      {
        method: "POST",

        body: JSON.stringify({
          ...pendingAuthentication,
          code: formData.get("code"),
        }),
      }
    );

    signOutButton.classList.remove("hidden");
    verificationForm.reset();
    sessionStorage.removeItem("tableForAllPendingAuthentication");
    pendingAuthentication = null;
    resendAvailableAt = 0;
    updateResendCooldown();

    if (verification.intent === "host") {
      showView("create-event-view");
      showMessage("Your email was confirmed.", "success");
    } else {
      const joinedEvent = await apiRequest(
        `/api/events/${verification.eventCode}/join`,
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );

      if (joinedEvent.event.role !== "member") {
        throw new Error(
          "This email belongs to the event host. Sign out and use a different verified email to join as a member."
        );
      }

      showMemberPortal(joinedEvent.event);
    }
  } catch (error) {
    showMessage(error.message);
  } finally {
    setButtonLoading(button, false);
  }
});

resendCodeButton.addEventListener("click", async () => {
  if (!pendingAuthentication) {
    showView("role-view");
    return;
  }

  setButtonLoading(
    resendCodeButton,
    true,
    "Sending another code..."
  );

  try {
    await requestVerification(pendingAuthentication);
  } catch (error) {
    showMessage(error.message);
  } finally {
    setButtonLoading(resendCodeButton, false);
    updateResendCooldown();
  }
});

newEventForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  const button = newEventForm.querySelector(
    'button[type="submit"]'
  );

  const formData = new FormData(newEventForm);

  const eventInformation = {
    eventName: formData.get("eventName").trim(),
    description: formData.get("description").trim(),
    eventType: formData.get("eventType"),
    eventDate: formData.get("eventDate"),

    foodBlacklist: splitCommaSeparatedList(
      formData.get("foodBlacklist")
    ),
  };

  setButtonLoading(button, true, "Creating event...");

  try {
    const data = await apiRequest("/api/events", {
      method: "POST",
      body: JSON.stringify(eventInformation),
    });

    showHostPortal(data.event);
  } catch (error) {
    showMessage(error.message);
  } finally {
    setButtonLoading(button, false);
  }
});

hostEventSettingsForm.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    if (!activeEvent) {
      showHostMessage(
        "The current event could not be found.",
        "error"
      );

      return;
    }

    const button = hostEventSettingsForm.querySelector(
      'button[type="submit"]'
    );

    const formData = new FormData(hostEventSettingsForm);

    const updatedInformation = {
      eventName: formData.get("eventName").trim(),
      description: formData.get("description").trim(),
      eventType: formData.get("eventType"),
      eventDate: formData.get("eventDate"),
      status: formData.get("status"),

      foodBlacklist: splitCommaSeparatedList(
        formData.get("foodBlacklist")
      ),
    };

    setButtonLoading(button, true, "Saving...");

    try {
      const data = await apiRequest(
        `/api/events/${activeEvent.code}/settings`,
        {
          method: "PATCH",
          body: JSON.stringify(updatedInformation),
        }
      );

      showHostPortal(data.event);
      showHostMessage(data.message, "success");
    } catch (error) {
      showHostMessage(error.message, "error");
    } finally {
      setButtonLoading(button, false);
    }
  }
);

mealOptionForm.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    if (!activeEvent) {
      showHostMessage(
        "The current event could not be found.",
        "error"
      );

      return;
    }

    const button = mealOptionForm.querySelector(
      'button[type="submit"]'
    );

    const formData = new FormData(mealOptionForm);

    const mealInformation = {
      name: formData.get("name").trim(),
      description: formData.get("description").trim(),
      category: formData.get("category"),

      ingredients: splitCommaSeparatedList(
        formData.get("ingredients")
      ),

      containsAllergens: splitCommaSeparatedList(
        formData.get("containsAllergens")
      ),

      mayContainAllergens: splitCommaSeparatedList(
        formData.get("mayContainAllergens")
      ),

      preparationInformation: formData
        .get("preparationInformation")
        .trim(),

      crossContactStatus: formData.get("crossContactStatus"),

      ingredientListComplete:
        formData.get("ingredientListComplete") === "on",

      isPublished:
        formData.get("isPublished") === "on",
    };

    setButtonLoading(button, true, "Adding meal...");

    try {
      const data = await apiRequest(
        `/api/events/${activeEvent.code}/dishes`,
        {
          method: "POST",
          body: JSON.stringify(mealInformation),
        }
      );

      mealOptionForm.reset();
      showHostPortal(data.event);
      showHostMessage(data.message, "success");
    } catch (error) {
      showHostMessage(error.message, "error");
    } finally {
      setButtonLoading(button, false);
    }
  }
);

copyEventCodeButton.addEventListener(
  "click",
  async () => {
    if (!activeEvent) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        activeEvent.code
      );

      copyEventCodeButton.textContent = "Code copied";

      showHostMessage(
        "The event code was copied.",
        "success"
      );
    } catch {
      copyEventCodeButton.textContent =
        activeEvent.code;

      showHostMessage(
        "Select and copy the displayed code manually.",
        "error"
      );
    }

    window.setTimeout(() => {
      copyEventCodeButton.textContent = "Copy code";
    }, 2000);
  }
);

memberCodeInput.addEventListener("input", () => {
  memberCodeInput.value = memberCodeInput.value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
});

verificationInput.addEventListener("input", () => {
  verificationInput.value = verificationInput.value
    .replace(/\D/g, "")
    .slice(0, 6);
});

homeButton.addEventListener("click", () => {
  closeRoomChat();
  showView("role-view");
});

signOutButton.addEventListener("click", async () => {
  try {
    await apiRequest("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({}),
    });
  } catch {
    // Clear the browser session even if the server request fails.
  }

  sessionStorage.removeItem(
    "tableForAllPendingAuthentication"
  );

  sessionStorage.removeItem("tableForAllCurrentEvent");

  pendingAuthentication = null;
  activeEvent = null;
  closeRoomChat();
  signOutButton.classList.add("hidden");

  showView("role-view");
  showMessage("You have signed out.", "success");
});

setDefaultEventDate();
restoreCurrentEvent();
window.setInterval(() => refreshMenuOptimization(true), 30000);
