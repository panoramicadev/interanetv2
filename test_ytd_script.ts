import { storage } from "./server/storage";

async function run() {
    try {
        const tot = await storage.getYearlyTotals(2026, {}, '2026-01-31');
        console.log("TOTALS:", tot);
    } catch (e) {
        console.error("Error:", e);
    }
}
run().then(() => process.exit(0)).catch(() => process.exit(1));
