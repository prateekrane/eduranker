import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Rect, Defs, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const Step = ({ icon, text, number }) => (
    <View style={styles.stepContainer}>
        <View style={styles.stepIconContainer}>
            <Text style={styles.stepNumber}>{number}</Text>
        </View>
        <View style={styles.stepContent}>
            <View style={styles.stepIcon}>{icon}</View>
            <Text style={styles.stepText}>{text}</Text>
        </View>
    </View>
);

const BackgroundSVG = () => (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
            <SvgLinearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor="#0b0b12" />
                <Stop offset="100%" stopColor="#3b0a6e" />
            </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#bgGrad)" />
        <Circle cx={width * 0.1} cy={height * 0.15} r="60" fill="rgba(167,139,250,0.12)" />
        <Circle cx={width * 0.9} cy={height * 0.25} r="40" fill="rgba(124,58,237,0.10)" />
        <Circle cx={width * 0.8} cy={height * 0.8} r="80" fill="rgba(167,139,250,0.08)" />
        <Circle cx={width * 0.2} cy={height * 0.9} r="50" fill="rgba(124,58,237,0.12)" />
    </Svg>
);

export default function MainScreen({ navigation }) {
    return (
        <SafeAreaView style={styles.safeArea}>
            <BackgroundSVG />
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.container}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero Section */}
                <View style={styles.heroSection}>
                    <Text style={styles.title}>EduRank Analyzer</Text>
                    <Text style={styles.subtitle}>Transform Excel data into beautiful student rankings</Text>
                    <View style={styles.tagline}>
                        <Text style={styles.taglineText}>Accurate • Fast • Professional</Text>
                    </View>
                </View>

                {/* Features Section */}
                <View style={styles.featuresSection}>
                    <Text style={styles.sectionTitle}>How it works</Text>
                    <Step
                        number="1"
                        icon={<Ionicons name="cloud-upload-outline" size={26} color="#C4B5FD" />}
                        text="Upload your Excel file with student data and marks"
                    />
                    <Step
                        number="2"
                        icon={<Ionicons name="search-outline" size={26} color="#C4B5FD" />}
                        text="Our algorithm automatically identifies top performers"
                    />
                    <Step
                        number="3"
                        icon={<MaterialCommunityIcons name="image-multiple-outline" size={26} color="#C4B5FD" />}
                        text="Generate and download professional ranking certificates"
                    />
                </View>

                {/* Stats Section */}
                <View style={styles.statsSection}>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>10</Text>
                        <Text style={styles.statLabel}>Top Students</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>1</Text>
                        <Text style={styles.statLabel}>Click Process</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>HD</Text>
                        <Text style={styles.statLabel}>Quality Output</Text>
                    </View>
                </View>

                {/* CTA Button */}
                <TouchableOpacity onPress={() => navigation.navigate('Result')} style={styles.button}>
                    <ExpoLinearGradient colors={["#7C3AED", "#A78BFA"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.buttonGradient}>
                        <Text style={styles.buttonText}>Start Ranking Now</Text>
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
        flexGrow: 1,
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 36,
        paddingBottom: 56,
        gap: 24,
        width: '100%'
    },
    page: {
        position: 'relative',
        width: '100%',
        minHeight: height,
    },

    // Hero Section
    heroSection: {
        alignItems: 'center',
        width: '100%'
    },
    iconContainer: {
        backgroundColor: 'rgba(167,139,250,0.12)',
        borderRadius: 50,
        padding: 20,
        marginBottom: 16,
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
        marginBottom: 6,
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.85)',
        textAlign: 'center',
        marginBottom: 12,
        fontWeight: '500'
    },
    tagline: {
        backgroundColor: 'rgba(167,139,250,0.15)',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(167,139,250,0.35)'
    },
    taglineText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '600'
    },

    // Features Section
    featuresSection: {
        width: '100%',
        marginBottom: 8
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#ffffff',
        textAlign: 'center',
        marginBottom: 20,
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    stepContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 15,
        padding: 15,
        borderWidth: 1,
        borderColor: 'rgba(167,139,250,0.25)'
    },
    stepIconContainer: {
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderRadius: 20,
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
    },
    stepNumber: {
        fontSize: 18,
        fontWeight: '900',
        color: '#A78BFA'
    },
    stepContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center'
    },
    stepIcon: {
        marginRight: 12
    },
    stepText: {
        fontSize: 16,
        color: '#ffffff',
        flex: 1,
        fontWeight: '500'
    },

    // Stats Section
    statsSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 8,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(167,139,250,0.25)'
    },
    statItem: {
        alignItems: 'center'
    },
    statNumber: {
        fontSize: 24,
        fontWeight: '900',
        color: '#E9D5FF',
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    statLabel: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.75)',
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 5
    },

    // Button
    button: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 12,
        borderRadius: 30,
        width: '100%'
    },
    buttonGradient: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 30,
        alignItems: 'center'
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '800',
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
});
