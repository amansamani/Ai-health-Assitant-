"use strict";

const express = require("express");

const router =
  express.Router();

const auth = require(
  "../../middleware/authMiddleware"
);

const validate = require(
  "../../middleware/validate"
);

const {
  healthProfileSchema,
  healthProfileUpdateSchema,
} = require(
  "../../validation/schemas"
);

const controller =
  require("./health.controller");

/*
 * POST /api/health
 *
 * Creating a health profile requires all required
 * health fields.
 */
router.post(
  "/",
  auth,
  validate(
    healthProfileSchema
  ),
  controller.createOrUpdateHealthProfile
);

/*
 * GET /api/health
 */
router.get(
  "/",
  auth,
  controller.getHealthProfile
);

/*
 * PUT /api/health
 *
 * Partial update is allowed.
 *
 * The controller merges the submitted fields with
 * the existing profile before recalculating all
 * derived values.
 */
router.put(
  "/",
  auth,
  validate(
    healthProfileUpdateSchema
  ),
  controller.createOrUpdateHealthProfile
);

module.exports = router;