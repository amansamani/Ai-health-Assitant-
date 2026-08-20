// ─────────────────────────────────────────────────────────────────────────
// Notification copy library — the voice of FitLip.
//
// Ground rules for every line in here (don't break these when adding more):
//   1. Never guilt-trip about food, weight, or "failure." No "you didn't
//      eat enough," no "you were lazy today." The nudge is always about
//      the ACT of logging/moving, framed as an invite, never a scolding.
//      This matters more in a health app than almost anywhere else —
//      shame-based fitness copy is a real trigger for disordered patterns.
//   2. Playful > Preachy. If a line reads like a lecture, cut it.
//   3. One emoji max per line. Zomato/Swiggy-style wit, not emoji soup.
//   4. Every moment has several variants so the same user doesn't see the
//      identical line every day — pick() below rotates randomly.
// ─────────────────────────────────────────────────────────────────────────

const NOTIFICATION_COPY = {
  morningKickoff: [
    { title: "Rise and shine ☀️", body: "Your step goal isn't going to hit itself today." },
    { title: "Good morning!", body: "Yesterday's you set the bar — today's you is about to clear it. 💪" },
    { title: "New day, who dis", body: "Same goals, fresh 24 hours. Let's go." },
    { title: "Morning ☕", body: "Coffee first, obviously. Then let's crush today's targets." },
    { title: "Hey, it's FitLip", body: "Just checking in before your day gets loud. You've got this today." },
    { title: "Day {streakDay} 🔥", body: "Your streak is counting on you. No pressure. (Okay, a little pressure.)" },
  ],

  lunchReminder: [
    { title: "Lunch o'clock 🍽️", body: "Snap a pic and let's see what's cooking." },
    { title: "Psst", body: "Your stomach called. It said 'log me before I forget what I ate.' 😄" },
    { title: "10-second favor?", body: "Logging lunch takes less time than deciding what to order." },
    { title: "Hey", body: "Did lunch happen yet? No judgment either way, just log it when it does 👀" },
  ],

  dinnerReminder: [
    { title: "Dinner time 🌙", body: "One more log and today's diary is complete." },
    { title: "Last meal of the day?", body: "Whatever's on the plate tonight, FitLip wants the tea ☕" },
    { title: "Quick one", body: "Log dinner now so future-you doesn't have to remember it tomorrow." },
  ],

  waterNudge: [
    { title: "Hydration check 💧", body: "Your water goal is feeling a little neglected today." },
    { title: "Drink some water", body: "Not because we said so — because you deserve to feel good. 💦" },
    { title: "PSA from your kidneys", body: "Water. Now. They'd appreciate it. 🙏" },
  ],

  stepNudge: [
    { title: "Still time for a walk 🚶", body: "Even a lap around the block counts toward today's goal." },
    { title: "Your steps are napping", body: "Wake them up before the day clocks out 👟" },
    { title: "Fun fact", body: "The couch will still be there after a 10-minute walk." },
    { title: "{stepsLeft} steps to go", body: "That's basically one good playlist's worth of walking." },
  ],

  workoutReminder: [
    { title: "Today's workout is waiting", body: "It won't complete itself. We checked. 💪" },
    { title: "Small effort > perfect effort", body: "Especially the kind that never happens. Let's move." },
    { title: "Your workout plan sent a message", body: "It said: 'where are they?' 👀" },
  ],

  streakAtRisk: [
    { title: "🚨 Streak alert", body: "Your {streakDay}-day streak is on thin ice. A few minutes could save it." },
    { title: "Don't let today be the day", body: "You've come {streakDay} days. Don't stop now. 🔥" },
    { title: "Last call", body: "Your {streakDay}-day streak needs one more push before midnight." },
  ],

  weeklyRecap: [
    { title: "New week, clean slate 📅", body: "Last week's you would be proud of this week's plan." },
    { title: "Monday's here", body: "Let's make last week's best day this week's average day." },
    { title: "Your Weekly Summary is ready", body: "Go see how you did, then let's beat it. 📊" },
  ],

  comeback: [
    { title: "It's been a few days", body: "No guilt, just glad to have you back whenever you're ready. 💜" },
    { title: "Your streak's a little dusty", body: "Let's dust it off together, whenever suits you." },
    { title: "FitLip misses you", body: "Steps miss you. Even the water tracker misses you. 💧" },
  ],

  // ── Event-triggered (not scheduled — fired the moment something happens) ──
  duelChallenged: [
    { title: "{name} just challenged you! ⚡", body: "Duel incoming — accept and show them who's boss." },
    { title: "You've been called out", body: "{name} wants to duel. Tap to accept (or decline, we won't tell)." },
  ],
  duelAccepted: [
    { title: "{name} accepted!", body: "Game on. May the best tracker win. 🔥" },
  ],
  duelWon: [
    { title: "You won! 🏆", body: "Duel against {name}: settled. Screenshot this moment." },
  ],
  duelLost: [
    { title: "So close!", body: "{name} edged you out this time. Rematch? 😏" },
  ],
  duelTie: [
    { title: "It's a tie!", body: "You and {name} finished dead even. Tiebreaker duel?" },
  ],
  achievementEarned: [
    { title: "🏅 New badge!", body: "{achievementTitle} — you're on fire." },
  ],
};

/**
 * Picks a random variant for a moment and fills in {placeholders} from
 * `vars`. Unmatched placeholders are left as-is rather than throwing —
 * a missing var should never crash a notification send.
 */
function pick(moment, vars = {}) {
  const variants = NOTIFICATION_COPY[moment];
  if (!variants || variants.length === 0) return null;

  const { title, body } = variants[Math.floor(Math.random() * variants.length)];
  const fill = (s) => s.replace(/\{(\w+)\}/g, (m, key) => (vars[key] != null ? vars[key] : m));

  return { title: fill(title), body: fill(body) };
}

module.exports = { NOTIFICATION_COPY, pick };
