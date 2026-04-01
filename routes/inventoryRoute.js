const express = require("express");
const router = express.Router();

const {
  getInventory,
  addBook,
  deleteBook,
} = require("../controllers/inventoryController");
const { checkLibrarian } = require("../middleware/authMiddleware");

router.get("/", getInventory);
router.post("/add", checkLibrarian, addBook);
router.delete("/delete/:inventoryId", checkLibrarian, deleteBook);

module.exports = router;
