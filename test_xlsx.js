import * as XLSX from "xlsx";
import * as fs from "fs";

const file = fs.readFileSync("/Users/jnahuelfil/Desktop/clone-panoramica/intranet-panoramica/info-extra/PRESUPUESTO 2026.csv");
const workbook = XLSX.read(file, { type: "buffer", raw: true });
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });

console.log("JORGE NAHUELFIL ROW:", jsonData.find(row => row[0] && String(row[0]).includes("JORGE NAHUEL")));
