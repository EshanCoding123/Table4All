const test = require("node:test");
const assert = require("node:assert/strict");
const { optimizeMenu } = require("../lib/menuOptimizer");

const member = (allergies = [], extra = {}) => ({
  role: "member", profileComplete: true, allergies, otherAllergies: [], ...extra,
});
const meal = (extra = {}) => ({
  _id: "dish-1", name: "Peanut Noodles", isPublished: true,
  ingredients: ["noodles", "peanuts"], containsAllergens: ["peanuts"],
  mayContainAllergens: [], ingredientListComplete: true,
  crossContactStatus: "reported-separate", ...extra,
});
const removals = (result) => result.suggestions.filter((item) => item.type === "ingredient-removal");

test("zero members gives no percentage or invented gains", () => {
  const result = optimizeMenu({});
  assert.equal(result.profiledMembers, 0);
  assert.equal(result.coveredMembers, 0);
  assert.equal(result.uncoveredMembers, 0);
  assert.equal(result.missingProfiles, 0);
  assert.equal(result.coveragePercentage, null);
  assert.deepEqual(result.suggestions, []);
});

test("the host is excluded and incomplete guest profiles are counted separately", () => {
  const result = optimizeMenu({
    members: [member([], { role: "host" }), member([]), member(["peanuts"], { profileComplete: false })],
    dishes: [meal()],
  });
  assert.equal(result.profiledMembers, 1);
  assert.equal(result.coveredMembers, 1);
  assert.equal(result.missingProfiles, 1);
  assert.equal(result.coveragePercentage, 100);
  assert.deepEqual(result.suggestions, []);
});

test("only incomplete profiles produces no coverage percentage or estimated additional members", () => {
  const result = optimizeMenu({ members: [member(["peanuts"], { profileComplete: false })], dishes: [meal()] });
  assert.equal(result.missingProfiles, 1);
  assert.equal(result.profiledMembers, 0);
  assert.equal(result.coveragePercentage, null);
  assert.equal(result.uncoveredMembers, 0);
  assert.deepEqual(result.suggestions, []);
});

test("full coverage requires one usable published option per guest, not every meal", () => {
  const result = optimizeMenu({
    members: [member(["peanuts"]), member(["milk"])],
    dishes: [meal(), meal({ _id: "dish-2", name: "Milk rice", containsAllergens: ["milk"] })],
  });
  assert.equal(result.coveredMembers, 2);
  assert.equal(result.uncoveredMembers, 0);
  assert.equal(result.coveragePercentage, 100);
  assert.deepEqual(result.blockingAllergens, []);
  assert.deepEqual(result.suggestions, []);
});

test("high risk and review needed both leave a profiled member uncovered", () => {
  const result = optimizeMenu({
    members: [member(["peanuts"]), member(["milk"])],
    dishes: [meal({ mayContainAllergens: ["milk"] })],
  });
  assert.equal(result.coveredMembers, 0);
  assert.equal(result.uncoveredMembers, 2);
  assert.equal(result.coveragePercentage, 0);
});

test("no published meals produces an add-option suggestion for all profiled guests", () => {
  const result = optimizeMenu({ members: [member(["peanuts"]), member(["milk"])], dishes: [] });
  assert.equal(result.uncoveredMembers, 2);
  assert.equal(result.publishedMeals, 0);
  assert.equal(result.suggestions.length, 1);
  assert.equal(result.suggestions[0].type, "add-option");
  assert.equal(result.suggestions[0].estimatedAdditionalMembers, 2);
});

test("single-allergen reviews count only newly covered members", () => {
  const result = optimizeMenu({ members: [member(["peanuts"]), member(["peanuts"]), member(["soy"])], dishes: [meal()] });
  assert.equal(result.profiledMembers, 3);
  assert.equal(result.coveredMembers, 1);
  assert.equal(result.coveragePercentage, 33.3);
  assert.equal(removals(result).length, 1);
  assert.equal(removals(result)[0].estimatedAdditionalMembers, 2);
  assert.deepEqual(removals(result)[0].allergens, ["peanuts"]);
  assert.match(removals(result)[0].reasons[0], /every other meal restriction/);
  assert.match(removals(result)[0].caution, /Confirm the full recipe/);
});

