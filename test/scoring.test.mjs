// node --test test/scoring.test.mjs
import assert from "node:assert/strict";
import test from "node:test";

await import("../src/scoring.js");
const { SCORING_MODES, computeScore, MINIMUM_WINNING_MARGIN } = globalThis.PROFCHECK_SCORING;

const balanced = SCORING_MODES.balanced.weights;

function instructor({ rating, ratingCount = 20, gpa, dropRate }) {
  return {
    rmp: rating == null ? null : { avgRating: rating, numRatings: ratingCount },
    cougarGrades: gpa == null && dropRate == null ? null : { gpa, dropRate }
  };
}

test("one metric is not enough to rank an instructor", () => {
  assert.equal(computeScore(null, balanced), null);
  assert.equal(computeScore(instructor({ rating: 4.5 }), balanced), null);
  assert.equal(computeScore(instructor({ gpa: 3.8 }), balanced), null);
  assert.ok(computeScore(instructor({ rating: 4.5, gpa: 3.8 }), balanced) != null);
});

test("a thin rating is shrunk toward the mean", () => {
  const unproven = computeScore(instructor({ rating: 5, ratingCount: 1, gpa: 3 }), balanced);
  const established = computeScore(instructor({ rating: 4.5, ratingCount: 50, gpa: 3 }), balanced);
  assert.ok(established > unproven, "50 ratings at 4.5 must outrank 1 rating at 5.0");
});

test("drop rate still discriminates inside its real range", () => {
  const safe = computeScore(instructor({ rating: 3, gpa: 3, dropRate: 5 }), balanced);
  const risky = computeScore(instructor({ rating: 3, gpa: 3, dropRate: 14 }), balanced);
  // The old 0-100% axis put this gap at 0.02; it has to actually move the score.
  assert.ok(safe - risky > 0.05, `expected a real gap, got ${safe - risky}`);
});

test("a missing metric scores neutral rather than renormalizing away", () => {
  const complete = computeScore(instructor({ rating: 4.5, gpa: 3.6, dropRate: 3 }), balanced);
  const partial = computeScore(instructor({ rating: 4.5, gpa: 3.6 }), balanced);
  assert.ok(complete > partial, "having more good data must never lower the score");
});

test("values outside the range clamp instead of running away", () => {
  const best = computeScore(instructor({ rating: 5, ratingCount: 5000, gpa: 4.0, dropRate: 0 }), balanced);
  const worst = computeScore(instructor({ rating: 0, ratingCount: 5000, gpa: 0, dropRate: 90 }), balanced);
  assert.ok(best > 0.99 && best <= 1, `top of scale, got ${best}`);
  assert.equal(worst, 0);

  // A 4.5 GPA and a negative drop rate are impossible; neither may exceed the axis.
  assert.equal(computeScore(instructor({ rating: 5, ratingCount: 5000, gpa: 4.5, dropRate: -3 }), balanced), best);
});

test("modes rank the same pair differently", () => {
  const easyGrader = instructor({ rating: 2, gpa: 3.8, dropRate: 20 });
  const safeBet = instructor({ rating: 4.5, gpa: 2.6, dropRate: 2 });

  assert.ok(computeScore(easyGrader, SCORING_MODES.easiestA.weights)
    > computeScore(safeBet, SCORING_MODES.easiestA.weights));
  assert.ok(computeScore(safeBet, SCORING_MODES.lowestRisk.weights)
    > computeScore(easyGrader, SCORING_MODES.lowestRisk.weights));
});

test("a high drop rate no longer wins on a strong GPA alone", () => {
  // Real MATH 3321 data: the old scoring badged Ordonez despite 14.1% withdrawals.
  const ordonez = computeScore(instructor({ rating: 3.0, gpa: 3.1, dropRate: 14.1 }), balanced);
  const hilford = computeScore(instructor({ rating: 2.1, gpa: 3.1, dropRate: 5.2 }), balanced);
  assert.ok(hilford > ordonez, "the same GPA with a third of the withdrawals must rank higher");
  assert.ok(Math.abs(hilford - ordonez) < MINIMUM_WINNING_MARGIN,
    "and it is close enough that neither earns a badge");
});

const { pickBadgedProfessors } = globalThis.PROFCHECK_SCORING;
const scores = (pairs) => new Map(pairs);

test("a clear winner is badged alone", () => {
  const badged = pickBadgedProfessors(scores([["almus", 0.530], ["xhabli", 0.471]]), 2);
  assert.deepEqual([...badged], ["almus"]);
});

test("instructors too close to separate share the badge", () => {
  // Real MATH 3321 data: Hilford and Ordonez differ by 0.005, Ramamurthy by 0.059.
  const badged = pickBadgedProfessors(
    scores([["hilford", 0.474], ["ordonez", 0.469], ["ramamurthy", 0.415]]), 3);
  assert.deepEqual([...badged].sort(), ["hilford", "ordonez"]);
  assert.ok(!badged.has("ramamurthy"), "a clearly worse option must not be badged");
});

test("nothing is badged when the tie reaches every rival", () => {
  assert.equal(pickBadgedProfessors(scores([["a", 0.50], ["b", 0.49]]), 2).size, 0);
  assert.equal(pickBadgedProfessors(scores([["a", 0.50], ["b", 0.49], ["c", 0.48]]), 3).size, 0);
});

test("best of one is never a recommendation", () => {
  assert.equal(pickBadgedProfessors(scores([["solo", 0.9]]), 1).size, 0);
});

test("an unscoreable rival still leaves a real winner", () => {
  // Raj Singh has a rating but no CougarGrades data, so he never scores.
  assert.deepEqual([...pickBadgedProfessors(scores([["rathish das", 0.801]]), 2)], ["rathish das"]);
});
