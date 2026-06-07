import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { getDatabase, ref, push } from '@react-native-firebase/database';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { uploaderVersDrive, extraireHashtags, VIDEO_PAR_DEFAUT } from '../utils/feedHelpers';

type SectionCreation = 'media' | 'quiz';

type FormulaireQuizProps = {
  question: string;
  setQuestion: (v: string) => void;
  options: string[];
  majOption: (idx: number, valeur: string) => void;
  indexCorrect: number | null;
  setIndexCorrect: (idx: number) => void;
};

function FormulaireQuiz({
  question,
  setQuestion,
  options,
  majOption,
  indexCorrect,
  setIndexCorrect,
}: FormulaireQuizProps) {
  return (
    <View style={styles.zoneFormQuiz}>
      <TextInput
        style={styles.champSaisie}
        placeholder="Votre question (ex: Quelle est la dérivée de ln(x) ?)"
        placeholderTextColor="#555"
        value={question}
        onChangeText={setQuestion}
      />
      <Text style={styles.labelSousSection}>Options — touchez le numéro de la bonne réponse</Text>
      {options.map((valeur, idx) => (
        <View key={idx} style={styles.ligneOption}>
          <TouchableOpacity
            style={[styles.indicateurCorrection, indexCorrect === idx && styles.indicateurCorrectionActif]}
            onPress={() => setIndexCorrect(idx)}
          >
            <Text style={[styles.texteIndicateur, indexCorrect === idx && styles.texteIndicateurActif]}>
              {idx + 1}
            </Text>
          </TouchableOpacity>
          <TextInput
            style={styles.inputOption}
            placeholder={`Option ${idx + 1}`}
            placeholderTextColor="#555"
            value={valeur}
            onChangeText={(t) => majOption(idx, t)}
          />
        </View>
      ))}
    </View>
  );
}

