export interface PollOption {
  id: number;
  text: string;
  votes: number;
}

export interface Poll {
  id: number;
  question: string;
  description?: string | null;
  likes: number;
  created_at: string;
  options: PollOption[];
}
