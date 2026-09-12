const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeList, getEventFoodBlacklist, findBlacklistMatches, reviewMeal,
} = require("../lib/meal-review");

const profile = {
  allergies: ["peanuts", "tree nuts", "milk"],
  otherAllergies: ["kiwi"],
  crossContactConcern: true,
  profileComplete: true,
};

const completeMeal = {
  ingredients: ["rice", "water"],
  containsAllergens: [],
  mayContainAllergens: [],
  ingredientListComplete: true,
  crossContactStatus: "reported-separate",
};

test("normalization trims, collapses whitespace, ignores case, and removes duplicates", () => {
  assert.deepEqual(normalizeList(" Milk, milk, TREE   NUTS, tree nuts, ,"), ["milk", "tree nuts"]);
  assert.deepEqual(normalizeList(["PEANUTS", " peanuts ", null, {}, 42]), ["peanuts"]);
  assert.deepEqual(normalizeList(undefined), []);
});

test("known matches are HIGH RISK with every exact matching allergen", () => {
  const result = reviewMeal({ ...completeMeal, containsAllergens: [" MILK ", "TREE  NUTS", "milk", "KIWI"] }, profile);
  assert.equal(result.status, "HIGH RISK");
  assert.deepEqual(result.knownMatches, ["tree nuts", "milk", "kiwi"]);
  assert.match(result.reasons[0], /tree nuts, milk, kiwi/);
  assert.equal(result.action, "Do not choose this meal without speaking directly with the host.");
});

test("high risk takes precedence while retaining all review and blacklist reasons", () => {
  const result = reviewMeal({
    ...completeMeal, containsAllergens: ["milk"], mayContainAllergens: ["peanuts"],
    ingredientListComplete: false, crossContactStatus: "unknown",
  }, profile, ["rice"]);
  assert.equal(result.status, "HIGH RISK");
  for (const reason of [/Known allergen/, /Possible allergen/, /not marked complete/, /unclear/, /Your concern/, /blacklist match/]) {
    assert.ok(result.reasons.some((text) => reason.test(text)), `Missing reason: ${reason}`);
  }
});

test("possible allergen matches require review even if cross-contact concern is unchecked", () => {
  const result = reviewMeal({ ...completeMeal, mayContainAllergens: [" PEANUTS ", "kiwi"] }, { ...profile, crossContactConcern: false });
  assert.equal(result.status, "REVIEW NEEDED");
  assert.deepEqual(result.possibleMatches, ["peanuts", "kiwi"]);
  assert.equal(result.action, "Ask the host about ingredients and preparation.");
});

test("incomplete ingredient lists require review without an allergen match", () => {
  const result = reviewMeal({ ...completeMeal, ingredientListComplete: false }, profile);
  assert.equal(result.status, "REVIEW NEEDED");
  assert.ok(result.reasons.includes("The ingredient list is not marked complete."));
});

test("empty ingredients remain unknown even when the complete box is checked", () => {
  const result = reviewMeal({ ...completeMeal, ingredients: [] }, profile);
  assert.equal(result.status, "REVIEW NEEDED");
  assert.ok(result.reasons.includes("No ingredients have been provided."));
});

test("missing, unknown, or unrecognized cross-contact statuses require review", () => {
  for (const crossContactStatus of [undefined, "", "unknown", "unrecognized"]) {
    const result = reviewMeal({ ...completeMeal, crossContactStatus }, { ...profile, crossContactConcern: false });
    assert.equal(result.status, "REVIEW NEEDED");
    assert.ok(result.reasons.some((text) => text.includes("Cross-contact information is unclear")));
  }
});

test("free-text preparation claims do not replace explicit cross-contact information", () => {
  const result = reviewMeal({ ...completeMeal, crossContactStatus: undefined, preparationInformation: "Separate equipment; no cross-contact" }, profile);
  assert.equal(result.status, "REVIEW NEEDED");
});

test("reported possible cross-contact requires review and explains a member's concern", () => {
  const result = reviewMeal({ ...completeMeal, crossContactStatus: "possible" }, profile);
  assert.equal(result.status, "REVIEW NEEDED");
  assert.ok(result.reasons.some((text) => text.includes("host reports possible cross-contact")));
  assert.ok(result.reasons.some((text) => text.includes("Your concern about cross-contact")));
});

test("complete information and no matches produce NO LISTED CONFLICT with the disclaimer", () => {
  const result = reviewMeal(completeMeal, profile);
  assert.equal(result.status, "NO LISTED CONFLICT");
  assert.deepEqual(result.knownMatches, []);
  assert.deepEqual(result.possibleMatches, []);
  assert.equal(result.disclaimer, "This is based only on information entered by participants. Confirm ingredients and preparation directly.");
  assert.equal(result.action, "Confirm ingredients and preparation directly.");
  assert.ok(result.reasons.some((text) => text.includes("not been independently verified")));
});

test("exact comparisons do not confuse fish with shellfish or wheat with buckwheat", () => {
  const result = reviewMeal({
    ...completeMeal, containsAllergens: ["shellfish", "buckwheat", "milk chocolate"], mayContainAllergens: ["peanut oil"],
  }, { ...profile, allergies: ["fish", "wheat", "milk", "peanut"] });
  assert.equal(result.status, "NO LISTED CONFLICT");
});

test("an unsaved profile cannot produce a reassuring result", () => {
  assert.equal(reviewMeal(completeMeal, {}).status, "REVIEW NEEDED");
  assert.equal(reviewMeal(completeMeal, { ...profile, profileComplete: false }).status, "REVIEW NEEDED");
});

test("a saved profile can explicitly list no allergies", () => {
  assert.equal(reviewMeal(completeMeal, { profileComplete: true }).status, "NO LISTED CONFLICT");
});

test("blacklist checks cover ingredients, known allergens, and possible allergens exactly", () => {
  const dish = { ...completeMeal, containsAllergens: ["WHEAT"], mayContainAllergens: [" Sesame ", "rice"] };
  assert.deepEqual(findBlacklistMatches(dish, [" Rice ", "wheat", "SESAME", "rice", "whe"]), ["rice", "wheat", "sesame"]);
  const result = reviewMeal(dish, { profileComplete: true }, ["sesame"]);
  assert.equal(result.status, "REVIEW NEEDED");
  assert.deepEqual(result.blacklistMatches, ["sesame"]);
});

test("legacy blacklists remain available until the host saves or clears the current list", () => {
  const legacy = { ingredientBlacklist: ["Garlic"], foodAllergenBlacklist: ["Milk", "milk"] };
  assert.deepEqual(getEventFoodBlacklist(legacy), ["milk", "garlic"]);
  assert.deepEqual(getEventFoodBlacklist({ ...legacy, foodBlacklist: ["Sesame"] }), ["sesame"]);
  assert.deepEqual(getEventFoodBlacklist({ ...legacy, foodBlacklist: [] }), []);
});

test("meal review does not mutate the meal or profile", () => {
  const dish = structuredClone(completeMeal);
  const member = structuredClone(profile);
  reviewMeal(dish, member, ["rice"]);
  assert.deepEqual(dish, completeMeal);
  assert.deepEqual(member, profile);
});
