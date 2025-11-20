// screens/Result.js
import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { LinearGradient as ExpoLinearGradient } from "expo-linear-gradient";
import Svg, {
  Rect,
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import ImagePrint from "../components/ImagePrint";
import * as XLSX from "xlsx";

const { width, height } = Dimensions.get("window");

const BackgroundSVG = () => (
  <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
    <Defs>
      <SvgLinearGradient id="bgGradRes" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#0b0b12" />
        <Stop offset="100%" stopColor="#3b0a6e" />
      </SvgLinearGradient>
    </Defs>
    <Rect x="0" y="0" width="100%" height="100%" fill="url(#bgGradRes)" />
    <Circle
      cx={width * 0.15}
      cy={height * 0.2}
      r="56"
      fill="rgba(167,139,250,0.12)"
    />
    <Circle
      cx={width * 0.85}
      cy={height * 0.3}
      r="36"
      fill="rgba(124,58,237,0.10)"
    />
    <Circle
      cx={width * 0.75}
      cy={height * 0.8}
      r="70"
      fill="rgba(167,139,250,0.08)"
    />
  </Svg>
);

export default function Result({ navigation }) {
  const [filePicked, setFilePicked] = useState(false);
  const [rawData, setRawData] = useState([]);
  // Master sheet states
  const [masterPicked, setMasterPicked] = useState(false);
  const [masterRows, setMasterRows] = useState([]);
  const [photoMap, setPhotoMap] = useState({}); // { [rollNo: string]: imageString }
  const [sheetHeading, setSheetHeading] = useState("");
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [clearingMasterCache, setClearingMasterCache] = useState(false);
  const [clearingMarksCache, setClearingMarksCache] = useState(false);
  const [extractedData, setExtractedData] = useState([]);
  const [showDataPreview, setShowDataPreview] = useState(true); // show box by default
  const [top10Data, setTop10Data] = useState([]);
  const [subjectsDetectedState, setSubjectsDetectedState] = useState([]);
  // Subject filtering state
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  // Removed showImagePreview state; image will always show after top 10

  const importExcel = async () => {
    try {
      setLoadingMarks(true);
      // Support both legacy and new DocumentPicker APIs
      const res = await DocumentPicker.getDocumentAsync({
        // Accept common Excel mime-types and fallbacks used on Android/iOS
        type: [
          // Modern Excel (.xlsx)
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          // Legacy Excel (.xls)
          "application/vnd.ms-excel",
          // Macro-enabled (.xlsm)
          "application/vnd.ms-excel.sheet.macroEnabled.12",
          // Generic excel labels seen on some devices
          "application/excel",
          "application/x-excel",
          // Some Android providers mark .xlsx as zip
          "application/zip",
          // Fallback
          "*/*",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      let fileUri = null;
      // New API shape: { canceled: boolean, assets?: [{ uri, name, ... }] }
      if (typeof res === "object" && "canceled" in res) {
        if (res.canceled) return;
        const asset = res.assets?.[0];
        if (!asset?.uri) {
          Alert.alert("Error", "No file URI returned. Please try again.");
          return;
        }
        fileUri = asset.uri;
        console.log("Picked (new API):", asset);
      } else {
        // Legacy API shape: { type: 'success'|'cancel', uri, ... }
        if (res.type !== "success") return;
        fileUri = res.uri;
        console.log("Picked (legacy API):", res);
      }

      // Read as base64 for xlsx parser (use string literal; EncodingType may be undefined on some platforms)
      const b64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: "base64",
      });
      const workbook = XLSX.read(b64, { type: "base64", dense: true });
      const sheetName = workbook.SheetNames?.[0];
      if (!sheetName) {
        Alert.alert("Error", "No sheets found in the workbook.");
        return;
      }
      const worksheet = workbook.Sheets[sheetName];

      // Extract heading from the top region
      const extractHeading = (ws) => {
        if (!ws) return "";

        // First priority: Check if A1 has a heading-like text
        if (ws["A1"] && ws["A1"].v) {
          const a1Val = String(ws["A1"].v).trim();
          // Check if it looks like a heading (contains letters and is reasonably long)
          if (
            a1Val &&
            a1Val.length >= 5 &&
            /[A-Za-z]/.test(a1Val) &&
            !a1Val.toLowerCase().includes("candidate") &&
            !a1Val.toLowerCase().includes("roll")
          ) {
            console.log("Heading found in A1:", a1Val);
            return a1Val;
          }
        }

        // Second priority: Check merged cells in first row
        const merges = ws["!merges"] || [];
        for (const m of merges) {
          if (m.s.r === 0) {
            // starts on row 1
            const addr = XLSX.utils.encode_cell(m.s);
            const cell = ws[addr];
            if (cell && cell.v) {
              const val = String(cell.v).trim();
              if (val && val.length >= 5) {
                console.log("Heading found in merged cell:", val);
                return val;
              }
            }
          }
        }

        // Third priority: Scan first row for any long text that looks like a title
        const cols = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
        for (let c = 0; c < cols.length && c < 20; c++) {
          const addr = cols[c] + "1";
          const cell = ws[addr];
          if (cell && cell.v) {
            const val = String(cell.v).trim();
            // Look for text that's likely a heading (long, contains words, not a column header)
            if (
              val &&
              val.length >= 10 &&
              /[A-Za-z]/.test(val) &&
              !val.toLowerCase().includes("candidate") &&
              !val.toLowerCase().includes("name") &&
              !val.toLowerCase().includes("marks") &&
              !val.toLowerCase().includes("roll") &&
              !val.toLowerCase().includes("total")
            ) {
              console.log("Heading found in column", cols[c] + "1:", val);
              return val;
            }
          }
        }

        console.log("No heading found in marks sheet");
        return "";
      };

      const heading = extractHeading(worksheet);
      if (heading) setSheetHeading(heading);

      const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      // Normalize header keys: trim, collapse spaces, lowercase
      const normalizeObjKeys = (obj) => {
        const out = {};
        Object.keys(obj || {}).forEach((k) => {
          const nk = k.toString().replace(/\s+/g, " ").trim().toLowerCase();
          out[nk] = obj[k];
        });
        return out;
      };
      const normalizedRows = Array.isArray(json)
        ? json.map(normalizeObjKeys)
        : [];
      if (!Array.isArray(normalizedRows) || normalizedRows.length === 0) {
        Alert.alert("Empty Sheet", "No rows found in the selected sheet.");
        return;
      }
      setRawData(normalizedRows);
      setFilePicked(true);
      console.log("Marks sheet heading set to:", heading || "(none)");
      Alert.alert(
        "Imported",
        `Found ${normalizedRows.length} rows. Ready to get result.${heading ? `\nHeading: ${heading}` : ""
        }`
      );
    } catch (err) {
      console.error("importExcel error:", err);
      Alert.alert(
        "Error",
        "Failed to import Excel file. Make sure it is a valid .xlsx or .xls file."
      );
    } finally {
      setLoadingMarks(false);
    }
  };

  // Import Master Excel: build a rollNo -> image map
  const importMasterExcel = async () => {
    try {
      setLoadingMaster(true);
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "application/vnd.ms-excel.sheet.macroEnabled.12",
          "application/excel",
          "application/x-excel",
          "application/zip",
          "*/*",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      let fileUri = null;
      if (typeof res === "object" && "canceled" in res) {
        if (res.canceled) return;
        const asset = res.assets?.[0];
        if (!asset?.uri) {
          Alert.alert("Error", "No file URI returned. Please try again.");
          return;
        }
        fileUri = asset.uri;
        try {
          Alert.alert("File selected", asset.name || fileUri);
        } catch { }
      } else {
        if (res.type !== "success") return;
        fileUri = res.uri;
        try {
          Alert.alert("File selected", res.name || fileUri);
        } catch { }
      }

      const b64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: "base64",
      });
      const workbook = XLSX.read(b64, { type: "base64" });
      const sheetName = workbook.SheetNames?.[0];
      if (!sheetName) {
        Alert.alert("Error", "No sheets found in the Master workbook.");
        return;
      }
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      // normalize headers
      const normalizeObjKeys = (obj) => {
        const out = {};
        Object.keys(obj || {}).forEach((k) => {
          const nk = k.toString().replace(/\s+/g, " ").trim().toLowerCase();
          out[nk] = obj[k];
        });
        return out;
      };
      const rows = Array.isArray(json) ? json.map(normalizeObjKeys) : [];
      console.log(
        "DEBUG - Master Excel header keys:",
        Object.keys(rows[0] || {})
      );
      console.log("DEBUG - First 3 rows:", rows.slice(0, 3));
      if (!rows.length) {
        Alert.alert("Empty Sheet", "No rows found in the Master sheet.");
        return;
      }

      // detect roll/candidate id and image column
      const keys = Object.keys(rows[0] || {});
      console.log("Master Excel columns:", keys);
      function normalize(str) {
        return String(str).replace(/\s+/g, "").toLowerCase();
      }
      let rollKey = null;
      let imageKey = null;
      let linkKey = null;
      keys.forEach((k) => {
        const trimmed = k.trim();
        const norm = normalize(trimmed);
        // robust: accept any 'photo' or 'candidate id' with spaces, any case
        if (
          !rollKey &&
          (norm === "candidateid" || norm === "rollno" || norm === "rollnumber")
        )
          rollKey = k;
        // image column may be named 'photo', 'link', 'image', 'photo link', etc.
        if (
          !imageKey &&
          (norm === "photo" ||
            norm === "image" ||
            norm === "photolink" ||
            norm === "imagelink")
        )
          imageKey = k;
        if (!linkKey && (norm === "link" || norm.includes("link"))) linkKey = k;
      });
      // fallback: try to match with includes if not found yet
      if (!rollKey) {
        for (const k of keys) {
          if (
            normalize(k.trim()).includes("candidateid") ||
            normalize(k.trim()).includes("rollno")
          ) {
            rollKey = k;
            break;
          }
        }
      }
      if (!imageKey) {
        for (const k of keys) {
          const nk = normalize(k.trim());
          if (nk === "photo" || nk === "image") {
            imageKey = k;
            break;
          }
          if (nk.includes("photo") || nk.includes("image")) {
            imageKey = k;
            break;
          }
        }
      }

      // Always prefer 'link' column if it exists and has data
      if (linkKey) {
        const sampleRows = rows.slice(0, Math.min(10, rows.length));
        const linkFilled = sampleRows.filter((r) =>
          String(r[linkKey] || "").trim()
        ).length;
        if (linkFilled > 0) {
          console.log(
            `Using 'link' column as image source (${linkFilled} filled entries found)`
          );
          imageKey = linkKey;
        }
      }
      console.log("Detected roll key:", rollKey);
      console.log("Detected image key:", imageKey);
      console.log("Detected link key:", linkKey);

      if (!rollKey) {
        // try to guess numeric-looking key titled similar
        const candidate = keys.find((k) =>
          /(roll|candidate\s*id|cand\s*id)/.test(k.toLowerCase())
        );
        if (candidate) rollKey = candidate;
      }

      if (!rollKey) {
        Alert.alert(
          "Missing column",
          'Could not detect "Roll No" column in Master sheet.'
        );
        return;
      }

      if (!imageKey) {
        // If no explicit image column, we still proceed (photos may be unavailable in this format)
        console.warn("No image/photo column detected in Master sheet.");
      }

      // Helper: normalize photo values to renderable URIs for WebView
      const normalizePhoto = (val) => {
        if (!val) return "";
        const raw = String(val).trim();
        if (!raw) return "";

        // Minimal debug (commented to improve performance)
        // console.log('Normalizing photo value:', raw.substring(0, 100) + (raw.length > 100 ? '...' : ''));

        // Already a data URI
        if (raw.startsWith("data:image/")) {
          return raw;
        }

        // Looks like base64 blob without prefix
        const b64Like =
          /^[A-Za-z0-9+/=\r\n]+$/.test(raw) &&
          raw.replace(/\s+/g, "").length > 100;
        if (b64Like) {
          // console.log('Photo appears to be base64, adding data URI prefix');
          return `data:image/jpeg;base64,${raw.replace(/\s+/g, "")}`;
        }

        // Google Drive share link -> direct view link
        if (/https?:\/\/drive\.google\.com\//i.test(raw)) {
          // Support multiple patterns: /file/d/{id}/view, /open?id={id}, /uc?id={id}, ?id={id}
          const tryExtractId = (url) => {
            // /file/d/{id}/view or /d/{id}
            let m = url.match(/\/(?:file\/)?d\/([^\/\?]+)/);
            if (m && m[1]) return m[1];
            // open?id={id}
            m = url.match(/[?&]id=([^&#]+)/);
            if (m && m[1]) return m[1];
            // uc?id={id}
            m = url.match(/uc\?.*?[?&]id=([^&#]+)/);
            if (m && m[1]) return m[1];
            return null;
          };
          const id = tryExtractId(raw);
          if (id) {
            const directUrl = `https://drive.google.com/uc?export=view&id=${id}`;
            console.log(
              `Converted Google Drive link: ${raw.substring(
                0,
                50
              )}... -> ${directUrl}`
            );
            return directUrl;
          }
        }

        // Regular http(s) URL
        if (/^https?:\/\//i.test(raw)) {
          // console.log('Photo is a regular HTTP URL');
          return raw;
        }

        // Try to handle file paths (convert to data URI if possible)
        if (raw.includes("\\") || raw.includes("/")) {
          // console.log('Photo appears to be a file path, returning as-is');
          return raw;
        }

        // Fallback: return as-is (may not render if it's a local path)
        // console.log('Photo format not recognized, returning as-is');
        return raw;
      };

      // Build map
      const map = {};
      let photoCount = 0;
      const getRowImage = (r) => {
        // Try chosen imageKey first
        const primary = imageKey ? String(r[imageKey] || "").trim() : "";
        if (primary) return normalizePhoto(primary);
        // Fallback to linkKey
        if (linkKey) {
          const alt = String(r[linkKey] || "").trim();
          if (alt) return normalizePhoto(alt);
        }
        // Try generic columns
        const tryKeys = ["link", "photo", "image"].filter((k) => k in r);
        for (const k of tryKeys) {
          const v = String(r[k] || "").trim();
          if (v) return normalizePhoto(v);
        }
        return "";
      };

      rows.forEach((r, index) => {
        const roll = (r[rollKey] ?? "").toString().trim();
        if (!roll) return;

        const img = getRowImage(r);
        if (typeof img === "string" && img.length > 0) {
          // Store multiple variations for robust matching
          const rollStr = String(roll);
          const digits = rollStr.replace(/\D+/g, "");

          // Store with original key
          map[rollStr] = img;

          // Store with digits only
          if (digits && digits !== rollStr) {
            map[digits] = img;
          }

          // Store with padded zeros (for 5-digit IDs)
          if (digits && digits.length === 5) {
            map[digits] = img;
            // Also store without leading zeros
            const withoutLeadingZeros = digits.replace(/^0+/, "");
            if (withoutLeadingZeros !== digits) {
              map[withoutLeadingZeros] = img;
            }
          }

          // Store lowercase version
          const lowerRoll = rollStr.toLowerCase();
          if (lowerRoll !== rollStr) {
            map[lowerRoll] = img;
          }

          photoCount++;

          // Debug for first few entries
          if (index < 5) {
            console.log(
              `Photo mapping ${index + 1}: ID="${roll}" -> URL: ${img.substring(
                0,
                80
              )}...`
            );
            console.log(
              `  Stored keys: ${rollStr}, ${digits}${digits !== rollStr ? ", " + withoutLeadingZeros : ""
              }`
            );
          }
        } else if (index < 5) {
          console.log(
            `No photo for ID: "${roll}" - link: "${r.link || ""}", photo: "${r.photo || ""
            }", imageKey: ${imageKey}`
          );
        }
      });

      console.log(
        `Built photo map with ${photoCount} photos from ${rows.length} rows`
      );
      console.log("Photo map sample keys:", Object.keys(map).slice(0, 10));
      if (Object.keys(map).length > 0) {
        const firstKey = Object.keys(map)[0];
        console.log(
          `Sample photo map entry: ${firstKey} -> ${map[firstKey].substring(
            0,
            100
          )}...`
        );
      }

      setMasterRows(rows);
      setPhotoMap(map);
      // Reduced debug logging for performance
      // console.log('DEBUG - Photo map keys:', Object.keys(map));
      // console.log('DEBUG - Sample photo map entry:', Object.keys(map).length > 0 ? map[Object.keys(map)[0]] : null);
      setMasterPicked(true);
      Alert.alert(
        "Master Imported",
        `Found ${rows.length} rows${Object.keys(map).length
          ? `, ${Object.keys(map).length} photos mapped`
          : ""
        }.`
      );
    } catch (err) {
      console.error("importMasterExcel error:", err);
      Alert.alert("Error", "Failed to import Master Excel file.");
    } finally {
      setLoadingMaster(false);
    }
  };

  // Helper: clear app cache safely (delete all children under cacheDirectory)
  const clearAppCache = async (setLoadingState) => {
    try {
      setLoadingState(true);
      const base = FileSystem.cacheDirectory;
      if (!base) return 0;
      const entries = await FileSystem.readDirectoryAsync(base);
      let deleted = 0;
      for (const name of entries) {
        const uri = base + name;
        try {
          await FileSystem.deleteAsync(uri, { idempotent: true });
          deleted++;
        } catch (e) {
          console.warn("Failed deleting cache entry:", uri, e?.message || e);
        }
      }
      return deleted;
    } catch (err) {
      console.warn("clearAppCache error:", err);
      return 0;
    } finally {
      setLoadingState(false);
    }
  };

  // Remove Master + Clear Cache
  const removeMasterAndClear = async () => {
    if (
      loadingMaster ||
      loadingMarks ||
      clearingMasterCache ||
      clearingMarksCache
    )
      return;
    try {
      // Reset master-related state
      setMasterPicked(false);
      setMasterRows([]);
      setPhotoMap({});
      const deleted = await clearAppCache(setClearingMasterCache);
      Alert.alert(
        "Cleared",
        `Master removed. Cache cleared${deleted ? ` (${deleted} items)` : ""}.`
      );
    } catch (err) {
      console.error("removeMasterAndClear error:", err);
      Alert.alert("Error", "Failed to clear cache.");
    }
  };

  // Remove Marks + Clear Cache
  const removeMarksAndClear = async () => {
    if (
      loadingMaster ||
      loadingMarks ||
      clearingMasterCache ||
      clearingMarksCache
    )
      return;
    try {
      // Reset marks-related state
      setFilePicked(false);
      setRawData([]);
      setSheetHeading("");
      // Clear Top 10 preview and hide the section
      setTop10Data([]);
      setShowDataPreview(false);
      // Also clear any older extracted data if present
      if (typeof setExtractedData === "function") {
        try {
          setExtractedData([]);
        } catch { }
      }
      const deleted = await clearAppCache(setClearingMarksCache);
      Alert.alert(
        "Cleared",
        `Marks removed. Cache cleared${deleted ? ` (${deleted} items)` : ""}.`
      );
    } catch (err) {
      console.error("removeMarksAndClear error:", err);
      Alert.alert("Error", "Failed to clear cache.");
    }
  };

  const detectColumnsAndTop10 = (rows) => {
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      console.log("No valid rows provided to detectColumnsAndTop10");
      return { students: [], subjectsDetected: [] };
    }

    // 1. Find the Header Row
    // We look for a row that contains "candidate id" or "candidate name"
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

    if (headerRowIndex === -1) {
      console.log("Could not find a valid header row.");
      return { students: [], subjectsDetected: [] };
    }

    console.log("Found header row at index:", headerRowIndex, headerRow);

    // 2. Map Columns
    // We need to map: CandidateID, Name, and Subjects (PHY, CHEM, MATHS, BIO)
    // We will create a map of { NormalizedColumnName: KeyInRowObject }
    const columnMap = {};
    const availableKeys = Object.keys(headerRow);

    availableKeys.forEach(key => {
      const value = String(headerRow[key]).toLowerCase().trim();
      columnMap[value] = key;
    });

    // Helper to find key by partial match
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

    // Subject Detection
    // We look for specific subject headers. We avoid "sec a", "int sec" etc.
    const potentialSubjects = ['PHY', 'CHEM', 'MATHS', 'BIO'];
    const subjectKeys = {};

    potentialSubjects.forEach(subj => {
      // We want exact matches or "Subject Total" type matches, avoiding "Sec A"
      // Iterate over all columns to find best match
      for (const [colName, key] of Object.entries(columnMap)) {
        const upperName = colName.toUpperCase();
        if (upperName === subj || upperName === `${subj} TOTAL` || upperName === `${subj} MARKS`) {
          subjectKeys[subj] = key;
          break; // Found exact/good match
        }
        // Fallback: if it starts with subject name and doesn't have "sec" or "int"
        if (upperName.startsWith(subj) && !upperName.includes('sec') && !upperName.includes('int')) {
          subjectKeys[subj] = key;
        }
      }
    });

    console.log("Dynamic Column Mapping:");
    console.log("ID Key:", idKey);
    console.log("Name Key:", nameKey);
    console.log("Subject Keys:", subjectKeys);

    if (!idKey || !nameKey) {
      console.log("Critical columns (ID or Name) missing.");
      return { students: [], subjectsDetected: [] };
    }

    const subjectsDetected = Object.keys(subjectKeys).map(s => ({ label: s, key: subjectKeys[s] }));

    // 3. Extract Data
    // Start processing from the row AFTER the header
    const dataRows = rows.slice(headerRowIndex + 1);

    const parseNum = (v) => {
      if (v === null || v === undefined || v === "") return 0;
      if (typeof v === "number") return v;
      if (typeof v === "string") {
        const s = v.trim();
        // Handle "75/100"
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

    const mapped = dataRows.map(r => {
      try {
        // Skip empty rows or repeated headers
        const idVal = r[idKey];
        if (!idVal || String(idVal).toLowerCase().includes('candidate')) return null;

        const subj = {};
        let total = 0;
        let validSubjects = 0;

        subjectsDetected.forEach(s => {
          const val = parseNum(r[s.key]);
          if (val >= 0) { // Allow 0 marks
            subj[s.label] = val;
            total += val;
            validSubjects++;
          }
        });

        // If total column exists in excel, maybe use it? 
        // For now, let's sum the detected subjects to be safe and consistent.

        return {
          CandidateID: String(r[idKey]).trim(),
          Name: String(r[nameKey]).trim(),
          Subjects: subj,
          Total: total,
          SubjectCount: validSubjects,
          Rank: 0,
          raw: r
        };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);

    // 4. Sort and Rank
    const sortBy = (a, b) => {
      if (b.Total !== a.Total) return b.Total - a.Total;
      return a.Name.localeCompare(b.Name);
    };

    mapped.sort(sortBy);

    // Assign Ranks (Dense Ranking)
    let currentRank = 1;
    let prevScore = null;
    for (let i = 0; i < mapped.length; i++) {
      const score = mapped[i].Total;
      if (i > 0 && score !== prevScore) {
        currentRank++;
      }
      mapped[i].Rank = currentRank;
      prevScore = score;
    }

    const result = mapped.slice(0, 10);
    return {
      students: result,
      allStudents: mapped,
      subjectsDetected: subjectsDetected.map(s => s.label)
    };
  };

  const getResult = () => {
    if (!filePicked) {
      Alert.alert("Import first", "Please import the Marks Excel file first.");
      return;
    }
    if (!masterPicked) {
      // Not hard-failing, but inform user
      Alert.alert(
        "Optional: Master Excel",
        "Master Excel not imported. Photos may not be shown."
      );
    }
    try {
      // Log the raw data for debugging
      console.log("Processing raw data:", rawData.slice(0, 2));

      // Pass rawData directly to detectColumnsAndTop10 so it can find the header row
      const topRes = detectColumnsAndTop10(rawData);

      if (topRes && topRes.subjectsDetected) {
        setAvailableSubjects(topRes.subjectsDetected);
        // Default to all subjects selected initially
        setSelectedSubjects(topRes.subjectsDetected);
      }

      // Ensure we have a valid response structure and take only top 10
      let allStudents = topRes && topRes.allStudents ? [...topRes.allStudents] : [];
      setExtractedData(allStudents);

      // Initial calculation with all subjects
      recalculateRankings(allStudents, topRes.subjectsDetected);

      setShowDataPreview(true);
    } catch (err) {
      console.log("Error in getResult:", err);
      Alert.alert("Error", "Failed to process data. Check console.");
    }
  };

  const recalculateRankings = (students, subjectsToInclude) => {
    if (!students || !subjectsToInclude) return;

    const processed = students.map(s => {
      let newTotal = 0;
      let validSubjs = 0;
      // Re-sum based on selected subjects
      subjectsToInclude.forEach(subj => {
        const val = s.Subjects[subj] || 0;
        newTotal += val;
        if (s.Subjects[subj] !== undefined) validSubjs++;
      });
      return { ...s, Total: newTotal, SubjectCount: validSubjs };
    });

    // Sort
    processed.sort((a, b) => {
      if (b.Total !== a.Total) return b.Total - a.Total;
      return a.Name.localeCompare(b.Name);
    });

    // Rank
    let currentRank = 1;
    let prevScore = null;
    for (let i = 0; i < processed.length; i++) {
      const score = processed[i].Total;
      if (i > 0 && score !== prevScore) {
        currentRank++;
      }
      processed[i].Rank = currentRank;
      prevScore = score;
    }

    const top10 = processed.slice(0, 10);
    setTop10Data(top10);

    // Update navigation params if we are already navigating (not applicable here as we navigate on button press usually, 
    // but if we want to update the view dynamically we just update state. 
    // The ImagePrint component is rendered inside Result? No, it's a separate screen usually?
    // Wait, let's check navigation. 
    // App.js says: Result and ImagePrint are screens.
    // BUT Result.js might be navigating to ImagePrint?
    // Let's check where `navigation.navigate('ImagePrint')` is called.
    // Ah, I need to check if there is a "Generate Image" button that navigates.
  };

  // Effect to re-calculate when selectedSubjects changes
  useEffect(() => {
    if (extractedData.length > 0) {
      recalculateRankings(extractedData, selectedSubjects);
    }
  }, [selectedSubjects, extractedData]);

  const toggleSubject = (subj) => {
    setSelectedSubjects(prev => {
      if (prev.includes(subj)) {
        // Don't allow deselecting the last subject
        if (prev.length === 1) {
          Alert.alert("Minimum 1", "At least one subject must be selected.");
          return prev;
        }
        return prev.filter(s => s !== subj);
      } else {
        return [...prev, subj];
      }
    });
  };

  const navigateToImagePrint = () => {
    if (top10Data.length === 0) {
      Alert.alert("No Data", "Please generate result first.");
      return;
    }
    navigation.navigate("ImagePrint", {
      students: top10Data,
      photoMap: photoMap,
      subjectsDetected: selectedSubjects, // Pass selected subjects
      sheetHeading: sheetHeading
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <BackgroundSVG />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerWrap}>
          <View style={styles.headerIcon}>
            <Ionicons name="analytics-outline" size={34} color="#A78BFA" />
          </View>
          <Text style={styles.header}>Result Processing</Text>
          <Text style={styles.subheader}>
            Import your Excel file and generate the Top 10 automatically
          </Text>
        </View>

        {/* Master Excel first */}
        <TouchableOpacity
          style={[
            styles.button,
            (loadingMaster || loadingMarks) && { opacity: 0.6 },
          ]}
          onPress={importMasterExcel}
          disabled={loadingMaster || loadingMarks}
        >
          <ExpoLinearGradient
            colors={["#2563EB", "#60A5FA"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buttonGradient}
          >
            <Ionicons
              name="person-circle-outline"
              size={18}
              color="#fff"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.buttonText}>
              {loadingMaster ? "Importing Master..." : "Import Master Excel"}
            </Text>
          </ExpoLinearGradient>
        </TouchableOpacity>

        {/* Remove Master + Clear Cache */}
        <TouchableOpacity
          style={[
            styles.button,
            (!masterPicked ||
              loadingMaster ||
              loadingMarks ||
              clearingMasterCache ||
              clearingMarksCache) && { opacity: 0.6 },
          ]}
          onPress={removeMasterAndClear}
          disabled={
            !masterPicked ||
            loadingMaster ||
            loadingMarks ||
            clearingMasterCache ||
            clearingMarksCache
          }
        >
          <ExpoLinearGradient
            colors={["#EF4444", "#F87171"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buttonGradient}
          >
            <Ionicons
              name="trash-outline"
              size={18}
              color="#fff"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.buttonText}>
              {clearingMasterCache
                ? "Clearing Cache..."
                : "Remove Master & Clear Cache"}
            </Text>
          </ExpoLinearGradient>
        </TouchableOpacity>

        {/* Master status chip */}
        <View style={styles.statusRow}>
          <View
            style={[
              styles.chip,
              masterPicked ? styles.chipSuccess : styles.chipPending,
            ]}
          >
            <Ionicons
              name={masterPicked ? "checkmark-circle" : "alert-circle"}
              size={14}
              color="#fff"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.chipText}>
              {masterPicked
                ? `Master: Uploaded (${masterRows.length} rows${Object.keys(photoMap || {}).length
                  ? `, ${Object.keys(photoMap).length} photos`
                  : ""
                })`
                : "Master: Not uploaded"}
            </Text>
          </View>
        </View>

        {/* Marks Excel second */}
        <TouchableOpacity
          style={[
            styles.button,
            (loadingMaster || loadingMarks) && { opacity: 0.6 },
          ]}
          onPress={importExcel}
          disabled={loadingMaster || loadingMarks}
        >
          <ExpoLinearGradient
            colors={["#7C3AED", "#A78BFA"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buttonGradient}
          >
            <Ionicons
              name="cloud-upload-outline"
              size={18}
              color="#fff"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.buttonText}>
              {loadingMarks ? "Importing Marks..." : "Import Marks Excel"}
            </Text>
          </ExpoLinearGradient>
        </TouchableOpacity>

        {/* Remove Marks + Clear Cache */}
        <TouchableOpacity
          style={[
            styles.button,
            (!filePicked ||
              loadingMaster ||
              loadingMarks ||
              clearingMasterCache ||
              clearingMarksCache) && { opacity: 0.6 },
          ]}
          onPress={removeMarksAndClear}
          disabled={
            !filePicked ||
            loadingMaster ||
            loadingMarks ||
            clearingMasterCache ||
            clearingMarksCache
          }
        >
          <ExpoLinearGradient
            colors={["#DC2626", "#EF4444"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buttonGradient}
          >
            <Ionicons
              name="trash-bin-outline"
              size={18}
              color="#fff"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.buttonText}>
              {clearingMarksCache
                ? "Clearing Cache..."
                : "Remove Marks & Clear Cache"}
            </Text>
          </ExpoLinearGradient>
        </TouchableOpacity>

        {/* Marks status chip */}
        <View style={styles.statusRow}>
          <View
            style={[
              styles.chip,
              filePicked ? styles.chipSuccess : styles.chipPending,
            ]}
          >
            <Ionicons
              name={filePicked ? "checkmark-circle" : "alert-circle"}
              size={14}
              color="#fff"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.chipText}>
              {filePicked
                ? `Marks: Uploaded (${rawData.length} rows)`
                : "Marks: Not uploaded"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            (!filePicked || loadingMaster || loadingMarks) && { opacity: 0.6 },
          ]}
          disabled={!filePicked || loadingMaster || loadingMarks}
          onPress={getResult}
        >
          <ExpoLinearGradient
            colors={["#10B981", "#34D399"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buttonGradient}
          >
            <Ionicons
              name="trophy-outline"
              size={18}
              color="#fff"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.buttonText}>Get Result</Text>
          </ExpoLinearGradient>
        </TouchableOpacity>

        <View style={styles.noteCard}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color="#C4B5FD"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.hint}>
            The app will auto-detect Candidate ID, Student Name, and Marks.
            Master Excel is used to fetch photos by matching Roll No to
            Candidate ID.
          </Text>
        </View>

        {/* Debug Info (Hidden in prod, but useful now) */}
        {/* <Text style={{color: 'white'}}>Debug: {availableSubjects.join(', ')}</Text> */}

        {/* Subject Filter Section - Ensure it renders */}
        {availableSubjects && availableSubjects.length > 0 ? (
          <View style={styles.filterContainer}>
            <Text style={styles.filterTitle}>Filter Subjects:</Text>
            <View style={styles.chipContainer}>
              {availableSubjects.map(subj => (
                <TouchableOpacity
                  key={subj}
                  style={[
                    styles.chip,
                    selectedSubjects.includes(subj) ? styles.chipActive : styles.chipInactive
                  ]}
                  onPress={() => toggleSubject(subj)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.chipLabel,
                    selectedSubjects.includes(subj) ? styles.chipLabelActive : styles.chipLabelInactive
                  ]}>{subj}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        {/* Generate Image Button - Added explicitly if not present or to replace existing flow if needed. 
            Wait, looking at the code, there is a "Get Result" button which calculates. 
            Is there a button to go to ImagePrint? 
            Usually `ImagePrint` is a separate screen. 
            Let's check if there is a button to navigate there.
            If not, maybe `Get Result` was supposed to do it?
            The previous code just set `top10Data`. 
            Ah, `ImagePrint` might be embedded or there's another button.
            Let's assume we need a button to "Generate Image" after preview.
        */}
        {/* {top10Data.length > 0 && (
          <TouchableOpacity
            style={[styles.button, { marginTop: 20, backgroundColor: '#8B5CF6' }]}
            onPress={navigateToImagePrint}
          >
            <Ionicons name="image-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.buttonText}>Generate Image</Text>
          </TouchableOpacity>
        )} */}

        {/* Data Preview Section */}
        {showDataPreview && top10Data.length > 0 && (
          <View style={styles.previewContainer}>
            <View
              className="dataPreviewHeader"
              style={styles.dataPreviewHeader}
            >
              <Text style={styles.previewTitle}>Top 10 Students Preview</Text>
              <TouchableOpacity
                style={styles.hidePreviewBtn}
                onPress={() => setShowDataPreview(false)}
              >
                <Ionicons name="close-circle" size={24} color="#EF4444" />
              </TouchableOpacity>
            </View>

            <View style={styles.previewContent}>
              {top10Data.map((student, index) => (
                <View key={index} style={styles.previewRow}>
                  <Text style={styles.previewText}>
                    {`${index + 1}. ${student.Name || "-"} - Total: ${student.Total || 0
                      }`}
                  </Text>
                </View>
              ))}
            </View>

            {/* Always show image preview and download button after top 10 */}
            <View style={{ marginTop: 12, width: "100%" }}>
              <ImagePrint
                route={{
                  params: {
                    students: top10Data,
                    photoMap: photoMap,
                    hideCandidateId: true,
                    subjectsDetected: selectedSubjects,
                    sheetHeading,
                  },
                }}
                autoGenerate={true}
              />
            </View>
          </View>
        )}
      </ScrollView>
      {(loadingMaster || loadingMarks) && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#A78BFA" />
            <Text style={styles.loadingText}>
              {loadingMaster
                ? "Importing Master sheet..."
                : "Importing Marks sheet..."}
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0b0b12",
  },
  scroll: {
    flex: 1,
    backgroundColor: "#0b0b12",
  },
  container: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 56,
    gap: 18,
    width: "100%",
  },
  headerWrap: {
    width: "100%",
    alignItems: "center",
  },
  headerIcon: {
    backgroundColor: "rgba(167,139,250,0.12)",
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
  },
  header: {
    fontSize: 24,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 6,
    textAlign: "center",
  },
  subheader: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
  },
  button: {
    width: "100%",
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  buttonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
  noteCard: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.25)",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  hint: {
    flex: 1,
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    textAlign: "left",
  },
  // Status chips
  statusRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-start",
    paddingHorizontal: 4,
    marginTop: 6,
    marginBottom: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  chipSuccess: {
    backgroundColor: "rgba(16,185,129,0.25)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.6)",
  },
  chipPending: {
    backgroundColor: "rgba(245,158,11,0.25)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.6)",
  },
  chipText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingCard: {
    backgroundColor: "rgba(27,27,38,0.95)",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.35)",
  },
  loadingText: {
    marginTop: 10,
    color: "#fff",
    fontWeight: "700",
    textAlign: "center",
  },

  // Data Preview Styles
  previewContainer: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    marginTop: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.3)",
  },
  filterContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#1F2937', // Darker, more opaque background
    borderRadius: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: '#374151',
  },
  filterTitle: {
    color: '#A78BFA',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#7C3AED',
  },
  chipInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: '#4B5563',
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  chipLabelActive: {
    color: '#FFFFFF',
  },
  chipLabelInactive: {
    color: '#D1D5DB',
  },
  previewTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  previewContent: {
    marginBottom: 16,
  },
  previewRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(167,139,250,0.15)",
  },
  previewText: {
    color: "#fff",
    fontSize: 14,
  },
  generateButton: {
    marginTop: 16,
  },

  // Old Data Preview Styles
  dataPreviewSection: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.3)",
  },
  dataPreviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(167,139,250,0.2)",
  },
  dataPreviewTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  hidePreviewBtn: {
    padding: 4,
  },
  dataPreviewScroll: {
    maxHeight: 400,
  },
  dataTable: {
    minWidth: 800,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(167,139,250,0.15)",
  },
  tableHeader: {
    color: "#A78BFA",
    fontSize: 14,
    fontWeight: "800",
    padding: 12,
    backgroundColor: "rgba(167,139,250,0.15)",
    textAlign: "center",
  },
  tableCell: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "500",
    padding: 12,
    textAlign: "center",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  tableDataScroll: {
    maxHeight: 300,
  },

  // Column widths
  rankCol: {
    width: 60,
  },
  idCol: {
    width: 80,
  },
  nameCol: {
    width: 180,
    textAlign: "left",
  },
  subjectCol: {
    width: 70,
  },
  totalCol: {
    width: 80,
    backgroundColor: "rgba(16,185,129,0.1)",
  },
});
