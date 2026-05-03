import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Dimensions,
  Animated, Platform,
} from 'react-native';
import * as Location from 'expo-location';
import Svg, {
  Path, Line, Circle, Rect,
  Text as SvgText, Defs, LinearGradient, Stop,
} from 'react-native-svg';
import { predictStorage } from '../api';

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_W = SCREEN_W - 40;
const CHART_H = 220;
const PAD = { top: 24, bottom: 40, left: 52, right: 16 };

const COLORS = {
  bg:         '#f4f6f0',
  card:       '#ffffff',
  green:      '#2d5a27',
  greenLight: '#3a7d44',
  greenBg:    '#dcecd4',
  orange:     '#e67e22',
  orangeBg:   '#fef0e0',
  red:        '#c0392b',
  gray:       '#7f8c8d',
  grayLight:  '#ecf0eb',
  border:     '#d5e0ce',
  text:       '#1a2e1a',
  textMuted:  '#6b7c6b',
  q05:        '#e74c3c',
  q50:        '#2d5a27',
  q95:        '#3498db',
  history:    '#95a5a6',
};

const TOP_PRODUCTS = [
  { key: 'olive',     label: 'Olive',     emoji: '🫒', winRate: 75 },
  { key: 'oignon',    label: 'Oignon',    emoji: '🧅', winRate: 81 },
  { key: 'piment',    label: 'Piment',    emoji: '🌶️', winRate: 71 },
  { key: 'orange',    label: 'Orange',    emoji: '🍊', winRate: 84 },
  { key: 'feve',      label: 'Fève',      emoji: '🫘', winRate: 83 },
  { key: 'pomme',     label: 'Pomme',     emoji: '🍎', winRate: 95 },
  { key: 'citron',    label: 'Citron',    emoji: '🍋', winRate: 76 },
  { key: 'poire',     label: 'Poire',     emoji: '🍐', winRate: 75 },
  { key: 'courgette', label: 'Courgette', emoji: '🥒', winRate: 83 },
];

const DEFAULT_PRICES = {
  olive: 3.2, oignon: 0.9, piment: 2.1, orange: 1.4,
  feve: 1.6,  pomme: 1.8,  citron: 1.2, poire: 2.0,
  courgette: 0.8,
};

// Coordonnées des régions tunisiennes
const REGION_COORDS = {
  Bizerte:  { lat: 37.27, lon: 9.87  },
  Gabes:    { lat: 33.88, lon: 10.10 },
  Gafsa:    { lat: 34.42, lon: 8.78  },
  Kairouan: { lat: 35.68, lon: 10.10 },
  Nabeul:   { lat: 36.45, lon: 10.73 },
  Sfax:     { lat: 34.74, lon: 10.76 },
  Sousse:   { lat: 35.83, lon: 10.64 },
  Tunis:    { lat: 36.82, lon: 10.17 },
};

function getNearestRegion(lat, lon) {
  let best = 'Tunis', minDist = Infinity;
  for (const [name, coords] of Object.entries(REGION_COORDS)) {
    const d = Math.sqrt(
      Math.pow(lat - coords.lat, 2) + Math.pow(lon - coords.lon, 2)
    );
    if (d < minDist) { minDist = d; best = name; }
  }
  return best;
}

function getCurrentSeason() {
  const m = new Date().getMonth() + 1;
  if (m <= 2 || m === 12) return 'hiver';
  if (m <= 5)             return 'printemps';
  if (m <= 8)             return 'ete';
  return 'automne';
}

