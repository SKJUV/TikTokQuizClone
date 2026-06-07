# Documentation technique — TikTok Quiz UY1

> État du projet, architecture, modèle de données, ce qui est **déjà fait**, et la
> **feuille de route** pour les membres du groupe.
> Dernière mise à jour : juin 2026.

---

## 1. Vue d'ensemble

Application mobile Android (React Native + TypeScript) de quiz pédagogiques au format
TikTok. Chaque publication est une vidéo plein écran avec, en surimpression, un quiz à
4 réponses. Backend 100 % **Firebase**.

| Élément | Valeur |
|---|---|
| Projet Firebase | `tiktok-f72e6` |
| Realtime Database | `https://tiktok-f72e6-default-rtdb.firebaseio.com` |
| Storage bucket | `tiktok-f72e6.firebasestorage.app` |
| Package Android | `com.tiktokquiz` |
| RN / React | 0.85 / 19 |

---

## 2. Architecture logicielle

```
App.tsx  ──(onAuthStateChanged)──┐
                                 │ non connecté → AuthScreen
                                 │ connecté     → MainContainer
                                 ▼
                          MainContainer  (3 onglets, état local)
                          ├── FeedScreen      (Accueil)
                          ├── CreateScreen    ( + )
                          └── ProfileScreen   (Profil)
```

- **Routage d'authentification** centralisé dans `App.tsx` via un écouteur global
  `onAuthStateChanged` (écran de chargement pendant la vérification du jeton).
- **Navigation** : pas de librairie externe ; `MainContainer` bascule entre 3 écrans
  via un simple état (`'accueil' | 'creer' | 'profil'`).
- **API Firebase modulaire (v10+)** partout : `getApp()`, `getAuth()`, `getDatabase()`,
  `getStorage()`.
- **Résilience** : `ErrorBoundary` autour du lecteur vidéo ; gestionnaire d'erreurs JS
  global dans `App.tsx` ; minuteur de secours dans le flux (voir §4).

---

## 3. Modèle de données (Realtime Database)

```jsonc
{
  "posts": {
    "<postId>": {
      "auteur": "etudiant@uy1.uninet.cm",
      "description": "Nouveau Quiz communautaire ! 🚀",
      "videoUrl": "https://.../video.mp4",
      "likes": 12,
      "shares": 0,
      "createdAt": 1717500000000,
      "likedBy": { "<uid>": true },          // un like par utilisateur
      "comments": {
        "<commentId>": { "auteur": "alice", "texte": "Top !", "createdAt": 0 }
      },
      "quiz": {                               // optionnel (absent pour un post "vidéo")
        "question": "Quel hook gère les effets de bord ?",
        "options": ["useState", "useEffect", "useMemo", "useRef"],
        "reponseCorrecte": 1                  // index de la bonne réponse (0-3)
      }
    }
  },
  "users": {
    "<uid>": { "score": 5 }                   // total de bonnes réponses
  }
}
```

