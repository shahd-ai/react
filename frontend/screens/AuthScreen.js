import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Animated, Dimensions, StatusBar,
  KeyboardAvoidingView, Platform, ScrollView, Alert
} from 'react-native';
import Svg, {
  G, Path, Circle, Rect, Defs, LinearGradient, Stop, Text as SvgText
} from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login, register } from '../api';

const { width } = Dimensions.get('window');

function SenitectLogo({ size = 180 }) {
  return (
    <Svg width={size} height={size * 0.55} viewBox="0 0 300 165">
      <Defs>
        <LinearGradient id="greenGrad2" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#2ecc71" />
          <Stop offset="1" stopColor="#27ae60" />
        </LinearGradient>
        <LinearGradient id="blueGrad2" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#2980b9" />
          <Stop offset="1" stopColor="#1a6699" />
        </LinearGradient>
        <LinearGradient id="skyGrad2" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#56CCF2" />
          <Stop offset="1" stopColor="#2F80ED" />
        </LinearGradient>
        <LinearGradient id="fieldGrad2" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#6fcf97" />
          <Stop offset="1" stopColor="#219653" />
        </LinearGradient>
      </Defs>
      <G transform="translate(5, 5)">
        <Path
          d="M75 10 L80 0 L90 0 L95 10 L107 14 L115 6 L123 14 L115 22 L119 34 L130 39 L130 49 L119 54 L115 66 L123 74 L115 82 L107 74 L95 78 L90 88 L80 88 L75 78 L63 74 L55 82 L47 74 L55 66 L51 54 L40 49 L40 39 L51 34 L55 22 L47 14 L55 6 L63 14 Z"
          fill="url(#blueGrad2)"
        />
        <Circle cx="85" cy="44" r="22" fill="url(#skyGrad2)" />
        <Path d="M63 52 Q75 38 85 44 Q95 50 107 44 L107 66 Q85 72 63 66 Z" fill="url(#fieldGrad2)" />
        <Path d="M66 58 Q78 52 90 56" stroke="#fff" strokeWidth="1.2" fill="none" opacity="0.6" />
        <Path d="M68 62 Q80 56 92 60" stroke="#fff" strokeWidth="1.2" fill="none" opacity="0.6" />
        <Path d="M79 50 L85 42 L91 50 L91 58 L79 58 Z" fill="#e67e22" />
        <Rect x="82" y="52" width="6" height="6" fill="#d35400" rx="1" />
        <Path d="M96 32 Q101 28 106 32" stroke="#f39c12" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <Path d="M98 28 Q103 22 108 28" stroke="#f39c12" strokeWidth="2" fill="none" strokeLinecap="round" />
        <Circle cx="103" cy="35" r="2" fill="#f39c12" />
        <Path d="M85 40 Q82 35 80 37 Q83 38 85 40 Z" fill="#27ae60" />
        <Path d="M85 40 Q88 35 90 37 Q87 38 85 40 Z" fill="#2ecc71" />
      </G>
      <SvgText x="122" y="68" fontSize="54" fontWeight="bold" fill="url(#greenGrad2)" fontFamily="serif">Seni</SvgText>
      <SvgText x="213" y="68" fontSize="54" fontWeight="bold" fill="url(#blueGrad2)" fontFamily="serif">tech</SvgText>
      <Circle cx="163" cy="22" r="5" fill="#2ecc71" />
      <SvgText x="150" y="105" fontSize="11" fill="#95a5a6" textAnchor="middle" fontFamily="sans-serif" letterSpacing="1">
        SMART AGRICULTURE
      </SvgText>
    </Svg>
  );
}

