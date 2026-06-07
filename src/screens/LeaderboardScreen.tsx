import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { getDatabase, ref, onValue } from '@react-native-firebase/database';
import { normaliserPost } from '../utils/feedHelpers';

type UserEntry = {
  uid: string;
  score: number;
  displayName: string;
  email: string;
};

export default function LeaderboardScreen(): React.JSX.Element {
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [usersFiltrés, setUsersFiltrés] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [rafraichissement, setRafraichissement] = useState(false);
  const [recherche, setRecherche] = useState('');

  const auth = getAuth(getApp());
  const uidConnecte = auth.currentUser?.uid;

  const chargerClassement = () => {
    const db = getDatabase(getApp());
    const reference = ref(db, '/posts');

    onValue(reference, (snap) => {
      const val = snap.val() || {};
      const posts = Object.keys(val).map((k) => normaliserPost(k, val[k]));
      
      const userScores: Record<string, { score: number; displayName: string; email: string }> = {};

      posts.forEach((post) => {
        if (post.correctAnswers) {
          Object.entries(post.correctAnswers).forEach(([uid, info]: [string, any]) => {
            if (!userScores[uid]) {
              userScores[uid] = {
                score: 0,
                displayName: info.displayName || 'Étudiant anonyme',
                email: info.email || '',
              };
            }
            userScores[uid].score += 1;
          });
        }
      });

      const list: UserEntry[] = Object.entries(userScores).map(([uid, info]) => ({
        uid,
        ...info,
      }));

      // Trier par score décroissant, puis par nom
      list.sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName));

      setUsers(list);
      setUsersFiltrés(list);
      setLoading(false);
      setRafraichissement(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
      setRafraichissement(false);
    });
  };

  useEffect(() => {
    chargerClassement();
  }, []);

  const gererRecherche = (text: string) => {
    setRecherche(text);
    if (!text.trim()) {
      setUsersFiltrés(users);
      return;
    }
    const cleanQuery = text.toLowerCase();
    const filtrés = users.filter(
      (u) =>
        u.displayName.toLowerCase().includes(cleanQuery) ||
        u.email.toLowerCase().includes(cleanQuery)
    );
    setUsersFiltrés(filtrés);
  };

  if (loading) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator size="large" color="#fe2c55" />
        <Text style={styles.texteChargement}>Calcul du classement global...</Text>
      </View>
    );
  }

  // Diviser la liste pour le podium (Top 3) et le reste
  const top3 = usersFiltrés.slice(0, 3);
  const resteUsers = usersFiltrés.slice(3);

  // Pour le podium: replacer dans l'ordre de gauche à droite: 2ème, 1er, 3ème
  const podium = [];
  if (top3[1]) podium.push({ ...top3[1], rang: 2 }); // Argent
  if (top3[0]) podium.push({ ...top3[0], rang: 1 }); // Or
  if (top3[2]) podium.push({ ...top3[2], rang: 3 }); // Bronze

  const renderPodiumItem = (item: any) => {
    const estLuiMeme = item.uid === uidConnecte;
    const estOr = item.rang === 1;
    const estArgent = item.rang === 2;

    const couleurMedaille = estOr ? '#FFD700' : estArgent ? '#C0C0C0' : '#CD7F32';
    const hauteurPodium = estOr ? 100 : estArgent ? 80 : 65;

    return (
      <View key={item.uid} style={styles.colonnePodium}>
        {/* Avatar */}
        <View style={[styles.avatarPodiumCadre, { borderColor: couleurMedaille }]}>
          <View style={[styles.avatarPodium, { backgroundColor: estLuiMeme ? '#fe2c55' : '#1a1a1a' }]}>
            <Text style={styles.avatarLettre}>{item.displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={[styles.badgeMedaille, { backgroundColor: couleurMedaille }]}>
            <Text style={styles.texteMedaille}>{item.rang === 1 ? '🏆' : item.rang}</Text>
          </View>
        </View>

        {/* Nom & Score */}
        <Text style={[styles.nomPodium, estLuiMeme && { color: '#fe2c55', fontWeight: 'bold' }]} numberOfLines={1}>
          {item.displayName.split(' ')[0]}
        </Text>
        <Text style={styles.scorePodium}>{item.score} pts</Text>

        {/* Colonne physique */}
        <View style={[styles.soclePodium, { height: hauteurPodium, backgroundColor: estOr ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.05)' }]}>
          <Text style={[styles.chiffreSocle, { color: couleurMedaille }]}>{item.rang}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.titre}>Classement Général 🏆</Text>

      {/* Barre de recherche */}
      <TextInput
        style={styles.champRecherche}
        placeholder="Rechercher un étudiant..."
        placeholderTextColor="#555"
        value={recherche}
        onChangeText={gererRecherche}
      />

      {/* Podium */}
      {podium.length > 0 && (
        <View style={styles.zonePodium}>
          {podium.map(renderPodiumItem)}
        </View>
      )}

      {/* Liste des autres étudiants */}
      <FlatList
        data={resteUsers}
        keyExtractor={(item) => item.uid}
        onRefresh={() => {
          setRafraichissement(true);
          chargerClassement();
        }}
        refreshing={rafraichissement}
        ListEmptyComponent={
          resteUsers.length === 0 && podium.length === 0 ? (
            <Text style={styles.listeVide}>Aucun étudiant trouvé.</Text>
          ) : null
        }
        renderItem={({ item, index }) => {
          const rangReel = index + 4;
          const estLuiMeme = item.uid === uidConnecte;

          return (
            <View style={[styles.ligne, estLuiMeme && styles.ligneUtilisateurConnecte]}>
              <Text style={styles.position}>{rangReel}</Text>
              <View style={[styles.listeAvatar, { backgroundColor: estLuiMeme ? '#fe2c55' : '#222' }]}>
                <Text style={styles.avatarLettre}>{item.displayName.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.info}>
                <Text style={[styles.nom, estLuiMeme && { color: '#fe2c55', fontWeight: 'bold' }]}>
                  {item.displayName} {estLuiMeme && '(Vous)'}
                </Text>
                <Text style={styles.emailSub}>{item.email}</Text>
              </View>
              <Text style={styles.score}>{item.score} pts</Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingHorizontal: 16, paddingTop: 20 },
  centre: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  texteChargement: { color: '#aaa', marginTop: 10, fontSize: 14 },
  titre: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 15, letterSpacing: 0.5 },
  champRecherche: {
    backgroundColor: '#161616',
    color: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#262626',
    marginBottom: 20,
  },
  zonePodium: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'flex-end',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderColor: '#161616',
    paddingBottom: 15,
  },
  colonnePodium: {
    alignItems: 'center',
    width: '30%',
  },
  avatarPodiumCadre: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 8,
  },
  avatarPodium: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeMedaille: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  texteMedaille: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  nomPodium: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
    textAlign: 'center',
  },
  scorePodium: {
    color: '#aaa',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  soclePodium: {
    width: '100%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chiffreSocle: {
    fontSize: 24,
    fontWeight: '900',
  },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderColor: '#111',
    borderRadius: 8,
    marginBottom: 4,
  },
  ligneUtilisateurConnecte: {
    backgroundColor: 'rgba(254,44,85,0.08)',
    borderColor: 'rgba(254,44,85,0.15)',
    borderWidth: 1,
  },
  position: { color: '#888', fontSize: 14, width: 28, fontWeight: '700', textAlign: 'center' },
  listeAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  avatarLettre: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  info: { flex: 1, marginLeft: 12 },
  nom: { color: '#fff', fontSize: 14, fontWeight: '600' },
  emailSub: { color: '#555', fontSize: 11, marginTop: 2 },
  score: { color: '#fff', fontSize: 14, fontWeight: '700', paddingRight: 4 },
  listeVide: { color: '#666', textAlign: 'center', marginTop: 40, fontSize: 14 },
});