- **`/posts`** : un nœud par publication. `quiz` est optionnel (les posts purement
  « vidéo » n'en ont pas).
- **`likedBy/<uid>`** : empêche le double-like et permet d'afficher l'état « liké ».
- **`/users/<uid>/score`** : score personnel, incrémenté à chaque première bonne réponse.

### Données de secours
`quiz.json` (à la racine) est chargé localement si la base est injoignable.
`firebase_import_posts.json` est un exemple importable dans la console pour amorcer
`/posts`.

---

## 4. Détail des écrans

### `AuthScreen.tsx`
- Connexion / inscription **email + mot de passe** (`signInWithEmailAndPassword`,
  `createUserWithEmailAndPassword`).
- **Connexion Google** via `@react-native-google-signin` + `signInWithCredential`.
- `GoogleSignin.configure({ webClientId })` lit `FIREBASE_WEB_CLIENT_ID` depuis `.env`.

### `MainContainer.tsx`
- Barre de navigation basse style TikTok (noir), bouton central `+`.
- 3 onglets fonctionnels : **Accueil**, **Créer**, **Profil**.

### `FeedScreen.tsx` (cœur de l'app)
- **Défilement vertical paginé** (`FlatList` + `pagingEnabled` + `snapToInterval`
  = hauteur écran).
- **Vidéo** : `react-native-video` avec `paused={index !== indexActuel}` → seule la
  vidéo visible est lue (économie CPU/RAM). Validation simple de l'URL (`urlValide`)
  + `ErrorBoundary` + repli vidéo par défaut.
- **Quiz** : carte « glassmorphism », bonne réponse en vert / mauvaise en rouge,
  formulaire gelé après le 1er clic (anti-triche).
- **Likes** : `runTransaction` sur `/posts/<id>` (met à jour `likes` + `likedBy/<uid>`
  de façon atomique → pas de race condition).
- **Commentaires** : modale temps réel (`onValue` sur `/posts/<id>/comments`, `push`
  pour envoyer).
- **Partage** : API native `Share`.
- **Score** : à la première bonne réponse d'un post, `runTransaction` incrémente
  `/users/<uid>/score`.
- **Résilience réseau** : minuteur de secours de 2,5 s — si Firebase ne répond pas,
  on injecte `quiz.json` (zéro écran blanc).

### `CreateScreen.tsx`
- Deux modes : **Quiz** (question + 4 options + sélection du corrigé par pastille) et
  **Vidéo**.
- **Upload vidéo in-app** : `react-native-image-picker` → upload vers **Firebase
  Storage** (`putFile`) avec **barre de progression**, puis l'URL de téléchargement est
  enregistrée dans le post. Possibilité aussi de coller une URL publique.
- Publication via `push` sur `/posts`, puis réinitialisation du formulaire.

### `ProfileScreen.tsx`
- Avatar (initiale), email, **score** (lecture temps réel de `/users/<uid>/score`).
- **Thème sombre/clair** persisté via `AsyncStorage`.
- **Déconnexion** (`signOut`).

---

## 5. Sécurité

Les règles sont versionnées dans le repo et déployables avec le CLI.

- **`database.rules.json`** : `/posts` lisible par tous, écriture authentifiée ;
  `likedBy/<uid>` modifiable uniquement par le propriétaire ; `/users/<uid>` privé.
- **`storage.rules`** : `/videos` lisible par tous, upload réservé aux utilisateurs
  authentifiés et limité à 50 Mo.
- **Secrets** : `.env` et `serviceAccountKey.json` sont git-ignorés. Le
  `FIREBASE_WEB_CLIENT_ID` n'est pas un secret sensible mais reste hors du code.

Déploiement :
```sh
firebase deploy --only database,storage
```

---

## 6. Ce qui est DÉJÀ fait ✅

| Domaine | État |
|---|---|
| Authentification email + Google | ✅ |
| Routage auth + écran de chargement | ✅ |
| Navigation 3 onglets | ✅ |
| Flux vertical paginé + lecture vidéo optimisée | ✅ |
| Moteur de quiz (validation, anti-triche) | ✅ |
| Likes atomiques (transaction + likedBy) | ✅ |
| Commentaires temps réel | ✅ |
| Partage natif | ✅ |
| Score persistant par utilisateur | ✅ |
| Création de quiz | ✅ |
| Upload vidéo → Firebase Storage (avec progression) | ✅ |
| Profil + thème + déconnexion | ✅ |
| Résilience réseau (mocks de secours) | ✅ |
| Règles de sécurité DB + Storage | ✅ |
| Config de déploiement (`firebase.json`, `.firebaserc`) | ✅ |
| TypeScript strict / lint / test smoke | ✅ |

---

## 7. Feuille de route — comment continuer (pour le groupe)

Tâches indépendantes, à se répartir. Chacune est isolée pour limiter les conflits git.

### Priorité haute
1. **Profil enrichi** — afficher les quiz publiés par l'utilisateur, son rang/classement
   (lire et agréger `/users`). *Fichier : `ProfileScreen.tsx`.*
2. **Classement (leaderboard)** — nouvel écran listant les meilleurs scores
   (`onValue` sur `/users`, tri décroissant). *Nouveau fichier `LeaderboardScreen.tsx`
   + onglet.*
3. **Compteur de commentaires & de partages** — afficher le nombre réel sous chaque
   icône (longueur de `comments`, incrément de `shares` au partage). *Fichier :
   `FeedScreen.tsx`.*

### Priorité moyenne
4. **Catégories / matières** — ajouter un champ `categorie` aux posts + filtrage du flux.
5. **Suppression / modération** — permettre à l'auteur de supprimer son post
   (`remove` + règle `.write` restreinte à l'auteur).
6. **Recherche** — barre de recherche par mot-clé sur les questions.
7. **Validation des emails institutionnels** (`@uy1.uninet.cm`) à l'inscription.

### Priorité basse / bonus
8. **Login GitHub réel** — ouverture du navigateur GitHub + redirection custom scheme + Firebase Auth via `signInWithCredential`.
9. **Tests** — ajouter des tests unitaires sur `normaliserPost`, `validerReponse`.
10. **Enregistrement vidéo in-app** (caméra) au lieu d'une sélection en galerie.

### Conventions de contribution
- Travaillez sur une **branche** par fonctionnalité (`feat/leaderboard`, etc.).
- Avant de pousser : `npx tsc --noEmit && npm run lint && npm test` doivent passer.
- Code en **TypeScript**, composants **natifs** uniquement (jamais de balises web),
  styles via `StyleSheet.create`, API Firebase **modulaire**.
- **Ne committez jamais** `.env` ni `serviceAccountKey.json`.

---

## 8. Scripts d'administration (`scripts/`)

Scripts Node (hors app) pour amorcer des vidéos via un **compte de service** :
- `upload_video_and_update_db.js` — upload vers Firebase Storage + mise à jour de l'URL.
- `upload_to_drive_and_update_db.js` — variante via Google Drive.

Nécessitent un `serviceAccountKey.json` (git-ignoré). Usage détaillé en en-tête de
chaque fichier.

---

## 9. Dépannage

| Symptôme | Piste |
|---|---|
| Login Google échoue | Vérifier `FIREBASE_WEB_CLIENT_ID` dans `.env` + SHA-1 ajouté dans Firebase |
| « Permission denied » DB | Règles non déployées → `firebase deploy --only database` |
| Upload vidéo échoue | Storage non activé dans la console / règles non déployées |
| Écran blanc au build | `google-services.json` manquant dans `android/app/` |
| Vidéo « indisponible » | URL non `http(s)` → le repli par défaut s'affiche |
```
