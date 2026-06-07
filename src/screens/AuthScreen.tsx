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
  GithubAuthProvider,
  signInWithCredential,
} from '@react-native-firebase/auth';
import { Linking } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Svg, Path } from 'react-native-svg';
import { FIREBASE_WEB_CLIENT_ID, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } from '@env';

GoogleSignin.configure({ webClientId: FIREBASE_WEB_CLIENT_ID });

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_SCOPE = 'read:user user:email';
const GITHUB_REDIRECT_URI = 'tiktokquiz://auth/github';

const buildRandomState = () => `${Date.now()}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;

type GitHubPendingRequest = {
  state: string;
  resolve: (code: string) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [chargement, setChargement] = useState(false);
  const githubPendingRef = React.useRef<GitHubPendingRequest | null>(null);

  const auth = getAuth();

  const terminerGithubPending = React.useCallback(() => {
    if (githubPendingRef.current) {
      clearTimeout(githubPendingRef.current.timeoutId);
      githubPendingRef.current = null;
    }
  }, []);

  const resoudreGithubCallback = React.useCallback((url: string) => {
    const pending = githubPendingRef.current;
    if (!pending || !url.startsWith(GITHUB_REDIRECT_URI)) {
      return false;
    }

    const parsedUrl = new URL(url);
    const code = parsedUrl.searchParams.get('code');
    const returnedState = parsedUrl.searchParams.get('state');
    const error = parsedUrl.searchParams.get('error');
    const errorDescription = parsedUrl.searchParams.get('error_description');

    if (error) {
      pending.reject(new Error(errorDescription || error));
      terminerGithubPending();
      return true;
    }

    if (returnedState !== pending.state) {
      pending.reject(new Error('Le paramètre state GitHub ne correspond pas.'));
      terminerGithubPending();
      return true;
    }

    if (!code) {
      pending.reject(new Error('Code GitHub manquant dans la redirection.'));
      terminerGithubPending();
      return true;
    }

    pending.resolve(code);
    terminerGithubPending();
    return true;
  }, [terminerGithubPending]);

  React.useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      resoudreGithubCallback(url);
    });

    Linking.getInitialURL().then((url) => {
      if (url) {
        resoudreGithubCallback(url);
      }
    });

    return () => {
      subscription.remove();
      terminerGithubPending();
    };
  }, [resoudreGithubCallback, terminerGithubPending]);

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

  const connexionGitHub = async () => {
    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      Alert.alert('Erreur GitHub Auth', 'GITHUB_CLIENT_ID ou GITHUB_CLIENT_SECRET est manquant dans .env');
      return;
    }

    setChargement(true);
    try {
      const state = buildRandomState();
      const authorizeUrl = new URL(GITHUB_AUTHORIZE_URL);
      authorizeUrl.searchParams.set('client_id', GITHUB_CLIENT_ID);
      authorizeUrl.searchParams.set('redirect_uri', GITHUB_REDIRECT_URI);
      authorizeUrl.searchParams.set('scope', GITHUB_SCOPE);
      authorizeUrl.searchParams.set('state', state);
      authorizeUrl.searchParams.set('allow_signup', 'true');

      const codePromise = new Promise<string>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          githubPendingRef.current = null;
          reject(new Error('Délai dépassé avant validation GitHub.'));
        }, 10 * 60 * 1000);

        githubPendingRef.current = {
          state,
          resolve,
          reject,
          timeoutId,
        };
      });

      await Linking.openURL(authorizeUrl.toString());

      const code = await codePromise;

      const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: GITHUB_REDIRECT_URI,
          state,
        }),
      });

      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok || tokenData.error) {
        throw new Error(tokenData.error_description || tokenData.error || 'Connexion GitHub refusée.');
      }

      const credential = GithubAuthProvider.credential(tokenData.access_token);
      await signInWithCredential(auth, credential);
    } catch (error: any) {
      Alert.alert('Erreur GitHub Auth', error.message);
    } finally {
      terminerGithubPending();
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

      <TouchableOpacity style={[styles.boutonReseau, { marginTop: 12 }]} onPress={connexionGitHub}>
        <Svg width="20" height="20" viewBox="0 0 24 24" style={{ marginRight: 10 }}>
          <Path
            fill="#FFF"
            d="M12 .5C5.73.5.67 5.66.67 12.06c0 5.13 3.29 9.48 7.86 11.02.58.11.79-.26.79-.57 0-.28-.01-1.02-.02-2-3.2.71-3.88-1.58-3.88-1.58-.52-1.36-1.27-1.72-1.27-1.72-1.04-.73.08-.72.08-.72 1.15.08 1.75 1.21 1.75 1.21 1.02 1.78 2.67 1.27 3.32.97.1-.76.4-1.27.73-1.56-2.56-.3-5.25-1.31-5.25-5.84 0-1.29.45-2.34 1.2-3.17-.12-.3-.52-1.5.11-3.13 0 0 .98-.32 3.2 1.21a10.8 10.8 0 0 1 2.92-.4c.99 0 1.99.14 2.92.4 2.22-1.53 3.2-1.21 3.2-1.21.63 1.63.23 2.83.11 3.13.75.83 1.2 1.88 1.2 3.17 0 4.54-2.69 5.54-5.26 5.83.41.36.78 1.08.78 2.17 0 1.56-.01 2.82-.01 3.2 0 .31.2.69.8.57 4.57-1.55 7.86-5.9 7.86-11.02C23.33 5.66 18.27.5 12 .5z"
          />
        </Svg>
        <Text style={styles.texteBoutonReseau}>Continuer avec GitHub</Text>
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
