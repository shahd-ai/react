import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, SafeAreaView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { predict } from '../api';

const CULTURES = [
  'Blé dur', 'Orge', 'Tomate', 'Pomme de terre', 'Oignon',
  'Piment', 'Pastèque', 'Melon', 'Olivier', 'Amandier',
  'Grenadier', 'Lentille'
];

export default function PredictionScreen({ navigation, route }) {
  const existing = route.params?.parcelle;

  const [form, setForm] = useState({
    altitude:          existing?.altitude?.toString()          || '200',
    latitude:          existing?.latitude?.toString()          || '33.8',
    longitude:         existing?.longitude?.toString()         || '9.5',
    depth_restriction: existing?.depth_restriction?.toString() || '0',
    sign_erosion:      existing?.sign_erosion                  || 'No',
    stone_pedestal:    existing?.stone_pedestal                || 'No',
    rain_mean_mm:      existing?.rain_mean_mm?.toString()      || '50',
    rain_accum:        existing?.rain_accum?.toString()        || '600',
    pct_normal:        existing?.pct_normal?.toString()        || '90',
    culture_name:      existing?.culture                       || 'Tomate',
  });

  const [result,         setResult]         = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [gpsLoading,     setGpsLoading]     = useState(false);
  const [locationOk,     setLocationOk]     = useState(!!existing);
  const [weatherOk,      setWeatherOk]      = useState(!!existing);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherInfo,    setWeatherInfo]    = useState(null);

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const detectLocation = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Activez la localisation pour continuer.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat = loc.coords.latitude.toFixed(5);
      const lon = loc.coords.longitude.toFixed(5);
      const alt = loc.coords.altitude ? Math.round(loc.coords.altitude).toString() : '100';
      update('latitude', lat);
      update('longitude', lon);
      update('altitude', alt);
      setLocationOk(true);
      fetchWeather(lat, lon);
    } catch (e) {
      Alert.alert('Erreur GPS', 'Impossible de récupérer votre position.');
    } finally {
      setGpsLoading(false);
    }
  };

  const fetchWeather = async (lat, lon) => {
    setWeatherLoading(true);
    try {
      const today     = new Date();
      const endDate   = today.toISOString().split('T')[0];
      const startDate = new Date(today.setFullYear(today.getFullYear() - 1))
                          .toISOString().split('T')[0];
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=precipitation_sum&timezone=Africa%2FTunis`;
      const res  = await fetch(url);
      const data = await res.json();
      if (!data.daily?.precipitation_sum) throw new Error();
      const allDays    = data.daily.precipitation_sum;
      const validDays  = allDays.filter(v => v !== null);
      const rain_accum = validDays.reduce((a, b) => a + b, 0);
      const last30     = validDays.slice(-30);
      const rain_mean  = last30.reduce((a, b) => a + b, 0);
      const pct_normal = Math.round((rain_accum / 400) * 100);
      update('rain_accum',   Math.round(rain_accum).toString());
      update('rain_mean_mm', Math.round(rain_mean).toString());
      update('pct_normal',   pct_normal.toString());
      setWeatherInfo({ rain_accum: Math.round(rain_accum), rain_mean: Math.round(rain_mean), pct_normal });
      setWeatherOk(true);
    } catch {
      Alert.alert('Météo', 'Données météo indisponibles. Valeurs par défaut utilisées.');
    } finally {
      setWeatherLoading(false);
    }
  };

  const handlePredict = async () => {
    if (!locationOk) {
      Alert.alert('Position requise', "Détectez votre position d'abord.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const payload = {
        altitude:          parseFloat(form.altitude),
        latitude:          parseFloat(form.latitude),
        longitude:         parseFloat(form.longitude),
        depth_restriction: parseFloat(form.depth_restriction),
        sign_erosion:      form.sign_erosion,
        stone_pedestal:    form.stone_pedestal,
        rain_mean_mm:      parseFloat(form.rain_mean_mm),
        rain_accum:        parseFloat(form.rain_accum),
        pct_normal:        parseFloat(form.pct_normal),
        culture_name:      form.culture_name,
      };
      const res = await predict(payload);
      setResult(res);
    } catch {
      Alert.alert('Erreur', 'Impossible de contacter le serveur.');
    } finally {
      setLoading(false);
    }
  };

  const saveParcelle = async () => {
    if (!result) return;
    try {
      const data     = await AsyncStorage.getItem('parcelles');
      const existing = data ? JSON.parse(data) : [];
      const parcelle = {
        id:                Date.now().toString(),
        culture:           result.Culture,
        bni:               result.BNI_mm_j,
        niveau:            result.Niveau,
        altitude:          parseFloat(form.altitude),
        latitude:          parseFloat(form.latitude),
        longitude:         parseFloat(form.longitude),
        depth_restriction: parseFloat(form.depth_restriction),
        sign_erosion:      form.sign_erosion,
        stone_pedestal:    form.stone_pedestal,
        rain_mean_mm:      parseFloat(form.rain_mean_mm),
        rain_accum:        parseFloat(form.rain_accum),
        pct_normal:        parseFloat(form.pct_normal),
        date:              new Date().toLocaleDateString('fr-FR'),
      };
      await AsyncStorage.setItem('parcelles', JSON.stringify([parcelle, ...existing]));
      Alert.alert('Sauvegardé', 'Parcelle ajoutée au dashboard.', [
        { text: 'OK', onPress: () => navigation.navigate('Dashboard') }
      ]);
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder.');
    }
  };

  const getNiveauColor = (niveau) => {
    if (niveau === 'Eleve') return '#c0392b';
    if (niveau === 'Moyen') return '#d4832a';
    return '#3a7d44';
  };

  const getNiveauLabel = (niveau) => {
    if (niveau === 'Eleve') return 'Besoin élevé';
    if (niveau === 'Moyen') return 'Besoin moyen';
    return 'Besoin faible';
  };

  const getNiveauDesc = (niveau) => {
    if (niveau === 'Eleve') return 'Irrigation urgente nécessaire';
    if (niveau === 'Moyen') return "Surveillez l'humidité du sol";
    return "Pas d'irrigation urgente";
  };

  const Toggle = ({ label, keyName }) => (
    <View style={styles.toggleField}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={styles.toggleRow}>
        {['Yes', 'No'].map(opt => (
          <TouchableOpacity
            key={opt}
            style={[styles.toggleBtn, form[keyName] === opt && styles.toggleActive]}
            onPress={() => update(keyName, opt)}
          >
            <Text style={[styles.toggleText, form[keyName] === opt && styles.toggleTextActive]}>
              {opt === 'Yes' ? 'Oui' : 'Non'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Nouvelle Prédiction</Text>
          <Text style={styles.headerSub}>Calcul du besoin en eau</Text>
        </View>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>BNI</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 50 }}
        showsVerticalScrollIndicator={false}
      >

        {/* Culture */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Culture</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {CULTURES.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, form.culture_name === c && styles.chipActive]}
                onPress={() => update('culture_name', c)}
              >
                <Text style={[styles.chipText, form.culture_name === c && styles.chipTextActive]}>
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Position GPS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Localisation</Text>

          <TouchableOpacity
            style={[styles.gpsBtn, locationOk && styles.gpsBtnOk]}
            onPress={detectLocation}
            disabled={gpsLoading}
            activeOpacity={0.85}
          >
            {gpsLoading
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <View style={[styles.gpsDot, { backgroundColor: locationOk ? '#a8d5a2' : 'rgba(255,255,255,0.5)' }]} />
                  <Text style={styles.gpsBtnText}>
                    {locationOk ? 'Position détectée — Appuyer pour actualiser' : 'Détecter ma position automatiquement'}
                  </Text>
                </>
            }
          </TouchableOpacity>

          {locationOk && (
            <View style={styles.coordRow}>
              <View style={styles.coordItem}>
                <Text style={styles.coordLabel}>Latitude</Text>
                <Text style={styles.coordValue}>{parseFloat(form.latitude).toFixed(4)}</Text>
              </View>
              <View style={styles.coordDivider} />
              <View style={styles.coordItem}>
                <Text style={styles.coordLabel}>Longitude</Text>
                <Text style={styles.coordValue}>{parseFloat(form.longitude).toFixed(4)}</Text>
              </View>
              <View style={styles.coordDivider} />
              <View style={styles.coordItem}>
                <Text style={styles.coordLabel}>Altitude</Text>
                <Text style={styles.coordValue}>{form.altitude} m</Text>
              </View>
            </View>
          )}
        </View>

        {/* Météo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Précipitations</Text>

          {weatherLoading ? (
            <View style={styles.weatherLoading}>
              <ActivityIndicator color={MID_GREEN} size="small" />
              <Text style={styles.weatherLoadingText}>Récupération des données météo...</Text>
            </View>
          ) : weatherOk && weatherInfo ? (
            <>
              <View style={styles.weatherGrid}>
                <View style={styles.weatherCard}>
                  <Text style={styles.weatherVal}>{weatherInfo.rain_mean}</Text>
                  <Text style={styles.weatherUnit}>mm</Text>
                  <Text style={styles.weatherLbl}>Ce mois</Text>
                  <View style={styles.weatherBar}>
                    <View style={[styles.weatherBarFill, {
                      width: `${Math.min((weatherInfo.rain_mean / 100) * 100, 100)}%`,
                      backgroundColor: '#2e86c1'
                    }]} />
                  </View>
                </View>

                <View style={styles.weatherCard}>
                  <Text style={styles.weatherVal}>{weatherInfo.rain_accum}</Text>
                  <Text style={styles.weatherUnit}>mm</Text>
                  <Text style={styles.weatherLbl}>Cette année</Text>
                  <View style={styles.weatherBar}>
                    <View style={[styles.weatherBarFill, {
                      width: `${Math.min((weatherInfo.rain_accum / 600) * 100, 100)}%`,
                      backgroundColor: '#2e86c1'
                    }]} />
                  </View>
                </View>

                <View style={styles.weatherCard}>
                  <Text style={[styles.weatherVal, {
                    color: weatherInfo.pct_normal < 80 ? '#c0392b' :
                           weatherInfo.pct_normal > 110 ? '#2e86c1' : '#3a7d44'
                  }]}>{weatherInfo.pct_normal}</Text>
                  <Text style={styles.weatherUnit}>%</Text>
                  <Text style={styles.weatherLbl}>/ Normale</Text>
                  <View style={styles.weatherBar}>
                    <View style={[styles.weatherBarFill, {
                      width: `${Math.min(weatherInfo.pct_normal, 100)}%`,
                      backgroundColor: weatherInfo.pct_normal < 80 ? '#c0392b' : '#3a7d44'
                    }]} />
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.refreshBtn}
                onPress={() => fetchWeather(form.latitude, form.longitude)}
              >
                <Text style={styles.refreshBtnText}>Actualiser les données météo</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.weatherWarning}>
              <Text style={styles.weatherWarningText}>
                Détectez votre position pour récupérer les données météo automatiquement.
              </Text>
            </View>
          )}
        </View>

        {/* Sol */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Caractéristiques du Sol</Text>

          <Text style={styles.fieldLabel}>Profondeur du sol</Text>
          <View style={styles.depthRow}>
            {[
              { label: 'Profond',      val: '0',  color: '#3a7d44' },
              { label: 'Moyen',        val: '30', color: '#d4832a' },
              { label: 'Peu profond',  val: '60', color: '#c0392b' },
            ].map(opt => (
              <TouchableOpacity
                key={opt.val}
                style={[
                  styles.depthBtn,
                  form.depth_restriction === opt.val && { backgroundColor: opt.color, borderColor: opt.color }
                ]}
                onPress={() => update('depth_restriction', opt.val)}
              >
                <View style={[styles.depthDot, { backgroundColor: form.depth_restriction === opt.val ? '#fff' : opt.color }]} />
                <Text style={[styles.depthText, form.depth_restriction === opt.val && { color: '#fff' }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Toggle label="Érosion visible dans le champ ?"  keyName="sign_erosion" />
          <Toggle label="Présence de pierres dans le sol ?" keyName="stone_pedestal" />
        </View>

        {/* Bouton */}
        <TouchableOpacity
          style={[styles.predictBtn, loading && { opacity: 0.75 }]}
          onPress={handlePredict}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.predictBtnText}>Calculer le besoin en eau</Text>
          }
        </TouchableOpacity>

        {/* Résultat */}
        {result && (
          <View style={styles.resultCard}>
            <View style={[styles.resultAccent, { backgroundColor: getNiveauColor(result.Niveau) }]} />

            <View style={styles.resultTop}>
              <Text style={styles.resultCulture}>{result.Culture}</Text>
              <View style={[styles.resultBadge, { backgroundColor: getNiveauColor(result.Niveau) + '20' }]}>
                <Text style={[styles.resultBadgeText, { color: getNiveauColor(result.Niveau) }]}>
                  {getNiveauLabel(result.Niveau)}
                </Text>
              </View>
            </View>

            <View style={styles.resultBniRow}>
              <Text style={[styles.resultBni, { color: getNiveauColor(result.Niveau) }]}>
                {result.BNI_mm_j}
              </Text>
              <Text style={styles.resultBniUnit}>mm / jour</Text>
            </View>

            <View style={styles.resultProgressBg}>
              <View style={[styles.resultProgressFill, {
                width: `${Math.min((result.BNI_mm_j / 10) * 100, 100)}%`,
                backgroundColor: getNiveauColor(result.Niveau)
              }]} />
            </View>

            <Text style={styles.resultDesc}>{getNiveauDesc(result.Niveau)}</Text>

            <View style={styles.resultDivider} />

            <TouchableOpacity style={styles.saveBtn} onPress={saveParcelle} activeOpacity={0.85}>
              <Text style={styles.saveBtnText}>Sauvegarder la parcelle</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const DARK_GREEN = '#2d5a27';
const MID_GREEN  = '#3a7d44';
const LIGHT_BG   = '#f4f6f0';

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: LIGHT_BG },

  // Header
  header: {
    backgroundColor: DARK_GREEN,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  headerSub:   { fontSize: 13, color: '#a8d5a2', marginTop: 2 },
  headerBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
  },
  headerBadgeText: { color: '#fff', fontWeight: 'bold', fontSize: 13, letterSpacing: 1 },

  scroll: { flex: 1 },

  // Section
  section: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 14,
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  sectionTitle: {
    fontSize: 14, fontWeight: '700', color: '#1a2e1a',
    marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5,
  },

  // Chips culture
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, marginRight: 8,
    backgroundColor: '#f4f6f0',
    borderWidth: 1.5, borderColor: '#e0e4d8',
  },
  chipActive:     { backgroundColor: MID_GREEN, borderColor: MID_GREEN },
  chipText:       { color: '#4a5568', fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#fff' },

  // GPS
  gpsBtn: {
    backgroundColor: '#2e86c1', borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  gpsBtnOk:   { backgroundColor: MID_GREEN },
  gpsDot:     { width: 8, height: 8, borderRadius: 4 },
  gpsBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Coords
  coordRow: {
    flexDirection: 'row', marginTop: 12,
    backgroundColor: '#f4f6f0', borderRadius: 12, padding: 12,
  },
  coordItem:    { flex: 1, alignItems: 'center' },
  coordLabel:   { fontSize: 11, color: '#7f8c8d', marginBottom: 3 },
  coordValue:   { fontSize: 13, fontWeight: '700', color: '#1a2e1a' },
  coordDivider: { width: 1, backgroundColor: '#e0e4d8' },

  // Météo
  weatherLoading: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, backgroundColor: '#f4f6f0', borderRadius: 12,
  },
  weatherLoadingText: { fontSize: 13, color: '#7f8c8d' },
  weatherGrid:        { flexDirection: 'row', gap: 10, marginBottom: 10 },
  weatherCard: {
    flex: 1, backgroundColor: '#f9faf7', borderRadius: 12,
    padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#e8ede4',
  },
  weatherVal:     { fontSize: 20, fontWeight: 'bold', color: '#1a2e1a' },
  weatherUnit:    { fontSize: 11, color: '#7f8c8d' },
  weatherLbl:     { fontSize: 11, color: '#7f8c8d', marginBottom: 6 },
  weatherBar:     { height: 3, width: '100%', backgroundColor: '#e8ede4', borderRadius: 3, overflow: 'hidden' },
  weatherBarFill: { height: '100%', borderRadius: 3 },
  weatherWarning: {
    backgroundColor: '#fef9f0', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#f0e0c0',
  },
  weatherWarningText: { fontSize: 13, color: '#d4832a', textAlign: 'center' },
  refreshBtn: {
    borderWidth: 1.5, borderColor: MID_GREEN,
    borderRadius: 10, padding: 10, alignItems: 'center',
  },
  refreshBtnText: { color: MID_GREEN, fontSize: 13, fontWeight: '600' },

  // Sol
  fieldLabel: { fontSize: 12, color: '#7f8c8d', fontWeight: '500', marginBottom: 8 },
  depthRow:   { flexDirection: 'row', gap: 8, marginBottom: 14 },
  depthBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#f4f6f0', borderWidth: 1.5, borderColor: '#e0e4d8', gap: 6,
  },
  depthDot:  { width: 8, height: 8, borderRadius: 4 },
  depthText: { fontSize: 12, fontWeight: '500', color: '#4a5568' },

  // Toggle
  toggleField: { marginTop: 10 },
  toggleLabel: { fontSize: 12, color: '#7f8c8d', fontWeight: '500', marginBottom: 8 },
  toggleRow:   { flexDirection: 'row', gap: 8 },
  toggleBtn: {
    flex: 1, padding: 11, borderRadius: 10,
    backgroundColor: '#f4f6f0', borderWidth: 1.5, borderColor: '#e0e4d8',
    alignItems: 'center',
  },
  toggleActive:     { backgroundColor: DARK_GREEN, borderColor: DARK_GREEN },
  toggleText:       { color: '#4a5568', fontSize: 13, fontWeight: '500' },
  toggleTextActive: { color: '#fff', fontWeight: '600' },

  // Bouton prédiction
  predictBtn: {
    backgroundColor: MID_GREEN, borderRadius: 16, padding: 18,
    alignItems: 'center', marginHorizontal: 16, marginTop: 20,
    shadowColor: MID_GREEN, shadowOpacity: 0.35, shadowRadius: 10, elevation: 5,
  },
  predictBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.3 },

  // Résultat
  resultCard: {
    backgroundColor: '#fff', borderRadius: 16,
    marginHorizontal: 16, marginTop: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 12, elevation: 4,
  },
  resultAccent: { height: 5 },
  resultTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 16, paddingBottom: 0,
  },
  resultCulture:    { fontSize: 18, fontWeight: 'bold', color: '#1a2e1a' },
  resultBadge:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  resultBadgeText:  { fontSize: 12, fontWeight: '600' },
  resultBniRow:     { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, marginTop: 12 },
  resultBni:        { fontSize: 48, fontWeight: 'bold', lineHeight: 52 },
  resultBniUnit:    { fontSize: 14, color: '#7f8c8d', marginBottom: 8, marginLeft: 6 },
  resultProgressBg: {
    height: 6, backgroundColor: '#f0f0f0',
    marginHorizontal: 16, borderRadius: 6, overflow: 'hidden', marginTop: 8,
  },
  resultProgressFill: { height: '100%', borderRadius: 6 },
  resultDesc:   { fontSize: 13, color: '#7f8c8d', paddingHorizontal: 16, marginTop: 8 },
  resultDivider: { height: 1, backgroundColor: '#f0f0f0', margin: 16, marginBottom: 0 },

  saveBtn: {
    backgroundColor: DARK_GREEN, margin: 16,
    borderRadius: 12, padding: 14, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});