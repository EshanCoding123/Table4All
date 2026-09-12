const appMessage = document.querySelector("#app-message");
const startupScreen = document.querySelector("#startup-screen");
const homeButton = document.querySelector("#home-button");
const signOutButton = document.querySelector("#sign-out-button");

const chooseHostButton = document.querySelector(
  "#choose-host-button"
);

const chooseMemberButton = document.querySelector(
  "#choose-member-button"
);
const chooseLoginButton = document.querySelector("#choose-login-button");
const chooseSignupButton = document.querySelector("#choose-signup-button");
const loginForm = document.querySelector("#login-form");
const signupForm = document.querySelector("#signup-form");
const joinEventForm = document.querySelector("#join-event-form");
const joinEventCodeInput = document.querySelector("#join-event-code");
const yourEventsList = document.querySelector("#your-events-list");
const captchaContainers = {
  login: document.querySelector("#login-captcha"),
  signup: document.querySelector("#signup-captcha"),
  verification: document.querySelector("#verification-captcha"),
};

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
const mealOptionHeading = document.querySelector("#meal-option-heading");
const mealOptionDescription = document.querySelector("#meal-option-description");
const mealOptionSubmitButton = document.querySelector("#meal-option-submit-button");
const cancelMealEditButton = document.querySelector("#cancel-meal-edit-button");

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
const leaveEventButton = document.querySelector("#leave-event-button");
const refreshMenuAnalysisButton = document.querySelector("#refresh-menu-analysis-button");
const menuCoverageResults = document.querySelector("#menu-coverage-results");
const menuCoverageMessage = document.querySelector("#menu-coverage-message");
const menuOptimizationSuggestions = document.querySelector("#menu-optimization-suggestions");
const assistantStatus = document.querySelector("#assistant-status");
const assistantHistory = document.querySelector("#assistant-history");
const assistantForm = document.querySelector("#assistant-form");
const assistantQuestion = document.querySelector("#assistant-question");
const assistantSuggestions = document.querySelectorAll(".assistant-suggestion");
const portalSectionState = {
  host: "host-event-details-panel",
  member: "member-profile-panel",
};
const portalNavigation = {
  host: {
    select: document.querySelector("#host-section-select"),
    mobileNav: document.querySelector("#host-mobile-navigation"),
    panelIds: [
      "host-event-details-panel",
      "host-add-meal-panel",
      "host-meals-panel",
      "menu-coverage-panel",
      "host-members-panel",
      "host-chat-panel",
    ],
  },
  member: {
    select: document.querySelector("#member-section-select"),
    mobileNav: document.querySelector("#member-mobile-navigation"),
    panelIds: [
      "member-profile-panel",
      "member-meals-panel",
      "member-assistant-panel",
      "member-chat-panel",
    ],
  },
};

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
let editingDishId = null;
let currentUser = null;
let myEventsRequest = 0;
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
let captchaInitializationPromise = null;
let turnstileScriptPromise = null;
const captchaState = {
  enabled: false,
  required: false,
  siteKey: null,
  tokens: { login: "", signup: "", verification: "" },
  widgetIds: {},
  widgetActions: {},
};
const roomSocket = typeof window.io === "function"
  ? window.io({ autoConnect: false })
  : null;

let pendingAuthentication = loadPendingAuthentication();

function finishStartup() {
  document.body.classList.remove("app-starting");

  if (!startupScreen) return;

  startupScreen.classList.add("startup-screen-hidden");

  window.setTimeout(() => {
    startupScreen.hidden = true;
  }, 350);
}

