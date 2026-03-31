export type PredefinedSuggestionReason = "exact" | "startsWith" | "contains" | "similar";

export type PredefinedSuggestion = {
  name: string;
  reason: PredefinedSuggestionReason;
};

function normalizeSuggestionText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, "");
}

function getLevenshteinDistance(left: string, right: string) {
  if (!left) {
    return right.length;
  }

  if (!right) {
    return left.length;
  }

  const previousRow = Array.from({ length: right.length + 1 }, (_, index) => index);
  const currentRow = new Array(right.length + 1).fill(0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    currentRow[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;

      currentRow[rightIndex] = Math.min(
        currentRow[rightIndex - 1] + 1,
        previousRow[rightIndex] + 1,
        previousRow[rightIndex - 1] + substitutionCost,
      );
    }

    for (let index = 0; index < previousRow.length; index += 1) {
      previousRow[index] = currentRow[index];
    }
  }

  return previousRow[right.length];
}

function getSimilarity(left: string, right: string) {
  if (!left || !right) {
    return 0;
  }

  const distance = getLevenshteinDistance(left, right);
  return 1 - distance / Math.max(left.length, right.length);
}

function getSubsequenceGap(query: string, candidate: string) {
  if (!query || query.length > candidate.length) {
    return null;
  }

  let queryIndex = 0;
  let lastMatchIndex = -1;
  let gapCount = 0;

  for (let candidateIndex = 0; candidateIndex < candidate.length; candidateIndex += 1) {
    if (candidate[candidateIndex] !== query[queryIndex]) {
      continue;
    }

    if (lastMatchIndex >= 0) {
      gapCount += candidateIndex - lastMatchIndex - 1;
    }

    lastMatchIndex = candidateIndex;
    queryIndex += 1;

    if (queryIndex === query.length) {
      return gapCount;
    }
  }

  return null;
}

function getSuggestionScore(query: string, item: string, index: number) {
  const normalizedItem = normalizeSuggestionText(item);
  const collapsedItem = collapseWhitespace(normalizedItem);
  const collapsedQuery = collapseWhitespace(query);
  const itemTokens = normalizedItem.split(" ").filter(Boolean);

  let bestScore = Number.NEGATIVE_INFINITY;
  let bestReason: PredefinedSuggestionReason | null = null;

  function registerMatch(score: number, reason: PredefinedSuggestionReason) {
    if (score > bestScore) {
      bestScore = score;
      bestReason = reason;
    }
  }

  if (normalizedItem === query || collapsedItem === collapsedQuery) {
    registerMatch(1400, "exact");
  }

  if (normalizedItem.startsWith(query)) {
    registerMatch(1200 - (normalizedItem.length - query.length) * 0.35, "startsWith");
  }

  if (collapsedItem.startsWith(collapsedQuery)) {
    registerMatch(1180 - (collapsedItem.length - collapsedQuery.length) * 0.35, "startsWith");
  }

  const tokenPrefixIndex = itemTokens.findIndex(
    (token) => token.startsWith(query) || collapseWhitespace(token).startsWith(collapsedQuery),
  );

  if (tokenPrefixIndex >= 0) {
    registerMatch(1110 - tokenPrefixIndex * 12, "startsWith");
  }

  const directContainsIndex = normalizedItem.indexOf(query);

  if (directContainsIndex >= 0) {
    registerMatch(960 - directContainsIndex * 3, "contains");
  }

  const collapsedContainsIndex = collapsedItem.indexOf(collapsedQuery);

  if (collapsedContainsIndex >= 0) {
    registerMatch(940 - collapsedContainsIndex * 2, "contains");
  }

  const tokenContainsIndex = itemTokens.findIndex((token) => token.includes(query));

  if (tokenContainsIndex >= 0) {
    registerMatch(920 - tokenContainsIndex * 8, "contains");
  }

  if (collapsedQuery.length >= 3) {
    const subsequenceGap = getSubsequenceGap(collapsedQuery, collapsedItem);

    if (subsequenceGap !== null) {
      registerMatch(790 - subsequenceGap * 2, "similar");
    }

    const fuzzySimilarity = Math.max(
      getSimilarity(collapsedQuery, collapsedItem),
      ...itemTokens.map((token) => getSimilarity(collapsedQuery, collapseWhitespace(token))),
    );

    if (fuzzySimilarity >= 0.54) {
      registerMatch(700 + fuzzySimilarity * 100, "similar");
    }
  }

  if (!bestReason) {
    return null;
  }

  return {
    name: item,
    reason: bestReason,
    score: bestScore - index * 0.001,
  };
}

export function getPredefinedSuggestions(items: readonly string[], query: string, maxResults = 6) {
  const normalizedQuery = normalizeSuggestionText(query);

  if (!normalizedQuery) {
    return [];
  }

  return items
    .map((item, index) => getSuggestionScore(normalizedQuery, item, index))
    .filter((item): item is PredefinedSuggestion & { score: number } => item !== null)
    .sort((left, right) => right.score - left.score)
    .slice(0, maxResults)
    .map(({ name, reason }) => ({
      name,
      reason,
    }));
}
