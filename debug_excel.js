const XLSX = require('xlsx');
const fs = require('fs');

const files = [
    '/Users/achintyasingh/Desktop/eduranker/PCM JEE CT-1 Marks Score List.xlsx',
    '/Users/achintyasingh/Desktop/eduranker/Bio Class.xlsx'
];

const detectColumnsAndTop10 = (rows) => {
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
        console.log("No valid rows provided");
        return;
    }

    // 1. Find the Header Row
    let headerRowIndex = -1;
    let headerRow = null;

    for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i];
        // Handle array or object rows (xlsx sheet_to_json with header:1 returns arrays)
        // But here we expect objects if using default sheet_to_json, or we can adapt.
        // Let's assume we used sheet_to_json without header:1 for the app logic, 
        // but for robustness let's handle what we get. 
        // Actually, the app uses `sheet_to_json(..., { defval: "" })` which returns objects with keys as the first row if not specified, 
        // OR if we want to find the header manually, we should probably read with `header: 1` first to find the row index, 
        // then re-read or process manually. 

        // In the app refactor, I assumed `rows` are objects where keys might be the header if it was the first row, 
        // OR `rows` are objects from `sheet_to_json` where the first row was picked as header automatically.
        // BUT, if the header is on row 2 (index 1), `sheet_to_json` might pick row 0 as header.

        // Let's simulate exactly what the app does. The app calls `sheet_to_json` first.
        // If the real header is on row 2, the keys will be from row 1.
        // The app logic I wrote iterates `rows` looking for "candidate id" in *values*.

        const values = Object.values(row).map(v => String(v).toLowerCase().trim());
        if (values.some(v => v.includes('candidate id') || v.includes('candidate name') || v.includes('roll no'))) {
            headerRowIndex = i;
            headerRow = row;
            break;
        }
    }

    if (headerRowIndex === -1) {
        console.log("Could not find a valid header row.");
        return;
    }

    console.log("Found header row at index:", headerRowIndex);
    console.log("Header Row:", JSON.stringify(headerRow));

    // 2. Map Columns
    const columnMap = {};
    const availableKeys = Object.keys(headerRow);

    availableKeys.forEach(key => {
        const value = String(headerRow[key]).toLowerCase().trim();
        columnMap[value] = key;
    });

    const findKey = (keywords) => {
        for (const [colName, key] of Object.entries(columnMap)) {
            if (keywords.some(k => colName === k || colName.includes(k))) {
                return key;
            }
        }
        return null;
    };

    const idKey = findKey(['candidate id', 'roll no', 'roll number']);
    const nameKey = findKey(['candidate name', 'student name', 'name']);

    const potentialSubjects = ['PHY', 'CHEM', 'MATHS', 'BIO'];
    const subjectKeys = {};

    potentialSubjects.forEach(subj => {
        for (const [colName, key] of Object.entries(columnMap)) {
            const upperName = colName.toUpperCase();
            if (upperName === subj || upperName === `${subj} TOTAL` || upperName === `${subj} MARKS`) {
                subjectKeys[subj] = key;
                break;
            }
            if (upperName.startsWith(subj) && !upperName.includes('sec') && !upperName.includes('int')) {
                subjectKeys[subj] = key;
            }
        }
    });

    console.log("Detected Keys:");
    console.log("  ID:", idKey);
    console.log("  Name:", nameKey);
    console.log("  Subjects:", subjectKeys);

    const subjectsDetected = Object.keys(subjectKeys).map(s => ({ label: s, key: subjectKeys[s] }));

    // 3. Extract Data (First 3 rows)
    const dataRows = rows.slice(headerRowIndex + 1);
    const parseNum = (v) => {
        if (v === null || v === undefined || v === "") return 0;
        if (typeof v === "number") return v;
        if (typeof v === "string") {
            const s = v.trim();
            if (s.includes('/')) {
                const parts = s.split('/');
                const n = Number(parts[0]);
                return isNaN(n) ? 0 : n;
            }
            const n = Number(s);
            return isNaN(n) ? 0 : n;
        }
        return 0;
    };

    console.log("Sample Extracted Data (Top 3):");
    const mapped = dataRows.slice(0, 3).map(r => {
        const idVal = r[idKey];
        if (!idVal || String(idVal).toLowerCase().includes('candidate')) return null;

        const subj = {};
        let total = 0;
        subjectsDetected.forEach(s => {
            const val = parseNum(r[s.key]);
            if (val >= 0) {
                subj[s.label] = val;
                total += val;
            }
        });

        return {
            Name: r[nameKey],
            Subjects: subj,
            Total: total
        };
    }).filter(Boolean);

    console.log(JSON.stringify(mapped, null, 2));
};

files.forEach(file => {
    console.log(`\n--- Testing: ${file} ---`);
    try {
        if (!fs.existsSync(file)) return;
        const workbook = XLSX.readFile(file);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        // Mimic app: sheet_to_json with defval
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        detectColumnsAndTop10(json);
    } catch (err) {
        console.error('Error:', err.message);
    }
});
