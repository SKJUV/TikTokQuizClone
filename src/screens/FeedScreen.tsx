import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Text,
  Dimensions,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
  Modal,
  TextInput,
  Share,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { getDatabase, ref, onValue, push, runTransaction } from '@react-native-firebase/database';
import { PostTikTok } from '../types';
import Video from 'react-native-video';
import ErrorBoundary from '../components/ErrorBoundary';

const { height: ECRAN_HAUTEUR, width: ECRAN_LARGEUR } = Dimensions.get('screen');
const VIDEO_PAR_DEFAUT = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
const quizLocal = require('../../quiz.json') as Record<string, Omit<PostTikTok, 'id'>>;

const urlValide = (url?: string) => !!url && /^https?:\/\//i.test(url);

type PostNorm = PostTikTok & { likedBy?: Record<string, boolean> };

const normaliserPost = (id: string, post: any): PostNorm => ({
  id: post.id ?? id,
  videoUrl: urlValide(post.videoUrl) ? post.videoUrl : VIDEO_PAR_DEFAUT,
  auteur: post.auteur || 'Anonyme',
  description: post.description || 'Quiz communautaire',
  quiz: post.quiz
    ? {
        question: post.quiz.question || 'Question indisponible',
        options:
          Array.isArray(post.quiz.options) && post.quiz.options.length >= 4
            ? post.quiz.options.slice(0, 4)
            : ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
        reponseCorrecte: typeof post.quiz.reponseCorrecte === 'number' ? post.quiz.reponseCorrecte : 0,
      }
    : undefined,
  likes: typeof post.likes === 'number' ? post.likes : 0,
  shares: typeof post.shares === 'number' ? post.shares : 0,
  likedBy: post.likedBy || {},
});

const postsLocaux = (): PostNorm[] => Object.entries(quizLocal).map(([id, post]) => normaliserPost(id, post));

const IconeCoeur = ({ allume }: { allume: boolean }) => (
  <View style={styles.contenantIcone}>
    <View style={[styles.formeCoeurGauche, { backgroundColor: allume ? '#fe2c55' : '#fff' }]} />
    <View style={[styles.formeCoeurDroite, { backgroundColor: allume ? '#fe2c55' : '#fff' }]} />
    <View style={[styles.formeCoeurBas, { backgroundColor: allume ? '#fe2c55' : '#fff' }]} />
  </View>
);

const IconeCommentaire = () => (
  <View style={styles.contenantIcone}>
    <View style={styles.bulleDialogue} />
    <View style={styles.bulleFleche} />
  </View>
);

const IconePartage = () => (
  <View style={styles.contenantIcone}>
    <View style={styles.flechePartage} />
  </View>
);

type Commentaire = { auteur: string; texte: string };

