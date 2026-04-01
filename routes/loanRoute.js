const express = require("express");
const router = express.Router();

const {
  reserveBook,
  borrowBook,
  returnBook,
  myLoans,
} = require("../controllers/loanController");

router.get("/my-loans/:borrowerId", myLoans); // borrowerId in params

router.post("/reserve", reserveBook);
router.post("/borrow", borrowBook);
router.post("/return", returnBook);

module.exports = router;