export default function AuthScreen({ navigation }) {
  const [tab, setTab]               = useState('login');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [nom, setNom]               = useState('');
  const [prenom, setPrenom]         = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]       = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;

  const switchTab = (t) => {
    setTab(t);
    Animated.spring(slideAnim, {
      toValue: t === 'login' ? 0 : 1,
      friction: 6,
      useNativeDriver: false,
    }).start();
  };

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Champs requis', 'Veuillez remplir tous les champs.');
      return;
    }
    setLoading(true);
    try {
      const data = await login({ email, password });

      await AsyncStorage.setItem('auth_token', data.token);
      await AsyncStorage.setItem('auth_user', JSON.stringify(data.user));

      navigation.navigate('Auth');
    } catch (e) {
      const msg = e.response?.data?.detail || 'Erreur de connexion.';
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Sign Up ────────────────────────────────────────────────────────────────
  const handleSignUp = async () => {
    if (!nom || !prenom || !email || !password || !confirmPass) {
      Alert.alert('Champs requis', 'Veuillez remplir tous les champs.');
      return;
    }
    if (password !== confirmPass) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      const data = await register({ nom, prenom, email, password });

      await AsyncStorage.setItem('auth_token', data.token);
      await AsyncStorage.setItem('auth_user', JSON.stringify(data.user));

      navigation.navigate('Auth');
    } catch (e) {
      const msg = e.response?.data?.detail || "Erreur lors de la création du compte.";
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  const indicatorLeft = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['2%', '50%'],
  });

  return (
    <KeyboardAvoidingView
      style={styles.safeArea}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor={LIGHT_BG} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoArea}>
          <SenitectLogo size={width * 0.55} />
          <Text style={styles.tagline}>
            Don't let your farm guess, <Text style={styles.taglineBold}>Senitech knows best.</Text>
          </Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {tab === 'login' ? 'Bienvenue' : 'Créer un compte'}
          </Text>
          <Text style={styles.cardSub}>
            {tab === 'login'
              ? 'Connectez-vous à votre compte'
              : 'Rejoignez Senitech Agriculture'}
          </Text>

          {/* Tab switcher */}
          <View style={styles.tabBar}>
            <Animated.View style={[styles.tabIndicator, { left: indicatorLeft }]} />
            <TouchableOpacity
              style={styles.tabBtn}
              onPress={() => switchTab('login')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, tab === 'login' && styles.tabTextActive]}>
                Connexion
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tabBtn}
              onPress={() => switchTab('signup')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, tab === 'signup' && styles.tabTextActive]}>
                Inscription
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── LOGIN FORM ── */}
          {tab === 'login' && (
            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Adresse email</Text>
                <View style={styles.inputWrap}>
                  <View style={styles.inputIcon}>
                    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#95a5a6" strokeWidth="2" fill="none"/>
                      <Path d="M22 6l-10 7L2 6" stroke="#95a5a6" strokeWidth="2" fill="none"/>
                    </Svg>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="agriculteur@example.com"
                    placeholderTextColor="#bdc3c7"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Mot de passe</Text>
                <View style={styles.inputWrap}>
                  <View style={styles.inputIcon}>
                    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="#95a5a6" strokeWidth="2" fill="none"/>
                      <Path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#95a5a6" strokeWidth="2" fill="none"/>
                    </Svg>
                  </View>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="••••••••"
                    placeholderTextColor="#bdc3c7"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPass}
                  />
                  <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      {showPass
                        ? <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" stroke="#95a5a6" strokeWidth="2" strokeLinecap="round"/>
                        : <>
                            <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="#95a5a6" strokeWidth="2" fill="none"/>
                            <Circle cx="12" cy="12" r="3" stroke="#95a5a6" strokeWidth="2" fill="none"/>
                          </>
                      }
                    </Svg>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={styles.forgotBtn}>
                <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitBtn, loading && { opacity: 0.75 }]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text style={styles.submitBtnText}>
                  {loading ? 'Connexion...' : 'Se connecter'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── SIGNUP FORM ── */}
          {tab === 'signup' && (
            <View style={styles.form}>
              <View style={styles.nameRow}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Nom</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.input}
                      placeholder="Ben Ali"
                      placeholderTextColor="#bdc3c7"
                      value={nom}
                      onChangeText={setNom}
                    />
                  </View>
                </View>
                <View style={{ width: 10 }} />
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Prénom</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.input}
                      placeholder="Ahmed"
                      placeholderTextColor="#bdc3c7"
                      value={prenom}
                      onChangeText={setPrenom}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Adresse email</Text>
                <View style={styles.inputWrap}>
                  <View style={styles.inputIcon}>
                    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#95a5a6" strokeWidth="2" fill="none"/>
                      <Path d="M22 6l-10 7L2 6" stroke="#95a5a6" strokeWidth="2" fill="none"/>
                    </Svg>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="agriculteur@example.com"
                    placeholderTextColor="#bdc3c7"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Mot de passe</Text>
                <View style={styles.inputWrap}>
                  <View style={styles.inputIcon}>
                    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="#95a5a6" strokeWidth="2" fill="none"/>
                      <Path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#95a5a6" strokeWidth="2" fill="none"/>
                    </Svg>
                  </View>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="••••••••"
                    placeholderTextColor="#bdc3c7"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPass}
                  />
                  <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      {showPass
                        ? <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" stroke="#95a5a6" strokeWidth="2" strokeLinecap="round"/>
                        : <>
                            <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="#95a5a6" strokeWidth="2" fill="none"/>
                            <Circle cx="12" cy="12" r="3" stroke="#95a5a6" strokeWidth="2" fill="none"/>
                          </>
                      }
                    </Svg>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Confirmer le mot de passe</Text>
                <View style={styles.inputWrap}>
                  <View style={styles.inputIcon}>
                    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="#95a5a6" strokeWidth="2" fill="none"/>
                      <Path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#95a5a6" strokeWidth="2" fill="none"/>
                    </Svg>
                  </View>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="••••••••"
                    placeholderTextColor="#bdc3c7"
                    value={confirmPass}
                    onChangeText={setConfirmPass}
                    secureTextEntry={!showConfirm}
                  />
                  <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn}>
                    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      {showConfirm
                        ? <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" stroke="#95a5a6" strokeWidth="2" strokeLinecap="round"/>
                        : <>
                            <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="#95a5a6" strokeWidth="2" fill="none"/>
                            <Circle cx="12" cy="12" r="3" stroke="#95a5a6" strokeWidth="2" fill="none"/>
                          </>
                      }
                    </Svg>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, loading && { opacity: 0.75 }]}
                onPress={handleSignUp}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text style={styles.submitBtnText}>
                  {loading ? 'Création...' : "Créer mon compte"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Footer légal */}
          <Text style={styles.legalText}>
            En continuant, vous acceptez nos{' '}
            <Text style={styles.legalLink}>Conditions d'utilisation</Text>
            {' '}et notre{' '}
            <Text style={styles.legalLink}>Politique de confidentialité</Text>
          </Text>
        </View>

        <Text style={styles.footerText}>Agriculture intelligente • Tunisie</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const DARK_GREEN = '#2d5a27';
