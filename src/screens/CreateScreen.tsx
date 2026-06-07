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
} from 'react-native';
import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { getDatabase, ref, push } from '@react-native-firebase/database';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { uploaderVersDrive, extraireHashtags, VIDEO_PAR_DEFAUT } from '../utils/feedHelpers';

type ModeCreation = 'quiz' | 'media';

export default function CreateScreen(): React.JSX.Element {
  const [mode, setMode] = useState<ModeCreation>('quiz');
  const [description, setDescription] = useState('');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [indexCorrect, setIndexCorrect] = useState<number | null>(null);
  
  const [videoUrl, setVideoUrl] = useState('');
  const [mediaType, setMediaType] = useState<'photo' | 'video'>('video');
  const [progression, setProgression] = useState<number | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const auth = getAuth(getApp());
  const userEmail = auth.currentUser?.email || 'etudiant@uy1.uninet.cm';

  const majOption = (idx: number, valeur: string) =>
    setOptions((prev) => prev.map((o, i) => (i === idx ? valeur : o)));

  const rafraichir = () => {
    setDescription('');
    setQuestion('');
    setOptions(['', '', '', '']);
    setIndexCorrect(null);
    setVideoUrl('');
    setMediaType('video');
    setProgression(null);
  };

  const traiterMediaSelectionne = async (asset: any) => {
    if (!asset?.uri) return;

    setProgression(0);
    const estVideo = asset.type?.startsWith('video') || asset.duration !== undefined || asset.fileName?.endsWith('.mp4') || asset.fileName?.endsWith('.mov');
    const typeMedia: 'photo' | 'video' = estVideo ? 'video' : 'photo';
    setMediaType(typeMedia);

    const nomFichier = `app_upload_${Date.now()}_${asset.fileName || (estVideo ? 'video.mp4' : 'photo.jpg')}`;
    const mimeType = asset.type || (estVideo ? 'video/mp4' : 'image/jpeg');

    try {
      const publicUrl = await uploaderVersDrive(asset.uri, nomFichier, mimeType, (p) => {
        setProgression(p);
      });
      setVideoUrl(publicUrl);
      Alert.alert('Succès ! 🎉', `Média importé et hébergé avec succès sur le Drive de l'application.`);
    } catch (e: any) {
      console.error(e);
      setProgression(null);
      Alert.alert('Erreur de chargement', e.message || 'Impossible d\'uploader le fichier.');
    }
  };

  const choisirDepuisGalerie = (type: 'photo' | 'video') => {
    launchImageLibrary({ mediaType: type, quality: 0.8 }, (res) => {
      if (res.assets && res.assets[0]) {
        traiterMediaSelectionne(res.assets[0]);
      }
    });
  };

  const capturerViaCamera = (type: 'photo' | 'video') => {
    launchCamera(
      {
        mediaType: type,
        quality: 0.8,
        videoQuality: 'high',
        durationLimit: 30,
      },
      (res) => {
        if (res.assets && res.assets[0]) {
          traiterMediaSelectionne(res.assets[0]);
        }
      }
    );
  };

  const publier = async () => {
    if (!description.trim()) {
      return Alert.alert('Erreur', 'Veuillez saisir une description.');
    }

    if (mode === 'quiz') {
      if (!question.trim() || options.some((o) => !o.trim())) {
        return Alert.alert('Erreur', 'Veuillez remplir la question et les 4 options.');
      }
      if (indexCorrect === null) {
        return Alert.alert('Erreur', 'Sélectionnez la bonne réponse en cliquant sur son numéro.');
      }
    } else if (!videoUrl) {
      return Alert.alert('Erreur', 'Veuillez d\'abord capturer ou importer un média.');
    }

    setEnvoiEnCours(true);
    try {
      const tags = extraireHashtags(description);
      const defaultMedia = mediaType === 'photo' 
        ? 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=720&q=80' 
        : VIDEO_PAR_DEFAUT;

      const nouveauPost: any = {
        auteur: userEmail,
        description: description.trim(),
        videoUrl: videoUrl || defaultMedia,
        likes: 0,
        shares: 0,
        createdAt: Date.now(),
        mediaType: mediaType,
        hashtags: tags,
      };

      if (mode === 'quiz') {
        nouveauPost.quiz = {
          question: question.trim(),
          options: options.map((o) => o.trim()),
          reponseCorrecte: indexCorrect,
        };
      }

      await push(ref(getDatabase(getApp()), '/posts'), nouveauPost);
      Alert.alert('Succès 🎉', 'Votre publication a été ajoutée au flux avec succès !');
      rafraichir();
    } catch (e) {
      console.error(e);
      Alert.alert('Erreur de synchronisation', 'Impossible de publier sur Firebase.');
    } finally {
      setEnvoiEnCours(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView style={styles.conteneur} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.titrePage}>{mode === 'quiz' ? 'Créer un Quiz 🧠' : 'Partager un Média 🎬'}</Text>
        <Text style={styles.sousTitre}>
          {mode === 'quiz'
            ? 'Publiez une question pédagogique accompagnée d\'une illustration ou d\'une vidéo explicative.'
            : 'Partagez une photo ou une vidéo inspirante avec la communauté étudiante.'}
        </Text>

        {/* Sélecteur de mode */}
        <View style={styles.selecteurMode}>
          <TouchableOpacity
            onPress={() => { setMode('quiz'); rafraichir(); }}
            style={[styles.boutonMode, mode === 'quiz' && styles.boutonModeActif]}
          >
            <Text style={[styles.texteMode, mode === 'quiz' && styles.texteModeActif]}>Mode Quiz</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setMode('media'); rafraichir(); }}
            style={[styles.boutonMode, mode === 'media' && styles.boutonModeActif]}
          >
            <Text style={[styles.texteMode, mode === 'media' && styles.texteModeActif]}>Média Simple</Text>
          </TouchableOpacity>
        </View>

        {/* Section Médias */}
        <View style={styles.sectionMedia}>
          <Text style={styles.label}>1. Choisir ou capturer un média</Text>
          
          <View style={styles.grilleBoutons}>
            <TouchableOpacity style={styles.btnMediaAction} onPress={() => choisirDepuisGalerie('photo')}>
              <Text style={styles.emojiBouton}>🖼️</Text>
              <Text style={styles.texteBtnMedia}>Galerie Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnMediaAction} onPress={() => choisirDepuisGalerie('video')}>
              <Text style={styles.emojiBouton}>🎥</Text>
              <Text style={styles.texteBtnMedia}>Galerie Vidéo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnMediaAction} onPress={() => capturerViaCamera('photo')}>
              <Text style={styles.emojiBouton}>📸</Text>
              <Text style={styles.texteBtnMedia}>Prendre Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnMediaAction} onPress={() => capturerViaCamera('video')}>
              <Text style={styles.emojiBouton}>📹</Text>
              <Text style={styles.texteBtnMedia}>Filmer Vidéo</Text>
            </TouchableOpacity>
          </View>

          {progression !== null && (
            <View style={styles.carteUpload}>
              <Text style={styles.texteUpload}>
                {progression < 1 ? `Téléversement sur Drive... ${Math.round(progression * 100)}%` : 'Téléchargement terminé ! ✅'}
              </Text>
              <View style={styles.barreFond}>
                <View style={[styles.barreRemplissage, { width: `${Math.round(progression * 100)}%` }]} />
              </View>
            </View>
          )}

          {videoUrl ? (
            <View style={styles.badgeSucces}>
              <Text style={styles.badgeSuccesTexte}>
                Média lié ({mediaType === 'photo' ? 'Photo' : 'Vidéo'}) : Prêt à publier !
              </Text>
              <TouchableOpacity onPress={() => { setVideoUrl(''); setProgression(null); }} style={styles.btnSupprMedia}>
                <Text style={styles.btnSupprMediaTexte}>Changer</Text>
              </TouchableOpacity>
            </View>
          ) : mode === 'quiz' ? (
            <Text style={styles.infoMédiaDefaut}>💡 Sans média chargé, la vidéo par défaut de l'université sera utilisée.</Text>
          ) : null}
        </View>

        {/* Section Métadonnées */}
        <Text style={styles.label}>2. Description et Hashtags</Text>
        <TextInput
          style={styles.champSaisie}
          placeholder="Écrivez votre description et ajoutez des tags... Ex: Révision d'algèbre pour le contrôle #maths #algebre"
          placeholderTextColor="#555"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
        />

        {/* Formulaire spécifique au Quiz */}
        {mode === 'quiz' && (
          <View style={styles.zoneFormQuiz}>
            <Text style={styles.label}>3. Contenu du Quiz</Text>
            
            <TextInput
              style={styles.champSaisie}
              placeholder="Votre Question (ex: Quelle est la dérivée de ln(x) ?)"
              placeholderTextColor="#555"
              value={question}
              onChangeText={setQuestion}
            />

            <Text style={styles.labelSousSection}>Options de réponse (Cochez le numéro de la réponse correcte)</Text>
            {options.map((valeur, idx) => (
              <View key={idx} style={styles.ligneOption}>
                <TouchableOpacity
                  style={[styles.indicateurCorrection, indexCorrect === idx && styles.indicateurCorrectionActif]}
                  onPress={() => setIndexCorrect(idx)}
                >
                  <Text style={[styles.texteIndicateur, indexCorrect === idx && { color: '#fff' }]}>{idx + 1}</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.inputOption}
                  placeholder={`Option de réponse ${idx + 1}`}
                  placeholderTextColor="#555"
                  value={valeur}
                  onChangeText={(t) => majOption(idx, t)}
                />
              </View>
            ))}
          </View>
        )}

        {/* Bouton de Publication */}
        <TouchableOpacity style={styles.boutonPublier} onPress={publier} disabled={envoiEnCours}>
          {envoiEnCours ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.texteBoutonPublier}>Publier sur le Flux</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 20,
  },
  titrePage: {
    color: '#fff',
    fontSize: 26,
    fontWeight: 'bold',
    marginTop: 25,
    marginBottom: 6,
  },
  sousTitre: {
    color: '#888',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 25,
  },
  selecteurMode: {
    flexDirection: 'row',
    backgroundColor: '#161616',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#262626',
  },
  boutonMode: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  boutonModeActif: {
    backgroundColor: '#fe2c55',
  },
  texteMode: {
    color: '#888',
    fontWeight: 'bold',
    fontSize: 14,
  },
  texteModeActif: {
    color: '#fff',
  },
  sectionMedia: {
    marginBottom: 20,
  },
  label: {
    color: '#fe2c55',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 12,
    marginTop: 10,
  },
  labelSousSection: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 10,
    fontWeight: '600',
  },
  grilleBoutons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
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
  emojiBouton: {
    fontSize: 24,
    marginBottom: 6,
  },
  texteBtnMedia: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  carteUpload: {
    backgroundColor: '#161616',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#262626',
  },
  texteUpload: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  barreFond: {
    height: 6,
    backgroundColor: '#262626',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barreRemplissage: {
    height: 6,
    backgroundColor: '#2ecc71',
  },
  badgeSucces: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(46, 204, 113, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 113, 0.3)',
    borderRadius: 12,
    padding: 12,
  },
  badgeSuccesTexte: {
    color: '#2ecc71',
    fontWeight: 'bold',
    fontSize: 13,
  },
  btnSupprMedia: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnSupprMediaTexte: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  infoMédiaDefaut: {
    color: '#777',
    fontSize: 12,
    fontStyle: 'italic',
  },
  champSaisie: {
    backgroundColor: '#161616',
    color: '#fff',
    borderRadius: 12,
    padding: 15,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#262626',
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  zoneFormQuiz: {
    marginTop: 10,
  },
  ligneOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
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
  indicateurCorrectionActif: {
    backgroundColor: '#2ecc71',
    borderColor: '#2ecc71',
  },
  texteIndicateur: {
    color: '#888',
    fontWeight: 'bold',
    fontSize: 14,
  },
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
  boutonPublier: {
    backgroundColor: '#fe2c55',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#fe2c55',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  texteBoutonPublier: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
