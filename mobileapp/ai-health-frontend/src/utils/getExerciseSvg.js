import { EXERCISE_SVGS } from "../constants/exerciseSvgs";

export const getExerciseSvg = (imageKey) => {
  return EXERCISE_SVGS[imageKey] || EXERCISE_SVGS.default;
};