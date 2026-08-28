// Pure section-scoring math, shared by the overlay and test/scoring.test.mjs.
globalThis.PROFCHECK_SCORING = (() => {
  // drop metrics are ranged from 0 to 25, no drop rate is higher
  const METRIC_RANGES = {
    rating: { worst: 2, best: 5 },
    gpa: { worst: 2, best: 3.9 },
    dropRate: { worst: 25, best: 0 }
  };

  // Pulls a thin rating toward the mean so "5.0 from two students" cannot win.
  const RATING_PRIOR_COUNT = 5;
  const RATING_PRIOR_VALUE = 3.5;

  const NEUTRAL_VALUE = 0.5;
  const REQUIRED_METRIC_COUNT = 2;

  // ponytail: flat threshold. Raise it if too few sections earn a badge, or make
  // it relative to the spread of the course once there is a reason to.
  const MINIMUM_WINNING_MARGIN = 0.03;

  const SCORING_MODES = {
    balanced: {
      label: "Best Overall",
      weights: { rating: 0.35, gpa: 0.4, dropRate: 0.25 }
    },
    easiestA: {
      label: "Easiest A",
      weights: { rating: 0.1, gpa: 0.7, dropRate: 0.2 }
    },
    lowestRisk: {
      label: "Lowest Risk",
      weights: { rating: 0.3, gpa: 0.15, dropRate: 0.55 }
    }
  };

  /** Weighted 0..1 score, or null when too little is known to rank fairly. */
  function computeScore(result, weights) {
    const metricValues = {
      rating: toRangeFraction(shrinkRating(result?.rmp), "rating"),
      gpa: toRangeFraction(result?.cougarGrades?.gpa, "gpa"),
      dropRate: toRangeFraction(result?.cougarGrades?.dropRate, "dropRate")
    };

    const knownMetricCount = Object.values(metricValues).filter((value) => value != null).length;
    if (knownMetricCount < REQUIRED_METRIC_COUNT) {
      return null;
    }

    // An unknown metric scores neutral at its full weight. Renormalizing onto the
    // weights that remain would reward an instructor for having less data.
    const weightEntries = Object.entries(weights);
    const totalWeight = weightEntries.reduce((sum, [, weight]) => sum + weight, 0);
    const weightedTotal = weightEntries.reduce(
      (sum, [metric, weight]) => sum + ((metricValues[metric] ?? NEUTRAL_VALUE) * weight),
      0
    );

    return weightedTotal / totalWeight;
  }

  function shrinkRating(rmp) {
    // Number(null) is 0, so an absent rating must be rejected before coercion or
    // it scores as the worst possible rating instead of as unknown.
    if (rmp?.avgRating == null) {
      return null;
    }

    const rating = Number(rmp.avgRating);
    if (!Number.isFinite(rating)) {
      return null;
    }

    const ratingCount = Math.max(0, Number(rmp?.numRatings) || 0);
    return ((rating * ratingCount) + (RATING_PRIOR_VALUE * RATING_PRIOR_COUNT))
      / (ratingCount + RATING_PRIOR_COUNT);
  }

  /** Direction falls out of the range: dropRate runs worst 25 -> best 0. */
  function toRangeFraction(value, metric) {
    if (value == null) {
      return null;
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return null;
    }

    const { worst, best } = METRIC_RANGES[metric];
    return clamp((numericValue - worst) / (best - worst), 0, 1);
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  /**
   * Every instructor within MINIMUM_WINNING_MARGIN of the top shares the badge.
   * Two instructors can be genuinely inseparable on this data, and naming one of
   * them would be a coin flip dressed up as a recommendation. Returns nothing when
   * the tie reaches every rival, because then there is nothing to choose between.
   * @param {Map<string, number>} scoresByProfessorKey scored instructors only
   * @param {number} rivalCount every instructor on the course, scored or not
   */
  function pickBadgedProfessors(scoresByProfessorKey, rivalCount) {
    if (!scoresByProfessorKey.size) {
      return new Set();
    }

    const topScore = Math.max(...scoresByProfessorKey.values());
    const tiedKeys = [...scoresByProfessorKey]
      .filter(([, score]) => topScore - score < MINIMUM_WINNING_MARGIN)
      .map(([professorKey]) => professorKey);

    return tiedKeys.length < rivalCount ? new Set(tiedKeys) : new Set();
  }

  return { SCORING_MODES, computeScore, pickBadgedProfessors, MINIMUM_WINNING_MARGIN };
})();
