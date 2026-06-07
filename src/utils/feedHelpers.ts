import { PostTikTok } from '../types';
export const VIDEO_PAR_DEFAUT = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

const quizLocal = require('../../quiz.json') as Record<string, Omit<PostTikTok, 'id'>>;

export const urlValide = (url?: string) => !!url && /^https?:\/\//i.test(url);

export type PostNorm = PostTikTok & { likedBy?: Record<string, boolean> };

export const normaliserPost = (id: string, post: any): PostNorm => ({
  id: post.id ?? id,
  videoUrl: urlValide(post.videoUrl) ? post.videoUrl : VIDEO_PAR_DEFAUT,
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
});

export const postsLocaux = (): PostNorm[] => Object.entries(quizLocal).map(([id, post]) => normaliserPost(id, post));

export default {
  VIDEO_PAR_DEFAUT,
  urlValide,
  normaliserPost,
  postsLocaux,
};
