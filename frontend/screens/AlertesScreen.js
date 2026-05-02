import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AlertesScreen({ navigation }) {
  const [alertes, setAlertes] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadAlertes();
    }, [])
  );

  const loadAlertes = async () => {
    try {
      const data = await AsyncStorage.getItem('parcelles');
      if (data) {
        const parcelles = JSON.parse(data);
        const filtered  = parcelles.filter(p => p.niveau === 'Eleve' || p.niveau === 'Moyen');
        setAlertes(filtered.sort((a, b) => {
          const order = { Eleve: 0, Moyen: 1, Faible: 2 };
          return order[a.niveau] - order[b.niveau];
        }));
      }
    } finally {
      setLoading(false);
    }
  };

  const getNiveauColor = (niveau) => {
    if (niveau === 'Eleve') return '#e74c3c';
    if (niveau === 'Moyen') return '#f39c12';
    return '#2ecc71';
  };

  const getNiveauIcon = (niveau) => {
    if (niveau === 'Eleve') return '🔴';
    if (niveau === 'Moyen') return '🟡';
    return '🟢';
  };

  const getConseil = (niveau, culture) => {
    if (niveau === 'Eleve')
      return `Irrigation urgente pour ${culture}. Arrosez dès maintenant pour éviter le stress hydrique.`;
    return `Surveillez l'humidité du sol pour ${culture}. Irrigation recommandée sous 48h.`;
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: getNiveauColor(item.niveau) }]}
      onPress={() => navigation.navigate('Prediction', { parcelle: item })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.icon}>{getNiveauIcon(item.niveau)}</Text>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{item.culture}</Text>
          <Text style={styles.cardBni}>BNI : {item.bni} mm/jour</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: getNiveauColor(item.niveau) }]}>
          <Text style={styles.badgeText}>{item.niveau}</Text>
        </View>
      </View>
      <Text style={styles.conseil}>{getConseil(item.niveau, item.culture)}</Text>
      <Text style={styles.cardDate}>{item.date}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#e74c3c" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Alertes</Text>
      {alertes.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyText}>Aucune alerte</Text>
          <Text style={styles.emptySubText}>Toutes vos parcelles sont en bon état</Text>
        </View>
      ) : (
        <>
          <Text style={styles.subtitle}>{alertes.length} parcelle(s) nécessitent votre attention</Text>
          <FlatList
            data={alertes}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f5f6fa', padding: 16 },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title:        { fontSize: 24, fontWeight: 'bold', color: '#2c3e50', marginBottom: 4 },
  subtitle:     { fontSize: 14, color: '#e74c3c', marginBottom: 16, fontWeight: '600' },
  card:         { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
                  borderLeftWidth: 5, shadowColor: '#000', shadowOpacity: 0.08,
                  shadowRadius: 8, elevation: 3 },
  cardHeader:   { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  icon:         { fontSize: 28, marginRight: 12 },
  cardInfo:     { flex: 1 },
  cardTitle:    { fontSize: 18, fontWeight: 'bold', color: '#2c3e50' },
  cardBni:      { fontSize: 14, color: '#7f8c8d' },
  badge:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText:    { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  conseil:      { fontSize: 14, color: '#2c3e50', lineHeight: 20, marginBottom: 8 },
  cardDate:     { fontSize: 12, color: '#bdc3c7' },
  empty:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon:    { fontSize: 64, marginBottom: 16 },
  emptyText:    { fontSize: 18, color: '#7f8c8d', fontWeight: 'bold' },
  emptySubText: { fontSize: 14, color: '#bdc3c7', marginTop: 8 },
});
