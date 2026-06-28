// exerciseImages.js — replaces exerciseSvgs.js
// WebP files: ~5-9KB each vs 200-1400KB SVGs — 99% smaller, instant render

export const EXERCISE_IMAGES = {
  // PUSH
  pushup:                    require("../../assets/exercises/webp/pushups.webp"),
  bench_press:               require("../../assets/exercises/webp/bench_press.webp"),
  chest_fly:                 require("../../assets/exercises/webp/chest_fly.webp"),
  isometric_chest:           require("../../assets/exercises/webp/isometric_chest_hold.webp"),

  // PULL / BACK
  pullup:                    require("../../assets/exercises/webp/pullups.webp"),
  lat_pulldown:              require("../../assets/exercises/webp/lat_pulldown.webp"),
  isometric_towel:           require("../../assets/exercises/webp/isometric_towel_rows.webp"),
  face_pull:                 require("../../assets/exercises/webp/face_pulls.webp"),
  deadlift:                  require("../../assets/exercises/webp/deadlift.webp"),
  romanian_deadlift:         require("../../assets/exercises/webp/romanian_deadlift.webp"),
  back_extension:            require("../../assets/exercises/webp/back_extension.webp"),
  rowing:                    require("../../assets/exercises/webp/rowing_machine.webp"),
  upright_row:               require("../../assets/exercises/webp/upright_rows.webp"),

  // LEGS
  squat:                     require("../../assets/exercises/webp/squats.webp"),
  lunge:                     require("../../assets/exercises/webp/lunges.webp"),
  leg_press:                 require("../../assets/exercises/webp/leg_press.webp"),
  leg_extension:             require("../../assets/exercises/webp/leg_extension.webp"),
  calf_raise:                require("../../assets/exercises/webp/calf_raises.webp"),
  leg_curl:                  require("../../assets/exercises/webp/leg_curl.webp"),
  wallsit:                   require("../../assets/exercises/webp/wall_sit.webp"),
  glute_bridges:             require("../../assets/exercises/webp/glute_bridges.webp"),

  // CORE
  plank:                     require("../../assets/exercises/webp/plank.webp"),
  plank_side:                require("../../assets/exercises/webp/side_plank.webp"),
  crunch:                    require("../../assets/exercises/webp/bicycle_crunch.webp"),
  cable_crunch:              require("../../assets/exercises/webp/cable_crunch.webp"),
  leg_raise:                 require("../../assets/exercises/webp/leg_raises.webp"),
  light_core:                require("../../assets/exercises/webp/light_core_work.webp"),
  twist:                     require("../../assets/exercises/webp/russian_twists.webp"),
  ab_rollout:                require("../../assets/exercises/webp/ab_rollout.webp"),

  // SHOULDERS
  shoulder_press:            require("../../assets/exercises/webp/shoulder_press.webp"),
  overhead_press:            require("../../assets/exercises/webp/overhead_press.webp"),
  shoulder_taps:             require("../../assets/exercises/webp/shoulder_taps.webp"),
  lateral_raise:             require("../../assets/exercises/webp/lateral_raises.webp"),
  front_raise:               require("../../assets/exercises/webp/front_raises.webp"),
  rear_delt:                 require("../../assets/exercises/webp/rear_delt_fly.webp"),
  shrug:                     require("../../assets/exercises/webp/shrugs.webp"),

  // ARMS
  bicep_curl:                require("../../assets/exercises/webp/bicep_curls.webp"),
  incline_press:             require("../../assets/exercises/webp/incline_dumbell_press.webp"),
  barbell_curl:              require("../../assets/exercises/webp/barbell_curl.webp"),
  towel_bicep:               require("../../assets/exercises/webp/towel_bicep_curls.webp"),
  tricep_pushdown:           require("../../assets/exercises/webp/tricep_pushdown.webp"),
  overhead_tricep_extension: require("../../assets/exercises/webp/overhead_tricep_extension.webp"),
  tricep_extension:          require("../../assets/exercises/webp/tricep_extension.webp"),
  dips:                      require("../../assets/exercises/webp/dips.webp"),
  skull_crusher:             require("../../assets/exercises/webp/skull_crusher.webp"),
  arm_circles:               require("../../assets/exercises/webp/arm_circle.webp"),

  // CARDIO
  high_knees:                require("../../assets/exercises/webp/high_knees.webp"),
  burpees:                   require("../../assets/exercises/webp/burpees.webp"),
  cycling:                   require("../../assets/exercises/webp/cycling.webp"),
  brisk_walking:             require("../../assets/exercises/webp/brisk_walking.webp"),
  treadmill:                 require("../../assets/exercises/webp/treadmill_walk.webp"),
  elliptical:                require("../../assets/exercises/webp/elliptical.webp"),
  deep_breathing:            require("../../assets/exercises/webp/deep_breathing.webp"),
  superman_hold:             require("../../assets/exercises/webp/superman_hold.webp"),
  handstand_hold:            require("../../assets/exercises/webp/handstand_hold.webp"),
  jump_rope:                 require("../../assets/exercises/webp/jump_rope.webp"),
  box_jump:                  require("../../assets/exercises/webp/box_jumps.webp"),
  kettlebell:                require("../../assets/exercises/webp/kettlebell_swings.webp"),
  battle_rope:               require("../../assets/exercises/webp/battle_ropes.webp"),
  dead_hang:                 require("../../assets/exercises/webp/dead_hang.webp"),
  yoga_flow:                 require("../../assets/exercises/webp/yoga_flow.webp"),

  // STRETCHING
  stretching:                require("../../assets/exercises/webp/stretching.webp"),
  foam_rolling:              require("../../assets/exercises/webp/foam_rolling.webp"),

  // FALLBACK
  default:                   require("../../assets/exercises/webp/pushups.webp"),
};
