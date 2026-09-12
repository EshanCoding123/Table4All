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

function memberWord(count) {
  return count === 1 ? "member" : "members";
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
    reasons.push("The ingredient list is not marked complete.");
  }
  if (!normalizeList(dish.ingredients).length) {
    reasons.push("No ingredients have been provided.");
  }
  if (!["reported-separate", "possible"].includes(dish.crossContactStatus)) {
    reasons.push("Cross-contact information is unclear or has not been provided.");
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
        title: "Ingredient-removal review",
        action: `Review whether ${allergen} can be removed or replaced in ${reference.dishName}. If the recipe and preparation process can be changed safely, this could give ${gain} additional ${memberWord(gain)} an option.`,
        reasons: [
          `${gain === 1 ? "This member currently has" : "These members currently have"} no published option with a NO LISTED CONFLICT result.`,
          "The estimate keeps all other listed allergens, cross-contact information, ingredient completeness, and blacklist restrictions in place.",
        ],
        caution: "Changing an allergen label alone does not establish coverage. Confirm the full recipe, any replacements, and preparation, then update all meal information.",
      });
    }

    const unknowns = missingInformation(dish);
    if (unknowns.length) {
      suggestions.push({
        type: "missing-information",
        ...reference,
        estimatedAdditionalMembers: null,
        title: "Missing-information review",
        action: `Review the ingredient and preparation information for ${reference.dishName}. Completing it may resolve uncertainty, but may also confirm a conflict.`,
        reasons: unknowns,
        caution: "No additional coverage is counted until the information is confirmed and the meal results are recalculated.",
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
      title: "Add one fully documented option",
      action: `Consider adding one fully documented option${avoidance}. This could provide an option for ${uncovered.length} currently uncovered ${memberWord(uncovered.length)} if ingredients and preparation are confirmed.`,
      reasons: [
        "The avoidance list combines all listed allergies of currently uncovered members with the event food blacklist.",
        "The option needs a complete ingredient list, no known or possible matches, and confirmed cross-contact information under the current meal-review rules.",
      ],
      caution: "This is a conditional planning estimate, not a recipe recommendation or a guarantee that a suitable meal can be prepared.",
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
    disclaimer: "Coverage means at least one published meal has a NO LISTED CONFLICT result based on the saved profile. It does not mean allergy-safe. Confirm ingredients and preparation directly.",
    estimateNote: "Suggestions are independent alternatives. Their estimated gains overlap and must not be added together. No meal or profile is changed by this analysis.",
  };
}

module.exports = { optimizeMenu };
