const pool = require("../config/db");

const checkLibrarian = async (req, res, next) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(401).json({ error: "User ID required for auth." });
  }

  try {
    const [users] = await pool.query(
      "SELECT role FROM borrowers WHERE borrower_id = ?",
      [userId]
    );

    if (users.length === 0 || users[0].role !== "librarian") {
      return res.status(403).json({ error: "Access Denied: Librarians only." });
    }

    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { checkLibrarian };
