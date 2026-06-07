export interface QuizQuestion {
  question: string;
  options: string[];
  reponseCorrecte: number;
}

export interface CommentairePost {
  auteur: string;
  texte: string;
  createdAt: number;
}

export interface PostTikTok {
  id: string;
  videoUrl: string;
  auteur: string;
  description: string;
  quiz?: QuizQuestion;
  likes?: number;
  shares?: number;
  mediaType?: 'photo' | 'video';
  createdAt?: number;
  hashtags?: string[];
  comments?: Record<string, CommentairePost>;
  likedBy?: Record<string, boolean>;
  correctAnswers?: Record<string, { displayName: string; email: string }>;
  typePublication?: 'media' | 'quiz_seul' | 'media_quiz';
  quizApresVideo?: boolean;
}
