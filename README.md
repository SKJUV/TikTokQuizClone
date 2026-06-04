# TikTok Quiz UY1 🧠

Application mobile **React Native** (Android) de quiz au format TikTok : un flux vertical
plein écran où chaque vidéo porte un quiz à 4 réponses. Les étudiants s'authentifient,
répondent aux quiz, gagnent des points, commentent, likent, et peuvent publier leurs
propres quiz ou vidéos. Backend **Firebase** (Auth + Realtime Database + Storage).

> Projet de TP — Architecture des Systèmes Mobiles, Université de Yaoundé I.
> Documentation technique complète : voir [`DOCUMENTATION.md`](./DOCUMENTATION.md).

---

## Stack technique

- **React Native 0.85 / React 19** + **TypeScript**
- **Firebase** : Auth (email + Google), Realtime Database, Storage
- `react-native-video`, `react-native-image-picker`, `react-native-svg`, `@react-native-async-storage/async-storage`

---

## Démarrage rapide

### 1. Prérequis
- Node.js >= 22.11
- Environnement React Native Android prêt (JDK 17, Android SDK, un émulateur ou un appareil).
  Voir [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment).

### 2. Installation
```sh
git clone <url-du-repo>
cd TikTokQuizClone
npm install
```

### 3. Configuration Firebase (indispensable)
1. **`android/app/google-services.json`** : doit être présent (fourni dans le repo, ou
   téléchargé depuis la console Firebase du projet `tiktok-f72e6`).
2. **`.env`** : copie le modèle et remplis-le.
   ```sh
   cp .env.example .env
   ```
   ```
   FIREBASE_WEB_CLIENT_ID=126002780914-xxxx.apps.googleusercontent.com
   ```
   Le `.env` est **ignoré par git** (secrets).

### 4. Lancer l'app
```sh
npm start          # démarre Metro
npm run android    # build + lance sur émulateur/appareil
```

### 5. Vérifications
```sh
npx tsc --noEmit   # types
npm test           # tests
npm run lint       # lint
```

---

## 👥 Pour les membres du groupe (onboarding)

Vous avez été ajoutés au **projet Firebase `tiktok-f72e6`**. Pour contribuer :

1. **Cloner + `npm install`** (étapes ci-dessus).
2. **Récupérer `google-services.json`** : Console Firebase → ⚙️ Paramètres du projet →
   *Vos applications* → Android `com.tiktokquiz` → télécharger, et le placer dans
   `android/app/`.
3. **Créer votre `.env`** à partir de `.env.example`.
4. **Connectez-vous au CLI Firebase** une seule fois :
   ```sh
   npm i -g firebase-tools
   firebase login
   ```
5. **Déployer les règles** (le projet par défaut est déjà défini dans `.firebaserc`) :
   ```sh
   firebase deploy --only database,storage
   ```

➡️ **Lisez [`DOCUMENTATION.md`](./DOCUMENTATION.md)** : il contient l'architecture complète,
le modèle de données, **tout ce qui a déjà été fait**, et la **feuille de route** pour
savoir quoi développer ensuite (qui prend quoi).

---

## Structure du projet

```
TikTokQuizClone/
├── App.tsx                     # Point d'entrée + routage auth
├── src/
│   ├── screens/
│   │   ├── AuthScreen.tsx       # Connexion / inscription (email + Google)
│   │   ├── MainContainer.tsx    # Navigation à 3 onglets (Accueil / + / Profil)
│   │   ├── FeedScreen.tsx       # Flux vertical + quiz + likes/commentaires/partage
│   │   ├── CreateScreen.tsx     # Création de quiz + upload vidéo (Storage)
│   │   └── ProfileScreen.tsx    # Profil + score + thème + déconnexion
│   ├── components/ErrorBoundary.tsx
│   └── types/                   # Types TS + déclaration @env
├── quiz.json                   # Données de secours (mode hors-ligne)
├── database.rules.json         # Règles de sécurité Realtime Database
├── storage.rules               # Règles de sécurité Storage
├── firebase.json / .firebaserc # Config de déploiement Firebase
└── scripts/                    # Scripts admin (seed vidéos via service account)
```
