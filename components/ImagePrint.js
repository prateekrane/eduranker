// screens/ImagePrint.js
import React, { useRef, useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { WebView } from "react-native-webview";
import ViewShot from "react-native-view-shot";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";

import * as FileSystem from "expo-file-system/legacy";

export default function ImagePrint({
  route,
  navigation,
  autoGenerate = false,
}) {
  // More robust parameter extraction with multiple fallbacks
  const params = route?.params || {};
  const students = params.students || [];
  const photoMap = params.photoMap || {};
  const hideCandidateId = !!params.hideCandidateId;
  const subjectsDetected = Array.isArray(params.subjectsDetected)
    ? params.subjectsDetected
    : [];
  const sheetHeading =
    typeof params.sheetHeading === "string" ? params.sheetHeading : "";

  // Safety check to ensure students is always an array
  const safeStudents = Array.isArray(students) ? students : [];
  const viewRef = useRef();
  const [capturedUri, setCapturedUri] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [isGenerating, setIsGenerating] = useState(true);

  useEffect(() => {
    // Reset generation when data changes
    setCapturedUri(null);
    setHasCaptured(false);
    setIsGenerating(true);
    console.log("Students data updated, WebView will auto-capture when ready");
  }, [safeStudents]);

  const [hasCaptured, setHasCaptured] = useState(false);

  const capture = async (showAlert = true) => {
    try {
      console.log("Attempting to capture image...");
      console.log(
        "Students data for capture:",
        safeStudents.length,
        "students"
      );
      const uri = await viewRef.current.capture();
      console.log("Captured URI:", uri);
      setCapturedUri(uri);
      setHasCaptured(true);
      setIsGenerating(false);
      if (showAlert) {
        Alert.alert(
          "Image generated",
          "Preview below — you can download to gallery."
        );
      }
    } catch (err) {
      console.error("Capture error:", err);
      if (showAlert) {
        Alert.alert("Error", "Failed to capture image.");
      }
    }
  };

  const saveToGallery = async () => {
    if (!capturedUri) {
      Alert.alert("Generate first", 'Tap "Generate Image" first.');
      return;
    }

    try {
      const fileUri = FileSystem.cacheDirectory + `Top10_${Date.now()}.png`;
      await FileSystem.copyAsync({ from: capturedUri, to: fileUri });
      // Try direct save. On newer Android, this may work without explicit permission.
      await MediaLibrary.saveToLibraryAsync(fileUri);
      Alert.alert("Saved", "Image saved to your gallery.");
    } catch (err) {
      console.warn(
        "Save to gallery failed, trying share fallback:",
        err?.message || err
      );
      try {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(capturedUri, {
            mimeType: "image/png",
            dialogTitle: "Save/Share Top 10 Image",
          });
          Alert.alert("Share opened", "Use the share sheet to save the image.");
        } else {
          Alert.alert(
            "Permission required",
            "Unable to save automatically. Please allow Photos/Media permission in Settings and try again."
          );
        }
      } catch (e2) {
        console.error(e2);
        Alert.alert("Error", "Failed to save or share the image.");
      }
    }
  };

  // Generate HTML with dynamic student data (Tailwind-based template)
  const generateHTML = () => {
    // Fixed order of subjects as specified
    const ALLOWED_SUBJECTS = ["PHY", "CHEM", "MATHS", "BIO"];

    // Get subjects that are actually present in the data
    const presentSubjects = ALLOWED_SUBJECTS.filter((subject) =>
      safeStudents.some(
        (student) => student.Subjects && student.Subjects[subject] !== undefined
      )
    );

    // Prepare students data (already sorted and ranked in Result.js)
    const studentsData = safeStudents.map((student, index) => {
      const id = (student.CandidateID || "").toString().trim();
      const idDigits = id.replace(/\D+/g, "");

      // Enhanced photo lookup with multiple matching strategies
      let photo = null;
      if (id && photoMap) {
        // Strategy 1: Try exact match
        photo = photoMap[id];

        // Strategy 2: Try digits-only match
        if (!photo && idDigits) {
          photo = photoMap[idDigits];
        }

        // Strategy 3: Try without leading zeros
        if (!photo && idDigits) {
          const withoutLeadingZeros = idDigits.replace(/^0+/, "");
          if (withoutLeadingZeros !== idDigits) {
            photo = photoMap[withoutLeadingZeros];
          }
        }

        // Strategy 4: Try with padded zeros (5 digits)
        if (!photo && idDigits && idDigits.length < 5) {
          const paddedId = idDigits.padStart(5, "0");
          photo = photoMap[paddedId];
        }

        // Strategy 5: Try case-insensitive match
        if (!photo) {
          const lowerId = id.toLowerCase();
          photo = photoMap[lowerId];
        }

        // Strategy 6: Try partial match (last 4 digits)
        if (!photo && idDigits && idDigits.length >= 4) {
          const last4 = idDigits.slice(-4);
          // Find any key that ends with these 4 digits
          for (const [key, value] of Object.entries(photoMap)) {
            if (key.endsWith(last4)) {
              photo = value;
              console.log(
                `Found partial match for ID "${id}" using last 4 digits "${last4}" -> key "${key}"`
              );
              break;
            }
          }
        }

        if (index < 3) {
          console.log(`Photo lookup for "${student.Name}" (ID: ${id})`);
          console.log(`  - Exact match: ${!!photoMap[id]}`);
          console.log(`  - Digits match: ${!!photoMap[idDigits]}`);
          console.log(`  - Photo found: ${!!photo}`);
        }
      }

      if (photo) {
        console.log(
          `Student ${student.Name} (ID: ${id}) - Photo URL: ${photo.substring(
            0,
            100
          )}...`
        );
      } else {
        console.log(`Student ${student.Name} (ID: ${id}) - No photo found`);
        console.log(
          `Available photo map keys: ${Object.keys(photoMap || {})
            .slice(0, 10)
            .join(", ")}`
        );
      }

      return {
        rank: student.Rank || index + 1, // Use assigned rank or fallback to index
        id,
        name: student.Name || "-",
        Subjects: student.Subjects || {},
        Total:
          presentSubjects.length >= 2
            ? presentSubjects.reduce(
                (sum, subject) => sum + (student.Subjects?.[subject] || 0),
                0
              )
            : undefined,
        photo,
      };
    });

    // Fill remaining slots with empty data if needed
    while (studentsData.length < 10) {
      studentsData.push({
        rank: studentsData.length + 1,
        name: "-",
        Subjects: {},
        Total: undefined,
      });
    }

    // Generate initials for placeholder images
    const initials = (name) => {
      if (!name || name === "-") return "NA";
      const parts = name.trim().split(/\s+/);
      const first = parts[0]?.[0] || "";
      const last = parts[parts.length - 1]?.[0] || "";
      return (first + last).toUpperCase();
    };

    // Build header HTML for one set with fixed column classes
    const headerHtmlForOne = (() => {
      const parts = [];
      parts.push('<th class="col-photo">Photo</th>');
      parts.push('<th class="col-rank">Rank</th>');
      parts.push('<th class="col-name">Student Name</th>');
      presentSubjects.forEach((subject) => {
        parts.push(`<th class="col-subject">${subject}</th>`);
      });
      if (presentSubjects.length >= 2) {
        parts.push('<th class="col-total">Total</th>');
      }
      return parts.join("");
    })();

    // Function to generate cells for one student
    const generateStudentCells = (student, bgColor) => {
      const cells = [];

      // Photo cell - use proxy URL for Google Drive images
      let photoHtml = "";
      if (student.name !== "-") {
        if (student.photo) {
          // Try multiple image loading strategies
          let imgSrc = student.photo;

          // If it's a Google Drive URL, try different approaches
          if (imgSrc.includes("drive.google.com")) {
            // Extract the file ID
            const match = imgSrc.match(/id=([^&]+)/);
            if (match && match[1]) {
              const fileId = match[1];
              // Try thumbnail API (works better in WebView)
              const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w100`;
              // Also prepare direct download URL as fallback
              const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

              photoHtml = `
                                <img 
                                    src="${thumbnailUrl}" 
                                    alt="${student.name}" 
                                    style="width: 56px; height: 56px; border-radius: 8px; object-fit: cover;" 
                                    onerror="this.onerror=null; this.src='${imgSrc}'; this.onerror=function(){this.style.display='none'; this.nextElementSibling.style.display='flex';}" 
                                />
                                <div style="display: none; width: 56px; height: 56px; border-radius: 8px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-size: 16px; font-weight: bold; align-items: center; justify-content: center;">${student.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .substring(0, 2)
                                  .toUpperCase()}</div>
                            `;
            } else {
              // Fallback to original URL
              photoHtml = `
                                <img 
                                    src="${imgSrc}" 
                                    alt="${student.name}" 
                                    style="width: 56px; height: 56px; border-radius: 8px; object-fit: cover;" 
                                    onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" 
                                />
                                <div style="display: none; width: 56px; height: 56px; border-radius: 8px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-size: 16px; font-weight: bold; align-items: center; justify-content: center;">${student.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .substring(0, 2)
                                  .toUpperCase()}</div>
                            `;
            }
          } else {
            // Non-Google Drive URL
            photoHtml = `
                            <img 
                                src="${imgSrc}" 
                                alt="${student.name}" 
                                style="width: 56px; height: 56px; border-radius: 8px; object-fit: cover;" 
                                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" 
                            />
                            <div style="display: none; width: 56px; height: 56px; border-radius: 8px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-size: 16px; font-weight: bold; align-items: center; justify-content: center;">${student.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .substring(0, 2)
                              .toUpperCase()}</div>
                        `;
          }
        } else {
          // No photo - show initials with gradient background
          const initials = student.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .substring(0, 2)
            .toUpperCase();
          photoHtml = `<div style="width: 56px; height: 56px; border-radius: 8px; background: linear-gradient(135deg, #e0e0e0 0%, #f5f5f5 100%); color: #999; font-size: 16px; font-weight: bold; display: flex; align-items: center; justify-content: center;">${
            initials || "?"
          }</div>`;
        }
      }
      cells.push(
        `<td class="${bgColor} col-photo text-center">${photoHtml}</td>`
      );

      // Rank and Name
      cells.push(
        `<td class="${bgColor} col-rank text-center font-bold text-black">${
          student.rank || ""
        }</td>`
      );
      cells.push(
        `<td class="${bgColor} col-name text-left font-semibold text-black">${
          student.name || ""
        }</td>`
      );

      // Subject marks
      presentSubjects.forEach((subject) => {
        cells.push(
          `<td class="bg-sky-300 col-subject text-center font-extrabold text-black">${
            student.Subjects[subject] !== undefined
              ? student.Subjects[subject]
              : ""
          }</td>`
        );
      });

      // Total (only if 2 or more subjects)
      if (presentSubjects.length >= 2) {
        cells.push(
          `<td class="bg-sky-300 col-total text-center font-extrabold text-black">${
            student.Total !== undefined ? student.Total : ""
          }</td>`
        );
      }

      return cells.join("");
    };

    // Generate rows HTML
    let rowsHtml = "";
    for (let i = 0; i < studentsData.length; i += 2) {
      const left = studentsData[i];
      const right = studentsData[i + 1] || {
        rank: "",
        name: "-",
        Subjects: {},
      };
      const leftColor =
        Math.floor(i / 2) % 2 === 0 ? "bg-lime-200" : "bg-sky-200";
      const rightColor =
        Math.floor(i / 2) % 2 === 0 ? "bg-sky-200" : "bg-lime-200";

      rowsHtml += `
                <tr>
                    ${generateStudentCells(left, leftColor)}
                    ${generateStudentCells(right, rightColor)}
                </tr>
            `;
    }

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Toppers List</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet">
        <style>
            html, body {
                width: 1200px !important;
                min-width: 1200px !important;
                max-width: 1200px !important;
                height: 800px !important;
                min-height: 800px !important;
                max-height: 800px !important;
                overflow: hidden !important;
                margin: 0;
                padding: 0;
                box-sizing: border-box;
                background-color: #004d40;
                font-family: 'Inter', sans-serif;
            }
            .text-shadow-heavy { text-shadow: 1px 1px 2px rgba(0,0,0,0.5); }
            .custom-table th, .custom-table td { 
                border: 2px solid black; 
                padding: 8px;
                vertical-align: middle;
            }
            .custom-table { 
                border-collapse: collapse;
                width: 1168px !important;
                min-width: 1168px !important;
                max-width: 1168px !important;
                table-layout: fixed;
            }
            /* Fixed widths per column (tighter so two blocks fit side-by-side) */
            .col-photo { width: 56px; text-align: center; }
            .col-rank { width: 46px; text-align: center; font-weight: 800; }
            .col-name { width: 150px; text-align: left; word-break: break-word; white-space: normal; }
            .col-subject { width: 66px; text-align: center; font-weight: 800; }
            .col-total { width: 66px; text-align: center; font-weight: 900; }
        </style>
    </head>
    <body>
        <div style="width: 1200px; height: 800px; margin: 0 auto;">
            <header class="text-center">
                <div class="bg-red-600 text-white font-black text-xl sm:text-2xl md:text-3xl py-3 shadow-lg text-shadow-heavy tracking-wide" style="text-align: center;">
                    ${
                      sheetHeading
                        ? sheetHeading
                            .replace(/</g, "&lt;")
                            .replace(/>/g, "&gt;")
                        : "TOPPER'S LIST"
                    }
                </div>
                ${
                  sheetHeading
                    ? ""
                    : `<div class="bg-blue-900 py-2 shadow-md" style="text-align: center;"><h2 class="text-white font-bold text-lg sm:text-xl md:text-2xl">CLUSTER TEST</h2></div>`
                }
            </header>
    
                <div style="width: 1168px; margin: 0 auto;">
                    <table class="custom-table mt-1 min-w-max">
                        <thead>
                            <tr class="bg-lime-200">
                                ${headerHtmlForOne}
                                ${headerHtmlForOne}
                            </tr>
                            
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
            </main>
    
            <footer class="mt-1">
                <div class="bg-teal-800 text-white font-black text-2xl sm:text-3xl md:text-4xl text-center py-4 shadow-lg tracking-wider">
                    ALL THE BEST FOR NEXT EXAM
                </div>
            </footer>
        </div>
    </body>
    </html>
        `;
  };

  // Debug: verify dynamic data arriving from navigation
  useEffect(() => {
    console.log("=== ImagePrint Debug Info ===");
    console.log("Students data count:", safeStudents.length);
    console.log("Photo map keys count:", Object.keys(photoMap || {}).length);
    console.log(
      "Photo map sample keys:",
      Object.keys(photoMap || {}).slice(0, 10)
    );
    console.log("Sheet heading:", sheetHeading);
    console.log("Subjects detected:", subjectsDetected);

    // Debug photo matching for first few students
    if (safeStudents.length > 0 && photoMap) {
      console.log("=== Photo Matching Debug ===");
      safeStudents.slice(0, 5).forEach((student, index) => {
        const id = (student.CandidateID || "").toString().trim();
        const idDigits = id.replace(/\D+/g, "");
        console.log(`Student ${index + 1}: ${student.Name}`);
        console.log(`  - Candidate ID from marks: "${id}"`);
        console.log(`  - ID Digits: "${idDigits}"`);
        console.log(`  - Photo found (exact): ${!!photoMap[id]}`);
        console.log(`  - Photo found (digits): ${!!photoMap[idDigits]}`);

        // Show what keys are available that might match
        const availableKeys = Object.keys(photoMap).filter(
          (k) => k.includes(idDigits.substring(0, 4)) || idDigits.includes(k)
        );
        if (availableKeys.length > 0) {
          console.log(
            `  - Similar keys in photo map: ${availableKeys
              .slice(0, 5)
              .join(", ")}`
          );
        }

        if (photoMap[id]) {
          console.log(`  - Photo URL: ${photoMap[id].substring(0, 50)}...`);
        } else if (photoMap[idDigits]) {
          console.log(
            `  - Photo URL (digits): ${photoMap[idDigits].substring(0, 50)}...`
          );
        } else {
          console.log(`  - NO PHOTO FOUND`);
        }
      });
    }
    console.log("=== End Debug Info ===");
  }, [safeStudents, photoMap]);

  // Auto-generate is now handled by WebView onLoadEnd only

  const html = useMemo(() => {
    const generatedHtml = generateHTML();
    console.log("Generated HTML length:", generatedHtml.length);
    console.log(
      "HTML preview (first 500 chars):",
      generatedHtml.substring(0, 500)
    );
    return generatedHtml;
  }, [safeStudents]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 20,
        backgroundColor: "#f0f0f0",
      }}
    >
      {/* Hidden WebView for generation only */}
      <ViewShot
        ref={viewRef}
        options={{ format: "png", quality: 1.0, width: 1200, height: 800 }}
        style={{
          width: 1200,
          height: 800,
          position: "absolute",
          left: -10000,
          top: -10000,
          opacity: 0,
          pointerEvents: "none",
        }}
      >
        <View style={[styles.webViewContainer, { width: 1200, height: 800 }]}>
          <WebView
            source={{ html }}
            style={[styles.webView, { width: 1200, height: 800 }]}
            scrollEnabled={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            onLoadStart={() => {
              console.log("WebView load started");
              setIsGenerating(true);
            }}
            onLoadEnd={() => {
              console.log("WebView load ended");
              if (autoGenerate && !capturedUri && !hasCaptured) {
                console.log("Triggering auto-capture after WebView load");
                setTimeout(() => {
                  try {
                    capture(false);
                  } catch (e) {
                    console.error("Auto-capture failed:", e);
                  }
                }, 1000);
              }
            }}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error("WebView error:", nativeEvent);
              setIsGenerating(false);
            }}
          />
        </View>
      </ViewShot>

      {/* Show loading while generating, else the captured image and download button */}
      {isGenerating && !capturedUri ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={styles.loadingText}>Generating image...</Text>
        </View>
      ) : capturedUri ? (
        <View style={styles.preview}>
          <ScrollView horizontal={true} showsHorizontalScrollIndicator={true}>
            <Image source={{ uri: capturedUri }} style={styles.previewImage} />
          </ScrollView>
          <TouchableOpacity style={styles.saveBtn} onPress={saveToGallery}>
            <Text style={styles.btnText}>Download to Gallery</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={{ color: "#666", fontStyle: "italic" }}>
          No image available
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingVertical: 20,
    backgroundColor: "#f0f0f0",
    minWidth: "100%",
  },
  verticalScroll: {
    alignItems: "center",
    minWidth: 900, // Ensure minimum width for horizontal scrolling
  },
  webViewContainer: {
    width: 1200, // Increased width to accommodate full table
    height: 800, // Increased height for better visibility
    backgroundColor: "white",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  webView: {
    flex: 1,
    backgroundColor: "transparent",
    borderRadius: 8,
  },

  // Controls
  controls: {
    flexDirection: "row",
    marginTop: 18,
    gap: 12,
  },
  generateBtn: {
    backgroundColor: "#2e86de",
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 10,
    marginRight: 12,
  },
  saveBtn: {
    backgroundColor: "#27ae60",
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 10,
  },
  btnText: {
    color: "#fff",
    fontWeight: "700",
  },

  // Preview
  preview: {
    marginTop: 20,
    alignItems: "center",
  },
  previewImage: {
    width: 1000, // Increased preview size to match capture
    height: 667, // Maintain aspect ratio (1200:800 = 1000:667)
    resizeMode: "contain",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
    gap: 10,
  },
  loadingText: {
    color: "#333",
    fontWeight: "600",
  },
});
