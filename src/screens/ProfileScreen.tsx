import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp } from '@react-native-firebase/app';
import { getAuth, signOut } from '@react-native-firebase/auth';
import { getDatabase, ref, onValue, remove } from '@react-native-firebase/database';
import { PostTikTok } from '../types';
import { normaliserPost } from '../utils/feedHelpers';

type PostAvecDate = PostTikTok & { createdAt?: number; comments?: any; correctAnswers?: any };

export default function ProfileScreen(): React.JSX.Element {
  const [sombre, setSombre] = useState(true);
  const [score, setScore] = useState(0);
  const [rang, setRang] = useState<string | number>('...');
  const [userPosts, setUserPosts] = useState<PostAvecDate[]>([]);
  const [loading, setLoading] = useState(true);

  const auth = getAuth(getApp());
  const utilisateur = auth.currentUser;
  const uid = utilisateur?.uid || 'anonyme';
  const userEmail = utilisateur?.email || '';
  const userDisplayName = utilisateur?.displayName || userEmail.split('@')[0] || 'Étudiant';

  // Charger le thème persisté
  useEffect(() => {
    AsyncStorage.getItem('theme').then((val) => {
      if (val) setSombre(val === 'dark');
    });
  }, []);

  // Calculer score, rang et récupérer les posts utilisateur
  useEffect(() => {
    const db = getDatabase(getApp());
    const reference = ref(db, '/posts');

    const unsubscribe = onValue(reference, (snap) => {
      const val = snap.val() || {};
      const postsList = Object.keys(val).map((k) => ({
        ...normaliserPost(k, val[k]),
        createdAt: val[k].createdAt,
      }));

      // 1. Calculer le score du user (occurrences de son uid dans correctAnswers)
      let scoreCalcule = 0;
      const userScores: Record<string, number> = {};

      postsList.forEach((post) => {
        if (post.correctAnswers) {
          Object.entries(post.correctAnswers).forEach(([answerUid]) => {
            userScores[answerUid] = (userScores[answerUid] || 0) + 1;
            if (answerUid === uid) {
              scoreCalcule += 1;
            }
          });
        }
      });
      setScore(scoreCalcule);

      // 2. Calculer le rang global
      const classement = Object.entries(userScores)
        .map(([u, s]) => ({ uid: u, score: s }))
        .sort((a, b) => b.score - a.score);

      const userRankIndex = classement.findIndex((entry) => entry.uid === uid);
      if (userRankIndex !== -1) {
        setRang(userRankIndex + 1);
      } else {
        setRang(scoreCalcule > 0 ? classement.length + 1 : 'N/A');
      }

      // 3. Filtrer les publications créées par l'utilisateur
      const mesPosts = postsList.filter((post) => post.auteur === userEmail);
      mesPosts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      setUserPosts(mesPosts);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [uid, userEmail]);

  const confirmerEtSupprimer = (postId: string) => {
    Alert.alert('Confirmer la suppression', 'Voulez-vous vraiment supprimer cette publication ? Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove(ref(getDatabase(getApp()), `/posts/${postId}`));
            Alert.alert('Supprimé', 'La publication a été retirée du flux.');
          } catch (e) {
            console.error(e);
            Alert.alert('Erreur', "Vous n'avez pas la permission de supprimer ce post.");
          }
        },
      },
    ]);
  };

  const modifierTheme = async (statut: boolean) => {
    setSombre(statut);
    await AsyncStorage.setItem('theme', statut ? 'dark' : 'light');
  };

  const deconnexion = () => signOut(auth);

  const couleurFond = sombre ? '#0a0a0a' : '#f8f9fa';
  const couleurCarte = sombre ? '#161616' : '#ffffff';
  const couleurBord = sombre ? '#262626' : '#e9ecef';
  const couleurTexte = sombre ? '#ffffff' : '#1a1f36';
  const couleurTexteSecondaire = sombre ? '#888888' : '#6b7c93';

  if (loading) {
    return (
      <View style={[styles.centre, { backgroundColor: couleurFond }]}>
        <ActivityIndicator size="large" color="#fe2c55" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: couleurFond }]}>
      {/* Profil Header */}
      <View style={styles.enteteProfil}>
        <View style={styles.avatar}>
          <Text style={styles.avatarTexte}>{userDisplayName.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={[styles.email, { color: couleurTexte }]}>@{userDisplayName}</Text>
        <Text style={[styles.sousEmail, { color: couleurTexteSecondaire }]}>{userEmail}</Text>
      </View>

      {/* Cartes Stats */}
      <View style={styles.zoneStats}>
        <View style={[styles.statCarte, { backgroundColor: couleurCarte, borderColor: couleurBord }]}>
          <Text style={styles.statValeur}>{score}</Text>
          <Text style={[styles.statLabel, { color: couleurTexteSecondaire }]}>Points</Text>
        </View>

        <View style={[styles.statCarte, { backgroundColor: couleurCarte, borderColor: couleurBord }]}>
          <Text style={[styles.statValeur, { color: '#FFD700' }]}>#{rang}</Text>
          <Text style={[styles.statLabel, { color: couleurTexteSecondaire }]}>Rang</Text>
        </View>

        <View style={[styles.statCarte, { backgroundColor: couleurCarte, borderColor: couleurBord }]}>
          <Text style={styles.statValeur}>{userPosts.length}</Text>
          <Text style={[styles.statLabel, { color: couleurTexteSecondaire }]}>Posts</Text>
        </View>
      </View>

      {/* Mes Publications */}
      <View style={styles.zonePublications}>
        <Text style={[styles.sectionTitre, { color: couleurTexte }]}>Mes publications</Text>
        
        <FlatList
          data={userPosts}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text style={[styles.listeVide, { color: couleurTexteSecondaire }]}>
              Vous n'avez encore rien publié sur le flux.
            </Text>
          }
          renderItem={({ item }) => {
            const nbrLikes = item.likes || 0;
            const nbrComments = item.comments ? Object.keys(item.comments).length : 0;
            return (
              <View style={[styles.postLigne, { backgroundColor: couleurCarte, borderColor: couleurBord }]}>
                <View style={styles.postInfo}>
                  <Text style={[styles.postTitre, { color: couleurTexte }]} numberOfLines={1}>
                    {item.quiz ? `🧠 Quiz: ${item.quiz.question}` : `🎬 Média: ${item.description}`}
                  </Text>
                  <Text style={[styles.postStats, { color: couleurTexteSecondaire }]}>
                    ❤️ {nbrLikes} likes  •  💬 {nbrComments} comms  •  {item.mediaType === 'photo' ? '🖼️ Photo' : '🎥 Vidéo'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.boutonSupprimer}
                  onPress={() => confirmerEtSupprimer(item.id)}
                >
                  <Text style={styles.boutonSupprimerTexte}>Supprimer</Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      </View>

      {/* Réglages Thème & Déco */}
      <View style={[styles.reglageZone, { borderColor: couleurBord }]}>
        <View style={styles.ligneReglage}>
          <Text style={[styles.texteReglage, { color: couleurTexte }]}>Mode sombre</Text>
          <Switch value={sombre} onValueChange={modifierTheme} thumbColor="#fe2c55" trackColor={{ false: '#767577', true: 'rgba(254,44,85,0.4)' }} />
        </View>

        <TouchableOpacity style={styles.boutonDeconnexion} onPress={deconnexion}>
          <Text style={styles.boutonDeconnexionTexte}>Déconnexion</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 15 },
  centre: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  enteteProfil: { alignItems: 'center', marginTop: 20 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fe2c55',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#fe2c55',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarTexte: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  email: { fontSize: 18, fontWeight: 'bold', marginTop: 12 },
  sousEmail: { fontSize: 13, marginTop: 4 },
  zoneStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 25,
    marginBottom: 20,
  },
  statCarte: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statValeur: { color: '#fe2c55', fontSize: 20, fontWeight: 'bold' },
  statLabel: { fontSize: 11, fontWeight: 'bold', marginTop: 4, letterSpacing: 0.2 },
  zonePublications: { flex: 1, marginTop: 10 },
  sectionTitre: { fontSize: 16, fontWeight: 'bold', marginBottom: 12, letterSpacing: 0.2 },
  listeVide: { textAlign: 'center', marginTop: 30, fontSize: 13, fontStyle: 'italic' },
  postLigne: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  postInfo: { flex: 1, marginRight: 10 },
  postTitre: { fontSize: 14, fontWeight: 'bold' },
  postStats: { fontSize: 12, marginTop: 5 },
  boutonSupprimer: {
    backgroundColor: 'rgba(231,76,60,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  boutonSupprimerTexte: { color: '#e74c3c', fontSize: 12, fontWeight: 'bold' },
  reglageZone: {
    paddingVertical: 15,
    borderTopWidth: 1,
    marginTop: 10,
    marginBottom: 15,
  },
  ligneReglage: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  texteReglage: { fontSize: 14, fontWeight: '600' },
  boutonDeconnexion: {
    borderWidth: 1.5,
    borderColor: '#fe2c55',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    width: '100%',
  },
  boutonDeconnexionTexte: { color: '#fe2c55', fontWeight: 'bold', fontSize: 14 },
});
