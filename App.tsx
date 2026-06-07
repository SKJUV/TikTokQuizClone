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

    // Chaîner le handler par défaut pour ne pas masquer les erreurs React Native
    // @ts-ignore
    const previousHandler = global.ErrorUtils?.getGlobalHandler?.();

    const globalHandler = (error: any, isFatal?: boolean) => {
      console.error('Global error captured', error, isFatal);
      try {
        if (isFatal) {
          Alert.alert('Erreur', error?.message || 'Une erreur est survenue.');
        }
      } catch {
        // ignore
      }
      if (typeof previousHandler === 'function') {
        previousHandler(error, isFatal);
      }
    };

    // @ts-ignore
    if (global.ErrorUtils && typeof global.ErrorUtils.setGlobalHandler === 'function') {
      // @ts-ignore
      global.ErrorUtils.setGlobalHandler(globalHandler);
    }

    return () => {
      // @ts-ignore
      if (previousHandler && global.ErrorUtils?.setGlobalHandler) {
        // @ts-ignore
        global.ErrorUtils.setGlobalHandler(previousHandler);
      }
    };
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