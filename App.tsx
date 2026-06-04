import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert, LogBox } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import { getAuth, onAuthStateChanged, FirebaseAuthTypes } from '@react-native-firebase/auth';
import AuthScreen from './src/screens/AuthScreen';
import MainContainer from './src/screens/MainContainer'; // 1. On importe le conteneur d'onglets

export default function App(): React.JSX.Element {
  const [chargement, setChargement] = useState<boolean>(true);
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);

  useEffect(() => {
    const authInstance = getAuth(getApp());

    const desabonner = onAuthStateChanged(authInstance, (utilisateurTrouve) => {
      setUser(utilisateurTrouve);
      setChargement(false);
    });
    
    return desabonner;
  }, []);

  useEffect(() => {
    // Supprimer certains warnings envahissants
    LogBox.ignoreLogs(['Setting a timer', 'Require cycle:']);

    // Installer un handler global JS pour éviter que l'app ne se ferme sur erreurs non gérées
    const globalHandler = (error: any) => {
      console.error('Global error captured', error);
      try {
        Alert.alert('Erreur', 'Une erreur est survenue, l\'application continue de fonctionner.');
      } catch {
        // ignore
      }
    };

    // @ts-ignore
    if (global.ErrorUtils && typeof global.ErrorUtils.setGlobalHandler === 'function') {
      // @ts-ignore
      global.ErrorUtils.setGlobalHandler(globalHandler);
    }
  }, []);

  if (chargement) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator size="large" color="#fe2c55" />
      </View>
    );
  }

  // 2. Si connecté, on affiche MainContainer (qui contient le flux ET la création)
  return user ? <MainContainer /> : <AuthScreen />;
}

const styles = StyleSheet.create({
  centre: { 
    flex: 1, 
    backgroundColor: '#000', 
    justifyContent: 'center', 
    alignItems: 'center' 
  }
});