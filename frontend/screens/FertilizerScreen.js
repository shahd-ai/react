import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, SafeAreaView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { predictFertilizer } from '../api';

const SOIL_TYPES = ['Sandy', 'Loamy', 'Black', 'Red', 'Clayey'];
const SOIL_LABELS = { Sandy: 'Sableux', Loamy: 'Limoneux', Black: 'Noir', Red: 'Rouge', Clayey: 'Argileux' };

const CROP_TYPES = [
  { value: 'Maize', label: 'Mais' },
  { value: 'Wheat', label: 'Blé' },
  { value: 'Cotton', label: 'Coton' },
  { value: 'Tobacco', label: 'Tabac' },
  { value: 'Paddy', label: 'Riz' },
  { value: 'Barley', label: 'Orge' },
  { value: 'Millets', label: 'Millet' },
  { value: 'Oil seeds', label: 'Oléagineux' },
  { value: 'Pulses', label: 'Légumineuses' },
  { value: 'Ground Nuts', label: 'Arachide' },
  { value: 'Sugarcane', label: 'Canne à sucre' },
];

export default function FertilizerScreen({ navigation }) {
  const [form, setForm] = useState({
    temperature:  '26',
    humidity:     '52',
    moisture:     '38',
    soil_type:    'Sandy',
    crop_type:    'Maize',
    nitrogen:     '37',
    phosphorous:  '0',
    potassium:    '0',
  });

  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handlePredict = async () => {
    setLoading(true);
    setResult(null);
    try {
      const data = await predictFertilizer({
        temperature:  parseFloat(form.temperature),
        humidity:     parseFloat(form.humidity),
        moisture:     parseFloat(form.moisture),
        soil_type:    form.soil_type,
        crop_type:    form.crop_type,
        nitrogen:     parseFloat(form.nitrogen),
        phosphorous:  parseFloat(form.phosphorous),
        potassium:    parseFloat(form.potassium),
      });
      if (data.error) {
        Alert.alert('Erreur', data.error);
      } else {
        setResult(data);
      }
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de contacter le serveur.');
    } finally {
      setLoading(false);
    }
  };

  const saveResult = async () => {
    if (!result) return;
    try {
      const data     = await AsyncStorage.getItem('fertilizer_history');
      const existing = data ? JSON.parse(data) : [];
      const entry = {
        id:          Date.now().toString(),
        culture:     result.Culture,
        sol:         result.Sol,
        fertilisant: result.Fertilisant,
        quantite:    result.Quantite_kg_ha,
        niveau:      result.Niveau_Deficit,
        date:        new Date().toLocaleDateString('fr-FR'),
      };
      await AsyncStorage.setItem('fertilizer_history', JSON.stringify([entry, ...existing]));
      Alert.alert('Sauvegardé', "Résultat ajouté à l'historique.", [
        { text: 'OK', onPress: () => navigation.navigate('Accueil') }
      ]);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de sauvegarder.');
    }
  };

  const getNiveauColor = (niveau) => {
    if (niveau === 'Critique') return '#c0392b';
    if (niveau === 'Moyen')    return '#d4832a';
    return '#3a7d44';
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Fertilisation</Text>
          <Text style={styles.headerSub}>Recommandation intelligente</Text>
        </View>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>NPK</Text>
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {CROP_TYPES.map(c => (
              <TouchableOpacity
                key={c.value}
                style={[styles.chip, form.crop_type === c.value && styles.chipActive]}
                onPress={() => update('crop_type', c.value)}
              >
                <Text style={[styles.chipText, form.crop_type === c.value && styles.chipTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Sol */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Type de Sol</Text>
          <View style={styles.soilGrid}>
            {SOIL_TYPES.map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.soilBtn, form.soil_type === s && styles.soilActive]}
                onPress={() => update('soil_type', s)}
              >
                <View style={[styles.soilDot, { backgroundColor: form.soil_type === s ? '#fff' : getSoilColor(s) }]} />
                <Text style={[styles.soilText, form.soil_type === s && styles.soilTextActive]}>
                  {SOIL_LABELS[s]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Conditions climatiques */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conditions Climatiques</Text>
          <View style={styles.climateGrid}>
            <View style={styles.climateCard}>
              <Text style={styles.climateLabel}>Température</Text>
              <View style={styles.climateInputRow}>
                <TextInput
                  style={styles.climateInput}
                  value={form.temperature}
                  onChangeText={v => update('temperature', v)}
                  keyboardType="numeric"
                />
                <Text style={styles.climateUnit}>°C</Text>
              </View>
              <View style={styles.climateBar}>
                <View style={[styles.climateBarFill, {
                  width: `${Math.min((parseFloat(form.temperature) / 50) * 100, 100)}%`,
                  backgroundColor: '#d4832a'
                }]} />
              </View>
            </View>

            <View style={styles.climateCard}>
              <Text style={styles.climateLabel}>Humidité</Text>
              <View style={styles.climateInputRow}>
                <TextInput
                  style={styles.climateInput}
                  value={form.humidity}
                  onChangeText={v => update('humidity', v)}
                  keyboardType="numeric"
                />
                <Text style={styles.climateUnit}>%</Text>
              </View>
              <View style={styles.climateBar}>
                <View style={[styles.climateBarFill, {
                  width: `${Math.min(parseFloat(form.humidity), 100)}%`,
                  backgroundColor: '#2e86c1'
                }]} />
              </View>
            </View>

            <View style={styles.climateCard}>
              <Text style={styles.climateLabel}>Humidité Sol</Text>
              <View style={styles.climateInputRow}>
                <TextInput
                  style={styles.climateInput}
                  value={form.moisture}
                  onChangeText={v => update('moisture', v)}
                  keyboardType="numeric"
                />
                <Text style={styles.climateUnit}>%</Text>
              </View>
              <View style={styles.climateBar}>
                <View style={[styles.climateBarFill, {
                  width: `${Math.min(parseFloat(form.moisture), 100)}%`,
                  backgroundColor: '#3a7d44'
                }]} />
              </View>
            </View>
          </View>
        </View>

        {/* NPK */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Composition NPK du Sol</Text>
          <View style={styles.npkRow}>

            <View style={styles.npkCard}>
              <View style={[styles.npkHeader, { backgroundColor: '#2e86c1' }]}>
                <Text style={styles.npkLetter}>N</Text>
              </View>
              <Text style={styles.npkName}>Azote</Text>
              <TextInput
                style={styles.npkInput}
                value={form.nitrogen}
                onChangeText={v => update('nitrogen', v)}
                keyboardType="numeric"
                textAlign="center"
              />
              <Text style={styles.npkUnit}>mg/kg</Text>
            </View>

            <View style={styles.npkCard}>
              <View style={[styles.npkHeader, { backgroundColor: '#d4832a' }]}>
                <Text style={styles.npkLetter}>P</Text>
              </View>
              <Text style={styles.npkName}>Phosphore</Text>
              <TextInput
                style={styles.npkInput}
                value={form.phosphorous}
                onChangeText={v => update('phosphorous', v)}
                keyboardType="numeric"
                textAlign="center"
              />
              <Text style={styles.npkUnit}>mg/kg</Text>
            </View>

            <View style={styles.npkCard}>
              <View style={[styles.npkHeader, { backgroundColor: '#7d3c98' }]}>
                <Text style={styles.npkLetter}>K</Text>
              </View>
              <Text style={styles.npkName}>Potassium</Text>
              <TextInput
                style={styles.npkInput}
                value={form.potassium}
                onChangeText={v => update('potassium', v)}
                keyboardType="numeric"
                textAlign="center"
              />
              <Text style={styles.npkUnit}>mg/kg</Text>
            </View>

          </View>
        </View>

        {/* Bouton Analyser */}
        <TouchableOpacity
          style={[styles.analyzeBtn, loading && { opacity: 0.75 }]}
          onPress={handlePredict}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.analyzeBtnText}>Analyser et Recommander</Text>
          }
        </TouchableOpacity>

        {/* Résultat */}
        {result && (
          <View style={styles.resultCard}>
            <View style={[styles.resultAccent, { backgroundColor: getNiveauColor(result.Niveau_Deficit) }]} />

            <Text style={styles.resultLabel}>Fertilisant recommandé</Text>
            <Text style={styles.resultFert}>{result.Fertilisant}</Text>

            <View style={styles.resultDivider} />

            <View style={styles.resultGrid}>
              <View style={styles.resultItem}>
                <Text style={styles.resultItemVal}>{result.Quantite_kg_ha}</Text>
                <Text style={styles.resultItemLabel}>kg / hectare</Text>
              </View>
              <View style={styles.resultItemDivider} />
              <View style={styles.resultItem}>
                <Text style={[styles.resultItemVal, { color: getNiveauColor(result.Niveau_Deficit) }]}>
                  {result.Niveau_Deficit}
                </Text>
                <Text style={styles.resultItemLabel}>Niveau déficit</Text>
              </View>
              <View style={styles.resultItemDivider} />
              <View style={styles.resultItem}>
                <Text style={styles.resultItemVal}>{result.Culture}</Text>
                <Text style={styles.resultItemLabel}>Culture</Text>
              </View>
            </View>

            <View style={styles.resultDivider} />

            <View style={styles.solRow}>
              <Text style={styles.solLabel}>Type de sol</Text>
              <Text style={styles.solValue}>{result.Sol}</Text>
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={saveResult} activeOpacity={0.85}>
              <Text style={styles.saveBtnText}>Sauvegarder le résultat</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const getSoilColor = (soil) => {
  const colors = { Sandy: '#e8d5a3', Loamy: '#8B6914', Black: '#3d3d3d', Red: '#c0392b', Clayey: '#95a5a6' };
  return colors[soil] || '#ccc';
};

const DARK_GREEN = '#2d5a27';
const MID_GREEN  = '#3a7d44';
const LIGHT_BG   = '#f4f6f0';

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: LIGHT_BG },

  // Header
  header: {
    backgroundColor: DARK_GREEN,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  headerSub:   { fontSize: 13, color: '#a8d5a2', marginTop: 2 },
  headerBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20,
  },
  headerBadgeText: { color: '#fff', fontWeight: 'bold', fontSize: 13, letterSpacing: 1 },

  scroll: { flex: 1 },

  // Section
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a2e1a',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Chips culture
  chipScroll: { marginHorizontal: -4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, marginRight: 8,
    backgroundColor: '#f4f6f0',
    borderWidth: 1.5, borderColor: '#e0e4d8',
  },
  chipActive:     { backgroundColor: MID_GREEN, borderColor: MID_GREEN },
  chipText:       { color: '#4a5568', fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#fff' },

  // Sol
  soilGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  soilBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 12, backgroundColor: '#f4f6f0',
    borderWidth: 1.5, borderColor: '#e0e4d8',
    width: '30%',
  },
  soilActive:     { backgroundColor: DARK_GREEN, borderColor: DARK_GREEN },
  soilDot:        { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  soilText:       { color: '#4a5568', fontSize: 12, fontWeight: '500' },
  soilTextActive: { color: '#fff' },

  // Climat
  climateGrid: { gap: 10 },
  climateCard: {
    backgroundColor: '#f9faf7',
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#e8ede4',
  },
  climateLabel:    { fontSize: 12, color: '#7f8c8d', fontWeight: '500', marginBottom: 6 },
  climateInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  climateInput: {
    fontSize: 22, fontWeight: 'bold', color: '#1a2e1a',
    flex: 1, padding: 0,
  },
  climateUnit: { fontSize: 14, color: '#7f8c8d', fontWeight: '500' },
  climateBar: {
    height: 4, backgroundColor: '#e8ede4',
    borderRadius: 4, overflow: 'hidden',
  },
  climateBarFill: { height: '100%', borderRadius: 4 },

  // NPK
  npkRow:   { flexDirection: 'row', gap: 10 },
  npkCard: {
    flex: 1, backgroundColor: '#f9faf7',
    borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: '#e8ede4',
    alignItems: 'center',
  },
  npkHeader: {
    width: '100%', paddingVertical: 10,
    alignItems: 'center',
  },
  npkLetter: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  npkName:   { fontSize: 11, color: '#7f8c8d', marginTop: 8, marginBottom: 4 },
  npkInput: {
    fontSize: 18, fontWeight: 'bold', color: '#1a2e1a',
    width: '100%', paddingHorizontal: 8, paddingVertical: 6,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderColor: '#e8ede4',
  },
  npkUnit: { fontSize: 10, color: '#95a5a6', marginVertical: 6 },

  // Bouton analyser
  analyzeBtn: {
    backgroundColor: MID_GREEN,
    borderRadius: 16, padding: 18,
    alignItems: 'center',
    marginHorizontal: 16, marginTop: 20,
    shadowColor: MID_GREEN,
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 5,
  },
  analyzeBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.3 },

  // Résultat
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16, marginTop: 16,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 12, elevation: 4,
  },
  resultAccent: { height: 5, width: '100%' },
  resultLabel:  { fontSize: 12, color: '#7f8c8d', textAlign: 'center', marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  resultFert:   { fontSize: 28, fontWeight: 'bold', color: '#1a2e1a', textAlign: 'center', marginTop: 4, paddingHorizontal: 16 },
  resultDivider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 14, marginHorizontal: 16 },

  resultGrid: { flexDirection: 'row', paddingHorizontal: 16 },
  resultItem: { flex: 1, alignItems: 'center' },
  resultItemVal:   { fontSize: 16, fontWeight: 'bold', color: '#1a2e1a' },
  resultItemLabel: { fontSize: 11, color: '#7f8c8d', marginTop: 3 },
  resultItemDivider: { width: 1, backgroundColor: '#f0f0f0' },

  solRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 16, marginBottom: 14,
  },
  solLabel: { fontSize: 13, color: '#7f8c8d' },
  solValue: { fontSize: 13, fontWeight: '600', color: '#1a2e1a' },

  saveBtn: {
    backgroundColor: DARK_GREEN,
    margin: 16, marginTop: 0,
    borderRadius: 12, padding: 14,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});