export default function FeedScreen(): React.JSX.Element {
  const [posts, setPosts] = useState<PostTikTok[]>([]);
  const [indexActuel, setIndexActuel] = useState(0);
  const [reponseSelectionnee, setReponseSelectionnee] = useState<number | null>(null);
  const [chargementDonnees, setChargementDonnees] = useState(true);
  const [likesMock, setLikesMock] = useState<{ [key: string]: boolean }>({});
  const [dejaRepondu, setDejaRepondu] = useState<{ [key: string]: boolean }>({});
  const [postCommentaire, setPostCommentaire] = useState<string | null>(null);
  const [commentaires, setCommentaires] = useState<Commentaire[]>([]);
  const [texteCommentaire, setTexteCommentaire] = useState('');

  const uid = getAuth(getApp()).currentUser?.uid || 'anonyme';

  useEffect(() => {
    const db = getDatabase(getApp());
    const reference = ref(db, '/posts');
    let charge = false;

    const minuteurSecours = setTimeout(() => {
      if (!charge) {
        setPosts(postsLocaux());
        setChargementDonnees(false);
      }
    }, 2500);

    const desabonner = onValue(
      reference,
      (snapshot) => {
        charge = true;
        clearTimeout(minuteurSecours);
        const donnees = snapshot.val();
        const liste = donnees ? Object.keys(donnees).map((cle) => normaliserPost(cle, donnees[cle])) : [];
        setPosts(liste.length > 0 ? liste : postsLocaux());
        setChargementDonnees(false);
      },
      () => {
        charge = true;
        clearTimeout(minuteurSecours);
        setPosts(postsLocaux());
        setChargementDonnees(false);
      },
    );

    return () => {
      clearTimeout(minuteurSecours);
      desabonner();
    };
  }, []);

  useEffect(() => {
    if (posts.length === 0) return setIndexActuel(0);
    setIndexActuel((prev) => Math.max(0, Math.min(prev, posts.length - 1)));
  }, [posts.length]);

  const validerReponse = (postId: string, idxOption: number, idxCorrect: number) => {
    setReponseSelectionnee(idxOption);
    const correct = idxOption === idxCorrect;
    if (correct) {
      if (!dejaRepondu[postId]) {
        setDejaRepondu((p) => ({ ...p, [postId]: true }));
        runTransaction(ref(getDatabase(getApp()), `/users/${uid}/score`), (s) => (s || 0) + 1).catch(() => {});
      }
      Alert.alert('Félicitations 🎉', 'Bonne réponse ! +1 point.');
    } else {
      Alert.alert('Aïe ❌', 'Mauvaise réponse, réessaye !');
    }
  };

  const gererLike = async (item: any) => {
    if (item.id.startsWith('quiz_')) {
      setLikesMock((p) => ({ ...p, [item.id]: !p[item.id] }));
      return;
    }
    try {
      await runTransaction(ref(getDatabase(getApp()), `/posts/${item.id}`), (post) => {
        if (!post) return post;
        post.likedBy = post.likedBy || {};
        if (post.likedBy[uid]) {
          delete post.likedBy[uid];
          post.likes = Math.max(0, (post.likes || 0) - 1);
        } else {
          post.likedBy[uid] = true;
          post.likes = (post.likes || 0) + 1;
        }
        return post;
      });
    } catch (e) {
      console.error('Erreur like:', e);
    }
  };

  const ouvrirCommentaires = (postId: string) => {
    if (postId.startsWith('quiz_')) {
      return Alert.alert('Commentaires', 'Indisponible pour le contenu de démonstration hors-ligne.');
    }
    setPostCommentaire(postId);
  };

  useEffect(() => {
    if (!postCommentaire) return;
    const reference = ref(getDatabase(getApp()), `/posts/${postCommentaire}/comments`);
    const desabonner = onValue(reference, (snapshot) => {
      const val = snapshot.val();
      setCommentaires(val ? Object.values(val) : []);
    });
    return desabonner;
  }, [postCommentaire]);

  const envoyerCommentaire = async () => {
    if (!texteCommentaire.trim() || !postCommentaire) return;
    const email = getAuth(getApp()).currentUser?.email || 'Anonyme';
    try {
      await push(ref(getDatabase(getApp()), `/posts/${postCommentaire}/comments`), {
        auteur: email.split('@')[0],
        texte: texteCommentaire.trim(),
        createdAt: Date.now(),
      });
      setTexteCommentaire('');
    } catch {
      Alert.alert('Erreur', "Impossible d'envoyer le commentaire.");
    }
  };

  const partager = async (item: any) => {
    try {
      await Share.share({
        message: `Quiz "${item.quiz?.question || item.description}" sur TikTok Quiz UY1 🧠`,
      });
    } catch {
      // annulé
    }
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const estLike = item.id.startsWith('quiz_') ? !!likesMock[item.id] : !!item.likedBy?.[uid];

    return (
      <View style={styles.blocVideo}>
        <ErrorBoundary>
          <Video
            source={{ uri: item.videoUrl }}
            style={styles.videoPleinEcran}
            resizeMode="cover"
            repeat
            paused={index !== indexActuel}
            posterResizeMode="cover"
          />
        </ErrorBoundary>

        <View style={styles.barreLaterale}>
          <View style={styles.conteneurAvatar}>
            <View style={styles.avatarMock}>
              <View style={styles.teteSilhouette} />
              <View style={styles.corpsSilhouette} />
            </View>
            <View style={styles.boutonPlus}>
              <Text style={styles.plusText}>+</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.boutonAction} onPress={() => gererLike(item)}>
            <IconeCoeur allume={estLike} />
            <Text style={styles.texteAction}>{item.likes || 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.boutonAction} onPress={() => ouvrirCommentaires(item.id)}>
            <IconeCommentaire />
            <Text style={styles.texteAction}>Commenter</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.boutonAction} onPress={() => partager(item)}>
            <IconePartage />
            <Text style={styles.texteAction}>Partager</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.calqueQuiz}>
          <Text style={styles.auteur}>@{item.auteur?.split('@')[0] || 'Anonyme'}</Text>
          <Text style={styles.desc}>{item.description}</Text>

          {item.quiz && (
            <View style={styles.zoneQuizCard}>
              <Text style={styles.questionText}>{item.quiz.question}</Text>
              {item.quiz.options.map((option: string, idx: number) => {
                let couleurBouton = 'rgba(255, 255, 255, 0.08)';
                if (reponseSelectionnee !== null) {
                  if (idx === item.quiz.reponseCorrecte) couleurBouton = '#2ecc71';
                  else if (idx === reponseSelectionnee) couleurBouton = '#e74c3c';
                }
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.boutonOption, { backgroundColor: couleurBouton }]}
                    onPress={() => validerReponse(item.id, idx, item.quiz.reponseCorrecte)}
                    disabled={reponseSelectionnee !== null}
                  >
                    <Text style={styles.optionText}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </View>
    );
  };

  if (chargementDonnees) {
    return (
      <View style={styles.centreComplet}>
        <ActivityIndicator size="large" color="#fe2c55" />
        <Text style={{ color: '#aaa', marginTop: 10 }}>Chargement du flux TikTok...</Text>
      </View>
    );
  }

  return (
    <View style={styles.conteneurPrincipal}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <FlatList
        data={posts}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={ECRAN_HAUTEUR}
        snapToAlignment="start"
        decelerationRate="fast"
        style={styles.fluxList}
        contentContainerStyle={{ flexGrow: 1 }}
        onMomentumScrollEnd={(e) => {
          const nouvelIndex = Math.round(e.nativeEvent.contentOffset.y / ECRAN_HAUTEUR);
          if (nouvelIndex !== indexActuel) {
            setIndexActuel(nouvelIndex);
            setReponseSelectionnee(null);
          }
        }}
      />

      <Modal visible={!!postCommentaire} animationType="slide" transparent onRequestClose={() => setPostCommentaire(null)}>
        <View style={styles.modalFond}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalCarte}>
            <View style={styles.modalEntete}>
              <Text style={styles.modalTitre}>Commentaires</Text>
              <TouchableOpacity onPress={() => setPostCommentaire(null)}>
                <Text style={styles.modalFermer}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={commentaires}
              keyExtractor={(_, i) => String(i)}
              style={{ flex: 1 }}
              ListEmptyComponent={<Text style={styles.commentaireVide}>Sois le premier à commenter !</Text>}
              renderItem={({ item }) => (
                <View style={styles.commentaireLigne}>
                  <Text style={styles.commentaireAuteur}>@{item.auteur}</Text>
                  <Text style={styles.commentaireTexte}>{item.texte}</Text>
                </View>
              )}
            />

            <View style={styles.commentaireSaisieZone}>
              <TextInput
                style={styles.commentaireInput}
                placeholder="Ajouter un commentaire..."
                placeholderTextColor="#666"
                value={texteCommentaire}
                onChangeText={setTexteCommentaire}
              />
              <TouchableOpacity style={styles.commentaireEnvoyer} onPress={envoyerCommentaire}>
                <Text style={styles.commentaireEnvoyerTexte}>Envoyer</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneurPrincipal: { flex: 1, backgroundColor: '#000' },
  fluxList: { flex: 1 },
  blocVideo: { height: ECRAN_HAUTEUR, width: ECRAN_LARGEUR, position: 'relative', backgroundColor: '#000' },
  videoPleinEcran: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#111' },
  barreLaterale: {
    position: 'absolute',
    right: 12,
    bottom: 60,
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    zIndex: 10,
  },
  conteneurAvatar: { marginBottom: 20, alignItems: 'center' },
  avatarMock: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#444',
    borderWidth: 1,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  boutonPlus: {
    position: 'absolute',
    bottom: -5,
    backgroundColor: '#fe2c55',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusText: { color: '#fff', fontSize: 12, fontWeight: 'bold', bottom: 1 },
  boutonAction: { alignItems: 'center', justifyContent: 'center', marginBottom: 20, width: '100%' },
  texteAction: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  calqueQuiz: { position: 'absolute', bottom: 50, left: 12, right: 80, zIndex: 5 },
  auteur: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginBottom: 4, textShadowColor: '#000', textShadowRadius: 2 },
  desc: { color: '#ddd', fontSize: 14, marginBottom: 12, textShadowColor: '#000', textShadowRadius: 2 },
  zoneQuizCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  questionText: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginBottom: 10 },
  boutonOption: { padding: 12, borderRadius: 10, marginTop: 6, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  optionText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  centreComplet: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  contenantIcone: { width: 30, height: 30, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  teteSilhouette: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff' },
  corpsSilhouette: {
    width: 24,
    height: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: '#fff',
    marginTop: 2,
  },
  formeCoeurGauche: { position: 'absolute', width: 14, height: 14, borderRadius: 7, top: 4, left: 2, transform: [{ rotate: '-45deg' }] },
  formeCoeurDroite: { position: 'absolute', width: 14, height: 14, borderRadius: 7, top: 4, right: 2, transform: [{ rotate: '45deg' }] },
  formeCoeurBas: { position: 'absolute', width: 14, height: 14, top: 9, left: 8, transform: [{ rotate: '45deg' }] },
  bulleDialogue: { width: 24, height: 18, borderRadius: 5, backgroundColor: '#fff' },
  bulleFleche: {
    position: 'absolute',
    bottom: 4,
    left: 6,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#fff',
    transform: [{ rotate: '45deg' }],
  },
  flechePartage: {
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderLeftWidth: 16,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#fff',
    transform: [{ rotate: '-45deg' }],
    left: 2,
  },
  modalFond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCarte: { height: '60%', backgroundColor: '#161616', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16 },
  modalEntete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitre: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalFermer: { color: '#aaa', fontSize: 18 },
  commentaireVide: { color: '#666', textAlign: 'center', marginTop: 30 },
  commentaireLigne: { paddingVertical: 8, borderBottomWidth: 0.5, borderColor: '#262626' },
  commentaireAuteur: { color: '#fe2c55', fontWeight: '700', fontSize: 13, marginBottom: 2 },
  commentaireTexte: { color: '#eee', fontSize: 14 },
  commentaireSaisieZone: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  commentaireInput: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    color: '#fff',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#262626',
  },
  commentaireEnvoyer: { backgroundColor: '#fe2c55', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, marginLeft: 8 },
  commentaireEnvoyerTexte: { color: '#fff', fontWeight: 'bold' },
});