function showStartupScreen() {
  const isMobile = window.matchMedia("(max-width: 700px)").matches;
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  if (!isMobile || reduceMotion) {
    finishStartup();
    return;
  }

  window.setTimeout(finishStartup, 1250);
}

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

  document.body.classList.toggle(
    "portal-open",
    viewId === "host-portal-view" || viewId === "member-portal-view"
  );

  portalNavigation.host.mobileNav.hidden = viewId !== "host-portal-view";
  portalNavigation.member.mobileNav.hidden = viewId !== "member-portal-view";

  clearMessage();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setStatusMessage(element, message, type = "error") {
  if (!element) return;

  const validType = ["success", "error", "warning", "info"].includes(type)
    ? type
    : "info";
  const labels = {
    success: "Success",
    error: "We couldn’t continue",
    warning: "Needs attention",
    info: "Update",
  };

  element.hidden = false;
  element.dataset.tone = validType;
  element.textContent = `${labels[validType]}: ${message}`;
  element.setAttribute("role", validType === "error" ? "alert" : "status");
  element.setAttribute(
    "aria-live",
    validType === "error" ? "assertive" : "polite"
  );
}

function clearStatusMessage(element) {
  if (!element) return;

  element.hidden = true;
  element.textContent = "";
  delete element.dataset.tone;
  element.setAttribute("role", "status");
  element.setAttribute("aria-live", "polite");
}

function showMessage(message, type = "error") {
  setStatusMessage(appMessage, message, type);
}

function clearMessage() {
  clearStatusMessage(appMessage);
}

function showHostMessage(message, type = "success") {
  setStatusMessage(hostPortalMessage, message, type);
}

function animateMobilePortalSection(panel) {
  if (
    !window.matchMedia("(max-width: 700px)").matches ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  panel.classList.remove("portal-section-entering");
  void panel.offsetWidth;
  panel.classList.add("portal-section-entering");
  panel.addEventListener(
    "animationend",
    () => panel.classList.remove("portal-section-entering"),
    { once: true }
  );
}

function activatePortalSection(role, targetId, options = {}) {
  const navigation = portalNavigation[role];

  if (!navigation || !navigation.panelIds.includes(targetId)) return;

  const targetPanel = document.querySelector(`#${targetId}`);

  if (!targetPanel || targetPanel.hidden) return;

  portalSectionState[role] = targetId;

  navigation.panelIds.forEach((panelId) => {
    const panel = document.querySelector(`#${panelId}`);
    panel?.classList.toggle("portal-section-hidden", panelId !== targetId);
  });

  if (navigation.select) navigation.select.value = targetId;

  document
    .querySelectorAll(`[data-portal-role="${role}"]`)
    .forEach((button) => {
      const active = button.dataset.portalTarget === targetId;
      button.classList.toggle("is-active", active);

      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });

  if (!options.moveFocus) return;

  animateMobilePortalSection(targetPanel);

  const heading = targetPanel.querySelector("h2");

  if (heading) {
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }

  targetPanel.scrollIntoView({ block: "start", behavior: "smooth" });
}

function setMemberMealsNavigationAvailable(available) {
  const navigation = portalNavigation.member;
  const option = navigation.select?.querySelector(
    'option[value="member-meals-panel"]'
  );
  const button = document.querySelector(
    '[data-portal-role="member"][data-portal-target="member-meals-panel"]'
  );

  if (option) option.disabled = !available;

  if (button) {
    button.disabled = !available;
    button.title = available
      ? ""
      : "Complete your allergy profile to review meal options.";
  }
}

Object.entries(portalNavigation).forEach(([role, navigation]) => {
  navigation.select?.addEventListener("change", () => {
    activatePortalSection(role, navigation.select.value, {
      moveFocus: true,
    });
  });

  document
    .querySelectorAll(`[data-portal-role="${role}"]`)
    .forEach((button) => {
      button.addEventListener("click", () => {
        activatePortalSection(role, button.dataset.portalTarget, {
          moveFocus: true,
        });
      });
    });
});

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
  let response;

  try {
    response = await fetch(url, {
      ...options,

      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;

    throw new Error(
      "TableForAll could not reach the server. Check your connection and try again."
    );
  }

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error(
      "The server returned an unexpected response. Refresh the page and try again."
    );
  }

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      "The server response could not be read. Refresh the page and try again."
    );
  }

  if (!response.ok) {
    const error = new Error(data.message || "Something went wrong.");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector("script[data-turnstile-script]");
    const script = existingScript || document.createElement("script");
    const timeout = window.setTimeout(() => {
      reject(new Error(
        "The security check took too long to load. Check your connection or content blocker and try again."
      ));
    }, 8000);

    script.addEventListener("load", () => {
      window.clearTimeout(timeout);
      if (!window.turnstile?.render) {
        reject(new Error("The security check did not load."));
        return;
      }
      resolve();
    }, { once: true });
    script.addEventListener("error", () => {
      window.clearTimeout(timeout);
      reject(new Error("The security check did not load."));
    }, { once: true });

    if (!existingScript) {
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.turnstileScript = "true";
      document.head.append(script);
    }
  });

  return turnstileScriptPromise;
}

