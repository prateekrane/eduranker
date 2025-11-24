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

import { Asset } from "expo-asset";

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
  const [logoBase64, setLogoBase64] = useState(null);

  useEffect(() => {
    // Load logo
    (async () => {
      try {
        const asset = Asset.fromModule(require("../assets/logo.jpg"));
        await asset.downloadAsync();

        // In production, localUri might be null if it's a bundled resource.
        // We should check localUri first, then fall back to copying if needed, 
        // but downloadAsync usually ensures localUri is populated for remote assets.
        // For bundled assets, we might need to copy it to cache if readAsStringAsync fails on the resource URI.

        let uri = asset.localUri || asset.uri;

        if (!uri) {
          console.log("Logo asset has no local URI/URI");
          return;
        }

        // If it's a resource identifier (android.resource://), we might need to handle it differently
        // But FileSystem.readAsStringAsync usually handles file:// and content://

        console.log("Loading logo from:", uri);
        const b64 = await FileSystem.readAsStringAsync(uri, {
          encoding: "base64",
        });
        const dataUri = `data:image/jpeg;base64,${b64}`;
        console.log("Logo base64 length:", dataUri.length);
        setLogoBase64(dataUri);
      } catch (e) {
        console.log("Error loading logo:", e);
        // Fallback: if local loading fails, try to use the http URI if available (though unlikely for require)
        // Or just leave it null
      }
    })();
  }, []);

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
      const fileUri = FileSystem.cacheDirectory + `Top15_${Date.now()}.png`;
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
            dialogTitle: "Save/Share Top 15 Image",
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
    // Use passed subjects if available, otherwise fallback to detection
    const ALLOWED_SUBJECTS = ["PHY", "CHEM", "MATHS", "BIO"];

    let presentSubjects = [];
    if (subjectsDetected && subjectsDetected.length > 0) {
      // Filter to ensure we only use valid allowed subjects
      presentSubjects = subjectsDetected.filter(s => ALLOWED_SUBJECTS.includes(s));
    } else {
      // Fallback: Get subjects that are actually present in the data
      presentSubjects = ALLOWED_SUBJECTS.filter((subject) =>
        safeStudents.some(
          (student) => student.Subjects && student.Subjects[subject] !== undefined
        )
      );
    }

    // Determine Title
    let title = "TOPPERS LIST";
    const s = presentSubjects;
    const has = (sub) => s.includes(sub);

    if (s.length === 3 && has('PHY') && has('CHEM') && has('MATHS')) title = "PCM TOPPERS";
    else if (s.length === 3 && has('PHY') && has('CHEM') && has('BIO')) title = "PCB TOPPERS";
    else if (s.length === 4) title = "PCMB TOPPERS";
    else if (s.length === 1) {
      if (has('PHY')) title = "PHYSICS TOPPERS";
      else if (has('CHEM')) title = "CHEMISTRY TOPPERS";
      else if (has('MATHS')) title = "MATHS TOPPERS";
      else if (has('BIO')) title = "BIOLOGY TOPPERS";
    } else if (s.length > 0) {
      title = s.join(' + ') + " TOPPERS";
    }

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

      // Fallback to placeholder if no photo found
      if (!photo) {
        // Use a generic placeholder or just null to show initials/icon
        photo = null;
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

    // Fill remaining slots with empty data if needed (up to 15)
    while (studentsData.length < 15) {
      studentsData.push({
        rank: studentsData.length + 1,
        name: "-",
        Subjects: {},
        Total: undefined,
      });
    }

    const dateStr = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Helper to generate a single student card (Horizontal Layout)
    const generateStudentCard = (student, rank, isTopper = false) => {
      if (!student) return "";
      const isEmpty = student.name === "-";

      let photoHtml = "";
      if (!isEmpty && student.photo) {
        let imgSrc = student.photo;
        // Google Drive handling
        if (imgSrc.includes("drive.google.com")) {
          const match = imgSrc.match(/id=([^&]+)/);
          if (match && match[1]) {
            const fileId = match[1];
            const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w200`;

            photoHtml = `
                    <img 
                        src="${thumbnailUrl}" 
                        class="w-full h-full object-cover" 
                        onerror="this.onerror=null; this.src='${imgSrc}'; this.onerror=function(){this.style.display='none'; this.nextElementSibling.style.display='flex';}" 
                    />
                    <div style="display: none;" class="w-full h-full items-center justify-center bg-slate-200 text-slate-400 font-bold">
                        ${student.name !== "-" ? student.name.split(' ').map(n => n[0]).join('').substring(0, 2) : ""}
                    </div>
                `;
          } else {
            photoHtml = `<img src="${imgSrc}" class="w-full h-full object-cover" />`;
          }
        } else {
          photoHtml = `<img src="${imgSrc}" class="w-full h-full object-cover" />`;
        }
      } else {
        const initials = student.name !== "-" ? student.name.split(' ').map(n => n[0]).join('').substring(0, 2) : "";
        photoHtml = `<div class="w-full h-full flex items-center justify-center bg-slate-200 text-slate-400 font-bold">${initials}</div>`;
      }

      // Subject marks
      let marksHtml = "";
      presentSubjects.forEach(sub => {
        marksHtml += `
                <div class="flex flex-col items-center">
                    <span class="text-[10px] font-bold text-slate-500 uppercase">${sub}</span>
                    <span class="text-sm font-bold text-slate-800">${student.Subjects[sub] || "-"}</span>
                </div>
            `;
      });

      if (isTopper) {
        // Special Horizontal Layout for Topper (Full Width)
        return `
            <div class="bg-gradient-to-r from-yellow-50 to-white rounded-2xl p-4 flex items-center shadow-lg border-2 border-yellow-400 relative overflow-hidden w-full mb-6">
                <div class="absolute top-0 right-0 bg-yellow-400 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">RANK 1</div>
                
                <!-- Rank Circle -->
                <div class="w-16 h-16 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center font-black text-3xl mr-6 shrink-0 border-2 border-yellow-200">
                    1
                </div>

                <!-- Photo -->
                <div class="w-24 h-24 rounded-full overflow-hidden bg-white border-4 border-yellow-400 shadow-md mr-6 shrink-0">
                    ${photoHtml}
                </div>

                <!-- Info -->
                <div class="flex-1 min-w-0 mr-6">
                    <h3 class="font-black text-slate-900 text-3xl truncate leading-tight mb-1">${student.name}</h3>
                    <p class="text-lg text-slate-500 font-medium">ID: ${student.id}</p>
                </div>

                <!-- Marks -->
                <div class="flex gap-6 items-center shrink-0">
                    <div class="flex gap-4">
                        ${marksHtml}
                    </div>
                    
                    ${student.Total !== undefined ? `
                    <div class="flex flex-col items-center pl-6 border-l-2 border-yellow-200">
                        <span class="text-xs font-bold text-yellow-600 uppercase tracking-wider">Total</span>
                        <span class="text-4xl font-black text-yellow-600 leading-none">${student.Total}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
          `;
      }

      // Standard Horizontal Card for others
      return `
        <div class="bg-white rounded-xl p-3 flex items-center shadow-sm border border-slate-100 relative overflow-hidden h-24">
            <div class="absolute top-0 left-0 w-1 h-full ${rank <= 3 ? 'bg-yellow-400' : 'bg-slate-300'}"></div>
            
            <!-- Rank -->
            <div class="w-8 h-8 rounded-full ${rank <= 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'} flex items-center justify-center font-black text-sm mr-3 shrink-0">
                ${student.rank}
            </div>

            <!-- Photo -->
            <div class="w-14 h-14 rounded-full overflow-hidden bg-slate-100 border-2 border-white shadow-sm mr-3 shrink-0">
                ${photoHtml}
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0 mr-2">
                <h3 class="font-bold text-slate-800 text-sm truncate leading-tight">${student.name}</h3>
                <p class="text-xs text-slate-500 truncate">ID: ${student.id}</p>
            </div>

            <!-- Marks -->
            <div class="flex gap-3 shrink-0 items-center">
                <div class="flex gap-2">
                    ${marksHtml}
                </div>
                ${student.Total !== undefined ? `
                <div class="flex flex-col items-center pl-3 border-l border-slate-100">
                    <span class="text-[9px] font-bold text-purple-600 uppercase">Total</span>
                    <span class="text-xl font-black text-purple-700 leading-none">${student.Total}</span>
                </div>
                ` : ''}
            </div>
        </div>
      `;
    };

    const topper = studentsData[0];
    const rest = studentsData.slice(1, 15); // Remaining 14 students

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap');
            body { font-family: 'Outfit', sans-serif; }
          </style>
        </head>
        <body class="bg-slate-50 p-8 flex items-center justify-center min-h-screen">
          <div class="w-[2400px] bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-200 relative">

            <!-- Header -->
            <div class="bg-[#3b0a6e] p-12 text-white relative overflow-hidden">
              <div class="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>

              <div class="flex justify-between items-center relative z-10">
                <!-- Left Logo -->
                <div class="w-32 h-32 bg-white rounded-3xl p-4 flex items-center justify-center shadow-lg transform -rotate-3">
                  ${logoBase64 ? `<img src="${logoBase64}" class="w-full h-full object-contain" />` : '<span class="text-xs text-black font-bold">LOGO</span>'}
                </div>

                <div class="text-center flex-1 px-8">
                  <h1 class="text-7xl font-extrabold tracking-tight mb-4 uppercase text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-400 drop-shadow-sm">
                    ${title}
                  </h1>
                  <p class="text-purple-200 text-3xl font-medium tracking-widest uppercase opacity-80">
                    ${sheetHeading || "Excellence in Education"}
                  </p>
                </div>

                <!-- Right Logo -->
                <div class="w-32 h-32 bg-white rounded-3xl p-4 flex items-center justify-center shadow-lg transform rotate-3">
                  ${logoBase64 ? `<img src="${logoBase64}" class="w-full h-full object-contain" />` : '<span class="text-xs text-black font-bold">LOGO</span>'}
                </div>
              </div>
            </div>

            <!-- Content -->
            <div class="p-12 bg-slate-50 flex flex-col h-full">
                
                <!-- Topper Section -->
                <div class="w-full">
                    ${generateStudentCard(topper, 1, true)}
                </div>

                <!-- Grid Section (2 Columns) -->
                <div class="grid grid-cols-2 gap-x-8 gap-y-4 w-full">
                    ${rest.map((s, i) => generateStudentCard(s, i + 2)).join('')}
                </div>

            </div>

            <!-- Footer -->
            <div class="bg-slate-900 text-white p-6 text-center mt-auto">
              <p class="text-slate-400 text-xl uppercase tracking-widest font-semibold">Result Date: ${dateStr}</p>
            </div>
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
  }, [safeStudents, logoBase64]);

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
      {/* Hidden WebView for generation only - HD Resolution */}
      <ViewShot
        ref={viewRef}
        options={{ format: "png", quality: 1.0, width: 2400, height: 1600 }}
        style={{
          width: 2400,
          height: 1600,
          position: "absolute",
          left: -10000,
          top: -10000,
          opacity: 0,
          pointerEvents: "none",
        }}
      >
        <View style={[styles.webViewContainer, { width: 2400, height: 1600 }]}>
          <WebView
            source={{ html }}
            style={[styles.webView, { width: 2400, height: 1600 }]}
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
          <Text style={styles.loadingText}>Generating HD image...</Text>
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
    width: 2400, // Increased width for HD
    height: 1600, // Increased height for HD
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
    height: 667, // Maintain aspect ratio (2400:1600 = 1000:667)
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
