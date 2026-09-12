const STANDARD_ALLERGENS = [
  "peanuts", "tree nuts", "milk", "eggs", "wheat",
  "soy", "sesame", "fish", "shellfish",
];

const CROSS_CONTACT_STATUSES = ["unknown", "possible", "reported-separate"];

const DISCLAIMER =
  "Participant-provided information only—not a safety guarantee.";

function normalizeList(value) {
  const items = Array.isArray(value)
    ? value
    : typeof value === "string" ? value.split(",") : [];

  return [...new Set(items
    .filter((item) => typeof item === "string")
    .map((item) => item.trim().replace(/\s+/g, " ").toLowerCase())
    .filter(Boolean))];
}

function getEventFoodBlacklist(event) {
  // An explicitly saved list replaces legacy lists, including when cleared.
  return event.foodBlacklist !== undefined
    ? normalizeList(event.foodBlacklist)
    : normalizeList([
      ...(event.foodAllergenBlacklist || []),
      ...(event.ingredientBlacklist || []),
    ]);
}

function findBlacklistMatches(dish, blacklist) {
  const listedItems = new Set([
    ...normalizeList(dish.ingredients),
    ...normalizeList(dish.containsAllergens),
    ...normalizeList(dish.mayContainAllergens),
  ]);
  return normalizeList(blacklist).filter((item) => listedItems.has(item));
}

function reviewMeal(dish, profile = {}, blacklist = []) {
  const allergens = normalizeList([
    ...normalizeList(profile.allergies),
    ...normalizeList(profile.otherAllergies),
  ]);
  const contains = new Set(normalizeList(dish.containsAllergens));
  const mayContain = new Set(normalizeList(dish.mayContainAllergens));
  const knownMatches = allergens.filter((allergen) => contains.has(allergen));
  const possibleMatches = allergens.filter((allergen) => mayContain.has(allergen));
  const blacklistMatches = findBlacklistMatches(dish, blacklist);
  const reasons = [];

  if (knownMatches.length) {
    reasons.push(`Contains: ${knownMatches.join(", ")}.`);
  }
  if (possibleMatches.length) {
    reasons.push(`May contain: ${possibleMatches.join(", ")}.`);
  }
  if (!profile.profileComplete) {
    reasons.push("Allergy profile incomplete.");
  }
  if (dish.ingredientListComplete !== true) {
    reasons.push("Ingredient list incomplete.");
  }
  if (!normalizeList(dish.ingredients).length) {
    reasons.push("No ingredients listed.");
  }

  // Only an explicit status counts as cross-contact information. Do not
  // interpret free-text notes or assume that missing information is reassuring.
  if (dish.crossContactStatus === "possible") {
    reasons.push("Possible cross-contact reported.");
  } else if (dish.crossContactStatus !== "reported-separate") {
    reasons.push("Cross-contact details missing.");
  }
  if (profile.crossContactConcern && dish.crossContactStatus !== "reported-separate") {
    reasons.push("Confirm your cross-contact concern with the host.");
  }
  if (blacklistMatches.length) {
    reasons.push(`Event blacklist: ${blacklistMatches.join(", ")}.`);
  }

  const status = knownMatches.length
    ? "HIGH RISK"
    : reasons.length ? "REVIEW NEEDED" : "NO LISTED CONFLICT";

  if (!reasons.length) {
    reasons.push("No listed allergen matches.");
    reasons.push("Separate preparation reported; not verified.");
  }

  return {
    status,
    reasons,
    knownMatches,
    possibleMatches,
    blacklistMatches,
    action: status === "HIGH RISK"
      ? "Do not choose this meal before speaking with the host."
      : status === "REVIEW NEEDED"
        ? "Ask the host about ingredients and preparation."
        : "Confirm ingredients and preparation with the host.",
    disclaimer: DISCLAIMER,
  };
}

module.exports = {
  STANDARD_ALLERGENS,
  CROSS_CONTACT_STATUSES,
  normalizeList,
  getEventFoodBlacklist,
  findBlacklistMatches,
  reviewMeal,
};
