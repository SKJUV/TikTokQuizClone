import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  InteractionManager,
  Animated,
  type ViewToken,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { getDatabase, ref, onValue, push, runTransaction } from '@react-native-firebase/database';
import Video from 'react-native-video';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import ErrorBoundary from '../components/ErrorBoundary';
import { normaliserPost, postsLocaux, PostNorm, resoudreUrlsMedia, extraireIdDrive } from '../utils/feedHelpers';

const ECRAN_LARGEUR = Dimensions.get('window').width;

type ModeQuiz = 'inline' | 'apres_video' | 'overlay_photo' | 'none';
type PhaseOverlay = 'cache' | 'invitation' | 'actif' | 'termine';
type Commentaire = { auteur: string; texte: string };

const getModeQuiz = (post: PostNorm): ModeQuiz => {
  if (!post.quiz) return 'none';
  if (post.typePublication === 'quiz_seul') return 'inline';
  if (post.quizApresVideo && post.mediaType === 'video') return 'apres_video';
  if (post.typePublication === 'media_quiz' && post.mediaType === 'photo') return 'overlay_photo';
  if (post.typePublication === 'media_quiz' && post.mediaType === 'video') return 'apres_video';
  return 'inline';
};

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

const DegradeFlou = ({ hauteur }: { hauteur: number }) => (
  <Svg width={ECRAN_LARGEUR} height={hauteur} style={StyleSheet.absoluteFill}>
    <Defs>
      <LinearGradient id="overlayGrad" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="rgba(0,0,0,0.15)" />
        <Stop offset="0.45" stopColor="rgba(0,0,0,0.55)" />
        <Stop offset="1" stopColor="rgba(0,0,0,0.88)" />
      </LinearGradient>
    </Defs>
    <Rect width={ECRAN_LARGEUR} height={hauteur} fill="url(#overlayGrad)" />
  </Svg>
);

