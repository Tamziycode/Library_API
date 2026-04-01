require("dotenv").config();

const express = require("express");
const app = express();

app.use(express.json());

const inventoryRoutes = require("./routes/inventoryRoute");
const loanRoutes = require("./routes/loanRoute");

app.use("/inventory", inventoryRoutes);
app.use("/loan", loanRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Library API running on http://localhost:${PORT}`);
});
