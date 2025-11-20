const XLSX = require('xlsx');
const fs = require('fs');

const files = [
    '/Users/achintyasingh/Desktop/eduranker/PCM JEE CT-1 Marks Score List.xlsx'
];

const detectColumnsAndTop10 = (rows) => {
    // ... (same detection logic as before) ...
    if (!rows || !Array.isArray(rows) || rows.length === 0) return { students: [], subjectsDetected: [] };
    let headerRowIndex = -1;
    let headerRow = null;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i];
        const values = Object.values(row).map(v => String(v).toLowerCase().trim());
        if (values.some(v => v.includes('candidate id') || v.includes('candidate name') || v.includes('roll no'))) {
            headerRowIndex = i;
            headerRow = row;
            break;
        }
    }
    if (headerRowIndex === -1) return { students: [], subjectsDetected: [] };

    const columnMap = {};
    const availableKeys = Object.keys(headerRow);
    availableKeys.forEach(key => {
        const value = String(headerRow[key]).toLowerCase().trim();
        columnMap[value] = key;
    });

    const findKey = (keywords) => {
        for (const [colName, key] of Object.entries(columnMap)) {
            if (keywords.some(k => colName === k || colName.includes(k))) return key;
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

    const subjectsDetected = Object.keys(subjectKeys).map(s => ({ label: s, key: subjectKeys[s] }));
    const dataRows = rows.slice(headerRowIndex + 1);

    const parseNum = (v) => {
        if (v === null || v === undefined || v === "") return 0;
        if (typeof v === "number") return v;
        if (typeof v === "string") {
            const s = v.trim();
            if (s.includes('/')) return Number(s.split('/')[0]) || 0;
            return Number(s) || 0;
        }
        return 0;
    };

    const mapped = dataRows.map(r => {
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
        return { Name: r[nameKey], Subjects: subj, Total: total };
    }).filter(Boolean);

    return { allStudents: mapped, subjectsDetected: subjectsDetected.map(s => s.label) };
};

const recalculateRankings = (students, subjectsToInclude) => {
    console.log(`\n--- Filtering for: ${subjectsToInclude.join(', ')} ---`);
    const processed = students.map(s => {
        let newTotal = 0;
        subjectsToInclude.forEach(subj => {
            newTotal += (s.Subjects[subj] || 0);
        });
        return { ...s, Total: newTotal };
    });

    processed.sort((a, b) => b.Total - a.Total);
    return processed.slice(0, 3); // Top 3 for brevity
};

files.forEach(file => {
    try {
        if (!fs.existsSync(file)) return;
        const workbook = XLSX.readFile(file);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        const result = detectColumnsAndTop10(json);
        if (result && result.allStudents) {
            console.log("Detected Subjects:", result.subjectsDetected);

            // Test 1: All Subjects
            const topAll = recalculateRankings(result.allStudents, result.subjectsDetected);
            console.log("Top 3 (All):", JSON.stringify(topAll, null, 2));

            // Test 2: Only Physics
            if (result.subjectsDetected.includes('PHY')) {
                const topPhy = recalculateRankings(result.allStudents, ['PHY']);
                console.log("Top 3 (PHY only):", JSON.stringify(topPhy, null, 2));
            }
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
});