export default function FeedScreen(): React.JSX.Element {
  const [posts, setPosts] = useState<PostNorm[]>([]);
  const [postsFiltrés, setPostsFiltrés] = useState<PostNorm[]>([]);
  const [indexActuel, setIndexActuel] = useState(0);
  const [reponseSelectionnee, setReponseSelectionnee] = useState<number | null>(null);
  const [chargementDonnees, setChargementDonnees] = useState(true);
  const [likesMock, setLikesMock] = useState<Record<string, boolean>>({});
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [requeteRecherche, setRequeteRecherche] = useState('');
  const [postCommentaire, setPostCommentaire] = useState<string | null>(null);
  const [commentaires, setCommentaires] = useState<Commentaire[]>([]);
  const [texteCommentaire, setTexteCommentaire] = useState('');
  const [mediasEnErreur, setMediasEnErreur] = useState<Record<string, boolean>>({});
  const [indexUrlMedia, setIndexUrlMedia] = useState<Record<string, number>>({});
  const [forcerAffichagePhoto, setForcerAffichagePhoto] = useState<Record<string, boolean>>({});
  const [videoPret, setVideoPret] = useState(false);
  const [hauteurPage, setHauteurPage] = useState(Dimensions.get('window').height * 0.85);
  const [phaseOverlay, setPhaseOverlay] = useState<PhaseOverlay>('cache');

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList<PostNorm>>(null);

  const auth = getAuth(getApp());
  const uid = auth.currentUser?.uid || 'anonyme';
  const userDisplayName = auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Étudiant';

  const postCourant = postsFiltrés[indexActuel];
  const modeQuizCourant = postCourant ? getModeQuiz(postCourant) : 'none';

  const reinitialiserOverlay = useCallback(() => {
    setPhaseOverlay('cache');
    overlayOpacity.setValue(0);
    setReponseSelectionnee(null);
  }, [overlayOpacity]);

  const afficherOverlay = useCallback(() => {
    setPhaseOverlay('invitation');
    Animated.timing(overlayOpacity, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, [overlayOpacity]);

  const estomperOverlay = useCallback(() => {
    Animated.timing(overlayOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
      setPhaseOverlay('termine');
    });
  }, [overlayOpacity]);

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
        const liste = donnees
          ? Object.keys(donnees)
              .filter((cle) => donnees[cle] && typeof donnees[cle] === 'object')
              .map((cle) => normaliserPost(cle, donnees[cle]))
          : [];
        const listeComplete = liste.length > 0 ? liste : postsLocaux();
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

  useEffect(() => {
    setVideoPret(false);
    const task = InteractionManager.runAfterInteractions(() => setVideoPret(true));
    return () => task.cancel();
  }, [indexActuel, chargementDonnees]);

  useEffect(() => {
    reinitialiserOverlay();
    if (!postCourant?.quiz) return;

    if (modeQuizCourant === 'overlay_photo') {
      const timer = setTimeout(() => afficherOverlay(), 900);
      return () => clearTimeout(timer);
    }

    if (postCourant.correctAnswers?.[uid]) {
      setReponseSelectionnee(postCourant.quiz.reponseCorrecte);
    }
  }, [indexActuel, postCourant?.id, modeQuizCourant, reinitialiserOverlay, afficherOverlay, uid, postCourant]);

  useEffect(() => {
    if (!postCommentaire) return;
    const reference = ref(getDatabase(getApp()), `/posts/${postCommentaire}/comments`);
    return onValue(reference, (snapshot) => {
      const val = snapshot.val();
      setCommentaires(val ? Object.values(val) : []);
    });
  }, [postCommentaire]);

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
    reinitialiserOverlay();
  };

  const fermerRecherche = () => {
    setRequeteRecherche('');
    setPostsFiltrés(posts);
    setRechercheOuverte(false);
    setIndexActuel(0);
    reinitialiserOverlay();
  };

  const validerReponse = async (postId: string, idxOption: number, idxCorrect: number) => {
    setReponseSelectionnee(idxOption);
    const correct = idxOption === idxCorrect;

    if (correct) {
      if (postId.startsWith('quiz_')) {
        Alert.alert('Félicitations', 'Bonne réponse ! +1 point.');
      } else {
        try {
          await ref(getDatabase(getApp()), `/posts/${postId}/correctAnswers/${uid}`).set({
            displayName: userDisplayName,
            email: auth.currentUser?.email || '',
          });
          Alert.alert('Félicitations', 'Bonne réponse enregistrée ! +1 point.');
        } catch (err) {
          console.error(err);
        }
      }
    } else {
      Alert.alert('Aïe', 'Mauvaise réponse.');
      setTimeout(() => setReponseSelectionnee(null), 1200);
      return;
    }

    if (modeQuizCourant === 'apres_video' || modeQuizCourant === 'overlay_photo') {
      setTimeout(() => estomperOverlay(), 900);
    }
  };

  const gererLike = async (item: PostNorm) => {
    if (item.id.startsWith('quiz_')) {
      setLikesMock((p) => ({ ...p, [item.id]: !p[item.id] }));
      return;
    }
    const estLikeActuel = !!item.likedBy?.[uid];
    const db = getDatabase(getApp());
    try {
      if (estLikeActuel) {
        await runTransaction(ref(db, `/posts/${item.id}/likes`), (n) => Math.max(0, (n || 0) - 1));
        await ref(db, `/posts/${item.id}/likedBy/${uid}`).remove();
      } else {
        await runTransaction(ref(db, `/posts/${item.id}/likes`), (n) => (n || 0) + 1);
        await ref(db, `/posts/${item.id}/likedBy/${uid}`).set(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const ouvrirCommentaires = (postId: string) => {
    if (postId.startsWith('quiz_')) {
      Alert.alert('Commentaires', 'Indisponible pour la démo hors-ligne.');
      return;
    }
    setPostCommentaire(postId);
  };

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

  const partager = async (item: PostNorm) => {
    try {
      await Share.share({
        message: `Découvrez "${item.quiz?.question || item.description}" sur TikTok Quiz UY1`,
      });
      if (!item.id.startsWith('quiz_')) {
        await runTransaction(ref(getDatabase(getApp()), `/posts/${item.id}/shares`), (s) => (s || 0) + 1);
      }
    } catch {
      // annulé
    }
  };

  const marquerMediaEnErreur = (postId: string) => {
    setMediasEnErreur((prev) => (prev[postId] ? prev : { ...prev, [postId]: true }));
  };

  const obtenirTypeAffichage = (item: PostNorm): 'photo' | 'video' => {
    if (forcerAffichagePhoto[item.id]) return 'photo';
    return item.mediaType;
  };

  const obtenirUrlsMediaItem = (item: PostNorm): string[] => {
    const type = obtenirTypeAffichage(item);
    if (item.urlsMedia?.length && type === item.mediaType && !forcerAffichagePhoto[item.id]) {
      return item.urlsMedia;
    }
    const fileId = item.driveFileId || extraireIdDrive(item.videoUrl);
    if (fileId) {
      return resoudreUrlsMedia(`https://drive.google.com/uc?id=${fileId}`, type);
    }
    return resoudreUrlsMedia(item.videoUrl, type);
  };

  const obtenirUrlMedia = (item: PostNorm): string => {
    const liste = obtenirUrlsMediaItem(item);
    const idx = indexUrlMedia[item.id] ?? 0;
    return liste[Math.min(idx, liste.length - 1)] || item.videoUrl;
  };

  const essayerUrlSuivante = (item: PostNorm) => {
    const liste = obtenirUrlsMediaItem(item);
    const idxActuel = indexUrlMedia[item.id] ?? 0;
    if (idxActuel + 1 < liste.length) {
      setIndexUrlMedia((prev) => ({ ...prev, [item.id]: idxActuel + 1 }));
      setMediasEnErreur((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      return true;
    }
    return false;
  };

  const gererErreurMedia = (item: PostNorm) => {
    const fileId = item.driveFileId || extraireIdDrive(item.videoUrl);
    if (item.mediaType === 'video' && fileId && !forcerAffichagePhoto[item.id]) {
      setForcerAffichagePhoto((prev) => ({ ...prev, [item.id]: true }));
      setIndexUrlMedia((prev) => ({ ...prev, [item.id]: 0 }));
      setMediasEnErreur((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      return;
    }
    if (essayerUrlSuivante(item)) return;
    marquerMediaEnErreur(item.id);
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setIndexActuel(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nouvelIndex = Math.round(e.nativeEvent.contentOffset.y / hauteurPage);
    if (nouvelIndex >= 0 && nouvelIndex < postsFiltrés.length) {
      setIndexActuel(nouvelIndex);
    }
  };

  const renderMedia = (item: PostNorm, index: number) => {
    const estVisible = index === indexActuel;
    const typeAffichage = obtenirTypeAffichage(item);
    const mode = getModeQuiz(item);
    const quizTermine = phaseOverlay === 'termine';
    const videoFinie = mode === 'apres_video' && phaseOverlay !== 'cache';
    const urlLecture = obtenirUrlMedia(item);

    if (!estVisible) {
      return <View style={[styles.mediaPlaceholder, { height: hauteurPage }]} />;
    }

    if (mediasEnErreur[item.id]) {
      return (
        <View style={[styles.mediaPlaceholder, styles.mediaErreur, { height: hauteurPage }]}>
          <Text style={styles.mediaErreurTexte}>Média indisponible</Text>
          <TouchableOpacity
            style={styles.boutonReessayer}
            onPress={() => {
              setIndexUrlMedia((prev) => ({ ...prev, [item.id]: 0 }));
              setForcerAffichagePhoto((prev) => {
                const next = { ...prev };
                delete next[item.id];
                return next;
              });
              setMediasEnErreur((prev) => {
                const next = { ...prev };
                delete next[item.id];
                return next;
              });
            }}
          >
            <Text style={styles.boutonReessayerTexte}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (typeAffichage === 'photo') {
      return (
        <View style={[styles.mediaPlein, { height: hauteurPage }]}>
          <Image
            key={`${item.id}-${urlLecture}`}
            source={{ uri: urlLecture }}
            style={[styles.mediaPlein, { height: hauteurPage }]}
            resizeMode="cover"
            onLoad={() => {
              setMediasEnErreur((prev) => {
                if (!prev[item.id]) return prev;
                const next = { ...prev };
                delete next[item.id];
                return next;
              });
            }}
            onError={() => gererErreurMedia(item)}
          />
        </View>
      );
    }

    if (!videoPret) {
      return (
        <View style={[styles.mediaPlaceholder, styles.mediaChargement, { height: hauteurPage }]}>
          <ActivityIndicator color="#fe2c55" size="large" />
        </View>
      );
    }

    return (
      <ErrorBoundary>
        <Video
          key={`${item.id}-${urlLecture}`}
          source={{ uri: urlLecture }}
          style={[styles.mediaPlein, { height: hauteurPage }]}
          resizeMode="cover"
          repeat={mode !== 'apres_video' || quizTermine}
          paused={!!postCommentaire || (mode === 'apres_video' && videoFinie && phaseOverlay !== 'termine')}
          playInBackground={false}
          playWhenInactive={false}
          ignoreSilentSwitch="ignore"
          controls={false}
          onLoad={() => {
            setMediasEnErreur((prev) => {
              if (!prev[item.id]) return prev;
              const next = { ...prev };
              delete next[item.id];
              return next;
            });
          }}
          onEnd={() => {
            if (index !== indexActuel || mode !== 'apres_video' || phaseOverlay !== 'cache') return;
            afficherOverlay();
          }}
          onError={() => gererErreurMedia(item)}
        />
      </ErrorBoundary>
    );
  };

  const renderOverlayQuiz = (item: PostNorm, index: number) => {
    if (index !== indexActuel) return null;
    if (phaseOverlay !== 'invitation' && phaseOverlay !== 'actif') return null;
    if (!item.quiz) return null;

    const quiz = item.quiz;
    const aDejaRepondu = !!item.correctAnswers?.[uid];

    return (
      <Animated.View
        pointerEvents="box-none"
        style={[styles.overlayQuiz, { height: hauteurPage, opacity: overlayOpacity }]}
      >
        <DegradeFlou hauteur={hauteurPage} />

        <View style={styles.overlayContenu}>
          {phaseOverlay === 'invitation' ? (
            <>
              <Text style={styles.overlayTitre}>Quiz disponible</Text>
              <Text style={styles.overlaySousTitre}>
                {item.mediaType === 'video'
                  ? 'La vidéo est terminée. Souhaitez-vous répondre au quiz ?'
                  : 'Un quiz accompagne cette publication. Voulez-vous y répondre ?'}
              </Text>
              <View style={styles.overlayBoutonsChoix}>
                <TouchableOpacity style={styles.boutonPasser} onPress={estomperOverlay}>
                  <Text style={styles.boutonPasserTexte}>Passer</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.boutonRepondre} onPress={() => setPhaseOverlay('actif')}>
                  <Text style={styles.boutonRepondreTexte}>Répondre</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.overlayTitre}>Question</Text>
              <Text style={styles.overlayQuestion}>{quiz.question}</Text>
              {aDejaRepondu && <Text style={styles.badgeRepondu}>✓ Déjà acquis</Text>}
              {quiz.options.map((option, idx) => {
                let bg = 'rgba(255,255,255,0.1)';
                let border = 'rgba(255,255,255,0.2)';
                if (reponseSelectionnee !== null) {
                  if (idx === quiz.reponseCorrecte) {
                    bg = 'rgba(46,204,113,0.25)';
                    border = '#2ecc71';
                  } else if (idx === reponseSelectionnee) {
                    bg = 'rgba(231,76,60,0.25)';
                    border = '#e74c3c';
                  }
                }
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.boutonOptionOverlay, { backgroundColor: bg, borderColor: border }]}
                    onPress={() => validerReponse(item.id, idx, quiz.reponseCorrecte)}
                    disabled={reponseSelectionnee !== null || aDejaRepondu}
                  >
                    <Text style={styles.optionText}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={styles.boutonPasserBas} onPress={estomperOverlay}>
                <Text style={styles.boutonPasserTexte}>Fermer le quiz</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Animated.View>
    );
  };

  const renderItem = ({ item, index }: { item: PostNorm; index: number }) => {
    const estLike = item.id.startsWith('quiz_') ? !!likesMock[item.id] : !!item.likedBy?.[uid];
    const nbrLikes = item.id.startsWith('quiz_')
      ? likesMock[item.id]
        ? (item.likes || 0) + 1
        : item.likes || 0
      : item.likes || 0;
    const nbrCommentaires = item.comments ? Object.keys(item.comments).length : 0;
    const mode = getModeQuiz(item);
    const quiz = item.quiz;
    const afficherQuizInline = mode === 'inline' && quiz;
    const aDejaRepondu = !!item.correctAnswers?.[uid];
    const overlayVisible = index === indexActuel && (phaseOverlay === 'invitation' || phaseOverlay === 'actif');

    return (
      <View style={[styles.blocVideo, { height: hauteurPage, width: ECRAN_LARGEUR }]}>
        {renderMedia(item, index)}
        {renderOverlayQuiz(item, index)}

        {!overlayVisible && (
          <>
            <View style={styles.barreLaterale}>
              <View style={styles.conteneurAvatar}>
                <View style={styles.avatarMock}>
                  <Text style={styles.avatarLettre}>{(item.auteur || '?').charAt(0).toUpperCase()}</Text>
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
                <Text style={styles.texteAction}>{item.shares || 0}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.calqueInfos}>
              <Text style={styles.auteur}>@{item.auteur?.split('@')[0] || 'Anonyme'}</Text>
              <Text style={styles.desc} numberOfLines={2}>
                {item.description}
              </Text>

              {afficherQuizInline && (
                <View style={styles.zoneQuizCard}>
                  <View style={styles.enteteQuizCard}>
                    <Text style={styles.questionText}>{quiz.question}</Text>
                    {aDejaRepondu && <Text style={styles.badgeRepondu}>✓ Acquis</Text>}
                  </View>
                  {quiz.options.map((option, idx) => {
                    let bg = 'rgba(255,255,255,0.08)';
                    let border = 'rgba(255,255,255,0.1)';
                    if (reponseSelectionnee !== null) {
                      if (idx === quiz.reponseCorrecte) {
                        bg = 'rgba(46,204,113,0.2)';
                        border = '#2ecc71';
                      } else if (idx === reponseSelectionnee) {
                        bg = 'rgba(231,76,60,0.2)';
                        border = '#e74c3c';
                      }
                    }
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[styles.boutonOption, { backgroundColor: bg, borderColor: border }]}
                        onPress={() => validerReponse(item.id, idx, quiz.reponseCorrecte)}
                        disabled={reponseSelectionnee !== null || aDejaRepondu}
                      >
                        <Text style={styles.optionText}>{option}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}
      </View>
    );
  };

  if (chargementDonnees) {
    return (
      <View style={styles.centreComplet}>
        <ActivityIndicator size="large" color="#fe2c55" />
        <Text style={styles.texteChargement}>Chargement du flux…</Text>
      </View>
    );
  }

  return (
    <View style={styles.conteneurPrincipal} onLayout={(e) => setHauteurPage(e.nativeEvent.layout.height)}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <View style={styles.enTeteFlottante}>
        {rechercheOuverte ? (
          <View style={styles.barreRecherche}>
            <TextInput
              style={styles.rechercheInput}
              placeholder="Rechercher #hashtag…"
              placeholderTextColor="#888"
              value={requeteRecherche}
              onChangeText={executerRecherche}
              autoFocus
            />
            <TouchableOpacity onPress={fermerRecherche} style={styles.rechercheFermer}>
              <Text style={styles.rechercheFermerTexte}>Annuler</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.enteteContenu}>
            <View style={styles.enteteSpacer} />
            <View style={styles.bullePourVous}>
              <Text style={styles.textePourVous}>Pour vous</Text>
              <View style={styles.pointRougePourVous} />
            </View>
            <TouchableOpacity onPress={() => setRechercheOuverte(true)} style={styles.btnRecherche}>
              <Text style={styles.iconeRecherche}>🔍</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {postsFiltrés.length === 0 ? (
        <View style={styles.centreComplet}>
          <Text style={styles.texteVide}>Aucune publication trouvée.</Text>
          <TouchableOpacity onPress={fermerRecherche} style={styles.btnResetSearch}>
            <Text style={styles.btnResetTexte}>Réinitialiser</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={postsFiltrés}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          extraData={{
            indexActuel,
            postCommentaire,
            mediasEnErreur,
            likesMock,
            reponseSelectionnee,
            videoPret,
            phaseOverlay,
            forcerAffichagePhoto,
            indexUrlMedia,
            hauteurPage,
          }}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={hauteurPage}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          bounces={false}
          overScrollMode="never"
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          getItemLayout={(_, index) => ({
            length: hauteurPage,
            offset: hauteurPage * index,
            index,
          })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onMomentumScrollEnd={onScrollEnd}
          onScrollEndDrag={onScrollEnd}
          scrollEventThrottle={16}
          style={styles.fluxList}
        />
      )}

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
              style={styles.listeCommentaires}
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
                placeholder="Ajouter un commentaire…"
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
  blocVideo: { position: 'relative', backgroundColor: '#000', overflow: 'hidden' },
  mediaPlein: { width: ECRAN_LARGEUR, backgroundColor: '#111' },
  mediaPlaceholder: { width: ECRAN_LARGEUR, backgroundColor: '#111' },
  mediaErreur: { justifyContent: 'center', alignItems: 'center' },
  mediaChargement: { justifyContent: 'center', alignItems: 'center' },
  mediaErreurTexte: { color: '#888', fontSize: 14, fontWeight: '600', marginBottom: 12 },
  boutonReessayer: {
    backgroundColor: '#fe2c55',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  boutonReessayerTexte: { color: '#fff', fontWeight: '700', fontSize: 13 },
  overlayQuiz: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    justifyContent: 'center',
  },
  overlayContenu: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  overlayTitre: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  overlaySousTitre: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  overlayQuestion: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  overlayBoutonsChoix: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  boutonPasser: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    marginRight: 8,
  },
  boutonPasserBas: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  boutonPasserTexte: { color: 'rgba(255,255,255,0.8)', fontWeight: '700', fontSize: 14 },
  boutonRepondre: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#fe2c55',
    alignItems: 'center',
    marginLeft: 8,
  },
  boutonRepondreTexte: { color: '#fff', fontWeight: '800', fontSize: 14 },
  boutonOptionOverlay: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1.5,
  },
  barreLaterale: {
    position: 'absolute',
    right: 10,
    bottom: 24,
    alignItems: 'center',
    width: 56,
    zIndex: 10,
  },
  conteneurAvatar: { marginBottom: 18, alignItems: 'center' },
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
  avatarLettre: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  boutonAction: { alignItems: 'center', marginBottom: 18, width: '100%' },
  texteAction: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  calqueInfos: {
    position: 'absolute',
    bottom: 20,
    left: 14,
    right: 72,
    zIndex: 5,
  },
  auteur: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
    marginBottom: 4,
    textShadowColor: '#000',
    textShadowRadius: 3,
  },
  desc: {
    color: '#eee',
    fontSize: 13,
    marginBottom: 10,
    textShadowColor: '#000',
    textShadowRadius: 3,
  },
  zoneQuizCard: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  enteteQuizCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  questionText: { color: '#fff', fontSize: 14, fontWeight: 'bold', flex: 1, marginRight: 6 },
  badgeRepondu: {
    backgroundColor: '#2ecc71',
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
    alignSelf: 'center',
    marginBottom: 10,
  },
  boutonOption: { padding: 11, borderRadius: 10, marginTop: 5, borderWidth: 1 },
  optionText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  centreComplet: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  texteChargement: { color: '#aaa', marginTop: 10 },
  texteVide: { color: '#666', fontSize: 15, textAlign: 'center', marginHorizontal: 30 },
  contenantIcone: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  formeCoeurGauche: { position: 'absolute', width: 13, height: 13, borderRadius: 7, top: 4, left: 2, transform: [{ rotate: '-45deg' }] },
  formeCoeurDroite: { position: 'absolute', width: 13, height: 13, borderRadius: 7, top: 4, right: 2, transform: [{ rotate: '45deg' }] },
  formeCoeurBas: { position: 'absolute', width: 13, height: 13, top: 9, left: 8, transform: [{ rotate: '45deg' }] },
  bulleDialogue: { width: 22, height: 16, borderRadius: 4, backgroundColor: '#fff' },
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
    borderTopWidth: 9,
    borderBottomWidth: 9,
    borderLeftWidth: 14,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#fff',
    transform: [{ rotate: '-45deg' }],
  },
  modalFond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCarte: { height: '60%', backgroundColor: '#161616', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16 },
  modalEntete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitre: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalFermer: { color: '#aaa', fontSize: 18 },
  listeCommentaires: { flex: 1 },
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
  commentaireEnvoyer: {
    backgroundColor: '#fe2c55',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginLeft: 8,
  },
  commentaireEnvoyerTexte: { color: '#fff', fontWeight: 'bold' },
  enTeteFlottante: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 48 : 16,
    left: 0,
    right: 0,
    height: 48,
    zIndex: 100,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  enteteContenu: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  enteteSpacer: { width: 40 },
  bullePourVous: { alignItems: 'center' },
  textePourVous: { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
  pointRougePourVous: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fe2c55', marginTop: 4 },
  btnRecherche: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconeRecherche: { fontSize: 18 },
  barreRecherche: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 22,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  rechercheInput: { flex: 1, height: 40, color: '#fff', fontSize: 14 },
  rechercheFermer: { paddingLeft: 8, paddingVertical: 8 },
  rechercheFermerTexte: { color: '#fe2c55', fontWeight: 'bold' },
  btnResetSearch: {
    marginTop: 15,
    backgroundColor: '#fe2c55',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  btnResetTexte: { color: '#fff', fontWeight: 'bold' },
});
