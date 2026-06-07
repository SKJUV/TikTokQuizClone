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
  Image,
} from 'react-native';
import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { getDatabase, ref, onValue, push, runTransaction } from '@react-native-firebase/database';
import Video from 'react-native-video';
import ErrorBoundary from '../components/ErrorBoundary';
import { normaliserPost, postsLocaux, PostNorm } from '../utils/feedHelpers';

const { height: ECRAN_HAUTEUR, width: ECRAN_LARGEUR } = Dimensions.get('screen');

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

const IconeRecherche = () => (
  <Text style={{ fontSize: 22, color: '#fff' }}>🔍</Text>
);

type Commentaire = { auteur: string; texte: string };

export default function FeedScreen(): React.JSX.Element {
  const [posts, setPosts] = useState<PostNorm[]>([]);
  const [postsFiltrés, setPostsFiltrés] = useState<PostNorm[]>([]);
  const [indexActuel, setIndexActuel] = useState(0);
  const [reponseSelectionnee, setReponseSelectionnee] = useState<number | null>(null);
  const [chargementDonnees, setChargementDonnees] = useState(true);
  const [likesMock, setLikesMock] = useState<{ [key: string]: boolean }>({});
  
  // États de recherche
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [requeteRecherche, setRequeteRecherche] = useState('');
  
  // États commentaires
  const [postCommentaire, setPostCommentaire] = useState<string | null>(null);
  const [commentaires, setCommentaires] = useState<Commentaire[]>([]);
  const [texteCommentaire, setTexteCommentaire] = useState('');

  const auth = getAuth(getApp());
  const uid = auth.currentUser?.uid || 'anonyme';
  const userDisplayName = auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Étudiant';

  // Chargement des posts
  useEffect(() => {
    const db = getDatabase(getApp());
    const reference = ref(db, '/posts');
    let charge = false;

    const minuteurSecours = setTimeout(() => {
      if (!charge) {
        const locaux = postsLocaux();
        setPosts(locaux);
        setPostsFiltrés(locaux);
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
        const listeComplete = liste.length > 0 ? liste : postsLocaux();
        
        // Trier par date décroissante pour afficher les plus récents en premier
        listeComplete.sort((a, b) => b.createdAt - a.createdAt);

        setPosts(listeComplete);
        setPostsFiltrés(listeComplete);
        setChargementDonnees(false);
      },
      () => {
        charge = true;
        clearTimeout(minuteurSecours);
        const locaux = postsLocaux();
        setPosts(locaux);
        setPostsFiltrés(locaux);
        setChargementDonnees(false);
      },
    );

    return () => {
      clearTimeout(minuteurSecours);
      desabonner();
    };
  }, []);

  // Gérer la réponse sélectionnée lors du défilement ou chargement
  useEffect(() => {
    if (postsFiltrés.length === 0) {
      setReponseSelectionnee(null);
      return;
    }
    const index = Math.max(0, Math.min(indexActuel, postsFiltrés.length - 1));
    const post = postsFiltrés[index];
    if (post && post.correctAnswers && post.correctAnswers[uid] !== undefined) {
      setReponseSelectionnee(post.quiz?.reponseCorrecte ?? null);
    } else {
      setReponseSelectionnee(null);
    }
  }, [indexActuel, postsFiltrés, uid]);

  // Filtrer les posts lors de la recherche
  const executerRecherche = (text: string) => {
    setRequeteRecherche(text);
    if (!text.trim()) {
      setPostsFiltrés(posts);
      setIndexActuel(0);
      return;
    }
    const cleanQuery = text.toLowerCase().trim();
    const estTag = cleanQuery.startsWith('#');
    const tagQuery = estTag ? cleanQuery.slice(1) : cleanQuery;

    const filtre = posts.filter((post) => {
      const descMatch = post.description?.toLowerCase().includes(cleanQuery);
      const questionMatch = post.quiz?.question?.toLowerCase().includes(cleanQuery);
      const tagMatch = post.hashtags.some((tag) => tag.toLowerCase().includes(tagQuery));
      return descMatch || questionMatch || tagMatch;
    });
    setPostsFiltrés(filtre);
    setIndexActuel(0);
  };

  const fermerRecherche = () => {
    setRequeteRecherche('');
    setPostsFiltrés(posts);
    setRechercheOuverte(false);
    setIndexActuel(0);
  };

  const validerReponse = async (postId: string, idxOption: number, idxCorrect: number) => {
    setReponseSelectionnee(idxOption);
    const correct = idxOption === idxCorrect;
    
    if (correct) {
      if (postId.startsWith('quiz_')) {
        Alert.alert('Félicitations 🎉', 'Bonne réponse ! +1 point de démonstration.');
        return;
      }
      
      const db = getDatabase(getApp());
      try {
        // Enregistrer la réponse correcte sous posts/postId/correctAnswers/uid
        await ref(db, `/posts/${postId}/correctAnswers/${uid}`).set({
          displayName: userDisplayName,
          email: auth.currentUser?.email || '',
        });
        Alert.alert('Félicitations 🎉', 'Bonne réponse enregistrée ! +1 point.');
      } catch (err) {
        console.error('Erreur enregistrement score:', err);
      }
    } else {
      Alert.alert('Aïe ❌', 'Mauvaise réponse, réessayez !');
      // Permettre de réesayer en réinitialisant après 1.5s
      setTimeout(() => setReponseSelectionnee(null), 1500);
    }
  };

  const gererLike = async (item: any) => {
    if (item.id.startsWith('quiz_')) {
      setLikesMock((p) => ({ ...p, [item.id]: !p[item.id] }));
      return;
    }
    const estLikeActuel = !!item.likedBy?.[uid];
    const db = getDatabase(getApp());
    try {
      if (estLikeActuel) {
        // Enlever le like
        await runTransaction(ref(db, `/posts/${item.id}/likes`), (currentLikes) => {
          return Math.max(0, (currentLikes || 0) - 1);
        });
        await ref(db, `/posts/${item.id}/likedBy/${uid}`).remove();
      } else {
        // Ajouter le like
        await runTransaction(ref(db, `/posts/${item.id}/likes`), (currentLikes) => {
          return (currentLikes || 0) + 1;
        });
        await ref(db, `/posts/${item.id}/likedBy/${uid}`).set(true);
      }
    } catch (e) {
      console.error('Erreur transaction like:', e);
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
    try {
      await push(ref(getDatabase(getApp()), `/posts/${postCommentaire}/comments`), {
        auteur: userDisplayName,
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
        message: `Découvrez ce Quiz "${item.quiz?.question || item.description}" sur TikTok Quiz UY1 🧠`,
      });
      if (!item.id.startsWith('quiz_')) {
        await runTransaction(ref(getDatabase(getApp()), `/posts/${item.id}/shares`), (s) => (s || 0) + 1);
      }
    } catch {
      // annulé
    }
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const estLike = item.id.startsWith('quiz_') ? !!likesMock[item.id] : !!item.likedBy?.[uid];
    const nbrLikes = item.id.startsWith('quiz_') ? (likesMock[item.id] ? (item.likes || 0) + 1 : item.likes || 0) : (item.likes || 0);
    const nbrCommentaires = item.comments ? Object.keys(item.comments).length : 0;
    const nbrShares = item.shares || 0;

    const aDejaReponduCorrectement = !!item.correctAnswers?.[uid];

    return (
      <View style={styles.blocVideo}>
        {item.mediaType === 'photo' ? (
          <Image source={{ uri: item.videoUrl }} style={styles.imagePleinEcran} resizeMode="cover" />
        ) : (
          <ErrorBoundary>
            <Video
              source={{ uri: item.videoUrl }}
              style={styles.videoPleinEcran}
              resizeMode="cover"
              repeat
              paused={index !== indexActuel || !!postCommentaire}
              posterResizeMode="cover"
            />
          </ErrorBoundary>
        )}

        <View style={styles.barreLaterale}>
          <View style={styles.conteneurAvatar}>
            <View style={styles.avatarMock}>
              <Text style={styles.avatarLettre}>
                {(item.auteur || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.boutonAction} onPress={() => gererLike(item)}>
            <IconeCoeur allume={estLike} />
            <Text style={styles.texteAction}>{nbrLikes}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.boutonAction} onPress={() => ouvrirCommentaires(item.id)}>
            <IconeCommentaire />
            <Text style={styles.texteAction}>{nbrCommentaires}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.boutonAction} onPress={() => partager(item)}>
            <IconePartage />
            <Text style={styles.texteAction}>{nbrShares}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.calqueQuiz}>
          <Text style={styles.auteur}>@{item.auteur?.split('@')[0] || 'Anonyme'}</Text>
          <Text style={styles.desc}>{item.description}</Text>

          {item.quiz && (
            <View style={styles.zoneQuizCard}>
              <View style={styles.enteteQuizCard}>
                <Text style={styles.questionText}>{item.quiz.question}</Text>
                {aDejaReponduCorrectement && (
                  <Text style={styles.badgeRepondu}>✓ Acquis</Text>
                )}
              </View>
              {item.quiz.options.map((option: string, idx: number) => {
                let couleurBouton = 'rgba(255, 255, 255, 0.08)';
                let epaisseurBord = 1;
                let couleurBord = 'rgba(255, 255, 255, 0.1)';

                if (reponseSelectionnee !== null) {
                  if (idx === item.quiz.reponseCorrecte) {
                    couleurBouton = 'rgba(46, 204, 113, 0.2)';
                    couleurBord = '#2ecc71';
                    epaisseurBord = 1.5;
                  } else if (idx === reponseSelectionnee) {
                    couleurBouton = 'rgba(231, 76, 60, 0.2)';
                    couleurBord = '#e74c3c';
                    epaisseurBord = 1.5;
                  }
                }
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.boutonOption, { backgroundColor: couleurBouton, borderColor: couleurBord, borderWidth: epaisseurBord }]}
                    onPress={() => validerReponse(item.id, idx, item.quiz.reponseCorrecte)}
                    disabled={reponseSelectionnee !== null || aDejaReponduCorrectement}
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

      {/* ─── EN-TÊTE FLOTTANTE TIKTOK ─── */}
      <View style={styles.enTeteFlottante}>
        {rechercheOuverte ? (
          <View style={styles.barreRecherche}>
            <TextInput
              style={styles.rechercheInput}
              placeholder="Rechercher par hashtag #informatique..."
              placeholderTextColor="#888"
              value={requeteRecherche}
              onChangeText={executerRecherche}
              autoFocus
            />
            <TouchableOpacity onPress={fermerRecherche} style={styles.rechercheFermer}>
              <Text style={{ color: '#fe2c55', fontWeight: 'bold' }}>Annuler</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.enteteContenu}>
            <View style={{ width: 40 }} />
            
            {/* Bulle Pour Vous */}
            <View style={styles.bullePourVous}>
              <Text style={styles.textePourVous}>Pour vous</Text>
              <View style={styles.pointRougePourVous} />
            </View>

            {/* Bouton recherche */}
            <TouchableOpacity onPress={() => setRechercheOuverte(true)} style={styles.btnRecherche}>
              <IconeRecherche />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {postsFiltrés.length === 0 ? (
        <View style={styles.centreComplet}>
          <Text style={{ color: '#666', fontSize: 16, textAlign: 'center', marginHorizontal: 30 }}>
            Aucune publication ne correspond à votre recherche.
          </Text>
          <TouchableOpacity onPress={fermerRecherche} style={styles.btnResetSearch}>
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Réinitialiser</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={postsFiltrés}
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
            }
          }}
        />
      )}

      {/* MODALE COMMENTAIRES */}
      <Modal visible={!!postCommentaire} animationType="slide" transparent onRequestClose={() => setPostCommentaire(null)}>
        <View style={styles.modalFond}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalCarte}>
            <View style={styles.modalEntete}>
              <Text style={styles.modalTitre}>Commentaires ({commentaires.length})</Text>
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
  imagePleinEcran: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#111' },
  barreLaterale: {
    position: 'absolute',
    right: 12,
    bottom: 80,
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    zIndex: 10,
  },
  conteneurAvatar: { marginBottom: 20, alignItems: 'center' },
  avatarMock: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fe2c55',
    borderWidth: 1.5,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLettre: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
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
  calqueQuiz: { position: 'absolute', bottom: 70, left: 12, right: 80, zIndex: 5 },
  auteur: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginBottom: 4, textShadowColor: '#000', textShadowRadius: 2 },
  desc: { color: '#ddd', fontSize: 14, marginBottom: 12, textShadowColor: '#000', textShadowRadius: 2 },
  zoneQuizCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  enteteQuizCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  questionText: { color: '#fff', fontSize: 15, fontWeight: 'bold', flex: 1, marginRight: 6 },
  badgeRepondu: {
    backgroundColor: '#2ecc71',
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  boutonOption: { padding: 12, borderRadius: 10, marginTop: 6 },
  optionText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  centreComplet: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  contenantIcone: { width: 30, height: 30, justifyContent: 'center', alignItems: 'center', position: 'relative' },
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
  
  // NOUVEAUX STYLES RECHERCHE & HEADER
  enTeteFlottante: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 0,
    right: 0,
    height: 50,
    zIndex: 100,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  enteteContenu: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bullePourVous: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textePourVous: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  pointRougePourVous: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fe2c55',
    marginTop: 4,
  },
  btnRecherche: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  barreRecherche: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 25,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  rechercheInput: {
    flex: 1,
    height: 40,
    color: '#fff',
    fontSize: 14,
  },
  rechercheFermer: {
    paddingLeft: 8,
    paddingVertical: 8,
  },
  btnResetSearch: {
    marginTop: 15,
    backgroundColor: '#fe2c55',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
});
