import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, SafeAreaView
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function DashboardScreen({ navigation }) {
  const [parcelles, setParcelles] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadParcelles();
    }, [])
  );

  const loadParcelles = async () => {
    try {
      const data = await AsyncStorage.getItem('parcelles');
      if (data) setParcelles(JSON.parse(data));
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de charger les parcelles');
    } finally {
      setLoading(false);
    }
  };

  const deleteParcelle = async (id) => {
    Alert.alert('Supprimer', 'Voulez-vous supprimer cette parcelle ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          const updated = parcelles.filter(p => p.id !== id);
          setParcelles(updated);
          await AsyncStorage.setItem('parcelles', JSON.stringify(updated));
        }
      }
    ]);
  };

  const getNiveauColor = (niveau) => {
    if (niveau === 'Eleve') return '#e74c3c';
    if (niveau === 'Moyen') return '#f39c12';
    return '#3a7d44';
  };

  const getNiveauLabel = (niveau) => {
    if (niveau === 'Eleve') return 'Élevé';
    if (niveau === 'Moyen') return 'Moyen';
    return 'Optimal';
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('Prediction', { parcelle: item })}
      onLongPress={() => deleteParcelle(item.id)}
      activeOpacity={0.85}
    >
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>{item.culture}</Text>
          <View style={styles.scheduleRow}>
            <Text style={styles.scheduleIcon}>🕐</Text>
            <Text style={styles.cardDate}>{item.date}</Text>
          </View>
        </View>
        <View style={[styles.badge, { backgroundColor: getNiveauColor(item.niveau) + '22' }]}>
          <Text style={[styles.badgeText, { color: getNiveauColor(item.niveau) }]}>
            {getNiveauLabel(item.niveau)}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.bniRow}>
        <Text style={styles.bniLabel}>BNI</Text>
        <Text style={styles.bniValue}>{item.bni} mm/jour</Text>
      </View>

      {/* Progress bar BNI visuelle */}
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, {
          width: `${Math.min((item.bni / 10) * 100, 100)}%`,
          backgroundColor: getNiveauColor(item.niveau)
        }]} />
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.cardSub}>📍 {item.latitude}, {item.longitude}</Text>
        <Text style={styles.cardSub}>⛰ {item.altitude}m</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3a7d44" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header style Smart Irrigation */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Mes Parcelles</Text>
          <Text style={styles.headerSub}>Gérez vos cultures intelligemment</Text>
        </View>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>🌿</Text>
        </View>
      </View>

      {/* Stats rapides */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>🌱</Text>
          <Text style={styles.statValue}>{parcelles.length}</Text>
          <Text style={styles.statLabel}>Parcelles</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>✅</Text>
          <Text style={styles.statValue}>
            {parcelles.filter(p => p.niveau === 'Faible').length}
          </Text>
          <Text style={styles.statLabel}>Optimales</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>⚠️</Text>
          <Text style={styles.statValue}>
            {parcelles.filter(p => p.niveau === 'Eleve' || p.niveau === 'Moyen').length}
          </Text>
          <Text style={styles.statLabel}>À surveiller</Text>
        </View>
      </View>

      <View style={styles.container}>
        {parcelles.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconContainer}>
              <Text style={styles.emptyIcon}>🌱</Text>
            </View>
            <Text style={styles.emptyText}>Aucune parcelle enregistrée</Text>
            <Text style={styles.emptySubText}>
              Appuyez sur + pour ajouter votre première parcelle
            </Text>
          </View>
        ) : (
          <FlatList
            data={parcelles}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('Prediction')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const DARK_GREEN = '#2d5a27';
const MID_GREEN  = '#3a7d44';
const LIGHT_BG   = '#f4f6f0';
const CARD_BG    = '#ffffff';

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
  headerAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerAvatarText: { fontSize: 20 },

  // Stats
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    backgroundColor: DARK_GREEN,
  },
  statCard: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14, padding: 12, alignItems: 'center',
  },
  statIcon:  { fontSize: 18, marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  statLabel: { fontSize: 11, color: '#a8d5a2', marginTop: 2 },

  // Container
  container: { flex: 1, padding: 16 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Card
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardTitle:   { fontSize: 17, fontWeight: 'bold', color: '#1a2e1a' },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  scheduleIcon: { fontSize: 11, marginRight: 4 },
  cardDate:    { fontSize: 12, color: '#7f8c8d' },

  badge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },

  divider: { height: 1, backgroundColor: '#f0f0f0', marginBottom: 10 },

  bniRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  bniLabel: { fontSize: 13, color: '#7f8c8d' },
  bniValue: { fontSize: 13, fontWeight: '600', color: '#1a2e1a' },

  progressBg: {
    height: 7, backgroundColor: '#eef2ea',
    borderRadius: 10, overflow: 'hidden', marginBottom: 10,
  },
  progressFill: { height: '100%', borderRadius: 10 },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardSub: { fontSize: 12, color: '#95a5a6' },

  // Empty state
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIconContainer: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#eef5eb',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyIcon:    { fontSize: 40 },
  emptyText:    { fontSize: 17, color: '#3a7d44', fontWeight: 'bold', marginBottom: 6 },
  emptySubText: { fontSize: 13, color: '#95a5a6', textAlign: 'center', paddingHorizontal: 40 },

  // FAB
  fab: {
    position: 'absolute', right: 24, bottom: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: MID_GREEN,
    justifyContent: 'center', alignItems: 'center',
    elevation: 6,
    shadowColor: MID_GREEN, shadowOpacity: 0.4, shadowRadius: 8,
  },
  fabText: { color: '#fff', fontSize: 32, lineHeight: 36 },
});