async function initializeCaptcha() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  let data;

  try {
    data = await apiRequest("/api/auth/config", {
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("The account security settings took too long to load. Refresh and try again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
  captchaState.enabled = data.captcha?.enabled === true;
  captchaState.required = data.captcha?.required === true;
  captchaState.siteKey = data.captcha?.siteKey || null;

  if (captchaState.required && !captchaState.enabled) {
    throw new Error("The account security check is not configured yet.");
  }

  if (captchaState.enabled) await loadTurnstileScript();
}

async function ensureCaptcha(kind, action = kind) {
  try {
    await captchaInitializationPromise;
  } catch (error) {
    showMessage(error.message);
    return false;
  }

  if (!captchaState.enabled) return true;
  if (
    captchaState.widgetIds[kind] !== undefined &&
    captchaState.widgetActions[kind] === action
  ) {
    return true;
  }

  if (captchaState.widgetIds[kind] !== undefined) {
    window.turnstile.remove(captchaState.widgetIds[kind]);
    delete captchaState.widgetIds[kind];
    captchaState.tokens[kind] = "";
  }

  const container = captchaContainers[kind];
  container.hidden = false;
  container.replaceChildren();

  try {
    captchaState.widgetIds[kind] = window.turnstile.render(container, {
      sitekey: captchaState.siteKey,
      action,
      size: window.matchMedia("(max-width: 370px)").matches
        ? "compact"
        : "normal",
      theme: "light",
      callback(token) {
        captchaState.tokens[kind] = token;
      },
      "expired-callback"() {
        captchaState.tokens[kind] = "";
      },
      "error-callback"() {
        captchaState.tokens[kind] = "";
        return true;
      },
    });
  } catch {
    const errorMessage = document.createElement("p");
    errorMessage.className = "field-help";
    errorMessage.textContent =
      "The security check could not open. Refresh the page and try again.";
    container.replaceChildren(errorMessage);
    return false;
  }
  captchaState.widgetActions[kind] = action;

  return true;
}

function getCaptchaToken(kind) {
  if (!captchaState.enabled) return "";
  if (!captchaState.tokens[kind]) {
    throw new Error("Complete the security check before continuing.");
  }
  return captchaState.tokens[kind];
}

function resetCaptcha(kind) {
  captchaState.tokens[kind] = "";
  const widgetId = captchaState.widgetIds[kind];
  if (widgetId !== undefined && window.turnstile) {
    window.turnstile.reset(widgetId);
  }
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
    return false;
  }

  let currentEvent;

  try {
    currentEvent = JSON.parse(storedEvent);
  } catch {
    sessionStorage.removeItem("tableForAllCurrentEvent");
    return false;
  }

  if (!/^[A-Z0-9]{6}$/.test(currentEvent?.eventCode || "")) {
    sessionStorage.removeItem("tableForAllCurrentEvent");
    return false;
  }

  try {
    const data = await apiRequest(
      `/api/events/${currentEvent.eventCode}`
    );

    if (
      sessionStorage.getItem("tableForAllCurrentEvent") !== storedEvent
    ) {
      return false;
    }

    if (data.event.role === "host") {
      showHostPortal(data.event);
    } else {
      showMemberPortal(data.event);
    }
    return true;
  } catch (error) {
    sessionStorage.removeItem("tableForAllCurrentEvent");
    showMessage(error.message);
    return false;
  }
}

async function restoreApplication() {
  try {
    const data = await apiRequest("/api/auth/me");
    currentUser = data.user;
    signOutButton.classList.remove("hidden");

    const eventRestored = await restoreCurrentEvent();
    if (!eventRestored) {
      showView("role-view");
      loadMyEvents();
    }
  } catch {
    currentUser = null;
    sessionStorage.removeItem("tableForAllCurrentEvent");
    signOutButton.classList.add("hidden");

    if (pendingAuthentication) {
      showView("verification-view");
      verificationInstructions.textContent =
        "Check your email for the six-digit confirmation code. It expires in 10 minutes.";
    } else {
      showView("account-view");
    }
  }
}

function renderMyEvents(events) {
  yourEventsList.replaceChildren();

  if (!events.length) {
    const emptyMessage = document.createElement("p");
    emptyMessage.textContent = "You have not created or joined an event yet.";
    yourEventsList.append(emptyMessage);
    return;
  }

  events.forEach((event) => {
    const item = document.createElement("article");
    item.className = "your-event-item";

    const details = document.createElement("div");
    const heading = document.createElement("h3");
    heading.textContent = event.name;

    const summary = document.createElement("p");
    const role = event.role === "host" ? "Host" : "Member";
    summary.textContent = `${role} · ${formatEventDate(event.eventDate)} · Code ${event.code}`;
    details.append(heading, summary);

    const openButton = document.createElement("button");
    openButton.className = "secondary-button";
    openButton.type = "button";
    openButton.textContent = "Open";
    openButton.addEventListener("click", async () => {
      setButtonLoading(openButton, true, "Opening...");
      try {
        const data = await apiRequest(`/api/events/${encodeURIComponent(event.code)}`);
        if (data.event.role === "host") {
          showHostPortal(data.event);
        } else {
          showMemberPortal(data.event);
        }
      } catch (error) {
        showMessage(error.message);
      } finally {
        setButtonLoading(openButton, false);
      }
    });

    item.append(details, openButton);
    yourEventsList.append(item);
  });
}

async function loadMyEvents() {
  if (!currentUser) return;

  const requestId = ++myEventsRequest;
  const loadingMessage = document.createElement("p");
  loadingMessage.textContent = "Loading your events…";
  yourEventsList.replaceChildren(loadingMessage);

  try {
    const data = await apiRequest("/api/events/mine");
    if (requestId !== myEventsRequest || !currentUser) return;
    renderMyEvents(Array.isArray(data.events) ? data.events : []);
  } catch (error) {
    if (requestId !== myEventsRequest || !currentUser) return;
    const errorMessage = document.createElement("p");
    errorMessage.className = "field-help";
    errorMessage.textContent = error.message;
    yourEventsList.replaceChildren(errorMessage);
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
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20000);

  try {
    data = await apiRequest("/api/auth/request-code", {
      method: "POST",
      body: JSON.stringify(authentication),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        "The login request took too long. Check your connection and try again."
      );
    }
    if (error.status === 429 && error.data?.retryAfterSeconds) {
      startResendCooldown(error.data.retryAfterSeconds);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }

  const { captchaToken, ...pendingAuthenticationDetails } = authentication;
  savePendingAuthentication(pendingAuthenticationDetails);
  showView("verification-view");
  verificationInstructions.textContent =
    "Check your email for the six-digit confirmation code. It expires in 10 minutes.";
  startResendCooldown(data.cooldownSeconds || 60);
  ensureCaptcha("verification", pendingAuthenticationDetails.intent);

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
  if (status === "possible") return "Possible";
  if (status === "reported-separate") return "Separate preparation reported (not verified)";
  return "Not provided";
}

function appendBlacklistWarning(card, dish) {
  if (!dish.blacklistMatches?.length) return;
  const warning = document.createElement("p");
  warning.className = "blacklist-warning";
  warning.textContent = `⚠ Event food blacklist match: ${dish.blacklistMatches.join(", ")}. Listed in ingredients, known allergens, or possible allergens. Speak with the host.`;
  card.append(warning);
}

function resetMealEditor() {
  editingDishId = null;
  mealOptionForm.reset();
  mealOptionHeading.textContent = "Add a meal option";
  mealOptionDescription.textContent =
    "Give members enough information to judge whether a meal may work for them. Unknown information should stay clearly marked.";
  mealOptionSubmitButton.textContent = "Add meal option";
  cancelMealEditButton.hidden = true;
}

function beginMealEdit(dish) {
  editingDishId = String(dish.id);

  mealOptionForm.elements.name.value = dish.name || "";
  mealOptionForm.elements.description.value = dish.description || "";
  setSelectValue(mealOptionForm.elements.category, dish.category || "Other");
  mealOptionForm.elements.ingredients.value = (dish.ingredients || []).join(", ");
  mealOptionForm.elements.containsAllergens.value =
    (dish.containsAllergens || []).join(", ");
  mealOptionForm.elements.mayContainAllergens.value =
    (dish.mayContainAllergens || []).join(", ");
  mealOptionForm.elements.preparationInformation.value =
    dish.preparationInformation || "";
  setSelectValue(
    mealOptionForm.elements.crossContactStatus,
    dish.crossContactStatus || "unknown"
  );
  mealOptionForm.elements.ingredientListComplete.checked =
    dish.ingredientListComplete === true;
  mealOptionForm.elements.isPublished.checked = dish.isPublished === true;

  mealOptionHeading.textContent = "Edit meal option";
  mealOptionDescription.textContent = `Update ${dish.name || "this meal"}, then save your changes.`;
  mealOptionSubmitButton.textContent = "Save meal option";
  cancelMealEditButton.hidden = false;

  activatePortalSection("host", "host-add-meal-panel", {
    moveFocus: true,
  });
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

    const actions = document.createElement("div");
    actions.className = "meal-card-actions";

    const editButton = document.createElement("button");
    editButton.className = "secondary-button";
    editButton.type = "button";
    editButton.textContent = "Edit meal";
    editButton.setAttribute("aria-label", `Edit ${dish.name || "meal option"}`);
    editButton.addEventListener("click", () => beginMealEdit(dish));

    actions.append(editButton);
    mealCard.append(actions);

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

    if (member.role === "member") {
      const removeButton = document.createElement("button");
      removeButton.className = "danger-button member-remove-button";
      removeButton.type = "button";
      removeButton.textContent = "Remove member";
      removeButton.addEventListener("click", async () => {
        const confirmed = window.confirm(
          `Remove ${member.displayName} from this event?`
        );
        if (!confirmed || !activeEvent || removeButton.disabled) return;

        const eventCode = activeEvent.code;
        setButtonLoading(removeButton, true, "Removing...");

        try {
          const data = await apiRequest(
            `/api/events/${eventCode}/members/${encodeURIComponent(member.id)}`,
            { method: "DELETE" }
          );
          if (activeEvent?.code !== eventCode || activeEvent.role !== "host") return;
          showHostPortal(data.event);
          activatePortalSection("host", "host-members-panel");
          showHostMessage(data.message, "success");
        } catch (error) {
          showHostMessage(error.message, "error");
          setButtonLoading(removeButton, false);
        }
      });

      memberCard.append(removeButton);
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
    status.textContent = "ℹ Waiting for completed guest profiles.";
  } else if (!uncoveredMembers) {
    status.dataset.tone = "complete";
    status.textContent = "✓ All profiled members have an option.";
  } else {
    status.dataset.tone = coveredMembers ? "review" : "uncovered";
    status.textContent = `⚠ ${uncoveredMembers} profiled ${uncoveredMembers === 1 ? "member still needs" : "members still need"} an option.`;
  }
  const percentText = coveragePercentage === null
    ? "Coverage unavailable"
    : `${coveragePercentage}% coverage`;
  document.querySelector("#menu-coverage-percent").textContent = percentText;
  const progress = document.querySelector("#menu-coverage-progress");
  progress.value = coveragePercentage ?? 0;
  progress.setAttribute(
    "aria-valuetext",
    coveragePercentage === null
      ? "Coverage unavailable because no profiles are complete"
      : `${coveragePercentage}% of profiled members have an option`
  );
  document.querySelector("#menu-profiled-count").textContent = profiledMembers;
  document.querySelector("#menu-covered-count").textContent = coveredMembers;
  document.querySelector("#menu-uncovered-count").textContent = uncoveredMembers;
  document.querySelector("#menu-missing-profiles").textContent = missingProfiles
    ? `⚠ ${missingProfiles} incomplete ${missingProfiles === 1 ? "profile" : "profiles"} (excluded).`
    : "✓ All guest profiles complete.";
  document.querySelector("#menu-published-count").textContent =
    `${analysis.publishedMeals} published ${analysis.publishedMeals === 1 ? "meal" : "meals"} analyzed.`;
  document.querySelector("#menu-coverage-disclaimer").textContent = analysis.disclaimer;
  document.querySelector("#menu-estimate-note").textContent = analysis.estimateNote;

  const blockers = document.querySelector("#menu-blocking-allergens");
  blockers.replaceChildren();
  analysis.blockingAllergens.forEach((blocker) => {
    const item = document.createElement("li");
    item.textContent = `⚠ ${blocker.allergen}: ${blocker.affectedMembers} ${blocker.affectedMembers === 1 ? "member" : "members"} (${blocker.knownMatchMembers} known, ${blocker.possibleMatchMembers} possible).`;
    blockers.append(item);
  });
  if (!analysis.blockingAllergens.length) {
    const item = document.createElement("li");
    item.textContent = uncoveredMembers
      ? "ℹ No allergen matches found. Missing details or meals may be the issue."
      : "ℹ No current allergen blockers.";
    blockers.append(item);
  }

  document.querySelector("#menu-blacklist-conflicts").hidden = !analysis.blacklistConflicts.length;
  const blacklistList = document.querySelector("#menu-blacklist-list");
  blacklistList.replaceChildren();
  analysis.blacklistConflicts.forEach((conflict) => {
    const item = document.createElement("li");
    item.textContent = `${conflict.dishName}: ${conflict.allergens.join(", ")}. Review the recipe and preparation.`;
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
      ? "ℹ Impact unknown until details are complete."
      : `Potential: +${suggestion.estimatedAdditionalMembers} ${suggestion.estimatedAdditionalMembers === 1 ? "member" : "members"}.`;
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
    ? "✓ No menu changes suggested right now."
    : "ℹ Complete guest profiles to get suggestions.";
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
  roomSocket.on("membership:removed", ({ code }) => {
    if (activeEvent?.role !== "member" || activeEvent.code !== code) return;
    sessionStorage.removeItem("tableForAllCurrentEvent");
    activeEvent = null;
    closeRoomChat();
    showView("role-view");
    loadMyEvents();
    showMessage("You were removed from the event.", "warning");
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
  const sameHostEvent =
    activeEvent?.role === "host" && activeEvent.code === event.code;
  const selectedSection = sameHostEvent
    ? portalSectionState.host
    : "host-event-details-panel";

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

  clearStatusMessage(hostPortalMessage);
  signOutButton.classList.remove("hidden");
  showView("host-portal-view");
  activatePortalSection("host", selectedSection);
  openRoomChat(event);
  refreshMenuOptimization();
}
function showMemberMessage(message, type = "success") {
  setStatusMessage(memberPortalMessage, message, type);
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
    empty.textContent = "No published meals yet.";
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
      reasons: ["Personalized result unavailable."],
      action: "Ask the host about ingredients and preparation.",
      disclaimer: "Participant-provided information only—not a safety guarantee.",
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
    action.textContent = `Next: ${review.action}`;
    const disclaimer = document.createElement("p");
    disclaimer.className = "meal-review-disclaimer";
    disclaimer.textContent = review.disclaimer;
    panel.append(heading, reasons, action, disclaimer);
    card.append(panel);
    appendBlacklistWarning(card, dish);
    card.append(
      createInformationLine("Category", dish.category || "Other"),
      createInformationLine("Ingredients", dish.ingredients?.join(", ") || "Not provided"),
      createInformationLine("Ingredient list", dish.ingredientListComplete ? "Complete" : "Incomplete"),
      createInformationLine("Known allergens", dish.containsAllergens?.join(", ") || "None listed"),
      createInformationLine("Possible allergens", dish.mayContainAllergens?.join(", ") || "None listed"),
      createInformationLine("Preparation information", dish.preparationInformation || "Not provided"),
      createInformationLine("Cross-contact information", crossContactLabel(dish.crossContactStatus))
    );
    memberMealOptionsList.append(card);
  });
}

function showMemberPortal(event) {
  const sameMemberEvent =
    activeEvent?.role === "member" && activeEvent.code === event.code;

  activeEvent = event;
  saveCurrentEvent(event.code, "member");
  document.querySelector("#member-event-heading").textContent = event.name;
  document.querySelector("#member-event-description").textContent = event.description || "The host has not added a description yet.";
  document.querySelector("#member-event-date").textContent = `${event.eventType} on ${formatEventDate(event.eventDate)}`;
  document.querySelector("#member-event-code").textContent = event.code;
  document.querySelector("#member-food-blacklist").textContent = `Event food blacklist: ${(event.foodBlacklist || []).join(", ") || "None listed"}`;
  clearStatusMessage(memberPortalMessage);

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
  setMemberMealsNavigationAvailable(profile.profileComplete === true);
  if (profile.profileComplete) renderMemberMeals(event);
  else memberMealOptionsList.replaceChildren();
  signOutButton.classList.remove("hidden");
  showView("member-portal-view");
  activatePortalSection(
    "member",
    profile.profileComplete
      ? sameMemberEvent
        ? portalSectionState.member
        : "member-meals-panel"
      : "member-profile-panel"
  );
  openRoomChat(event);
  loadAssistant(event.code);
}

editMemberProfileButton.addEventListener("click", () => {
  setMemberProfileEditing(true);
  activatePortalSection("member", "member-profile-panel");
  memberProfileForm.querySelector("input").focus();
});

cancelMemberProfileButton.addEventListener("click", () => {
  if (activeEvent?.role === "member") showMemberPortal(activeEvent);
});

leaveEventButton.addEventListener("click", async () => {
  if (activeEvent?.role !== "member" || leaveEventButton.disabled) return;

  const confirmed = window.confirm(
    `Leave ${activeEvent.name}? You can rejoin later while the event is open.`
  );
  if (!confirmed) return;

  const eventCode = activeEvent.code;
  setButtonLoading(leaveEventButton, true, "Leaving...");

  try {
    const data = await apiRequest(`/api/events/${eventCode}/members/me`, {
      method: "DELETE",
    });
    sessionStorage.removeItem("tableForAllCurrentEvent");
    activeEvent = null;
    closeRoomChat();
    showView("role-view");
    loadMyEvents();
    showMessage(data.message, "success");
  } catch (error) {
    showMemberMessage(error.message, "error");
  } finally {
    setButtonLoading(leaveEventButton, false);
  }
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
    activatePortalSection("member", "member-meals-panel", {
      moveFocus: true,
    });
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

chooseLoginButton.addEventListener("click", () => {
  showView("login-view");
  ensureCaptcha("login");
});

chooseSignupButton.addEventListener("click", () => {
  showView("signup-view");
  ensureCaptcha("signup");
});

chooseHostButton.addEventListener("click", () => {
  showView(currentUser ? "create-event-view" : "login-view");
});

chooseMemberButton.addEventListener("click", () => {
  showView(currentUser ? "join-event-view" : "login-view");
});

document.querySelectorAll(".back-button").forEach((button) => {
  button.addEventListener("click", () => {
    const currentView = button.closest(".app-view");

    if (
      currentView.id === "verification-view" &&
      pendingAuthentication
    ) {
      const previousViews = {
        host: "host-login-view",
        join: "member-login-view",
        login: "login-view",
        signup: "signup-view",
      };
      showView(previousViews[pendingAuthentication.intent] || "account-view");

      return;
    }

    showView(button.dataset.backView || (currentUser ? "role-view" : "account-view"));
  });
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  const button = loginForm.querySelector('button[type="submit"]');
  const formData = new FormData(loginForm);

  setButtonLoading(button, true, "Sending login code...");
  try {
    if (!(await ensureCaptcha("login"))) return;
    const authentication = {
      email: formData.get("email").trim().toLowerCase(),
      intent: "login",
      captchaToken: getCaptchaToken("login"),
    };
    await requestVerification(authentication);
  } catch (error) {
    showMessage(error.message);
  } finally {
    resetCaptcha("login");
    setButtonLoading(button, false);
  }
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  const button = signupForm.querySelector('button[type="submit"]');
  const formData = new FormData(signupForm);

  setButtonLoading(button, true, "Creating account...");
  try {
    if (!(await ensureCaptcha("signup"))) return;
    const authentication = {
      name: formData.get("name").trim(),
      email: formData.get("email").trim().toLowerCase(),
      intent: "signup",
      captchaToken: getCaptchaToken("signup"),
    };
    await requestVerification(authentication);
  } catch (error) {
    showMessage(error.message);
  } finally {
    resetCaptcha("signup");
    setButtonLoading(button, false);
  }
});

joinEventForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  const button = joinEventForm.querySelector('button[type="submit"]');
  const formData = new FormData(joinEventForm);
  const eventCode = formData.get("eventCode").trim().toUpperCase();

  setButtonLoading(button, true, "Joining event...");
  try {
    const data = await apiRequest(`/api/events/${eventCode}/join`, {
      method: "POST",
      body: JSON.stringify({}),
    });

    if (data.event.role !== "member") {
      throw new Error(
        "This account hosts that event and cannot join it as a member."
      );
    }

    joinEventForm.reset();
    showMemberPortal(data.event);
  } catch (error) {
    showMessage(error.message);
  } finally {
    setButtonLoading(button, false);
  }
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

    currentUser = verification.user;
    signOutButton.classList.remove("hidden");
    verificationForm.reset();
    sessionStorage.removeItem("tableForAllPendingAuthentication");
    pendingAuthentication = null;
    resendAvailableAt = 0;
    updateResendCooldown();

    if (["login", "signup"].includes(verification.intent)) {
      loginForm.reset();
      signupForm.reset();
      showView("role-view");
      showMessage(
        verification.intent === "signup"
          ? "Your account was created and verified."
          : "You are logged in.",
        "success"
      );
      loadMyEvents();
      return;
    }

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
    if (!(await ensureCaptcha("verification", pendingAuthentication.intent))) return;
    await requestVerification({
      ...pendingAuthentication,
      captchaToken: getCaptchaToken("verification"),
    });
  } catch (error) {
    showMessage(error.message);
  } finally {
    resetCaptcha("verification");
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

    const button = mealOptionSubmitButton;
    const dishId = editingDishId;

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

    setButtonLoading(
      button,
      true,
      dishId ? "Saving meal..." : "Adding meal..."
    );

    let data;

    try {
      data = await apiRequest(
        dishId
          ? `/api/events/${activeEvent.code}/dishes/${encodeURIComponent(dishId)}`
          : `/api/events/${activeEvent.code}/dishes`,
        {
          method: dishId ? "PATCH" : "POST",
          body: JSON.stringify(mealInformation),
        }
      );
    } catch (error) {
      showHostMessage(error.message, "error");
    } finally {
      setButtonLoading(button, false);
    }

    if (!data) return;

    resetMealEditor();
    showHostPortal(data.event);
    activatePortalSection("host", "host-meals-panel", {
      moveFocus: true,
    });
    showHostMessage(data.message, "success");
  }
);

cancelMealEditButton.addEventListener("click", () => {
  resetMealEditor();
  mealOptionHeading.focus();
});

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

joinEventCodeInput.addEventListener("input", () => {
  joinEventCodeInput.value = joinEventCodeInput.value
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
  showView(currentUser ? "role-view" : "account-view");
  if (currentUser) loadMyEvents();
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
  currentUser = null;
  myEventsRequest += 1;
  closeRoomChat();
  signOutButton.classList.add("hidden");

  showView("account-view");
  showMessage("You have signed out.", "success");
});

setDefaultEventDate();
captchaInitializationPromise = initializeCaptcha();
captchaInitializationPromise.catch(() => {});
showStartupScreen();
restoreApplication();
window.setInterval(() => refreshMenuOptimization(true), 30000);
