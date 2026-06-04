import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
} from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Svg, Path } from 'react-native-svg';
import { FIREBASE_WEB_CLIENT_ID } from '@env';

GoogleSignin.configure({ webClientId: FIREBASE_WEB_CLIENT_ID });

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [chargement, setChargement] = useState(false);

  const auth = getAuth();

  const gererConnexion = async () => {
    if (!email || !motDePasse) return Alert.alert('Erreur', 'Veuillez remplir tous les champs');
    setChargement(true);
    try {
      await signInWithEmailAndPassword(auth, email, motDePasse);
    } catch (error: any) {
      Alert.alert('Erreur de connexion', error.message);
    } finally {
      setChargement(false);
    }
  };

  const gererInscription = async () => {
    if (!email || !motDePasse) return Alert.alert('Erreur', 'Veuillez remplir tous les champs');
    setChargement(true);
    try {
      await createUserWithEmailAndPassword(auth, email, motDePasse);
      Alert.alert('Succès 🎉', 'Compte étudiant créé avec succès !');
    } catch (error: any) {
      Alert.alert("Erreur d'inscription", error.message);
    } finally {
      setChargement(false);
    }
  };

  const connexionGoogle = async () => {
    setChargement(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;
      if (!idToken) throw new Error("Impossible de récupérer le jeton Google (idToken).");
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
    } catch (error: any) {
      Alert.alert('Erreur Google Auth', error.message);
    } finally {
      setChargement(false);
    }
  };

  return (
    <View style={styles.conteneur}>
      <Text style={styles.titre}>TikTok Quiz UY1 🧠</Text>

      <TextInput
        style={styles.champ}
        placeholder="Email institutionnel"
        placeholderTextColor="#666"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.champ}
        placeholder="Mot de passe"
        placeholderTextColor="#666"
        secureTextEntry
        value={motDePasse}
        onChangeText={setMotDePasse}
        autoCapitalize="none"
      />

      {chargement ? (
        <ActivityIndicator size="large" color="#fe2c55" style={{ marginVertical: 20 }} />
      ) : (
        <>
          <TouchableOpacity style={styles.boutonPrincipal} onPress={gererConnexion}>
            <Text style={styles.texteBoutonPrincipal}>Se connecter</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.boutonSecondaire} onPress={gererInscription}>
            <Text style={styles.texteBoutonSecondaire}>Créer un compte</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={styles.zoneSeparateur}>
        <View style={styles.ligne} />
        <Text style={styles.texteSeparateur}>Ou continuer avec</Text>
        <View style={styles.ligne} />
      </View>

      <TouchableOpacity style={styles.boutonReseau} onPress={connexionGoogle}>
        <Svg width="20" height="20" viewBox="0 0 24 24" style={{ marginRight: 10 }}>
          <Path fill="#DB4437" d="M21.35 11.1H12v2.7h5.38c-.23 1.28-1 2.37-2.07 3.1v2.57h3.35c1.95-1.8 3.08-4.43 3.08-7.53 0-.63-.06-1.25-.19-1.84z" />
          <Path fill="#4285F4" d="M12 21.41c2.54 0 4.67-.84 6.23-2.3l-3.35-2.56c-.93.62-2.12 1-3.5 1-2.7 0-4.97-1.82-5.78-4.28H2.15v2.66c1.57 3.13 4.83 5.28 8.58 5.28z" />
          <Path fill="#FBBC05" d="M6.22 13.27c-.2-.62-.32-1.28-.32-1.96s.12-1.34.32-1.96V6.69H2.15A9.97 9.97 0 0 0 0 11.31c0 1.68.42 3.27 1.15 4.66l5.07-2.7z" />
          <Path fill="#34A853" d="M12 4.13c1.38 0 2.62.48 3.6 1.41l2.7-2.7A9.94 9.94 0 0 0 12 1.19c-3.75 0-7.01 2.15-8.58 5.28l5.07 3.93c.81-2.46 3.08-4.27 5.78-4.27z" />
        </Svg>
        <Text style={styles.texteBoutonReseau}>Continuer avec Google</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: '#000', justifyContent: 'center', padding: 20 },
  titre: { fontSize: 24, fontWeight: 'bold', color: '#FFF', textAlign: 'center', marginBottom: 30 },
  champ: {
    backgroundColor: '#1A1A1A',
    color: '#FFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  boutonPrincipal: {
    backgroundColor: '#fe2c55',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  texteBoutonPrincipal: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  boutonSecondaire: {
    backgroundColor: 'transparent',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#fe2c55',
  },
  texteBoutonSecondaire: { color: '#fe2c55', fontWeight: '600', fontSize: 16 },
  zoneSeparateur: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  ligne: { flex: 1, height: 1, backgroundColor: '#333' },
  texteSeparateur: { color: '#666', textAlign: 'center', paddingHorizontal: 10, fontSize: 14 },
  boutonReseau: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  texteBoutonReseau: { color: '#FFF', fontWeight: '600', fontSize: 14 },
});
