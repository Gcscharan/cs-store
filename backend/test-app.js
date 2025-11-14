const express = require("express");
const app = express();

app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

app.get("/api/payment/test", (req, res) => {
  res.json({ message: "Test route working!" });
});

const PORT = 5002;
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
});