// ── Graphe ────────────────────────────────────────────────────────────────────
function buildPath(pts) {
  if (!pts || pts.length < 2) return '';
  return pts.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`
  ).join(' ');
}

function buildArea(pts, bottom) {
  if (!pts || pts.length < 2) return '';
  return (
    pts.map((p, i) =>
      `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`
    ).join(' ') +
    ` L${pts[pts.length-1].x.toFixed(1)},${bottom}` +
    ` L${pts[0].x.toFixed(1)},${bottom} Z`
  );
}

function TradingChart({ chart }) {
  if (!chart) return (
    <View style={styles.chartPlaceholder}>
      <Text style={styles.chartPlaceholderTxt}>
        Choisissez un produit pour voir l'analyse
      </Text>
    </View>
  );

  const hVals = chart.history_values || [];
  const q50   = chart.q50 || [];
  const q05   = chart.q05 || [];
  const q95   = chart.q95 || [];
  const hLbls = chart.history_labels || [];
  const fLbls = chart.future_labels || [];

  const all = [...hVals,...q50,...q05,...q95].filter(v => v!=null && !isNaN(v));
  if (all.length === 0) return null;

  const minV   = Math.min(...all) * 0.95;
  const maxV   = Math.max(...all) * 1.05;
  const total  = hVals.length + q50.length;
  const innerW = CHART_W - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top  - PAD.bottom;
  const bottom = CHART_H - PAD.bottom;

  const toX = i => PAD.left + (i / Math.max(total-1,1)) * innerW;
  const toY = v => PAD.top  + innerH*(1-(v-minV)/(maxV-minV+1e-9));

  const hPts   = hVals.map((v,i) => ({ x: toX(i), y: toY(v) }));
  const off    = hVals.length;
  const last   = hPts[hPts.length-1] || { x: PAD.left, y: PAD.top+innerH/2 };
  const q50Pts = [last,...q50.map((v,i)=>({ x:toX(off+i), y:toY(v) }))];
  const q05Pts = [last,...q05.map((v,i)=>({ x:toX(off+i), y:toY(v) }))];
  const q95Pts = [last,...q95.map((v,i)=>({ x:toX(off+i), y:toY(v) }))];
  const sepX   = toX(off-1);
  const allLbls = [...hLbls,...fLbls];
  const yTicks  = [minV,(minV+maxV)/2,maxV];

  return (
    <Svg width={CHART_W} height={CHART_H}>
      <Defs>
        <LinearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%"   stopColor={COLORS.greenLight} stopOpacity="0.3"/>
          <Stop offset="100%" stopColor={COLORS.greenLight} stopOpacity="0.02"/>
        </LinearGradient>
        <LinearGradient id="gH" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%"   stopColor={COLORS.gray} stopOpacity="0.12"/>
          <Stop offset="100%" stopColor={COLORS.gray} stopOpacity="0.01"/>
        </LinearGradient>
      </Defs>

      <Rect x={PAD.left} y={PAD.top} width={sepX-PAD.left}
        height={innerH} fill="#f8faf6" opacity="0.8"/>

      {yTicks.map((v,i) => {
        const y = toY(v);
        return (
          <React.Fragment key={i}>
            <Line x1={PAD.left} y1={y} x2={CHART_W-PAD.right} y2={y}
              stroke={COLORS.border} strokeWidth="0.5" strokeDasharray="4,3"/>
            <SvgText x={PAD.left-5} y={y+4} fontSize="9"
              fill={COLORS.gray} textAnchor="end">{v.toFixed(2)}</SvgText>
          </React.Fragment>
        );
      })}

      <Line x1={sepX} y1={PAD.top} x2={sepX} y2={bottom}
        stroke={COLORS.border} strokeWidth="1.5" strokeDasharray="6,4"/>

      {q05Pts.length>1 && q95Pts.length>1 && (
        <Path d={buildArea(q95Pts,bottom)} fill="url(#gA)"/>
      )}
      {hPts.length>1 && (
        <Path d={buildArea(hPts,bottom)} fill="url(#gH)"/>
      )}
      {q95Pts.length>1 && (
        <Path d={buildPath(q95Pts)} stroke={COLORS.q95} strokeWidth="1.5"
          strokeDasharray="6,3" fill="none" opacity="0.8"/>
      )}
      {q05Pts.length>1 && (
        <Path d={buildPath(q05Pts)} stroke={COLORS.q05} strokeWidth="1.5"
          strokeDasharray="6,3" fill="none" opacity="0.8"/>
      )}
      {hPts.length>1 && (
        <Path d={buildPath(hPts)} stroke={COLORS.history} strokeWidth="2.5" fill="none"/>
      )}
      {q50Pts.length>1 && (
        <Path d={buildPath(q50Pts)} stroke={COLORS.q50} strokeWidth="3" fill="none"/>
      )}

      {allLbls.map((lbl,i) => {
        const isFut = i >= off;
        if (!isFut && i%3!==0) return null;
        return (
          <SvgText key={i} x={toX(i)} y={bottom+16} fontSize="9"
            fill={isFut ? COLORS.green : COLORS.gray}
            textAnchor="middle" fontWeight={isFut?'bold':'normal'}>
            {lbl}
          </SvgText>
        );
      })}

      <Circle cx={last.x} cy={last.y} r="5"
        fill={COLORS.card} stroke={COLORS.green} strokeWidth="2.5"/>

      <SvgText x={PAD.left+6} y={PAD.top+14} fontSize="9" fill={COLORS.gray}>
        Passé
      </SvgText>
      <SvgText x={sepX+6} y={PAD.top+14} fontSize="9"
        fill={COLORS.green} fontWeight="bold">
        Prévision IA
      </SvgText>
    </Svg>
  );
}

// ── Écran principal ───────────────────────────────────────────────────────────
export default function StorageScreen() {
  const [product,       setProduct]      = useState(TOP_PRODUCTS[0]);
  const [region,        setRegion]       = useState('Tunis');
  const [regionAuto,    setRegionAuto]   = useState(false);
  const [locLoading,    setLocLoading]   = useState(false);
  const [loading,       setLoading]      = useState(false);
  const [result,        setResult]       = useState(null);
  const [error,         setError]        = useState('');

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => { analyse(); }, [product, region]);

  useEffect(() => {
    if (!result) return;
    fadeAnim.setValue(0); slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue:1, duration:350, useNativeDriver:true }),
      Animated.spring(slideAnim, { toValue:0, tension:70, friction:9, useNativeDriver:true }),
    ]).start();
  }, [result]);

  useEffect(() => {
    if (!result) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim,{ toValue:1.03, duration:800, useNativeDriver:true }),
      Animated.timing(pulseAnim,{ toValue:1,    duration:800, useNativeDriver:true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [result]);

  const detectLocation = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Permission de localisation refusée.');
        setLocLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const nearest = getNearestRegion(loc.coords.latitude, loc.coords.longitude);
      setRegion(nearest);
      setRegionAuto(true);
      setError('');
    } catch (e) {
      setError('Impossible de détecter la position.');
    } finally {
      setLocLoading(false);
    }
  };

  const analyse = async () => {
    setError('');
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const price = DEFAULT_PRICES[product.key] || 1.5;
    try {
      const data = await predictStorage({
        product:      product.key,
        price_tnd_kg: price,
        region,
        date:         today,
        season:       getCurrentSeason(),
      });
      if (data?.error) setError(data.error);
      else             setResult(data);
    } catch (e) {
      setError('Erreur de connexion. Vérifiez que le serveur est démarré.');
    } finally {
      setLoading(false);
    }
  };

  const isStore = result?.decision === 'store';

  // Traduction du résultat en langage agriculteur
  const getAdvice = () => {
    if (!result) return null;
    if (isStore) {
      const days = result.best_horizon_days;
      const gain = result.expected_gain_net;
      const conf = result.confidence_pct;
      return {
        title:   `Attendez encore ${days} jours avant de vendre`,
        detail:  `Le prix devrait monter d'environ ${(gain*100).toFixed(1)} millimes par kg.`,
        confTxt: conf >= 70 ? 'Prévision fiable ✓'
                 : conf >= 40 ? 'Prévision modérée'
                 : 'Prévision incertaine',
        confColor: conf >= 70 ? COLORS.greenLight
                 : conf >= 40 ? COLORS.orange : COLORS.red,
      };
    }
    return {
      title:   'Vendez maintenant',
      detail:  'Le prix n\'est pas prévu de monter dans les prochains jours.',
      confTxt: 'Conseil basé sur l\'analyse du marché',
      confColor: COLORS.orange,
    };
  };

  const advice = getAdvice();

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.hTitle}>Marché & Stockage</Text>
          <Text style={styles.hSub}>Quand vendre votre récolte ?</Text>
        </View>
        {loading && <ActivityIndicator color="#fff"/>}
      </View>

      <ScrollView style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>

        {/* ── Produit ── */}
        <View style={styles.card}>
          <Text style={styles.label}>MA CULTURE</Text>
          <View style={styles.productGrid}>
            {TOP_PRODUCTS.map(p => {
              const active = product.key === p.key;
              return (
                <TouchableOpacity key={p.key}
                  style={[styles.productBtn, active && styles.productBtnActive]}
                  onPress={() => { setProduct(p); setResult(null); }}
                  activeOpacity={0.75}>
                  <Text style={styles.productEmoji}>{p.emoji}</Text>
                  <Text style={[styles.productLbl, active && styles.productLblActive]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Localisation ── */}
        <View style={styles.card}>
          <Text style={styles.label}>MON EMPLACEMENT</Text>
          <TouchableOpacity style={styles.locBtn} onPress={detectLocation}
            disabled={locLoading} activeOpacity={0.8}>
            {locLoading
              ? <ActivityIndicator color="#fff" size="small"/>
              : <Text style={styles.locBtnTxt}>
                  📍 {regionAuto ? `Détecté : ${region}` : 'Détecter ma position'}
                </Text>
            }
          </TouchableOpacity>
          {/* Sélection manuelle en secondaire */}
          <Text style={styles.orTxt}>ou choisir manuellement</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection:'row', gap:8, marginTop:6 }}>
              {Object.keys(REGION_COORDS).map(r => (
                <TouchableOpacity key={r}
                  style={[styles.chip, region===r && styles.chipActive]}
                  onPress={() => { setRegion(r); setRegionAuto(false); }}>
                  <Text style={[styles.chipTxt, region===r && styles.chipTxtActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* ── Erreur ── */}
        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTxt}>⚠ {error}</Text>
          </View>
        )}

        {/* ── Graphe ── */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>
              {product.emoji} {product.label} · {region}
            </Text>
            {result && !loading && (
              <View style={[styles.pill, isStore ? styles.pillStore : styles.pillSell]}>
                <Text style={[styles.pillTxt, isStore ? styles.pillTxtG : styles.pillTxtO]}>
                  {isStore ? `📦 +${result.best_horizon_days}j` : '💰 Vendre'}
                </Text>
              </View>
            )}
          </View>

          {loading
            ? <View style={styles.chartLoading}>
                <ActivityIndicator color={COLORS.green} size="large"/>
                <Text style={styles.chartLoadingTxt}>Analyse du marché...</Text>
              </View>
            : <TradingChart chart={result?.chart}/>
          }

          <View style={styles.legend}>
            {[
              { color: COLORS.history, label: 'Passé' },
              { color: COLORS.q50,     label: 'Prévision' },
              { color: COLORS.q95,     label: 'Cas favorable' },
              { color: COLORS.q05,     label: 'Cas défavorable' },
            ].map(l => (
              <View key={l.label} style={styles.legendItem}>
                <View style={[styles.legendDot,{ backgroundColor:l.color }]}/>
                <Text style={styles.legendTxt}>{l.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Conseil principal ── */}
        {result && !loading && advice && (
          <Animated.View style={[
            { opacity: fadeAnim, transform:[{ translateY: slideAnim }] }
          ]}>
            {/* Carte conseil */}
            <Animated.View style={[
              styles.adviceCard,
              isStore ? styles.adviceStore : styles.adviceSell,
              { transform:[{ scale: pulseAnim }] },
            ]}>
              <Text style={styles.adviceEmoji}>{isStore ? '📦' : '💰'}</Text>
              <Text style={styles.adviceTitle}>{advice.title}</Text>
              <Text style={styles.adviceDetail}>{advice.detail}</Text>
              <View style={styles.confRow}>
                <View style={[styles.confDot,{ backgroundColor: advice.confColor }]}/>
                <Text style={[styles.confTxt,{ color: advice.confColor }]}>
                  {advice.confTxt}
                </Text>
              </View>
            </Animated.View>

            {/* Prix attendus — version simple */}
            <View style={[styles.card,{ marginTop: 14 }]}>
              <Text style={styles.label}>PRIX ATTENDUS (TND/kg)</Text>
              <View style={styles.priceRow3}>
                <View style={styles.priceBox}>
                  <Text style={styles.priceBoxEmoji}>📉</Text>
                  <Text style={[styles.priceBoxVal,{ color: COLORS.q05 }]}>
                    {result.price_q05?.toFixed(3) ?? '--'}
                  </Text>
                  <Text style={styles.priceBoxLbl}>Au pire</Text>
                </View>
                <View style={[styles.priceBox, styles.priceBoxCenter]}>
                  <Text style={styles.priceBoxEmoji}>📊</Text>
                  <Text style={[styles.priceBoxVal,{ color: COLORS.q50, fontSize:22 }]}>
                    {result.price_q50?.toFixed(3) ?? '--'}
                  </Text>
                  <Text style={styles.priceBoxLbl}>En moyenne</Text>
                </View>
                <View style={styles.priceBox}>
                  <Text style={styles.priceBoxEmoji}>📈</Text>
                  <Text style={[styles.priceBoxVal,{ color: COLORS.q95 }]}>
                    {result.price_q95?.toFixed(3) ?? '--'}
                  </Text>
                  <Text style={styles.priceBoxLbl}>Au mieux</Text>
                </View>
              </View>
            </View>
{/* Gain estimé si l'agriculteur suit le conseil */}
<View style={[styles.card, { marginTop: 14 }]}>
  <Text style={styles.label}>💡 SI VOUS SUIVEZ NOTRE CONSEIL</Text>
  
  {isStore ? (
    <View style={styles.gainStoreBox}>
      <View style={styles.gainRow}>
        <Text style={styles.gainEmoji}>📦</Text>
        <View style={styles.gainTextBlock}>
          <Text style={styles.gainTitle}>
            Stockez {result.best_horizon_days} jours
          </Text>
          <Text style={styles.gainSub}>
            Prix actuel de référence : {result.price_now?.toFixed(3)} TND/kg
          </Text>
        </View>
      </View>

      <View style={styles.gainDivider}/>

      <View style={styles.gainNumbers}>
        <View style={styles.gainNumBox}>
          <Text style={styles.gainNumVal}>
            {result.price_now?.toFixed(3)}
          </Text>
          <Text style={styles.gainNumLbl}>Prix aujourd'hui</Text>
        </View>
        <View style={styles.gainArrow}>
          <Text style={styles.gainArrowTxt}>→</Text>
        </View>
        <View style={styles.gainNumBox}>
          <Text style={[styles.gainNumVal, { color: COLORS.greenLight }]}>
            {result.price_q50?.toFixed(3)}
          </Text>
          <Text style={styles.gainNumLbl}>Prix prévu</Text>
        </View>
        <View style={styles.gainArrow}>
          <Text style={styles.gainArrowTxt}>=</Text>
        </View>
        <View style={styles.gainNumBox}>
          <Text style={[styles.gainNumVal, { color: COLORS.greenLight, fontSize: 20 }]}>
            +{((result.price_q50 - result.price_now) * 1000).toFixed(0)}
          </Text>
          <Text style={styles.gainNumLbl}>Millimes/kg</Text>
        </View>
      </View>

      {/* Exemple concret pour 100kg */}
      <View style={styles.exampleBox}>
        <Text style={styles.exampleTitle}>📊 Exemple concret</Text>
        <Text style={styles.exampleTxt}>
          Pour <Text style={styles.exampleBold}>100 kg</Text> vendus après{' '}
          {result.best_horizon_days} jours :{'\n'}
          <Text style={[styles.exampleBold, { color: COLORS.greenLight }]}>
            +{((result.price_q50 - result.price_now) * 100).toFixed(2)} TND
          </Text>
          {' '}de gain estimé
        </Text>
        <Text style={styles.exampleTxt}>
          Pour <Text style={styles.exampleBold}>500 kg</Text> :{' '}
          <Text style={[styles.exampleBold, { color: COLORS.greenLight }]}>
            +{((result.price_q50 - result.price_now) * 500).toFixed(2)} TND
          </Text>
        </Text>
      </View>
    </View>
  ) : (
    <View style={styles.gainSellBox}>
      <Text style={styles.gainSellEmoji}>💰</Text>
      <Text style={styles.gainSellTitle}>Vendez maintenant à</Text>
      <Text style={styles.gainSellPrice}>
        {result.price_now?.toFixed(3)} TND/kg
      </Text>
      <Text style={styles.gainSellSub}>
        Attendre risque de faire baisser le prix jusqu'à{' '}
        {result.price_q05?.toFixed(3)} TND/kg
      </Text>
      {/* Exemple concret */}
      <View style={styles.exampleBox}>
        <Text style={styles.exampleTitle}>📊 Risque si vous attendez</Text>
        <Text style={styles.exampleTxt}>
          Pour <Text style={styles.exampleBold}>100 kg</Text> :{' '}
          <Text style={[styles.exampleBold, { color: COLORS.red }]}>
            {((result.price_q05 - result.price_now) * 100).toFixed(2)} TND
          </Text>
          {' '}de perte possible
        </Text>
      </View>
    </View>
  )}
</View>
            {/* Durées de stockage — version simple */}
            {isStore && (
              <View style={[styles.card,{ marginTop:14 }]}>
                <Text style={styles.label}>COMBIEN DE JOURS ATTENDRE ?</Text>
                {Object.entries(result.gains_by_horizon || {}).map(([h, gain]) => {
                  const pos  = gain > 0;
                  const conf = result.confidences?.[h] || 0;
                  const pct  = Math.min(Math.abs(gain)*150, 100);
                  const gainMillimes = Math.abs(gain * 1000).toFixed(0);
                  return (
                    <View key={h} style={styles.durationRow}>
                      <View style={styles.durationLeft}>
                        <Text style={styles.durationDays}>{h} jours</Text>
                        <Text style={styles.durationConf}>
                          {conf>=70 ? '✓ Fiable' : conf>=40 ? '~ Moyen' : '? Incertain'}
                        </Text>
                      </View>
                      <View style={styles.dBarTrack}>
                        <View style={[
                          styles.dBarFill,
                          { width:`${pct}%` },
                          pos ? styles.dBarPos : styles.dBarNeg,
                        ]}/>
                      </View>
                      <Text style={[styles.durationGain,
                        { color: pos ? COLORS.greenLight : COLORS.red }]}>
                        {pos ? `+${gainMillimes}m` : `-${gainMillimes}m`}
                      </Text>
                    </View>
                  );
                })}
                <Text style={styles.millimeNote}>
                  * m = millimes par kg stocké (après frais de stockage)
                </Text>
              </View>
            )}

          </Animated.View>
        )}

        <View style={{ height: 40 }}/>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:    { flex:1, backgroundColor: COLORS.bg },
  header:  {
    backgroundColor: COLORS.green,
    paddingTop: Platform.OS==='ios' ? 56 : 44,
    paddingBottom: 16, paddingHorizontal: 20,
    flexDirection:'row', justifyContent:'space-between', alignItems:'center',
  },
  hTitle:  { fontSize:20, fontWeight:'700', color:'#fff' },
  hSub:    { fontSize:12, color:'rgba(255,255,255,0.75)', marginTop:2 },
  scroll:  { flex:1 },
  content: { padding:20, gap:14 },

  card: {
    backgroundColor: COLORS.card, borderRadius:14,
    padding:16, borderWidth:1, borderColor:COLORS.border,
    shadowColor:'#000', shadowOpacity:0.04, shadowRadius:6, elevation:2,
  },
  label: { fontSize:11, fontWeight:'700', color:COLORS.textMuted, letterSpacing:0.8 },

  productGrid:    { flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:12 },
  productBtn: {
    flexDirection:'row', alignItems:'center', gap:6,
    paddingHorizontal:14, paddingVertical:10,
    borderRadius:12, borderWidth:1.5, borderColor:COLORS.border,
    backgroundColor: COLORS.card,
  },
  productBtnActive: { backgroundColor:COLORS.green, borderColor:COLORS.green },
  productEmoji:     { fontSize:18 },
  productLbl:       { fontSize:14, fontWeight:'600', color:COLORS.text },
  productLblActive: { color:'#fff' },

  locBtn: {
    backgroundColor: COLORS.green, borderRadius:12,
    padding:14, alignItems:'center', marginTop:10,
  },
  locBtnTxt: { color:'#fff', fontSize:15, fontWeight:'700' },
  orTxt:     { textAlign:'center', color:COLORS.textMuted, fontSize:12, marginTop:10 },

  chip: {
    paddingHorizontal:14, paddingVertical:8, borderRadius:20,
    borderWidth:1.5, borderColor:COLORS.border, backgroundColor:COLORS.card,
  },
  chipActive:   { backgroundColor:COLORS.green, borderColor:COLORS.green },
  chipTxt:      { fontSize:13, color:COLORS.text, fontWeight:'500' },
  chipTxtActive:{ color:'#fff', fontWeight:'700' },

  errorBox: {
    backgroundColor:'#fdecea', borderRadius:10,
    padding:12, borderLeftWidth:3, borderLeftColor:COLORS.red,
  },
  errorTxt: { color:COLORS.red, fontSize:13, fontWeight:'600' },

  chartCard: {
    backgroundColor:COLORS.card, borderRadius:14,
    padding:16, borderWidth:1, borderColor:COLORS.border, overflow:'hidden',
  },
  chartHeader:  { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8 },
  chartTitle:   { fontSize:14, fontWeight:'700', color:COLORS.text },
  chartLoading: { height:CHART_H, alignItems:'center', justifyContent:'center', gap:10 },
  chartLoadingTxt:    { fontSize:13, color:COLORS.textMuted },
  chartPlaceholder:   { height:CHART_H, alignItems:'center', justifyContent:'center' },
  chartPlaceholderTxt:{ fontSize:13, color:COLORS.textMuted, textAlign:'center' },

  pill:      { borderRadius:20, paddingHorizontal:12, paddingVertical:5, borderWidth:1.5 },
  pillStore: { backgroundColor:COLORS.greenBg, borderColor:COLORS.green },
  pillSell:  { backgroundColor:COLORS.orangeBg, borderColor:COLORS.orange },
  pillTxt:   { fontSize:12, fontWeight:'700' },
  pillTxtG:  { color:COLORS.green },
  pillTxtO:  { color:COLORS.orange },

  legend:     { flexDirection:'row', gap:12, marginTop:10, flexWrap:'wrap' },
  legendItem: { flexDirection:'row', alignItems:'center', gap:4 },
  legendDot:  { width:8, height:8, borderRadius:4 },
  legendTxt:  { fontSize:10, color:COLORS.textMuted },

  adviceCard: {
    borderRadius:16, padding:22, alignItems:'center',
    shadowOpacity:0.1, shadowRadius:10, elevation:5,
  },
  adviceStore:  { backgroundColor:COLORS.greenBg, borderWidth:2, borderColor:COLORS.green },
  adviceSell:   { backgroundColor:COLORS.orangeBg, borderWidth:2, borderColor:COLORS.orange },
  adviceEmoji:  { fontSize:44, marginBottom:8 },
  adviceTitle:  { fontSize:19, fontWeight:'800', color:COLORS.text, textAlign:'center' },
  adviceDetail: { fontSize:14, color:COLORS.textMuted, marginTop:8, textAlign:'center', lineHeight:20 },
  confRow:      { flexDirection:'row', alignItems:'center', gap:6, marginTop:12 },
  confDot:      { width:8, height:8, borderRadius:4 },
  confTxt:      { fontSize:12, fontWeight:'700' },

  priceRow3:     { flexDirection:'row', marginTop:12, gap:0 },
  priceBox: {
    flex:1, alignItems:'center', paddingVertical:16,
    borderRightWidth:1, borderRightColor:COLORS.border,
  },
  priceBoxCenter: { borderLeftWidth:1, borderLeftColor:COLORS.border },
  priceBoxEmoji:  { fontSize:18, marginBottom:4 },
  priceBoxVal:    { fontSize:18, fontWeight:'800' },
  priceBoxLbl:    { fontSize:10, color:COLORS.textMuted, marginTop:4, fontWeight:'600' },

  durationRow:  { flexDirection:'row', alignItems:'center', gap:10, marginTop:12 },
  durationLeft: { width:72 },
  durationDays: { fontSize:14, fontWeight:'700', color:COLORS.text },
  durationConf: { fontSize:10, color:COLORS.textMuted, marginTop:2 },
  dBarTrack: {
    flex:1, height:10, backgroundColor:COLORS.grayLight,
    borderRadius:5, overflow:'hidden',
  },
  dBarFill:  { height:'100%', borderRadius:5 },
  dBarPos:   { backgroundColor:COLORS.greenLight },
  dBarNeg:   { backgroundColor:COLORS.red },
  durationGain:{ width:52, textAlign:'right', fontSize:12, fontWeight:'700' },
  millimeNote: { fontSize:10, color:COLORS.textMuted, marginTop:10, fontStyle:'italic' },
  gainStoreBox:   { marginTop: 12 },
gainRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
gainEmoji:      { fontSize: 32 },
gainTextBlock:  { flex: 1 },
gainTitle:      { fontSize: 16, fontWeight: '700', color: COLORS.text },
gainSub:        { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
gainDivider:    { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
gainNumbers: {
  flexDirection: 'row', alignItems: 'center',
  justifyContent: 'center', gap: 8,
},
gainNumBox:     { alignItems: 'center', minWidth: 70 },
gainNumVal:     { fontSize: 18, fontWeight: '800', color: COLORS.text },
gainNumLbl:     { fontSize: 10, color: COLORS.textMuted, marginTop: 3, fontWeight: '600' },
gainArrow:      { alignItems: 'center' },
gainArrowTxt:   { fontSize: 20, color: COLORS.textMuted, fontWeight: '300' },

exampleBox: {
  backgroundColor: COLORS.greenBg, borderRadius: 10,
  padding: 12, marginTop: 14, gap: 6,
},
exampleTitle:   { fontSize: 12, fontWeight: '700', color: COLORS.green, marginBottom: 4 },
exampleTxt:     { fontSize: 13, color: COLORS.text, lineHeight: 20 },
exampleBold:    { fontWeight: '800' },

gainSellBox:    { alignItems: 'center', padding: 8, gap: 6 },
gainSellEmoji:  { fontSize: 36 },
gainSellTitle:  { fontSize: 15, color: COLORS.textMuted, fontWeight: '600' },
gainSellPrice:  { fontSize: 28, fontWeight: '800', color: COLORS.text },
gainSellSub:    { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', lineHeight: 18 },
});