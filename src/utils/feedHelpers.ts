import { PostTikTok } from '../types';
import { DRIVE_MOCK_TOKEN } from '@env';

export const VIDEO_PAR_DEFAUT = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
export const PHOTO_PAR_DEFAUT =
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=720&q=80';

const quizLocal = require('../../quiz.json') as Record<string, Omit<PostTikTok, 'id'>>;

export const urlValide = (url?: string) => !!url && /^https?:\/\//i.test(url);

const EXTENSIONS_PHOTO = /\.(jpe?g|png|gif|webp|heic|heif|bmp)(\?|$)/i;
const EXTENSIONS_VIDEO = /\.(mp4|mov|avi|mkv|webm|3gp|m4v)(\?|$)/i;

/** Détecte photo vs vidéo à partir du MIME, nom de fichier et intention utilisateur. */
export const detecterTypeMedia = (
  mimeType?: string,
  fileName?: string,
  intention: 'photo' | 'video' = 'photo',
  duration?: number,
): 'photo' | 'video' => {
  const mime = (mimeType || '').toLowerCase();
  if (mime.startsWith('image/')) return 'photo';
  if (mime.startsWith('video/')) return 'video';

  const nom = (fileName || '').toLowerCase();
  if (EXTENSIONS_PHOTO.test(nom)) return 'photo';
  if (EXTENSIONS_VIDEO.test(nom)) return 'video';

  if (intention === 'photo') return 'photo';
  if (intention === 'video') return 'video';
  if (typeof duration === 'number' && duration > 0) return 'video';

  return intention;
};

/** Infère le type média d'un post Firebase (corrige les anciennes publications). */
export const infererMediaType = (source: {
  mediaType?: string;
  mimeType?: string;
  videoUrl?: string;
}): 'photo' | 'video' => {
  if (source.mediaType === 'photo' || source.mediaType === 'video') {
    return source.mediaType;
  }
  const mime = (source.mimeType || '').toLowerCase();
  if (mime.startsWith('image/')) return 'photo';
  if (mime.startsWith('video/')) return 'video';
  const url = source.videoUrl || '';
  if (EXTENSIONS_PHOTO.test(url)) return 'photo';
  if (EXTENSIONS_VIDEO.test(url)) return 'video';
  return 'video';
};

export const mimeTypeParDefaut = (mediaType: 'photo' | 'video'): string =>
  mediaType === 'photo' ? 'image/jpeg' : 'video/mp4';

export const urlsDrivePhoto = (fileId: string): string[] => [
  `https://drive.google.com/thumbnail?id=${fileId}&sz=w1920`,
  `https://drive.google.com/uc?export=view&id=${fileId}`,
  `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
  `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
];

export const urlsDriveVideo = (fileId: string): string[] => [
  `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
  `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
  `https://drive.google.com/uc?id=${fileId}&export=download`,
];

export const extraireIdDrive = (url?: string): string | null => {
  if (!url) return null;
  const matchFileD = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchFileD?.[1]) return matchFileD[1];
  const matchId = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchId?.[1]) return matchId[1];
  return null;
};

// Google Drive Link Converter — URL principale selon le type de média
export const convertirLienDrive = (url?: string, mediaType: 'photo' | 'video' = 'video'): string => {
  if (!url) return '';
  const fileId = extraireIdDrive(url);
  if (fileId) {
    return mediaType === 'photo'
      ? urlsDrivePhoto(fileId)[0]
      : urlsDriveVideo(fileId)[0];
  }
  return url;
};

/** Liste de secours si la première URL échoue (Drive → formats alternatifs → média par défaut). */
export const resoudreUrlsMedia = (url: string | undefined, mediaType: 'photo' | 'video'): string[] => {
  const urls: string[] = [];
  const fileId = extraireIdDrive(url);

  if (fileId) {
    urls.push(...(mediaType === 'photo' ? urlsDrivePhoto(fileId) : urlsDriveVideo(fileId)));
  } else if (urlValide(url)) {
    urls.push(url!);
  }

  urls.push(mediaType === 'photo' ? PHOTO_PAR_DEFAUT : VIDEO_PAR_DEFAUT);

  return [...new Set(urls)];
};

export type ResultatUploadDrive = {
  url: string;
  fileId: string;
  mediaType: 'photo' | 'video';
  mimeType: string;
};

const construireUrlPubliqueDrive = (fileId: string, mediaType: 'photo' | 'video'): string =>
  mediaType === 'photo'
    ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1920`
    : `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;

// Hashtag extractor
export const extraireHashtags = (texte: string): string[] => {
  if (!texte) return [];
  const matches = texte.match(/#(\w+)/g);
  return matches ? matches.map((tag) => tag.toLowerCase()) : [];
};

export const uploaderVersDrive = async (
  fileUri: string,
  fileName: string,
  fileMimeType: string,
  mediaType: 'photo' | 'video',
  onProgress?: (progress: number) => void
): Promise<ResultatUploadDrive> => {
  const token = DRIVE_MOCK_TOKEN;
  if (!token || token === 'TON_TOKEN_OAUTH_GOOGLE') {
    throw new Error("Jeton Google Drive (DRIVE_MOCK_TOKEN) manquant ou non configuré dans .env");
  }

  const mimeType = fileMimeType || mimeTypeParDefaut(mediaType);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=media');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', mimeType);

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
          const fileId = response.id as string | undefined;
          if (!fileId) {
            reject(new Error("ID de fichier Google Drive manquant dans la réponse."));
            return;
          }

          await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: fileName, mimeType }),
          });

          const permRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ role: 'reader', type: 'anyone' }),
          });

          if (!permRes.ok) {
            console.warn('Impossible de rendre le fichier public sur Drive.');
          }

          resolve({
            url: construireUrlPubliqueDrive(fileId, mediaType),
            fileId,
            mediaType,
            mimeType,
          });
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new Error(`Erreur API Drive (${xhr.status}): ${xhr.responseText}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Erreur réseau lors du téléversement sur Google Drive.'));
    };

    xhr.send({ uri: fileUri, type: mimeType, name: fileName } as any);
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
  const mediaType = infererMediaType(source);
  const driveFileId = source.driveFileId || extraireIdDrive(rawUrl) || undefined;
  const urlsCandidates = driveFileId
    ? resoudreUrlsMedia(`https://drive.google.com/uc?id=${driveFileId}`, mediaType)
    : resoudreUrlsMedia(rawUrl, mediaType);
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
    mediaType,
    mimeType: source.mimeType || mimeTypeParDefaut(mediaType),
    driveFileId,
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
  detecterTypeMedia,
  infererMediaType,
  mimeTypeParDefaut,
  urlsDrivePhoto,
  urlsDriveVideo,
  convertirLienDrive,
  extraireIdDrive,
  resoudreUrlsMedia,
  extraireHashtags,
  uploaderVersDrive,
  normaliserPost,
  postsLocaux,
};
