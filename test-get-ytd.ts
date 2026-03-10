import { storage } from "./server/storage";
async function run() {
  const tot = await storage.getYearlyTotals(2026, {}, '2026-01-31');
  console.log("TOTALS:", tot);
}
run();