const MID_GREEN  = '#3a7d44';
const LIGHT_BG   = '#f4f6f0';

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: LIGHT_BG },
  scroll:    { flexGrow: 1, alignItems: 'center', paddingBottom: 30 },

  logoArea:    { alignItems: 'center', paddingTop: 50, paddingBottom: 10 },
  tagline:     { fontSize: 13, color: '#7f8c8d', marginTop: 6, textAlign: 'center' },
  taglineBold: { fontWeight: '700', color: DARK_GREEN },

  card: {
    backgroundColor: '#fff',
    width: width - 32,
    borderRadius: 24,
    padding: 24,
    marginTop: 16,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
  },
  cardTitle: { fontSize: 22, fontWeight: 'bold', color: '#1a2e1a', textAlign: 'center' },
  cardSub:   { fontSize: 13, color: '#7f8c8d', textAlign: 'center', marginTop: 4, marginBottom: 20 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#f4f6f0',
    borderRadius: 14,
    padding: 3,
    marginBottom: 24,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    top: 3, bottom: 3,
    width: '48%',
    backgroundColor: DARK_GREEN,
    borderRadius: 11,
  },
  tabBtn:         { flex: 1, paddingVertical: 10, alignItems: 'center', zIndex: 1 },
  tabText:        { fontSize: 14, fontWeight: '600', color: '#7f8c8d' },
  tabTextActive:  { color: '#fff' },

  form:      { width: '100%' },
  nameRow:   { flexDirection: 'row' },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#1a2e1a', marginBottom: 6 },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9faf7',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e0e4d8',
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: { marginRight: 8 },
  input:     { flex: 1, fontSize: 14, color: '#1a2e1a', height: '100%' },
  eyeBtn:    { padding: 4 },

  forgotBtn:  { alignSelf: 'flex-end', marginBottom: 16, marginTop: 2 },
  forgotText: { fontSize: 13, color: MID_GREEN, fontWeight: '500' },

  submitBtn: {
    backgroundColor: DARK_GREEN,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: DARK_GREEN,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.3 },

  legalText: {
    fontSize: 11, color: '#95a5a6',
    textAlign: 'center', marginTop: 20,
    lineHeight: 17,
  },
  legalLink: { color: MID_GREEN, fontWeight: '600' },

  footerText: { fontSize: 12, color: '#95a5a6', marginTop: 20, letterSpacing: 0.5 },
});