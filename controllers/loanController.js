const pool = require("../config/db");

const borrowBook = async (req, res) => {
  const { borrowerId, inventoryId } = req.body;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [items] = await connection.query(
      "SELECT available_stock, title FROM library_inventory WHERE inventory_id = ? FOR UPDATE",
      [inventoryId]
    );

    if (items.length === 0 || items[0].available_stock < 1) {
      throw new Error("Item out of stock or does not exist.");
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);

    await connection.query(
      'INSERT INTO loan_records (borrower_id, inventory_id, status, borrowed_at, due_date) VALUES (?, ?, "active", NOW(), ?)',
      [borrowerId, inventoryId, dueDate]
    );

    await connection.query(
      "UPDATE library_inventory SET available_stock = available_stock - 1 WHERE inventory_id = ?",
      [inventoryId]
    );

    await connection.commit();
    res.json({ message: `Borrowed: ${items[0].title}` });
  } catch (error) {
    await connection.rollback();
    res.status(400).json({ error: error.message });
  } finally {
    connection.release();
  }
};

const returnBook = async (req, res) => {
  const { borrowerId, inventoryId } = req.body;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [loans] = await connection.query(
      'SELECT loan_id, due_date FROM loan_records WHERE borrower_id = ? AND inventory_id = ? AND status = "active" FOR UPDATE',
      [borrowerId, inventoryId]
    );

    if (loans.length === 0) throw new Error("No active loan found.");

    const loan = loans[0];
    const now = new Date();
    const dueDate = new Date(loan.due_date);

    let fee = 0.0;
    if (now > dueDate) {
      const diffTime = Math.abs(now - dueDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      fee = diffDays * 0.5;
    }

    await connection.query(
      'UPDATE loan_records SET status = "returned", returned_at = NOW(), late_fee = ? WHERE loan_id = ?',
      [fee, loan.loan_id]
    );

    await connection.query(
      "UPDATE library_inventory SET available_stock = available_stock + 1 WHERE inventory_id = ?",
      [inventoryId]
    );

    await connection.commit();

    if (fee > 0) {
      res.json({
        message: `Item returned. YOU ARE LATE. Fee: $${fee.toFixed(2)}`,
      });
    } else {
      res.json({ message: "Item returned successfully. No fee." });
    }
  } catch (error) {
    await connection.rollback();
    res.status(400).json({ error: error.message });
  } finally {
    connection.release();
  }
};

// transaction + duplicate reservation guard
const reserveBook = async (req, res) => {
  const { borrowerId, inventoryId } = req.body;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [items] = await connection.query(
      "SELECT available_stock FROM library_inventory WHERE inventory_id = ? FOR UPDATE",
      [inventoryId]
    );

    if (items.length > 0 && items[0].available_stock > 0) {
      await connection.rollback();
      return res
        .status(400)
        .json({ message: "Item is currently available. Just borrow it!" });
    }

    // Check for existing pending reservation to prevent duplicates
    const [existing] = await connection.query(
      'SELECT reservation_id FROM reservations WHERE borrower_id = ? AND inventory_id = ? AND status = "pending"',
      [borrowerId, inventoryId]
    );

    if (existing.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        message: "You already have a pending reservation for this item.",
      });
    }

    await connection.query(
      "INSERT INTO reservations (borrower_id, inventory_id) VALUES (?, ?)",
      [borrowerId, inventoryId]
    );

    await connection.commit();
    res.json({
      message: "Reservation placed. We will notify you when it is available.",
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
};

// borrowerId now comes from params, not open query string
const myLoans = async (req, res) => {
  const { borrowerId } = req.params;

  try {
    const [loans] = await pool.query(
      `SELECT l.loan_id, i.title, l.borrowed_at, l.due_date 
       FROM loan_records l 
       JOIN library_inventory i ON l.inventory_id = i.inventory_id 
       WHERE l.borrower_id = ? AND l.status = 'active'`,
      [borrowerId]
    );

    res.json({ activeLoans: loans });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { reserveBook, borrowBook, returnBook, myLoans };
