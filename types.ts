
export interface VoiceOption {
  id: string;
  name: string;
  description: string;
  gender: 'Male' | 'Female' | 'Neutral';
  previewText: string;
}

export interface Generation {
  id: string;
  text: string;
  voiceId: string;
  timestamp: number;
  audioUrl: string;
  blob: Blob;
}

export interface ImageGeneration {
  id: string;
  prompt: string;
  url: string;
  timestamp: number;
  base64: string;
  aspectRatio: string;
}

export interface VideoGeneration {
  id: string;
  prompt: string;
  thumbnailUrl: string;
  videoUrl: string;
  timestamp: number;
  status: 'processing' | 'completed' | 'failed';
}

export const VOICES: VoiceOption[] = [
  { id: 'Kore', name: 'Kore', gender: 'Female', description: 'Clear, professional, and friendly.', previewText: 'Hello! I am Kore, ready to bring your words to life.' },
  { id: 'Puck', name: 'Puck', gender: 'Male', description: 'Energetic and expressive.', previewText: 'Hey there! Puck here. Let\'s make something exciting!' },
  { id: 'Charon', name: 'Charon', gender: 'Male', description: 'Deep, calm, and authoritative.', previewText: 'Welcome. I am Charon. My voice adds depth to your message.' },
  { id: 'Fenrir', name: 'Fenrir', gender: 'Male', description: 'Rough, gritty, and characterful.', previewText: 'The name\'s Fenrir. If you want grit, you\'ve come to the right place.' },
  { id: 'Zephyr', name: 'Zephyr', gender: 'Female', description: 'Soft, airy, and soothing.', previewText: 'Breathe in. I am Zephyr, here to provide a gentle touch.' },
];

export const MAX_CHARS = 5000;
