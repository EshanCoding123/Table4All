const {
  normalizeList,
  getEventFoodBlacklist,
  findBlacklistMatches,
  reviewMeal,
} = require("./meal-review");

// Code-point comparisons keep tie-breaking independent of the machine's locale.
function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedList(value) {
  return normalizeList(value).sort(compareText);
}

function mealReference(dish) {
  return {
    dishId: dish._id || dish.id ? String(dish._id || dish.id) : null,
    dishName: dish.name || "Untitled meal",
  };
}

function missingInformation(dish) {
  const reasons = [];
  if (dish.ingredientListComplete !== true) {
    reasons.push("Ingredient list incomplete.");
  }
  if (!normalizeList(dish.ingredients).length) {
    reasons.push("No ingredients listed.");
  }
  if (!["reported-separate", "possible"].includes(dish.crossContactStatus)) {
    reasons.push("Cross-contact details missing.");
  }
  return reasons;
}

function rankSuggestions(left, right) {
  return (right.estimatedAdditionalMembers ?? -1) - (left.estimatedAdditionalMembers ?? -1)
    // All removal reviews concern one allergen; a new recipe has unknown effort.
    || (left.type === "ingredient-removal" ? 0 : 1) - (right.type === "ingredient-removal" ? 0 : 1)
    || compareText(String(left.dishName || "").toLowerCase(), String(right.dishName || "").toLowerCase())
    || compareText((left.allergens || []).join(","), (right.allergens || []).join(","))
    || compareText(left.dishId || "", right.dishId || "")
    || compareText(JSON.stringify(left), JSON.stringify(right));
}

function optimizeMenu(event) {
  // The host is also stored in Event.members, but is not a guest to cover.
  const members = (event.members || []).filter((member) => member.role === "member");
  const profiled = members.filter((member) => member.profileComplete === true);
  const dishes = (event.dishes || []).filter((dish) => dish.isPublished === true);
  const blacklist = sortedList(getEventFoodBlacklist(event));
  const reviews = profiled.map((member) => dishes.map((dish) => reviewMeal(dish, member, blacklist)));
  const uncovered = profiled.filter((member, index) =>
    !reviews[index].some((review) => review.status === "NO LISTED CONFLICT")
  );
  const coveredCount = profiled.length - uncovered.length;

  // Count each uncovered guest once per allergen, even if several meals match.
  // These are observed blockers, not promises of coverage from removing them.
  const allergenCounts = new Map();
  reviews.forEach((memberReviews) => {
    if (memberReviews.some((review) => review.status === "NO LISTED CONFLICT")) return;
    const known = new Set(memberReviews.flatMap((review) => review.knownMatches));
    const possible = new Set(memberReviews.flatMap((review) => review.possibleMatches));
    for (const allergen of new Set([...known, ...possible])) {
      const counts = allergenCounts.get(allergen) || { allergen, affectedMembers: 0, knownMatchMembers: 0, possibleMatchMembers: 0 };
      counts.affectedMembers += 1;
      if (known.has(allergen)) counts.knownMatchMembers += 1;
      if (possible.has(allergen)) counts.possibleMatchMembers += 1;
      allergenCounts.set(allergen, counts);
    }
  });

  const suggestions = [];
  const blacklistConflicts = [];
  for (const dish of dishes) {
    const reference = mealReference(dish);
    const blacklistMatches = sortedList(findBlacklistMatches(dish, blacklist));
    if (blacklistMatches.length) {
      blacklistConflicts.push({ ...reference, allergens: blacklistMatches });
    }
    for (const allergen of sortedList(dish.containsAllergens)) {
      // Only containsAllergens changes in this hypothetical. The recipe,
      // possible allergens, completeness and preparation information stay intact.
      const hypothetical = {
        ingredients: dish.ingredients,
        containsAllergens: normalizeList(dish.containsAllergens).filter((item) => item !== allergen),
        mayContainAllergens: dish.mayContainAllergens,
        ingredientListComplete: dish.ingredientListComplete,
        crossContactStatus: dish.crossContactStatus,
      };
      // Never infer that deleting a label resolves an existing blacklist conflict,
      // even when that label was the only place the blacklist item was recorded.
      const gain = blacklistMatches.length ? 0 : uncovered.filter((member) =>
        reviewMeal(hypothetical, member, blacklist).status === "NO LISTED CONFLICT"
      ).length;
      if (!gain) continue;
      suggestions.push({
        type: "ingredient-removal",
        ...reference,
        allergens: [allergen],
        estimatedAdditionalMembers: gain,
        title: "Review one ingredient",
        action: `Could ${allergen} be removed or replaced in ${reference.dishName}?`,
        reasons: [
          "This estimate keeps every other meal restriction in place.",
        ],
        caution: "Confirm the full recipe, replacement, and preparation before updating the meal.",
      });
    }

    const unknowns = missingInformation(dish);
    if (unknowns.length) {
      suggestions.push({
        type: "missing-information",
        ...reference,
        estimatedAdditionalMembers: null,
        title: "Complete meal details",
        action: `Complete the ingredient and preparation details for ${reference.dishName}.`,
        reasons: unknowns,
        caution: "Impact stays unknown until the meal is updated.",
      });
    }
  }

  if (uncovered.length) {
    const allergens = sortedList(uncovered.flatMap((member) => [
      ...normalizeList(member.allergies), ...normalizeList(member.otherAllergies),
    ]));
    const avoidAllergens = sortedList([...allergens, ...blacklist]);
    const avoidance = avoidAllergens.length ? ` that avoids ${avoidAllergens.join(", ")}` : "";
    suggestions.push({
      type: "add-option",
      allergens,
      avoidAllergens,
      estimatedAdditionalMembers: uncovered.length,
      title: "Add one option",
      action: `Add a documented option${avoidance}.`,
      reasons: [
        "The avoidance list includes uncovered members’ allergens and the event blacklist.",
      ],
      caution: "Confirm ingredients and preparation. This is not a safety guarantee.",
    });
  }

  return {
    profiledMembers: profiled.length,
    coveredMembers: coveredCount,
    uncoveredMembers: uncovered.length,
    coveragePercentage: profiled.length ? Math.round(coveredCount / profiled.length * 1000) / 10 : null,
    missingProfiles: members.length - profiled.length,
    publishedMeals: dishes.length,
    foodBlacklist: blacklist,
    blockingAllergens: [...allergenCounts.values()].sort((a, b) =>
      b.affectedMembers - a.affectedMembers || compareText(a.allergen, b.allergen)
    ),
    blacklistConflicts: blacklistConflicts.sort((a, b) =>
      compareText(JSON.stringify(a), JSON.stringify(b))
    ),
    suggestions: suggestions.sort(rankSuggestions).map((suggestion, index) => ({ rank: index + 1, ...suggestion })),
    disclaimer: "Coverage means at least one ‘No listed conflict’ meal. It is not a safety guarantee.",
    estimateNote: "Estimates overlap; do not add them together. No data is changed.",
  };
}

module.exports = { optimizeMenu };
