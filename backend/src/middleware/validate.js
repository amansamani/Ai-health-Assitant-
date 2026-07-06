const logger = require("../config/logger");

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
      .join("; ");

    logger.warn({ path: req.path, issues: result.error.issues }, "Validation failed");
    return res.status(400).json({ message });
  }

  req.body = result.data;
  next();
};

module.exports = validate;