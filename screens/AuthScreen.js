import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, TextInput, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Rect, Defs, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const BackgroundSVG = () => (
  <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
    <Defs>
      <SvgLinearGradient id="bgGradAuth" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0%" stopColor="#0b0b12" />
        <Stop offset="100%" stopColor="#3b0a6e" />
      </SvgLinearGradient>
    </Defs>
    <Rect x="0" y="0" width="100%" height="100%" fill="url(#bgGradAuth)" />
    <Circle cx={width * 0.1} cy={height * 0.15} r="60" fill="rgba(167,139,250,0.12)" />
    <Circle cx={width * 0.9} cy={height * 0.25} r="40" fill="rgba(124,58,237,0.10)" />
    <Circle cx={width * 0.8} cy={height * 0.8} r="80" fill="rgba(167,139,250,0.08)" />
    <Circle cx={width * 0.2} cy={height * 0.9} r="50" fill="rgba(124,58,237,0.12)" />
  </Svg>
);

export default function AuthScreen({ navigation }) {
  const [code, setCode] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const inputRef = useRef(null);

  const verifyCode = () => {
    const value = (code || '').trim();
    if (!value) {
      Alert.alert('Code required', 'Please enter your secret access code to continue.');
      return;
    }
    if (value === '123456') {
      navigation.replace('MainScreen');
    } else {
      Alert.alert(
        'Invalid code',
        'The code you entered is incorrect. If you do not have a code, please contact your institute/admin.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconContainer}>
          <Ionicons name="shield-checkmark-outline" size={56} color="#A78BFA" />
        </View>
        <Text style={styles.title}>EduRank Analyzer</Text>
        <Text style={styles.subtitle}>Enter your secret access code to continue.</Text>
        <View style={styles.infoCard}>
          <Text style={styles.helper}>This code is provided by your institute/admin. Keep it confidential.</Text>
        </View>

        <View style={styles.inputRow}>
          <Ionicons name="lock-closed-outline" size={20} color="#C4B5FD" style={{ marginRight: 8 }} />
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={setCode}
            placeholder="Enter secret access code"
            placeholderTextColor="rgba(255,255,255,0.55)"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="default"
            returnKeyType="done"
            secureTextEntry={!showSecret}
            style={styles.codeInput}
          />
          <TouchableOpacity onPress={() => setShowSecret(s => !s)} accessibilityLabel="Toggle code visibility">
            <Ionicons name={showSecret ? 'eye-off-outline' : 'eye-outline'} size={20} color="#C4B5FD" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={verifyCode} style={styles.button}>
          <ExpoLinearGradient colors={["#7C3AED", "#A78BFA"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.buttonGradient}>
            <Text style={styles.buttonText}>Verify & Continue</Text>
          </ExpoLinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0b0b12'
  },
  scroll: {
    flex: 1,
    backgroundColor: '#0b0b12',
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 18,
  },
  iconContainer: {
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderRadius: 50,
    padding: 20,
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    fontWeight: '500'
  },
  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
    padding: 12,
    borderRadius: 12,
    width: '100%',
    marginTop: 10,
    marginBottom: 12,
  },
  helper: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  codeInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 4,
  },
  // Code input styles
  codeWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
    maxWidth: 360,
    marginTop: 10,
    marginBottom: 10,
  },
  codeBox: {
    width: 48,
    height: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBoxActive: {
    borderColor: '#A78BFA',
    backgroundColor: 'rgba(167,139,250,0.12)'
  },
  codeChar: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700'
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
  button: {
    width: '100%',
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 12,
    marginTop: 8,
  },
  buttonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800'
  },
});

