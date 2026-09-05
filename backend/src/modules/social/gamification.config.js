"use strict";

const LEVELS = [
  { level: 1, minXp: 0, title: "Rookie" },
  { level: 2, minXp: 150, title: "Rising" },
  { level: 3, minXp: 400, title: "Committed" },
  { level: 4, minXp: 800, title: "Disciplined" },
  { level: 5, minXp: 1400, title: "Strong" },
  { level: 6, minXp: 2200, title: "Athlete" },
  { level: 7, minXp: 3300, title: "Elite" },
  { level: 8, minXp: 4700, title: "Champion" },
  { level: 9, minXp: 6500, title: "Legend" },
  { level: 10, minXp: 8500, title: "Icon" },
];

const XP_VALUES = {
  exerciseConfirmed: 10,
  workoutCompleted: 50,
  mealLogged: 10,
  stepsGoal: 20,
  activeBurnGoal: 20,
  duelWin: 100,
  achievementEarned: 50,
  runCompleted: 30,   
  runFiveKPlus: 40,  
};

const RANKS = [
  { key: "bronze", title: "Bronze Dumbbell", icon: "barbell-outline", minLevel: 1 },
  { key: "silver", title: "Silver Dumbbell", icon: "barbell-outline", minLevel: 4 },
  { key: "gold", title: "Gold Dumbbell", icon: "barbell-outline", minLevel: 7 },
  { key: "diamond", title: "Diamond Dumbbell", icon: "diamond-outline", minLevel: 9 },
  { key: "elite", title: "Elite Dumbbell", icon: "trophy-outline", minLevel: 10 },
];

function getLevelFromXp(xp = 0) {
  const value = Math.max(0, Number(xp) || 0);
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (value >= level.minXp) current = level;
    else break;
  }
  return current;
}

function getNextLevel(level) {
  return LEVELS.find((item) => item.level === level + 1) || null;
}

function getRankFromLevel(level = 1) {
  let current = RANKS[0];
  for (const rank of RANKS) {
    if (level >= rank.minLevel) current = rank;
    else break;
  }
  return current;
}

function getGamificationSnapshot(xp = 0) {
  const totalXp = Math.max(0, Number(xp) || 0);
  const levelMeta = getLevelFromXp(totalXp);
  const nextLevel = getNextLevel(levelMeta.level);
  const rank = getRankFromLevel(levelMeta.level);

  const progressXp = nextLevel
    ? totalXp - levelMeta.minXp
    : 1;
  const requiredXp = nextLevel
    ? nextLevel.minXp - levelMeta.minXp
    : 1;

  return {
    totalXp,
    level: levelMeta.level,
    levelTitle: levelMeta.title,
    rank: rank.key,
    rankTitle: rank.title,
    rankIcon: rank.icon,
    nextLevel: nextLevel?.level || null,
    nextLevelXp: nextLevel?.minXp || null,
    xpIntoLevel: Math.max(0, progressXp),
    xpToNextLevel: nextLevel ? Math.max(0, nextLevel.minXp - totalXp) : 0,
    levelProgress: nextLevel ? Math.min(1, Math.max(0, progressXp / requiredXp)) : 1,
  };
}

module.exports = { LEVELS, XP_VALUES, RANKS, getLevelFromXp, getGamificationSnapshot };