export default function CreateScreen(): React.JSX.Element {
  const [section, setSection] = useState<SectionCreation>('media');
  const [description, setDescription] = useState('');
  const [descriptionQuiz, setDescriptionQuiz] = useState('');
  const [question, setQuestion] = useState('');
  const [questionMedia, setQuestionMedia] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [optionsMedia, setOptionsMedia] = useState(['', '', '', '']);
  const [indexCorrect, setIndexCorrect] = useState<number | null>(null);
  const [indexCorrectMedia, setIndexCorrectMedia] = useState<number | null>(null);
  const [ajouterQuiz, setAjouterQuiz] = useState(false);

  const [videoUrl, setVideoUrl] = useState('');
  const [mediaType, setMediaType] = useState<'photo' | 'video'>('video');
  const [progression, setProgression] = useState<number | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const auth = getAuth(getApp());
  const userEmail = auth.currentUser?.email || 'etudiant@uy1.uninet.cm';

  const majOption = (idx: number, valeur: string) =>
    setOptions((prev) => prev.map((o, i) => (i === idx ? valeur : o)));

  const majOptionMedia = (idx: number, valeur: string) =>
    setOptionsMedia((prev) => prev.map((o, i) => (i === idx ? valeur : o)));

  const reinitialiserMedia = () => {
    setDescription('');
    setQuestionMedia('');
    setOptionsMedia(['', '', '', '']);
    setIndexCorrectMedia(null);
    setAjouterQuiz(false);
    setVideoUrl('');
    setMediaType('video');
    setProgression(null);
  };

  const reinitialiserQuiz = () => {
    setDescriptionQuiz('');
    setQuestion('');
    setOptions(['', '', '', '']);
    setIndexCorrect(null);
  };

  const validerQuiz = (
    q: string,
    opts: string[],
    idx: number | null,
  ): { question: string; options: string[]; reponseCorrecte: number } | null => {
    if (!q.trim() || opts.some((o) => !o.trim())) {
      Alert.alert('Erreur', 'Veuillez remplir la question et les 4 options.');
      return null;
    }
    if (idx === null) {
      Alert.alert('Erreur', 'Sélectionnez la bonne réponse.');
      return null;
    }
    return {
      question: q.trim(),
      options: opts.map((o) => o.trim()),
      reponseCorrecte: idx,
    };
  };

  const traiterMediaSelectionne = async (asset: any) => {
    if (!asset?.uri) return;

    setProgression(0);
    const estVideo =
      asset.type?.startsWith('video') ||
      asset.duration !== undefined ||
      asset.fileName?.endsWith('.mp4') ||
      asset.fileName?.endsWith('.mov');
    const typeMedia: 'photo' | 'video' = estVideo ? 'video' : 'photo';
    setMediaType(typeMedia);

    const nomFichier = `app_upload_${Date.now()}_${asset.fileName || (estVideo ? 'video.mp4' : 'photo.jpg')}`;
    const mimeType = asset.type || (estVideo ? 'video/mp4' : 'image/jpeg');

    try {
      const publicUrl = await uploaderVersDrive(asset.uri, nomFichier, mimeType, (p) => {
        setProgression(p);
      });
      setVideoUrl(publicUrl);
      setProgression(1);
      Alert.alert('Succès', 'Média prêt à être publié sur le flux.');
    } catch (e: any) {
      console.error(e);
      setProgression(null);
      Alert.alert('Erreur', e.message || "Impossible d'uploader le fichier.");
    }
  };

  const choisirDepuisGalerie = (type: 'photo' | 'video') => {
    launchImageLibrary({ mediaType: type, quality: 0.8 }, (res) => {
      if (res.assets?.[0]) traiterMediaSelectionne(res.assets[0]);
    });
  };

  const capturerViaCamera = (type: 'photo' | 'video') => {
    launchCamera({ mediaType: type, quality: 0.8, videoQuality: 'high', durationLimit: 30 }, (res) => {
      if (res.assets?.[0]) traiterMediaSelectionne(res.assets[0]);
    });
  };

  const publierMedia = async () => {
    if (!description.trim()) {
      return Alert.alert('Erreur', 'Ajoutez une description pour votre publication.');
    }
    if (!videoUrl) {
      return Alert.alert('Erreur', 'Importez ou capturez un média avant de publier.');
    }

    let quizPayload: ReturnType<typeof validerQuiz> = null;
    if (ajouterQuiz) {
      quizPayload = validerQuiz(questionMedia, optionsMedia, indexCorrectMedia);
      if (!quizPayload) return;
    }

    setEnvoiEnCours(true);
    try {
      const tags = extraireHashtags(description);
      const nouveauPost: Record<string, unknown> = {
        auteur: userEmail,
        description: description.trim(),
        videoUrl,
        likes: 0,
        shares: 0,
        createdAt: Date.now(),
        mediaType,
        hashtags: tags,
        typePublication: ajouterQuiz ? 'media_quiz' : 'media',
      };

      if (quizPayload) {
        nouveauPost.quiz = quizPayload;
        nouveauPost.quizApresVideo = mediaType === 'video';
      }

      await push(ref(getDatabase(getApp()), '/posts'), nouveauPost);
      Alert.alert('Succès', 'Votre média est en ligne sur le flux !');
      reinitialiserMedia();
    } catch (e) {
      console.error(e);
      Alert.alert('Erreur', 'Impossible de publier sur Firebase.');
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const publierQuizSeul = async () => {
    const quizPayload = validerQuiz(question, options, indexCorrect);
    if (!quizPayload) return;

    setEnvoiEnCours(true);
    try {
      const desc = descriptionQuiz.trim() || quizPayload.question;
      const tags = extraireHashtags(desc);
      await push(ref(getDatabase(getApp()), '/posts'), {
        auteur: userEmail,
        description: desc,
        videoUrl: VIDEO_PAR_DEFAUT,
        likes: 0,
        shares: 0,
        createdAt: Date.now(),
        mediaType: 'video',
        hashtags: tags,
        typePublication: 'quiz_seul',
        quizApresVideo: false,
        quiz: quizPayload,
      });
      Alert.alert('Succès', 'Votre quiz est en ligne sur le flux !');
      reinitialiserQuiz();
    } catch (e) {
      console.error(e);
      Alert.alert('Erreur', 'Impossible de publier le quiz.');
    } finally {
      setEnvoiEnCours(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView style={styles.conteneur} contentContainerStyle={styles.contenuScroll}>
        <Text style={styles.titrePage}>Créer une publication</Text>
        <Text style={styles.sousTitre}>Choisissez ce que vous voulez partager avec la communauté UY1.</Text>

        <View style={styles.selecteurMode}>
          <TouchableOpacity
            onPress={() => setSection('media')}
            style={[styles.boutonMode, section === 'media' && styles.boutonModeActif]}
          >
            <Text style={[styles.texteMode, section === 'media' && styles.texteModeActif]}>Publier un média</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSection('quiz')}
            style={[styles.boutonMode, section === 'quiz' && styles.boutonModeActif]}
          >
            <Text style={[styles.texteMode, section === 'quiz' && styles.texteModeActif]}>Créer un quiz</Text>
          </TouchableOpacity>
        </View>

        {section === 'media' ? (
          <View style={styles.sectionBloc}>
            <Text style={styles.titreSection}>Partager photo ou vidéo</Text>

            <View style={styles.grilleBoutons}>
              <TouchableOpacity style={styles.btnMediaAction} onPress={() => choisirDepuisGalerie('photo')}>
                <Text style={styles.emojiBouton}>🖼️</Text>
                <Text style={styles.texteBtnMedia}>Galerie photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnMediaAction} onPress={() => choisirDepuisGalerie('video')}>
                <Text style={styles.emojiBouton}>🎥</Text>
                <Text style={styles.texteBtnMedia}>Galerie vidéo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnMediaAction} onPress={() => capturerViaCamera('photo')}>
                <Text style={styles.emojiBouton}>📸</Text>
                <Text style={styles.texteBtnMedia}>Prendre photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnMediaAction} onPress={() => capturerViaCamera('video')}>
                <Text style={styles.emojiBouton}>📹</Text>
                <Text style={styles.texteBtnMedia}>Filmer vidéo</Text>
              </TouchableOpacity>
            </View>

            {progression !== null && (
              <View style={styles.carteUpload}>
                <Text style={styles.texteUpload}>
                  {progression < 1
                    ? `Téléversement… ${Math.round(progression * 100)}%`
                    : 'Média prêt ✅'}
                </Text>
                <View style={styles.barreFond}>
                  <View style={[styles.barreRemplissage, { width: `${Math.round(progression * 100)}%` }]} />
                </View>
              </View>
            )}

            {videoUrl ? (
              <View style={styles.badgeSucces}>
                <Text style={styles.badgeSuccesTexte}>
                  {mediaType === 'photo' ? 'Photo' : 'Vidéo'} prête à publier
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setVideoUrl('');
                    setProgression(null);
                  }}
                  style={styles.btnSupprMedia}
                >
                  <Text style={styles.btnSupprMediaTexte}>Changer</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <Text style={styles.label}>Description & hashtags</Text>
            <TextInput
              style={styles.champSaisie}
              placeholder="Ex: Révision algo #examens #uy1"
              placeholderTextColor="#555"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />

            <View style={styles.ligneSwitch}>
              <View style={styles.switchTextes}>
                <Text style={styles.switchTitre}>Ajouter un quiz à mon post</Text>
                <Text style={styles.switchSousTitre}>
                  {mediaType === 'video'
                    ? 'Le quiz apparaîtra après la fin de la vidéo.'
                    : 'Le quiz s\'affichera en surimpression sur la photo.'}
                </Text>
              </View>
              <Switch
                value={ajouterQuiz}
                onValueChange={setAjouterQuiz}
                trackColor={{ false: '#333', true: 'rgba(254,44,85,0.4)' }}
                thumbColor={ajouterQuiz ? '#fe2c55' : '#888'}
              />
            </View>

            {ajouterQuiz && (
              <FormulaireQuiz
                question={questionMedia}
                setQuestion={setQuestionMedia}
                options={optionsMedia}
                majOption={majOptionMedia}
                indexCorrect={indexCorrectMedia}
                setIndexCorrect={setIndexCorrectMedia}
              />
            )}

            <TouchableOpacity style={styles.boutonPublierMedia} onPress={publierMedia} disabled={envoiEnCours}>
              {envoiEnCours ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.texteBoutonPublier}>Publier sur le flux</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.sectionBloc}>
            <Text style={styles.titreSection}>Quiz pédagogique</Text>
            <Text style={styles.infoQuizSeul}>
              Votre quiz sera publié avec une vidéo de fond par défaut. Les étudiants pourront répondre directement
              depuis le flux.
            </Text>

            <Text style={styles.label}>Description (optionnelle)</Text>
            <TextInput
              style={styles.champSaisie}
              placeholder="Contexte du quiz… #revision"
              placeholderTextColor="#555"
              value={descriptionQuiz}
              onChangeText={setDescriptionQuiz}
              multiline
              numberOfLines={2}
            />

            <Text style={styles.label}>Contenu du quiz</Text>
            <FormulaireQuiz
              question={question}
              setQuestion={setQuestion}
              options={options}
              majOption={majOption}
              indexCorrect={indexCorrect}
              setIndexCorrect={setIndexCorrect}
            />

            <TouchableOpacity style={styles.boutonPublierQuiz} onPress={publierQuizSeul} disabled={envoiEnCours}>
              {envoiEnCours ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.texteBoutonPublier}>Publier le quiz</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  conteneur: { flex: 1, backgroundColor: '#0a0a0a', paddingHorizontal: 20 },
  contenuScroll: { paddingBottom: 40 },
  titrePage: { color: '#fff', fontSize: 26, fontWeight: 'bold', marginTop: 20, marginBottom: 6 },
  sousTitre: { color: '#888', fontSize: 14, lineHeight: 20, marginBottom: 20 },
  selecteurMode: {
    flexDirection: 'row',
    backgroundColor: '#161616',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#262626',
  },
  boutonMode: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  boutonModeActif: { backgroundColor: '#fe2c55' },
  texteMode: { color: '#888', fontWeight: 'bold', fontSize: 13 },
  texteModeActif: { color: '#fff' },
  sectionBloc: { marginBottom: 24 },
  titreSection: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 14 },
  label: { color: '#fe2c55', fontSize: 14, fontWeight: 'bold', marginBottom: 10, marginTop: 8 },
  labelSousSection: { color: '#aaa', fontSize: 13, marginBottom: 10, fontWeight: '600' },
  grilleBoutons: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 12 },
  btnMediaAction: {
    width: '48%',
    backgroundColor: '#161616',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#262626',
  },
  emojiBouton: { fontSize: 24, marginBottom: 6 },
  texteBtnMedia: { color: '#fff', fontSize: 12, fontWeight: '700' },
  carteUpload: {
    backgroundColor: '#161616',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#262626',
  },
  texteUpload: { color: '#aaa', fontSize: 13, fontWeight: 'bold', marginBottom: 8 },
  barreFond: { height: 6, backgroundColor: '#262626', borderRadius: 3, overflow: 'hidden' },
  barreRemplissage: { height: 6, backgroundColor: '#2ecc71' },
  badgeSucces: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(46, 204, 113, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 113, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  badgeSuccesTexte: { color: '#2ecc71', fontWeight: 'bold', fontSize: 13 },
  btnSupprMedia: { backgroundColor: '#e74c3c', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  btnSupprMediaTexte: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  champSaisie: {
    backgroundColor: '#161616',
    color: '#fff',
    borderRadius: 12,
    padding: 15,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#262626',
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  ligneSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#262626',
    marginBottom: 12,
  },
  switchTextes: { flex: 1, marginRight: 12 },
  switchTitre: { color: '#fff', fontWeight: '700', fontSize: 14, marginBottom: 4 },
  switchSousTitre: { color: '#777', fontSize: 12, lineHeight: 16 },
  zoneFormQuiz: { marginTop: 4 },
  ligneOption: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  indicateurCorrection: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  indicateurCorrectionActif: { backgroundColor: '#2ecc71', borderColor: '#2ecc71' },
  texteIndicateur: { color: '#888', fontWeight: 'bold', fontSize: 14 },
  texteIndicateurActif: { color: '#fff' },
  inputOption: {
    flex: 1,
    backgroundColor: '#161616',
    color: '#fff',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#262626',
  },
  infoQuizSeul: { color: '#888', fontSize: 13, lineHeight: 19, marginBottom: 16 },
  boutonPublierMedia: {
    backgroundColor: '#fe2c55',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  boutonPublierQuiz: {
    backgroundColor: '#7c3aed',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  texteBoutonPublier: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
