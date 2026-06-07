import { PostTikTok } from '../types';
import { DRIVE_MOCK_TOKEN } from '@env';

export const VIDEO_PAR_DEFAUT = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
export const PHOTO_PAR_DEFAUT =
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=720&q=80';

const quizLocal = require('../../quiz.json') as Record<string, Omit<PostTikTok, 'id'>>;

export const urlValide = (url?: string) => !!url && /^https?:\/\//i.test(url);

export const extraireIdDrive = (url?: string): string | null => {
  if (!url) return null;
  const matchFileD = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchFileD?.[1]) return matchFileD[1];
  const matchId = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchId?.[1]) return matchId[1];
  return null;
};

// Google Drive Link Converter — URLs compatibles lecteurs mobiles (ExoPlayer / Image)
export const convertirLienDrive = (url?: string): string => {
  if (!url) return '';
  const fileId = extraireIdDrive(url);
  if (fileId) {
    return `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
  }
  return url;
};

/** Liste de secours si la première URL échoue (Drive → formats alternatifs → média par défaut). */
export const resoudreUrlsMedia = (url: string | undefined, mediaType: 'photo' | 'video'): string[] => {
  const urls: string[] = [];
  const fileId = extraireIdDrive(url);

  if (fileId) {
    urls.push(`https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`);
    urls.push(`https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`);
    urls.push(`https://drive.google.com/uc?id=${fileId}&export=download`);
  } else if (urlValide(url)) {
    urls.push(url!);
  }

  if (mediaType === 'video') {
    urls.push(VIDEO_PAR_DEFAUT);
  } else {
    urls.push(PHOTO_PAR_DEFAUT);
  }

  return [...new Set(urls)];
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

          const publicUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
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
  mediaType: 'photo' | 'video';
  createdAt: number;
  hashtags: string[];
  correctAnswers: Record<string, { displayName: string; email: string }>;
  urlsMedia: string[];
};

export const normaliserPost = (id: string, post: any): PostNorm => {
  const source = post && typeof post === 'object' ? post : {};
  const rawUrl = source.videoUrl || '';
  const mediaType: 'photo' | 'video' = source.mediaType === 'photo' ? 'photo' : 'video';
  const urlsCandidates = resoudreUrlsMedia(rawUrl, mediaType);
  const description = source.description || 'Quiz communautaire';
  return {
    id: source.id ?? id,
    videoUrl: urlsCandidates[0] || (mediaType === 'photo' ? PHOTO_PAR_DEFAUT : VIDEO_PAR_DEFAUT),
    urlsMedia: urlsCandidates,
    auteur: source.auteur || 'Anonyme',
    description,
    quiz: source.quiz
      ? {
          question: source.quiz.question || 'Question indisponible',
          options:
            Array.isArray(source.quiz.options) && source.quiz.options.length >= 4
              ? source.quiz.options.slice(0, 4)
              : ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
          reponseCorrecte: typeof source.quiz.reponseCorrecte === 'number' ? source.quiz.reponseCorrecte : 0,
        }
      : undefined,
    likes: typeof source.likes === 'number' ? source.likes : 0,
    shares: typeof source.shares === 'number' ? source.shares : 0,
    likedBy: source.likedBy || {},
    comments: source.comments || undefined,
    mediaType: source.mediaType === 'photo' ? 'photo' : 'video',
    createdAt: typeof source.createdAt === 'number' ? source.createdAt : Date.now(),
    hashtags: Array.isArray(source.hashtags)
      ? source.hashtags.map((tag: string) => tag.toLowerCase())
      : extraireHashtags(description),
    correctAnswers: source.correctAnswers || {},
    typePublication: source.typePublication,
    quizApresVideo: source.quizApresVideo === true,
  };
};

export const postsLocaux = (): PostNorm[] =>
  Object.entries(quizLocal).map(([id, post]) => normaliserPost(id, post));

export default {
  VIDEO_PAR_DEFAUT,
  urlValide,
  convertirLienDrive,
  extraireIdDrive,
  resoudreUrlsMedia,
  extraireHashtags,
  uploaderVersDrive,
  normaliserPost,
  postsLocaux,
};