test("one-allergen hypotheticals do not remove a member's other known conflicts", () => {
  const result = optimizeMenu({
    members: [member(["peanuts", "milk"]), member(["peanuts"])],
    dishes: [meal({ containsAllergens: ["peanuts", "milk"] })],
  });
  assert.equal(removals(result).length, 1);
  assert.deepEqual(removals(result)[0].allergens, ["peanuts"]);
  assert.equal(removals(result)[0].estimatedAdditionalMembers, 1);
});

test("removal estimates never clear possible matches, incomplete ingredients, or cross-contact blockers", () => {
  for (const extra of [
    { mayContainAllergens: ["peanuts"] },
    { ingredientListComplete: false },
    { ingredients: [] },
    { crossContactStatus: "unknown" },
    { crossContactStatus: "possible" },
  ]) {
    assert.deepEqual(removals(optimizeMenu({ members: [member(["peanuts"])], dishes: [meal(extra)] })), []);
  }
});

test("normalization produces one suggestion per exact allergen and never matches substrings", () => {
  const result = optimizeMenu({
    members: [member([" TREE   NUTS "]), member(["fish"])],
    dishes: [meal({ containsAllergens: ["tree nuts", " TREE   NUTS ", "shellfish"] })],
  });
  assert.equal(result.coveredMembers, 1);
  assert.equal(removals(result).length, 1);
  assert.deepEqual(removals(result)[0].allergens, ["tree nuts"]);
});

test("ingredient-removal suggestions rank by newly covered guests", () => {
  const result = optimizeMenu({
    members: [member(["peanuts"]), member(["peanuts"]), member(["milk"])],
    dishes: [meal({ containsAllergens: ["milk", "peanuts"] })],
  });
  assert.deepEqual(removals(result).map((item) => [item.allergens[0], item.estimatedAdditionalMembers]), [["peanuts", 2], ["milk", 1]]);
});

test("equal gains prefer a single-allergen review over a new recipe avoiding multiple allergens", () => {
  const result = optimizeMenu({ members: [member(["peanuts", "milk"])], dishes: [meal()] });
  assert.deepEqual(result.suggestions.map((item) => item.type), ["ingredient-removal", "add-option"]);
  assert.deepEqual(result.suggestions[1].avoidAllergens, ["milk", "peanuts"]);
});

test("ties and output are deterministic even when dishes and members are reordered", () => {
  const event = {
    members: [member(["peanuts", "milk"]), member(["peanuts"])],
    dishes: [meal({ _id: "b", name: "Zebra noodles" }), meal({ _id: "a", name: "Apple noodles" })],
  };
  const first = optimizeMenu(event);
  const second = optimizeMenu({ ...event, members: [...event.members].reverse(), dishes: [...event.dishes].reverse() });
  assert.deepEqual(first, second);
  assert.deepEqual(removals(first).map((item) => item.dishName), ["Apple noodles", "Zebra noodles"]);
  assert.deepEqual(first.suggestions.map((item) => item.rank), [1, 2, 3]);
  assert.match(first.estimateNote, /overlap; do not add them together/);
});

test("unpublished meals affect neither coverage, blockers, missing information nor suggestions", () => {
  const result = optimizeMenu({
    members: [member(["milk"])],
    dishes: [meal({ containsAllergens: ["milk"] }), meal({ name: "Hidden option", isPublished: false, containsAllergens: [], ingredientListComplete: false })],
  });
  assert.equal(result.uncoveredMembers, 1);
  assert.equal(result.publishedMeals, 1);
  assert.doesNotMatch(JSON.stringify(result), /Hidden option/);
});

test("missing-information reviews explain all unknowns and do not estimate extra coverage", () => {
  const result = optimizeMenu({
    members: [member(["peanuts"])],
    dishes: [meal({ ingredientListComplete: false, ingredients: [], crossContactStatus: "unknown" })],
  });
  const missing = result.suggestions.find((item) => item.type === "missing-information");
  assert.equal(missing.estimatedAdditionalMembers, null);
  assert.equal(missing.reasons.length, 3);
  assert.match(missing.action, /Complete the ingredient and preparation details/);
  assert.match(missing.caution, /Impact stays unknown/);
  assert.deepEqual(removals(result), []);
});

