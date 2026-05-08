process.on("uncaughtException", (err) => {
  console.error("❌ Bot error:", err.message);
});

process.on("unhandledRejection", (err) => {
  console.error("❌ Bot rejection:", err?.message || err);
});

require("./server");
require("./bot");
