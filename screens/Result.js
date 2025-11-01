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
        `Found ${normalizedRows.length} rows. Ready to get result.${
          heading ? `\nHeading: ${heading}` : ""
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
        } catch {}
      } else {
        if (res.type !== "success") return;
        fileUri = res.uri;
        try {
          Alert.alert("File selected", res.name || fileUri);
        } catch {}
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
              `  Stored keys: ${rollStr}, ${digits}${
                digits !== rollStr ? ", " + withoutLeadingZeros : ""
              }`
            );
          }
        } else if (index < 5) {
          console.log(
            `No photo for ID: "${roll}" - link: "${r.link || ""}", photo: "${
              r.photo || ""
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
        `Found ${rows.length} rows${
          Object.keys(map).length
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
        } catch {}
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

    // Log the first few rows for debugging
    console.log("First few rows:", rows.slice(0, 2));

    // Remove header row if it contains column headers
    if (
      rows[0] &&
      Object.values(rows[0]).some(
        (v) =>
          typeof v === "string" &&
          v.toString().toLowerCase().includes("candidate")
      )
    ) {
      console.log("Removing header row:", rows[0]);
      rows = rows.slice(1);
    }

    if (rows.length === 0) {
      console.log("No data rows after removing header");
      return { students: [], subjectsDetected: [] };
    }

    const first = rows[0];
    if (!first || typeof first !== "object") {
      console.log("First row is not a valid object");
      return { students: [], subjectsDetected: [] };
    }

    const keys = Object.keys(first);
    console.log("Available columns:", keys);

    // Log raw headers for debugging
    console.log("Raw Excel Headers:", keys);

    // Handle common Excel export patterns
    const isEmptyHeader = keys.some((k) => k.startsWith("__empty"));

    // Fixed format mapping based on known Excel structure
    // This assumes the Excel format matches the asset file structure
    const FIXED_COLUMN_MAPPING = {
      candidateId: 0, // Column A: CANDIDATE ID
      candidateName: 1, // Column B: CANDIDATE NAME
      group: 2, // Column C: GROUP
      phySecA: 3, // Column D: PHY SEC A
      phyIntSecA: 4, // Column E: PHY INT SEC A
      phy: 5, // Column F: PHY (main subject total)
      chemSecA: 6, // Column G: CHEM SEC A
      chemIntSecA: 7, // Column H: CHEM INT SEC A
      chem: 8, // Column I: CHEM (main subject total)
      mathsSecA: 9, // Column J: MATHS SEC A
      mathsIntSecA: 10, // Column K: MATHS INT SEC A
      maths: 11, // Column L: MATHS (main subject total)
      total: 12, // Column M: Total
    };

    // Convert column indices to actual key names from the Excel data
    const getColumnKey = (index) => {
      const keyArray = Object.keys(first);
      return keyArray[index] || null;
    };

    // Map to actual column keys using fixed format
    const idKey = getColumnKey(FIXED_COLUMN_MAPPING.candidateId);
    const nameKey = getColumnKey(FIXED_COLUMN_MAPPING.candidateName);

    const subjectKeyMap = {
      PHY: getColumnKey(FIXED_COLUMN_MAPPING.phy),
      CHEM: getColumnKey(FIXED_COLUMN_MAPPING.chem),
      MATHS: getColumnKey(FIXED_COLUMN_MAPPING.maths),
    };

    console.log("Fixed format mapping:");
    console.log("ID Key:", idKey);
    console.log("Name Key:", nameKey);
    console.log("Subject mapping:", subjectKeyMap);

    // Check if first row contains headers and skip it for data processing
    let headerRow = null;
    if (
      rows[0] &&
      Object.values(rows[0]).some(
        (v) =>
          typeof v === "string" &&
          (v.toString().toLowerCase().includes("candidate") ||
            v.toString().toLowerCase().includes("phy") ||
            v.toString().toLowerCase().includes("chem") ||
            v.toString().toLowerCase().includes("math"))
      )
    ) {
      headerRow = rows[0];
      console.log("Found header row:", headerRow);
    }

    // 2) If still missing, use heuristics over first ~50 data rows (skip header if detected)
    let sampleRows = rows;
    if (headerRow) {
      sampleRows = rows.slice(1); // Skip header row for sampling
    }
    const sample = sampleRows.slice(0, Math.min(50, sampleRows.length));
    const keyStats = {};
    keys.forEach((k) => {
      const values = sample
        .map((r) => r[k])
        .filter((v) => v !== undefined && v !== null && v !== "");
      const nums = values.map((v) => {
        if (typeof v === "number") return v;
        if (typeof v === "string") {
          // parse cases like "71/100"
          const part = v.includes("/") ? v.split("/")[0] : v;
          // Handle cases where multiple numbers are present (e.g. "Physics: 85")
          const matches = part.match(/\d+/g);
          if (matches) {
            const n = Number(matches[matches.length - 1]); // Take the last number
            return isNaN(n) ? null : n;
          }
          const n = Number(part);
          return isNaN(n) ? null : n;
        }
        return null;
      });
      const numVals = nums.filter((n) => n !== null);
      const numRatio = values.length ? numVals.length / values.length : 0;
      const avg = numVals.length
        ? numVals.reduce((a, b) => a + b, 0) / numVals.length
        : 0;
      const max = numVals.length ? Math.max(...numVals) : 0;
      const strVals = values.filter((v) => typeof v === "string");
      const avgLen = strVals.length
        ? strVals.reduce((a, b) => a + b.toString().length, 0) / strVals.length
        : 0;
      const spaceRatio = strVals.length
        ? strVals.filter((s) => /\s/.test(s)).length / strVals.length
        : 0;
      keyStats[k] = { numRatio, avg, max, avgLen, spaceRatio };
    });

    // Skip the old heuristic detection since we're using fixed format mapping

    // No single marksKey now; we rely on subjectKeyMap

    // 2.a.1) Validate and correct subject keys: avoid ID-like columns, choose marks-like
    const isIdLike = (k) =>
      !!(keyStats[k] && (keyStats[k].avg > 1000 || keyStats[k].max > 1000));
    // More strict marks-like detection to avoid picking columns like GROUP/JEE that contain small incidental numbers
    const isMarksLike = (k) => {
      if (!keyStats[k]) return false;
      const { numRatio, avg, max } = keyStats[k];
      // numeric enough, and within plausible exam marks range
      if (!(numRatio > 0.8 && avg > 1 && avg <= 500 && max >= 10)) return false;

      // Reject columns whose string values often look like labels (e.g., 'JEE - 1', 'Group A')
      const sampleValues = sample
        .map((r) => r[k])
        .filter((v) => v !== undefined && v !== null && v !== "");
      const strVals = sampleValues.filter((v) => typeof v === "string");
      const labelKeywords = [
        "group",
        "jee",
        "neet",
        "batch",
        "section",
        "sec a",
        "int sec",
      ];
      const labely = strVals.filter((s) =>
        labelKeywords.some((w) => String(s).toLowerCase().includes(w))
      );
      if (strVals.length && labely.length / strVals.length > 0.3) return false;

      return true;
    };
    // Skip isSubjectColumn since we're using fixed format mapping
    const numericCandidates = keys.filter(
      (k) => keyStats[k] && keyStats[k].numRatio > 0.8 && k !== idKey
    );
    const pickBestMarksColumn = () => {
      // Prefer common placement then best stats
      const preferredOrder = ["__empty_2", "__empty", "__empty_1"];
      for (const p of preferredOrder) {
        if (keys.includes(p) && isMarksLike(p)) return p;
      }
      const best = numericCandidates
        .filter((k) => isMarksLike(k) && k !== idKey)
        .sort((a, b) => keyStats[b].avg - keyStats[a].avg)[0];
      return best || null;
    };

    // Skip correction logic since we're using fixed format mapping

    // Skip clearing logic since we're using fixed format mapping

    // Skip heading-based detection since we're using fixed format mapping

    // Skip improved detection since we're using fixed format mapping

    // Skip heuristic picks since we're using fixed format mapping

    console.log(
      "Detected columns - ID:",
      idKey,
      "Name:",
      nameKey,
      "Subjects map:",
      subjectKeyMap
    );
    console.log(
      "Keys stats for debugging:",
      Object.keys(keyStats).map((k) => ({ key: k, ...keyStats[k] }))
    );
    console.log("Sample row after detection:", rows[0]);

    // subjects detected in order - using fixed format
    const subjectsDetected = [
      { label: "PHY", key: subjectKeyMap["PHY"] },
      { label: "CHEM", key: subjectKeyMap["CHEM"] },
      { label: "MATHS", key: subjectKeyMap["MATHS"] },
    ].filter((x) => !!x.key);

    console.log("Subjects detected:", subjectsDetected);

    const parseNum = (v) => {
      // Handle null/undefined
      if (v === null || v === undefined || v === "") return 0;

      // If already a number
      if (typeof v === "number") return v;

      // If string, handle various formats
      if (typeof v === "string") {
        const s = v.trim();
        // If it contains letters and is not a fraction-like "NN/NN", treat as label -> not marks
        const isFractionLike = /^\s*\d+\s*\/\s*\d+\s*$/.test(s);
        const isPlainNumber = /^\s*\d+(?:\.\d+)?\s*$/.test(s);

        if (!(isPlainNumber || isFractionLike)) {
          // Avoid parsing things like "JEE - 1" as 1
          return 0;
        }

        // Handle fraction format (e.g., "75/100")
        if (isFractionLike) {
          const [num] = s.split("/");
          const parsed = Number(num.trim());
          return isNaN(parsed) ? 0 : parsed;
        }

        // Handle plain/decimal number
        const parsed = parseFloat(s);
        return isNaN(parsed) ? 0 : parsed;
      }

      return 0;
    };

    // Map rows to normalized objects - skip header row if detected
    let dataRows = rows;
    if (headerRow) {
      dataRows = rows.slice(1); // Skip the header row
      console.log(
        "Skipping header row, processing",
        dataRows.length,
        "data rows"
      );
    }

    const mapped = dataRows
      .map((r) => {
        try {
          // Skip rows that are clearly headers
          if (
            Object.values(r).some(
              (v) =>
                typeof v === "string" &&
                [
                  "candidate id",
                  "candidate name",
                  "group",
                  "phy",
                  "chem",
                  "maths",
                  "total",
                ].includes(v.toString().toLowerCase())
            )
          ) {
            return null;
          }

          // derive name with fallback if numeric slipped in
          let nameVal = r[nameKey];
          const isNumericLike = (v) => {
            if (v === undefined || v === null) return false;
            const n = Number(v);
            return !isNaN(n) && v !== "" && /^(?:\d|\s|,)+$/.test(String(v));
          };
          if (!nameVal || isNumericLike(nameVal)) {
            // prefer common alt columns for names
            const altKeys = ["__empty", "candidate name", "name"];
            for (const k of altKeys) {
              if (k in r && r[k] && !isNumericLike(r[k])) {
                nameVal = r[k];
                break;
              }
            }
          }
          // collect subject marks with improved parsing
          const subj = {};
          let total = 0;
          let validSubjects = 0;

          // Enhanced subject processing
          subjectsDetected.forEach((s) => {
            let value = 0;

            // Try primary key first
            if (r[s.key] !== undefined) {
              value = parseNum(r[s.key]);
            }

            // If no value found, try looking for alternative columns
            if (!value) {
              const subjectKeys = Object.keys(r).filter((k) => {
                const kl = k.toLowerCase();
                return (
                  s.patterns.some((p) => p.test(kl)) ||
                  s.aliases.some((a) => kl.includes(a.toLowerCase()))
                );
              });

              // Try each potential column
              for (const key of subjectKeys) {
                const altValue = parseNum(r[key]);
                if (altValue > 0) {
                  value = altValue;
                  break;
                }
              }
            }

            // Only include non-zero values
            if (value > 0) {
              subj[s.label] = value;
              total += value;
              validSubjects++;
            }
          });

          return {
            CandidateID: (r[idKey] || "").toString(),
            Name: (nameVal || "").toString(),
            Subjects: subj,
            Total: total,
            SubjectCount: validSubjects,
            Rank: 0, // Will be assigned later
            raw: r,
          };
        } catch (error) {
          console.warn("Error processing row:", error);
          return null;
        }
      })
      .filter(Boolean); // Remove null entries

    // sort: if multiple subjects detected, by Total; if only one, by that subject; tie-breaker by name
    const sortBy = (a, b) => {
      if (subjectsDetected.length >= 2) {
        if (b.Total !== a.Total) return b.Total - a.Total;
      } else if (subjectsDetected.length === 1) {
        const s = subjectsDetected[0].label;
        const am = a.Subjects?.[s] ?? 0;
        const bm = b.Subjects?.[s] ?? 0;
        if (bm !== am) return bm - am;
      }
      return a.Name.localeCompare(b.Name);
    };
    mapped.sort(sortBy);

    // Assign ranks with tie handling (dense ranking): equal scores share rank; next unique score gets next rank number
    const getScore = (st) => {
      if (subjectsDetected.length >= 2) return st.Total ?? 0;
      if (subjectsDetected.length === 1) {
        const s = subjectsDetected[0].label;
        return st.Subjects?.[s] ?? 0;
      }
      return st.Total ?? 0;
    };

    let currentRank = 1;
    let prevScore = null;
    for (let i = 0; i < mapped.length; i++) {
      const score = getScore(mapped[i]);
      if (i === 0) {
        mapped[i].Rank = currentRank;
      } else {
        if (score !== prevScore) {
          currentRank += 1;
        }
        mapped[i].Rank = currentRank;
      }
      prevScore = score;
    }

    console.log(
      "Students with ranks assigned:",
      mapped.slice(0, 10).map((s) => ({
        name: s.Name,
        total: s.Total,
        rank: s.Rank,
        subjects: s.Subjects,
      }))
    );

    const result = mapped.slice(0, 10);
    console.log("detectColumnsAndTop10 returning top10:", result);
    // return top10 for image, and full mapped for preview table
    return Array.isArray(result)
      ? {
          students: result,
          allStudents: mapped,
          subjectsDetected: subjectsDetected.map((s) => s.label),
        }
      : { students: [], allStudents: [], subjectsDetected: [] };
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

      // Filter out any header-like rows from rawData
      const cleanData = rawData.filter((row) => {
        if (!row || typeof row !== "object") return false;
        // Skip rows that look like headers
        return !Object.values(row).some(
          (v) =>
            typeof v === "string" &&
            v.toString().toLowerCase().includes("candidate")
        );
      });

      console.log("Cleaned data first row:", cleanData[0]);

      const topRes = detectColumnsAndTop10(cleanData);

      // Ensure we have a valid response structure and take only top 10
      let allStudents = topRes && topRes.students ? [...topRes.students] : [];
      let top10 = allStudents.slice(0, 10);
      const subjectsDetected =
        topRes && topRes.subjectsDetected ? topRes.subjectsDetected : [];

      if (!top10.length) {
        Alert.alert(
          "No data",
          "Could not find suitable columns (ID, Name, Marks). Please check the Excel format."
        );
        return;
      }
      // Ensure exactly 10 rows by padding placeholders if needed
      if (top10.length < 10) {
        const startRank = (top10[top10.length - 1]?.Rank || top10.length) + 1;
        while (top10.length < 10) {
          top10.push({
            CandidateID: "",
            Name: "-",
            Subjects: {},
            Total: undefined,
            SubjectCount: 0,
            Rank: startRank + (top10.length - (startRank - 1)) - 1,
            raw: {},
          });
        }
      }

      console.log("Prepared students (top 10):", top10);

      // Store only top 10 data for preview
      setTop10Data(top10);
      setSubjectsDetectedState(subjectsDetected);
      setShowDataPreview(true);
      console.log("Passing heading to ImagePrint:", sheetHeading || "(none)");
    } catch (err) {
      console.error("Error in getResult:", err);
      Alert.alert("Error", "Failed computing top students.");
    }
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
                ? `Master: Uploaded (${masterRows.length} rows${
                    Object.keys(photoMap || {}).length
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
                    {`${index + 1}. ${student.Name || "-"} - Total: ${
                      student.Total || 0
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
                    subjectsDetected: subjectsDetectedState,
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
