import * as XLSX from "xlsx";
import * as fs from "fs";

const file = fs.readFileSync("/Users/jnahuelfil/Desktop/clone-panoramica/intranet-panoramica/info-extra/PRESUPUESTO 2026.csv");
const workbook = XLSX.read(file, { type: "buffer", raw: true });
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });

const KNOWN_CATEGORIES = [
    "MCT", "PANORAMICA STORE", "CONSTRUCCION", "CONSTRUCCIÓN",
    "CANALES DIGITALES", "FERRETERIAS", "FERRETERÍAS",
    "FABRICACION MODULAR", "FABRICACIÓN MODULAR"
];
const SKIP_ROWS = ["TOTAL", "META"];

let currentCategory = "SIN CATEGORÍA";
const catTotals = {}; // category -> string[] of 12 numbers

for (let rowIdx = 0; rowIdx < json.length; rowIdx++) {
    const row = json[rowIdx];
    if (!row || row.length === 0) continue;

    const firstCell = String(row[0] || "").trim().toUpperCase();
    const secondCell = String(row[1] || "").trim().toUpperCase();

    if (firstCell.includes("PRESUPUESTO") || firstCell.includes("ENERO") || secondCell.includes("ENERO")) continue;

    const cellToCheck = firstCell || secondCell;
    const matchedCategory = KNOWN_CATEGORIES.find(cat =>
        cellToCheck === cat || cellToCheck.startsWith(cat)
    );
    if (matchedCategory) {
        currentCategory = matchedCategory;
        if (!catTotals[currentCategory]) catTotals[currentCategory] = new Array(12).fill(0);
        continue;
    }

    if (firstCell === "META" || secondCell === "META") continue;
    if (firstCell === "TOTAL" || secondCell === "TOTAL") {
        if (!currentCategory.includes("FABRICACION MODULAR") && !currentCategory.includes("FABRICACIÓN MODULAR")) {
            continue;
        }
    }

    let entityName = "";
    let monthStartCol = -1;

    if (firstCell && !firstCell.match(/^\$?[\d.,]+$/)) {
        entityName = row[0] ? String(row[0]).trim() : "";
        monthStartCol = 1;
    } else if (secondCell && !secondCell.match(/^\$?[\d.,]+$/)) {
        entityName = row[1] ? String(row[1]).trim() : "";
        monthStartCol = 2;
    }

    if (!entityName || monthStartCol === -1) continue;

    for (let m = 0; m < 12; m++) {
        const colIdx = monthStartCol + m;
        if (colIdx >= row.length) break;
        const rawVal = row[colIdx];
        let monto = 0;
        if (rawVal !== null && rawVal !== undefined && rawVal !== "") {
            let cleaned = String(rawVal).replace(/[$\s]/g, "");

            if (cleaned.includes('.') && cleaned.includes(',')) {
                const lastDotIdx = cleaned.lastIndexOf('.');
                const lastCommaIdx = cleaned.lastIndexOf(',');
                if (lastCommaIdx > lastDotIdx) {
                    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
                } else {
                    cleaned = cleaned.replace(/,/g, "");
                }
            } else if (cleaned.includes('.')) {
                const parts = cleaned.split('.');
                if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
                    cleaned = cleaned.replace(/\./g, "");
                }
            } else if (cleaned.includes(',')) {
                const parts = cleaned.split(',');
                if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
                    cleaned = cleaned.replace(/,/g, "");
                } else {
                    cleaned = cleaned.replace(",", ".");
                }
            }
            monto = parseFloat(cleaned) || 0;
            catTotals[currentCategory][m] += monto;
        }
    }
}

// Find expected totals (last row before meta?)
let expectedTotals = {};
for (let rowIdx = 0; rowIdx < json.length; rowIdx++) {
    const row = json[rowIdx];
    if (!row) continue;
    const firstCell = String(row[0] || "").trim().toUpperCase();
    if (firstCell === "TOTAL") {
        // get the subtotal
        let start = 1;
        if (!row[1] && row[2]) start = 2; // offset
        const subtotals = [];
        for (let i = 0; i < 12; i++) {
            const raw = row[start + i];
            if (!raw) subtotals.push(0);
            else {
                let cleaned = String(raw).replace(/[$\s]/g, "").replace(/\./g, "");
                subtotals.push(parseFloat(cleaned) || 0);
            }
        }
        // Associate this TOTAL row with the previous category
        // This is a rough estimation script
        console.log("Found a TOTAL row:", subtotals);
    }
}

console.log("CALCULATED BY SCRIPT:");
for (const [cat, totals] of Object.entries(catTotals)) {
    console.log(`\n--- ${cat} ---`);
    console.log(`Ene: ${totals[0]} | Feb: ${totals[1]} | Mar: ${totals[2]}`);
}
