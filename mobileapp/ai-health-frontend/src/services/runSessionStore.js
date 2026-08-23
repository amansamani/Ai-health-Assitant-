// A finished run (esp. `route`, which can be thousands of GPS points) is
// too large/awkward to pass through expo-router's string-based params.
// Both RunTrackingScreen and RunSummaryScreen run in the same JS engine
// instance, so a plain module-level object is a perfectly safe, zero-deps
// way to hand the draft off between the two screens.

let draftRun = null;

export function setDraftRun(run) {
  draftRun = run;
}

export function getDraftRun() {
  return draftRun;
}

export function clearDraftRun() {
  draftRun = null;
}
