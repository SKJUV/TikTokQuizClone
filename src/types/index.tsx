export interface QuizQuestion {
  question: string;
  options: string[];
  reponseCorrecte: number;
}

export interface PostTikTok {
  id: string;
  videoUrl: string;
  auteur: string;
  description: string;
  quiz?: QuizQuestion;
  likes?: number;
  shares?: number;
}
