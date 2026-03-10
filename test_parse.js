const rawVals = ["$600.000", "$1.000.000", "1.500,50", "1,500.50", "$ 1.500.000", 600, "600,00"];

rawVals.forEach(rawVal => {
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
    }
    console.log(`${rawVal} -> ${monto}`);
});
