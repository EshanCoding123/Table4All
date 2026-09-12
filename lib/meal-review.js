const STANDARD_ALLERGENS = [
  "peanuts", "tree nuts", "milk", "eggs", "wheat",
  "soy", "sesame", "fish", "shellfish",
];

const CROSS_CONTACT_STATUSES = ["unknown", "possible", "reported-separate"];

const DISCLAIMER =
  "This is based only on information entered by participants. Confirm ingredients and preparation directly.";

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
    reasons.push(`Known allergen match: ${knownMatches.join(", ")}.`);
  }
  if (possibleMatches.length) {
    reasons.push(`Possible allergen or cross-contact match: ${possibleMatches.join(", ")}.`);
  }
  if (!profile.profileComplete) {
    reasons.push("Your allergy profile has not been completed.");
  }
  if (dish.ingredientListComplete !== true) {
    reasons.push("The ingredient list is not marked complete.");
  }
  if (!normalizeList(dish.ingredients).length) {
    reasons.push("No ingredients have been provided.");
  }

  // Only an explicit status counts as cross-contact information. Do not
  // interpret free-text notes or assume that missing information is reassuring.
  if (dish.crossContactStatus === "possible") {
    reasons.push("The host reports possible cross-contact during preparation.");
  } else if (dish.crossContactStatus !== "reported-separate") {
    reasons.push("Cross-contact information is unclear or has not been provided.");
  }
  if (profile.crossContactConcern && dish.crossContactStatus !== "reported-separate") {
    reasons.push("Your concern about cross-contact needs confirmation with the host.");
  }
  if (blacklistMatches.length) {
    reasons.push(`Event food blacklist match: ${blacklistMatches.join(", ")}.`);
  }

  const status = knownMatches.length
    ? "HIGH RISK"
    : reasons.length ? "REVIEW NEEDED" : "NO LISTED CONFLICT";

  if (!reasons.length) {
    reasons.push("The ingredient list is marked complete, with no exact matches to your listed allergens in known or possible allergens.");
    reasons.push("The host reports separate preparation; this has not been independently verified.");
  }

  return {
    status,
    reasons,
    knownMatches,
    possibleMatches,
    blacklistMatches,
    action: status === "HIGH RISK"
      ? "Do not choose this meal without speaking directly with the host."
      : status === "REVIEW NEEDED"
        ? "Ask the host about ingredients and preparation."
        : "Confirm ingredients and preparation directly.",
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
