import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp } from '@react-native-firebase/app';
import { getAuth, signOut } from '@react-native-firebase/auth';
import { getDatabase, ref, onValue } from '@react-native-firebase/database';

export default function ProfileScreen(): React.JSX.Element {
  const [sombre, setSombre] = useState(true);
  const [score, setScore] = useState(0);

  const utilisateur = getAuth(getApp()).currentUser;
  const uid = utilisateur?.uid || 'anonyme';

  useEffect(() => {
    AsyncStorage.getItem('theme').then((val) => {
      if (val) setSombre(val === 'dark');
    });
  }, []);

  useEffect(() => {
    const reference = ref(getDatabase(getApp()), `/users/${uid}/score`);
    return onValue(reference, (snap) => setScore(snap.val() || 0));
  }, [uid]);

  const modifierTheme = async (statut: boolean) => {
    setSombre(statut);
    await AsyncStorage.setItem('theme', statut ? 'dark' : 'light');
  };

  const deconnexion = () => signOut(getAuth(getApp()));

  const couleurTexte = sombre ? '#fff' : '#000';

  return (
    <View style={[styles.container, { backgroundColor: sombre ? '#121212' : '#f9f9f9' }]}>
      <View style={styles.avatar}>
        <Text style={styles.avatarTexte}>{(utilisateur?.email || '?').charAt(0).toUpperCase()}</Text>
      </View>
      <Text style={[styles.email, { color: couleurTexte }]}>{utilisateur?.email || 'Étudiant anonyme'}</Text>

      <View style={styles.scoreCarte}>
        <Text style={styles.scoreValeur}>{score}</Text>
        <Text style={styles.scoreLabel}>Bonnes réponses</Text>
      </View>

      <View style={styles.ligne}>
        <Text style={{ color: couleurTexte, fontSize: 16 }}>Interface sombre</Text>
        <Switch value={sombre} onValueChange={modifierTheme} />
      </View>

      <TouchableOpacity style={styles.boutonDeconnexion} onPress={deconnexion}>
        <Text style={styles.boutonDeconnexionTexte}>Se déconnecter</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 25, alignItems: 'center' },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#fe2c55',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  avatarTexte: { color: '#fff', fontSize: 38, fontWeight: 'bold' },
  email: { fontSize: 16, fontWeight: '600', marginTop: 14, marginBottom: 24 },
  scoreCarte: {
    backgroundColor: 'rgba(254,44,85,0.12)',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 40,
    alignItems: 'center',
    marginBottom: 30,
  },
  scoreValeur: { color: '#fe2c55', fontSize: 36, fontWeight: 'bold' },
  scoreLabel: { color: '#fe2c55', fontSize: 13, fontWeight: '600' },
  ligne: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 30,
  },
  boutonDeconnexion: {
    borderWidth: 1,
    borderColor: '#fe2c55',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 40,
    width: '100%',
    alignItems: 'center',
  },
  boutonDeconnexionTexte: { color: '#fe2c55', fontWeight: 'bold', fontSize: 16 },
});
