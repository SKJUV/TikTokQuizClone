import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import FeedScreen from './FeedScreen';
import CreateScreen from './CreateScreen';
import ProfileScreen from './ProfileScreen';

type Onglet = 'accueil' | 'creer' | 'profil';

export default function MainContainer(): React.JSX.Element {
  const [ongletActuel, setOngletActuel] = useState<Onglet>('accueil');

  return (
    <View style={styles.conteneurGlobal}>
      {/* Zone d'affichage de l'écran sélectionné */}
      <View style={styles.zoneContenu}>
        {ongletActuel === 'accueil' && <FeedScreen />}
        {ongletActuel === 'creer' && <CreateScreen />}
        {ongletActuel === 'profil' && <ProfileScreen />}
      </View>

      {/* ─── BARRE DE NAVIGATION BASSE TIKTOK NATIVE ─── */}
      <SafeAreaView style={styles.barreBasse}>
        {/* Onglet Accueil */}
        <TouchableOpacity 
          style={styles.boutonOnglet} 
          onPress={() => setOngletActuel('accueil')}
        >
          <Text style={[styles.texteOnglet, ongletActuel === 'accueil' && styles.ongletActif]}>
            Accueil
          </Text>
        </TouchableOpacity>

        {/* Bouton "+" Central Style TikTok */}
        <TouchableOpacity 
          style={styles.boutonOnglet} 
          onPress={() => setOngletActuel('creer')}
        >
          <View style={styles.cadreBoutonPlus}>
            <View style={[
              styles.fondBoutonPlusDesign, 
              ongletActuel === 'creer' ? { backgroundColor: '#fff' } : { backgroundColor: '#fe2c55' }
            ]}>
              <Text style={[
                styles.iconePlusText, 
                ongletActuel === 'creer' ? { color: '#000' } : { color: '#fff' }
              ]}>
                +
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Onglet Profil */}
        <TouchableOpacity style={styles.boutonOnglet} onPress={() => setOngletActuel('profil')}>
          <Text style={[styles.texteOnglet, ongletActuel === 'profil' && styles.ongletActif]}>Profil</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneurGlobal: {
    flex: 1,
    backgroundColor: '#000',
  },
  zoneContenu: {
    flex: 1,
  },
  barreBasse: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: '#000',
    borderTopWidth: 0.5,
    borderColor: '#222',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  boutonOnglet: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  texteOnglet: {
    color: '#858585',
    fontSize: 12,
    fontWeight: 'bold',
  },
  ongletActif: {
    color: '#fff',
  },
  cadreBoutonPlus: {
    width: 45,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fondBoutonPlusDesign: {
    width: 38,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconePlusText: {
    fontSize: 20,
    fontWeight: 'bold',
    bottom: 1,
  },
});