// Pet Type for the PETS feature
export interface Pet {
  id: string;
  homeId: string;
  name: string;
  type: PetType;
  personality: string;
  mood: PetMood;
  energy: number; // 0-100
  lastInteraction: Date;
  lastFed: Date;
  lastCleaned: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  imageUrl?: string;
}

export type PetType = 'dog' | 'cat' | 'bird' | 'rabbit' | 'fish' | 'hamster' | 'turtle';

export type PetMood = 'happy' | 'content' | 'neutral' | 'sad' | 'angry';

export interface PetInteraction {
  id: string;
  petId: string;
  userId: string;
  type: PetInteractionType;
  timestamp: Date;
  message?: string;
  response?: string;
}

export type PetInteractionType = 'feed' | 'clean' | 'play' | 'talk' | 'pet';
