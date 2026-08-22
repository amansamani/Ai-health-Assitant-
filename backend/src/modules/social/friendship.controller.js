const logger = require("../../config/logger");
const User = require("../../models/User");
const Friendship = require("./friendship.model");

// Excludes visually-ambiguous characters (0/O, 1/I/L) since this gets
// read off a phone screen and typed in by hand.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCode(length = 6) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

// user1/user2 always stored in the same order for any given pair,
// regardless of who added whom — lets the unique index actually prevent
// duplicates, and makes "are these two already friends" a single query.
function canonicalPair(idA, idB) {
  const a = idA.toString();
  const b = idB.toString();
  return a < b ? [a, b] : [b, a];
}

const PUBLIC_FIELDS = "name username picture bio profileVisibility profileImageUpdatedAt";

exports.getMyCode = async (req, res) => {
  try {
    if (req.user.friendCode) {
      return res.status(200).json({ friendCode: req.user.friendCode });
    }

    // Generate + retry on the rare collision, rather than pre-generating
    // codes for every user up front.
    let code, saved = false;
    for (let attempt = 0; attempt < 5 && !saved; attempt++) {
      code = generateCode();
      try {
        await User.updateOne({ _id: req.user.id }, { friendCode: code });
        saved = true;
      } catch (err) {
        if (err.code !== 11000) throw err; // collision — loop and retry
      }
    }
    if (!saved) {
      return res.status(500).json({ message: "Could not generate a friend code, try again" });
    }

    res.status(200).json({ friendCode: code });
  } catch (err) {
    logger.error({ err }, "Get friend code error");
    res.status(500).json({ message: "Failed to get friend code" });
  }
};

exports.addFriend = async (req, res) => {
  try {
    const { code } = req.body;
    const target = await User.findOne({ friendCode: code.toUpperCase() }).select(PUBLIC_FIELDS);

    if (!target) {
      return res.status(404).json({ message: "No user found with that code" });
    }
    if (target._id.toString() === req.user.id) {
      return res.status(400).json({ message: "You can't add yourself" });
    }

    const [user1, user2] = canonicalPair(req.user.id, target._id);

    const friendship = await Friendship.findOneAndUpdate(
      { user1, user2 },
      { user1, user2 },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ message: "Friend added", friend: target, friendship });
  } catch (err) {
    logger.error({ err }, "Add friend error");
    res.status(500).json({ message: "Failed to add friend" });
  }
};

exports.listFriends = async (req, res) => {
  try {
    const friendships = await Friendship.find({
      $or: [{ user1: req.user.id }, { user2: req.user.id }],
    })
      .populate("user1", PUBLIC_FIELDS)
      .populate("user2", PUBLIC_FIELDS)
      .sort({ createdAt: -1 })
      .lean();

    const friends = friendships.map((f) => {
      const other = f.user1._id.toString() === req.user.id ? f.user2 : f.user1;
      return { friendshipId: f._id, since: f.createdAt, ...other };
    });

    res.status(200).json(friends);
  } catch (err) {
    logger.error({ err }, "List friends error");
    res.status(500).json({ message: "Failed to fetch friends" });
  }
};

exports.removeFriend = async (req, res) => {
  try {
    const { friendId } = req.params;
    const [user1, user2] = canonicalPair(req.user.id, friendId);

    const deleted = await Friendship.findOneAndDelete({ user1, user2 });
    if (!deleted) {
      return res.status(404).json({ message: "Friendship not found" });
    }

    res.status(200).json({ message: "Friend removed" });
  } catch (err) {
    logger.error({ err }, "Remove friend error");
    res.status(500).json({ message: "Failed to remove friend" });
  }
};
