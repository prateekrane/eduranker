import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Rect, Defs, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const BackgroundSVG = () => (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
            <SvgLinearGradient id="bgGradSplash" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor="#0b0b12" />
                <Stop offset="100%" stopColor="#3b0a6e" />
            </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#bgGradSplash)" />
        <Circle cx={width * 0.1} cy={height * 0.15} r="60" fill="rgba(167,139,250,0.12)" />
        <Circle cx={width * 0.9} cy={height * 0.25} r="40" fill="rgba(124,58,237,0.10)" />
        <Circle cx={width * 0.8} cy={height * 0.8} r="80" fill="rgba(167,139,250,0.08)" />
        <Circle cx={width * 0.2} cy={height * 0.9} r="50" fill="rgba(124,58,237,0.12)" />
    </Svg>
);

export default function SplashScreen({ navigation }) {
    useEffect(() => {
        const t = setTimeout(() => {
            try { navigation.replace('AuthScreen'); } catch { }
        }, 2000);
        return () => clearTimeout(t);
    }, [navigation]);

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <View style={styles.iconContainer}>
                    <Ionicons name="school-outline" size={56} color="#A78BFA" />
                </View>
                <Text style={styles.title}>EduRank Analyzer</Text>
                <Text style={styles.subtitle}>Transform Excel data into beautiful student rankings</Text>
                <View style={styles.tagline}>
                    <Text style={styles.taglineText}>Accurate • Fast • Professional</Text>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#0b0b12'
    },
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        gap: 14,
    },
    iconContainer: {
        backgroundColor: 'rgba(167,139,250,0.12)',
        borderRadius: 50,
        padding: 20,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    title: {
        fontSize: 32,
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
    tagline: {
        backgroundColor: 'rgba(167,139,250,0.15)',
        paddingHorizontal: 18,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(167,139,250,0.35)'
    },
    taglineText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '600'
    }
});