test("add-option avoidance combines only uncovered members' listed allergies with the blacklist", () => {
  const result = optimizeMenu({
    members: [member(["peanuts"], { otherAllergies: [" KIWI ", "kiwi"] }), member(["milk"]), member(["soy"])],
    dishes: [meal({ containsAllergens: ["peanuts", "milk"] })],
    foodBlacklist: ["SESAME", "sesame"],
  });
  const added = result.suggestions.find((item) => item.type === "add-option");
  assert.equal(added.estimatedAdditionalMembers, 2);
  assert.deepEqual(added.avoidAllergens, ["kiwi", "milk", "peanuts", "sesame"]);
  assert.match(added.action, /avoids kiwi, milk, peanuts, sesame/);
  assert.match(added.caution, /not a safety guarantee/);
});

test("blacklist conflicts in ingredients or possible allergens block hypothetical gains", () => {
  for (const extra of [{ ingredients: ["sesame"] }, { mayContainAllergens: ["sesame"] }]) {
    const result = optimizeMenu({ members: [member(["peanuts"])], dishes: [meal(extra)], foodBlacklist: [" Sesame "] });
    assert.equal(result.coveredMembers, 0);
    assert.deepEqual(removals(result), []);
    assert.deepEqual(result.blacklistConflicts[0].allergens, ["sesame"]);
    assert.deepEqual(result.suggestions.find((item) => item.type === "add-option").avoidAllergens, ["peanuts", "sesame"]);
  }
});

test("removing a containsAllergens label cannot erase an existing blacklist conflict", () => {
  const result = optimizeMenu({
    members: [member(["peanuts"])], dishes: [meal({ ingredients: ["rice"] })], foodBlacklist: ["peanuts"],
  });
  assert.deepEqual(removals(result), []);
  assert.equal(result.blacklistConflicts.length, 1);
});

test("legacy blacklists work and an explicitly cleared blacklist replaces them", () => {
  const event = { members: [member(["peanuts"])], dishes: [meal()], foodAllergenBlacklist: ["peanuts"] };
  assert.deepEqual(removals(optimizeMenu(event)), []);
  assert.equal(removals(optimizeMenu({ ...event, foodBlacklist: [] })).length, 1);
});

test("allergen blockers count distinct uncovered guests rather than matches per meal", () => {
  const result = optimizeMenu({
    members: [member(["peanuts"]), member(["peanuts"]), member(["milk", "tree nuts"]), member(["soy"])],
    dishes: [meal({ containsAllergens: ["peanuts", "milk"], mayContainAllergens: ["tree nuts"] }), meal({ _id: "second", containsAllergens: ["peanuts", "milk"], mayContainAllergens: ["tree nuts"] })],
  });
  assert.deepEqual(result.blockingAllergens, [
    { allergen: "peanuts", affectedMembers: 2, knownMatchMembers: 2, possibleMatchMembers: 0 },
    { allergen: "milk", affectedMembers: 1, knownMatchMembers: 1, possibleMatchMembers: 0 },
    { allergen: "tree nuts", affectedMembers: 1, knownMatchMembers: 0, possibleMatchMembers: 1 },
  ]);
});

test("analysis is pure and contains no member names, emails, IDs, or notes", () => {
  const event = {
    members: [member(["peanuts"], { user: "private-member-id", displayName: "Private Person", email: "private@example.invalid", note: "Private note" })],
    dishes: [meal()],
  };
  const original = structuredClone(event);
  function freeze(value) {
    if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  }
  freeze(event);
  const result = optimizeMenu(event);
  assert.deepEqual(event, original);
  assert.doesNotMatch(JSON.stringify(result), /private-member-id|Private Person|private@example.invalid|Private note/);
  assert.match(result.disclaimer, /not a safety guarantee/);
});
