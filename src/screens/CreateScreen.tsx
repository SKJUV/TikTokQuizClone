import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { getDatabase, ref, push } from '@react-native-firebase/database';
import { getStorage, ref as storageRef, putFile, getDownloadURL } from '@react-native-firebase/storage';
import { launchImageLibrary } from 'react-native-image-picker';

type ModeCreation = 'quiz' | 'video';
const VIDEO_DEMO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

export default function CreateScreen(): React.JSX.Element {
  const [mode, setMode] = useState<ModeCreation>('quiz');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [indexCorrect, setIndexCorrect] = useState<number | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [progression, setProgression] = useState<number | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const auth = getAuth(getApp());
  const userEmail = auth.currentUser?.email || 'Etudiant_UY1@uy1.uninet.cm';

  const majOption = (idx: number, valeur: string) =>
    setOptions((prev) => prev.map((o, i) => (i === idx ? valeur : o)));

  const rafraichir = () => {
    setQuestion('');
    setOptions(['', '', '', '']);
    setIndexCorrect(null);
    setVideoUrl('');
    setProgression(null);
  };

  const choisirEtUploader = async () => {
    try {
      const res = await launchImageLibrary({ mediaType: 'video' });
      const asset = res.assets?.[0];
      if (!asset?.uri) return;

      setProgression(0);
      const nom = `videos/${Date.now()}_${asset.fileName || 'video.mp4'}`;
      const reference = storageRef(getStorage(getApp()), nom);
      const tache = putFile(reference, asset.uri);

      tache.on('state_changed', (snap) => {
        setProgression(snap.bytesTransferred / snap.totalBytes);
      });

      await tache;
      const url = await getDownloadURL(reference);
      setVideoUrl(url);
      setProgression(1);
      Alert.alert('Upload terminé ✅', 'La vidéo est prête à être publiée.');
    } catch (e) {
      console.error(e);
      setProgression(null);
      Alert.alert('Erreur', "Impossible d'uploader la vidéo.");
    }
  };

  const publier = async () => {
    if (mode === 'quiz') {
      if (!question.trim() || options.some((o) => !o.trim())) {
        return Alert.alert('Erreur', 'Veuillez remplir la question et les 4 options.');
      }
      if (indexCorrect === null) {
        return Alert.alert('Erreur', 'Sélectionnez la bonne réponse en cliquant sur son numéro.');
      }
    } else if (!videoUrl.trim()) {
      return Alert.alert('Erreur', "Choisissez une vidéo à uploader ou collez une URL publique.");
    }

    setEnvoiEnCours(true);
    try {
      const nouveauPost: any = {
        auteur: userEmail,
        description: mode === 'quiz' ? 'Nouveau Quiz communautaire ! 🚀' : 'Vidéo partagée 🎬',
        videoUrl: videoUrl.trim() || VIDEO_DEMO,
        likes: 0,
        shares: 0,
        createdAt: Date.now(),
      };
      if (mode === 'quiz') {
        nouveauPost.quiz = {
          question: question.trim(),
          options: options.map((o) => o.trim()),
          reponseCorrecte: indexCorrect,
        };
      }

      await push(ref(getDatabase(getApp()), '/posts'), nouveauPost);
      Alert.alert('Succès 🎉', 'Votre publication a été ajoutée au flux !');
      rafraichir();
    } catch (e) {
      console.error(e);
      Alert.alert('Erreur Synchro', 'Impossible de publier sur Firebase.');
    } finally {
      setEnvoiEnCours(false);
    }
  };

  return (
    <ScrollView style={styles.conteneur} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={styles.titrePage}>{mode === 'quiz' ? 'Créer un Quiz 🧠' : 'Partager une Vidéo 🎬'}</Text>
      <Text style={styles.sousTitre}>
        {mode === 'quiz'
          ? 'Ajoute une question pour tester la communauté étudiante.'
          : 'Uploade une vidéo depuis ton appareil ou colle une URL publique.'}
      </Text>

      <View style={{ flexDirection: 'row', marginBottom: 14 }}>
        <TouchableOpacity onPress={() => setMode('quiz')} style={[styles.modeBtn, mode === 'quiz' && styles.modeBtnActif]}>
          <Text style={[styles.modeTexte, mode === 'quiz' && styles.modeTexteActif]}>Quiz</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMode('video')} style={[styles.modeBtn, mode === 'video' && styles.modeBtnActif]}>
          <Text style={[styles.modeTexte, mode === 'video' && styles.modeTexteActif]}>Vidéo</Text>
        </TouchableOpacity>
      </View>

      {mode === 'video' && (
        <View>
          <Text style={styles.label}>Vidéo</Text>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={choisirEtUploader} disabled={progression !== null && progression < 1}>
            <Text style={styles.boutonTexte}>
              {progression === null
                ? 'Choisir et uploader une vidéo'
                : progression < 1
                ? `Upload... ${Math.round(progression * 100)}%`
                : 'Vidéo uploadée ✅'}
            </Text>
          </TouchableOpacity>
          {progression !== null && (
            <View style={styles.barreFond}>
              <View style={[styles.barreRemplissage, { width: `${Math.round(progression * 100)}%` }]} />
            </View>
          )}
          <Text style={styles.label}>Ou URL publique</Text>
          <TextInput
            style={styles.champSaisie}
            placeholder="https://.../video.mp4"
            placeholderTextColor="#666"
            value={videoUrl}
            onChangeText={setVideoUrl}
          />
        </View>
      )}

      {mode === 'quiz' && (
        <>
          <Text style={styles.label}>Votre Question</Text>
          <TextInput
            style={styles.champSaisie}
            placeholder="Ex: Quel hook gère les effets de bord ?"
            placeholderTextColor="#666"
            value={question}
            onChangeText={setQuestion}
            multiline
          />

          <Text style={styles.label}>Options (clique sur le chiffre pour le corrigé)</Text>
          {options.map((valeur, idx) => (
            <View key={idx} style={styles.blocOptionInput}>
              <TouchableOpacity
                style={[styles.indicateurCorrection, indexCorrect === idx && styles.indicateurCorrectionActif]}
                onPress={() => setIndexCorrect(idx)}
              >
                <Text style={[styles.texteIndicateur, indexCorrect === idx && { color: '#fff' }]}>{idx + 1}</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.champSaisieOption}
                placeholder={`Option ${idx + 1}`}
                placeholderTextColor="#666"
                value={valeur}
                onChangeText={(t) => majOption(idx, t)}
              />
            </View>
          ))}
        </>
      )}

      <TouchableOpacity style={styles.boutonPublier} onPress={publier} disabled={envoiEnCours}>
        {envoiEnCours ? <ActivityIndicator color="#fff" /> : <Text style={styles.boutonTexte}>Publier sur le Flux</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: '#0a0a0a', padding: 20 },
  titrePage: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 20, marginBottom: 5 },
  sousTitre: { color: '#aaa', fontSize: 14, marginBottom: 25 },
  label: { color: '#fe2c55', fontSize: 14, fontWeight: '700', marginBottom: 8, marginTop: 10 },
  champSaisie: {
    backgroundColor: '#161616',
    color: '#fff',
    borderRadius: 12,
    padding: 15,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#262626',
    textAlignVertical: 'top',
    minHeight: 50,
    marginBottom: 15,
  },
  blocOptionInput: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  indicateurCorrection: {
    width: 35,
    height: 35,
    borderRadius: 18,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  indicateurCorrectionActif: { backgroundColor: '#2ecc71', borderColor: '#2ecc71' },
  texteIndicateur: { color: '#aaa', fontWeight: 'bold' },
  champSaisieOption: {
    flex: 1,
    backgroundColor: '#161616',
    color: '#fff',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#262626',
  },
  boutonPublier: { backgroundColor: '#fe2c55', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 30 },
  boutonSecondaire: {
    backgroundColor: '#262626',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  boutonTexte: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  barreFond: { height: 6, backgroundColor: '#262626', borderRadius: 3, marginBottom: 15, overflow: 'hidden' },
  barreRemplissage: { height: 6, backgroundColor: '#2ecc71' },
  modeBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#262626',
    marginRight: 8,
    alignItems: 'center',
  },
  modeBtnActif: { backgroundColor: '#fe2c55', borderColor: '#fe2c55' },
  modeTexte: { color: '#aaa', fontWeight: '700' },
  modeTexteActif: { color: '#fff' },
});
