const pool = require("../config/db");

const getInventory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      "SELECT * FROM library_inventory WHERE is_active = TRUE LIMIT ? OFFSET ?",
      [limit, offset]
    );

    const [countResult] = await pool.query(
      "SELECT COUNT(*) as total FROM library_inventory WHERE is_active = TRUE"
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

const addBook = async (req, res) => {
  const { title, author, isbn, category, total_stock } = req.body;

  try {
    await pool.query(
      "INSERT INTO library_inventory (title, author, isbn, category, total_stock, available_stock) VALUES (?, ?, ?, ?, ?, ?)",
      [title, author, isbn, category, total_stock, total_stock]
    );

    res
      .status(201)
      .json({ message: `Success! '${title}' added to inventory.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteBook = async (req, res) => {
  const { inventoryId } = req.params; // Fixed: was req.body

  try {
    await pool.query(
      "UPDATE library_inventory SET is_active = FALSE WHERE inventory_id = ?",
      [inventoryId]
    );

    res.json({ message: "Item archived successfully (Soft Delete)." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getInventory, addBook, deleteBook };
