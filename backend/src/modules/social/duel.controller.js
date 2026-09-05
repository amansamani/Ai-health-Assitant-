const logger = require("../../config/logger");
const Duel = require("./duel.model");
const Friendship = require("./friendship.model");
const { computeDuelProgress, resolveDuelIfExpired } = require("./duel.service");
const { sendEventNotification } = require("../../notifications/engagement.service");

const PUBLIC_FIELDS = "name username picture hasProfilePhoto profileImageUpdatedAt";

function canonicalPair(idA, idB) {
  const a = idA.toString();
  const b = idB.toString();
  return a < b ? [a, b] : [b, a];
}

async function areFriends(idA, idB) {
  const [user1, user2] = canonicalPair(idA, idB);
  const friendship = await Friendship.findOne({ user1, user2 });
  return !!friendship;
}

exports.createDuel = async (req, res) => {
  try {
    const { opponentId, metric, durationDays } = req.body;

    if (opponentId === req.user.id) {
      return res.status(400).json({ message: "You can't duel yourself" });
    }
    if (!(await areFriends(req.user.id, opponentId))) {
      return res.status(403).json({ message: "You can only duel friends — add them first" });
    }

    const duel = await Duel.create({
      challenger: req.user.id,
      opponent: opponentId,
      metric,
      durationDays,
      status: "pending",
    });

    // Fire-and-forget — notification delivery should never block the challenge itself.
    sendEventNotification(opponentId, "duelChallenged", { name: req.user.name }, duel._id.toString()).catch(() => {});

    res.status(201).json(duel);
  } catch (err) {
    logger.error({ err }, "Create duel error");
    res.status(500).json({ message: "Failed to create duel" });
  }
};

exports.respondToDuel = async (req, res) => {
  try {
    const { action } = req.body; // "accept" | "decline"
    const duel = await Duel.findById(req.params.id);

    if (!duel) return res.status(404).json({ message: "Duel not found" });
    if (duel.opponent.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only the challenged user can respond to this duel" });
    }
    if (duel.status !== "pending") {
      return res.status(400).json({ message: `Duel is already ${duel.status}` });
    }

    if (action === "accept") {
      const start = new Date();
      const end = new Date(start);
      end.setDate(end.getDate() + duel.durationDays);
      duel.startDate = start;
      duel.endDate = end;
      duel.status = "active";
    } else if (action === "decline") {
      duel.status = "declined";
    } else {
      return res.status(400).json({ message: "action must be 'accept' or 'decline'" });
    }

    await duel.save();

    if (action === "accept") {
      // Fire-and-forget — the challenger should know right away, but a
      // failed push should never fail the accept action itself.
      sendEventNotification(duel.challenger, "duelAccepted", { name: req.user.name }, duel._id.toString()).catch(() => {});
    }

    res.status(200).json(duel);
  } catch (err) {
    logger.error({ err }, "Respond to duel error");
    res.status(500).json({ message: "Failed to respond to duel" });
  }
};

exports.cancelDuel = async (req, res) => {
  try {
    const duel = await Duel.findById(req.params.id);
    if (!duel) return res.status(404).json({ message: "Duel not found" });
    if (duel.challenger.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only the challenger can cancel this duel" });
    }
    if (duel.status !== "pending") {
      return res.status(400).json({ message: "Only a pending duel can be cancelled" });
    }

    duel.status = "cancelled";
    await duel.save();
    res.status(200).json(duel);
  } catch (err) {
    logger.error({ err }, "Cancel duel error");
    res.status(500).json({ message: "Failed to cancel duel" });
  }
};

// Shared by list/get — resolves expired duels lazily and attaches live
// progress so the response always reflects reality, not a stale snapshot.
async function withProgress(duel) {
  await resolveDuelIfExpired(duel);
  const plain = duel.toObject();

  if (duel.status === "completed") {
    plain.challengerScore = duel.finalChallengerScore;
    plain.opponentScore = duel.finalOpponentScore;
  } else if (duel.status === "active") {
    const { challengerScore, opponentScore } = await computeDuelProgress(duel);
    plain.challengerScore = challengerScore;
    plain.opponentScore = opponentScore;
  }
  return plain;
}

exports.listDuels = async (req, res) => {
  try {
    const duels = await Duel.find({
      $or: [{ challenger: req.user.id }, { opponent: req.user.id }],
    })
      .populate("challenger", PUBLIC_FIELDS)
      .populate("opponent", PUBLIC_FIELDS)
      .populate("winner", PUBLIC_FIELDS)
      .sort({ createdAt: -1 });

    const withScores = await Promise.all(duels.map(withProgress));
    res.status(200).json(withScores);
  } catch (err) {
    logger.error({ err }, "List duels error");
    res.status(500).json({ message: "Failed to fetch duels" });
  }
};

exports.getDuel = async (req, res) => {
  try {
    const duel = await Duel.findById(req.params.id)
      .populate("challenger", PUBLIC_FIELDS)
      .populate("opponent", PUBLIC_FIELDS)
      .populate("winner", PUBLIC_FIELDS);

    if (!duel) return res.status(404).json({ message: "Duel not found" });

    const isParticipant =
      duel.challenger._id.toString() === req.user.id ||
      duel.opponent._id.toString() === req.user.id;
    if (!isParticipant) {
      return res.status(403).json({ message: "Not a participant in this duel" });
    }

    res.status(200).json(await withProgress(duel));
  } catch (err) {
    logger.error({ err }, "Get duel error");
    res.status(500).json({ message: "Failed to fetch duel" });
  }
};
