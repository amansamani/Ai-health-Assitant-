const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const isAdmin = require("../middleware/isAdmin");
const {
  listExercises,
  createExercise,
  updateExercise,
  seedExerciseLibrary,
} = require("../controllers/exerciseController");

router.get("/", auth, listExercises);
router.post("/", auth, isAdmin, createExercise);
router.put("/:id", auth, isAdmin, updateExercise);
router.post("/seed", auth, isAdmin, seedExerciseLibrary);

module.exports = router;
