import { PostTikTok } from '../types';
import { DRIVE_MOCK_TOKEN } from '@env';

export const VIDEO_PAR_DEFAUT = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

const quizLocal = require('../../quiz.json') as Record<string, Omit<PostTikTok, 'id'>>;

export const urlValide = (url?: string) => !!url && /^https?:\/\//i.test(url);

// Google Drive Link Converter
export const convertirLienDrive = (url?: string): string => {
  if (!url) return '';
  const matchFileD = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchFileD && matchFileD[1]) {
    return `https://drive.google.com/uc?export=download&id=${matchFileD[1]}`;
  }
  const matchId = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchId && matchId[1]) {
    return `https://drive.google.com/uc?export=download&id=${matchId[1]}`;
  }
  return url;
};

// Hashtag extractor
export const extraireHashtags = (texte: string): string[] => {
  if (!texte) return [];
  const matches = texte.match(/#(\w+)/g);
  return matches ? matches.map((tag) => tag.toLowerCase()) : [];
};

// Upload to App Google Drive via API with progress tracking
export const uploaderVersDrive = async (
  fileUri: string,
  fileName: string,
  fileMimeType: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  const token = DRIVE_MOCK_TOKEN;
  if (!token || token === 'TON_TOKEN_OAUTH_GOOGLE') {
    throw new Error("Jeton Google Drive (DRIVE_MOCK_TOKEN) manquant ou non configuré dans .env");
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=media');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', fileMimeType);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(event.loaded / event.total);
        }
      };
    }

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          const fileId = response.id;
          if (!fileId) {
            reject(new Error("ID de fichier Google Drive manquant dans la réponse."));
            return;
          }

          // 2. Renommer le fichier
          const patchRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: fileName,
            }),
          });

          if (!patchRes.ok) {
            console.warn("Impossible de renommer le fichier sur Drive.");
          }

          // 3. Rendre le fichier lisible par tout le monde
          const permRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              role: 'reader',
              type: 'anyone',
            }),
          });

          if (!permRes.ok) {
            console.warn("Impossible de changer les permissions du fichier sur Drive.");
          }

          const publicUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
          resolve(publicUrl);
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new Error(`Erreur API Drive (${xhr.status}): ${xhr.responseText}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Erreur réseau lors du téléversement sur Google Drive."));
    };

    const fileObj = {
      uri: fileUri,
      type: fileMimeType,
      name: fileName,
    };
    xhr.send(fileObj as any);
  });
};

export type PostNorm = PostTikTok & {
  likedBy?: Record<string, boolean>;
  mediaType: 'photo' | 'video';
  createdAt: number;
  correctAnswers: Record<string, { displayName: string; email: string }>;
};

export const normaliserPost = (id: string, post: any): PostNorm => {
  const convertedUrl = convertirLienDrive(post.videoUrl);
  return {
    id: post.id ?? id,
    videoUrl: urlValide(convertedUrl) ? convertedUrl : VIDEO_PAR_DEFAUT,
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
    mediaType: post.mediaType === 'photo' ? 'photo' : 'video',
    createdAt: typeof post.createdAt === 'number' ? post.createdAt : Date.now(),
    correctAnswers: post.correctAnswers || {},
  };
};

export const postsLocaux = (): PostNorm[] =>
  Object.entries(quizLocal).map(([id, post]) => normaliserPost(id, post));

export default {
  VIDEO_PAR_DEFAUT,
  urlValide,
  convertirLienDrive,
  extraireHashtags,
  uploaderVersDrive,
  normaliserPost,
  postsLocaux,
};
