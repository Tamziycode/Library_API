const pool = require("../config/db");

const getInventory = async (req, res) => {
  try {
    // Default to page 1, 10 items per page if not specified
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      "SELECT * FROM library_inventory LIMIT ? OFFSET ?",
      [limit, offset]
    );

    // Also get total count for the frontend to know how many pages exist
    const [countResult] = await pool.query(
      "SELECT COUNT(*) as total FROM library_inventory"
    );

    res.json({
      data: rows,
      pagination: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems: countResult[0].total,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteBook = async (req, res) => {
  const { inventoryId } = req.body; // 'userId' is also required in body for the checkLibrarian middleware

  try {
    await pool.query("DELETE FROM library_inventory WHERE inventory_id = ?", [
      inventoryId,
    ]);
    res.json({ message: "Item deleted from database." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Advanced Library API running on http://localhost:${PORT}`);
});

module.exports = { getInventory, deleteBook };
