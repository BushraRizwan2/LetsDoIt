
import React, { useRef, useState, useEffect } from 'react';
import { Generation } from '../types';
import { audioBlobToVideo } from '../utils/audioUtils';

interface AudioPlayerProps {
  generation: Generation;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ generation }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isCopied, setIsCopied] = useState(false);
  const [isGeneratingMp4, setIsGeneratingMp4] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      setProgress((audio.currentTime / audio.duration) * 100 || 0);
    };

    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', handleEnded);
    
    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [generation.audioUrl]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleDownloadWav = () => {
    const a = document.createElement('a');
    a.href = generation.audioUrl;
    a.download = `voxgem-${generation.id.slice(0, 8)}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadMp4 = async () => {
    setIsGeneratingMp4(true);
    try {
      const mp4Blob = await audioBlobToVideo(generation.blob, generation.text, generation.voiceId);
      const url = URL.createObjectURL(mp4Blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = mp4Blob.type.includes('mp4') ? 'mp4' : 'webm';
      a.download = `voxgem-${generation.id.slice(0, 8)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("MP4 creation failed", err);
    } finally {
      setIsGeneratingMp4(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        const file = new File([generation.blob], `voxgem-${generation.id.slice(0, 8)}.wav`, { type: generation.blob.type });
        await navigator.share({
          files: [file],
          title: 'VoxGem AI Voiceover',
          text: generation.text,
        });
      } catch (err) {
        console.error('Share failed:', err);
      }
    } else {
      handleDownloadWav();
    }
  };

  const copyText = () => {
    navigator.clipboard.writeText(generation.text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900/40 rounded-2xl p-4 border border-slate-700/30">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={togglePlay}
            className="w-14 h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center transition-all shadow-lg active:scale-90 shrink-0"
          >
            <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-xl ${!isPlaying && 'ml-1'}`}></i>
          </button>
          
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start gap-2 mb-2">
              <div className="text-slate-400 text-xs italic line-clamp-1 flex-1">
                "{generation.text}"
              </div>
              <button 
                onClick={copyText}
                className="text-[10px] uppercase text-slate-500 hover:text-indigo-400 transition-colors font-bold"
              >
                {isCopied ? 'Copied!' : 'Copy Text'}
              </button>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 transition-all duration-100 ease-linear"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center px-1">
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <i className="fas fa-microphone-lines text-indigo-500/50"></i>
              {generation.voiceId}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <i className="fas fa-clock text-indigo-500/50"></i>
              {new Date(generation.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleShare}
              className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest"
            >
              <i className="fas fa-share-nodes"></i>
              Share
            </button>
            <div className="h-4 w-px bg-slate-800 self-center"></div>
            <button
              onClick={handleDownloadWav}
              className="flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest"
            >
              <i className="fas fa-file-audio"></i>
              WAV
            </button>
            <button
              onClick={handleDownloadMp4}
              disabled={isGeneratingMp4}
              className="flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest disabled:opacity-50"
            >
              {isGeneratingMp4 ? (
                <i className="fas fa-circle-notch fa-spin"></i>
              ) : (
                <i className="fas fa-file-video"></i>
              )}
              {isGeneratingMp4 ? '...' : 'MP4'}
            </button>
          </div>
        </div>
      </div>
      <audio ref={audioRef} src={generation.audioUrl} className="hidden" />
    </div>
  );
};

export default AudioPlayer;
