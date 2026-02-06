
import React, { useState, useRef, useEffect } from 'react';
import { VoiceOption } from '../types';
import { generateSpeech } from '../services/geminiService';

interface VoiceSelectorProps {
  voices: VoiceOption[];
  selected: VoiceOption;
  onSelect: (voice: VoiceOption) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
}

const VoiceSelector: React.FC<VoiceSelectorProps> = ({ voices, selected, onSelect, speed, onSpeedChange }) => {
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const audioCacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    return () => {
      stopPreview();
      audioCacheRef.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  // Clear cache if speed changes as it's baked into the audio
  useEffect(() => {
    audioCacheRef.current.forEach(url => URL.revokeObjectURL(url));
    audioCacheRef.current.clear();
  }, [speed]);

  const stopPreview = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setLoadingVoiceId(null);
  };

  const playVoicePreview = async (voice: VoiceOption) => {
    const cacheKey = `${voice.id}_${speed}`;
    let url = audioCacheRef.current.get(cacheKey);

    setLoadingVoiceId(voice.id);
    try {
      if (!url) {
        const audioBlob = await generateSpeech(voice.previewText, voice.id, speed);
        url = URL.createObjectURL(audioBlob);
        audioCacheRef.current.set(cacheKey, url);
      }

      const audio = new Audio(url);
      previewAudioRef.current = audio;
      audio.onended = () => setLoadingVoiceId(null);
      audio.onerror = () => setLoadingVoiceId(null);
      await audio.play();
    } catch (err) {
      console.error("Preview failed", err);
      setLoadingVoiceId(null);
    }
  };

  const handleMouseEnter = (voice: VoiceOption) => {
    hoverTimeoutRef.current = window.setTimeout(() => {
      playVoicePreview(voice);
    }, 450);
  };

  const handleManualPlay = (e: React.MouseEvent, voice: VoiceOption) => {
    e.stopPropagation();
    stopPreview();
    playVoicePreview(voice);
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-700/30">
        <div className="flex justify-between items-center mb-3">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <i className="fas fa-gauge-high text-indigo-400"></i>
            Speed Control
          </label>
          <span className="text-xs font-mono text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded">
            {speed.toFixed(1)}x
          </span>
        </div>
        <input 
          type="range" 
          min="0.5" 
          max="2.0" 
          step="0.1" 
          value={speed}
          onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-all"
        />
        <div className="flex justify-between mt-2 px-1">
          <span className="text-[9px] text-slate-600 uppercase font-bold">Slow</span>
          <span className="text-[9px] text-slate-600 uppercase font-bold">Normal</span>
          <span className="text-[9px] text-slate-600 uppercase font-bold">Fast</span>
        </div>
      </div>

      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar">
        {voices.map((voice) => (
          <button
            key={voice.id}
            onClick={() => onSelect(voice)}
            onMouseEnter={() => handleMouseEnter(voice)}
            onMouseLeave={stopPreview}
            className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-4 group relative overflow-hidden ${
              selected.id === voice.id
                ? 'bg-indigo-600/20 border-indigo-500 shadow-lg shadow-indigo-500/10'
                : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/60 hover:border-slate-600'
            }`}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 z-10 transition-transform group-hover:scale-110 ${
              selected.id === voice.id ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'
            }`}>
              <i className={`fas ${voice.gender === 'Female' ? 'fa-user-nurse' : 'fa-user-tie'}`}></i>
            </div>
            
            <div className="flex-1 min-w-0 z-10">
              <div className="flex justify-between items-center">
                <span className={`font-semibold truncate ${selected.id === voice.id ? 'text-white' : 'text-slate-300'}`}>
                  {voice.name}
                </span>
                <span className="text-[9px] uppercase tracking-tighter text-slate-500 font-bold bg-slate-900 px-1.5 py-0.5 rounded">
                  {voice.gender}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1 group-hover:text-slate-400">
                {voice.description}
              </p>
            </div>

            <button
              onClick={(e) => handleManualPlay(e, voice)}
              className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all z-10 ${
                loadingVoiceId === voice.id
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-700/50 text-slate-400 hover:bg-indigo-500 hover:text-white'
              }`}
            >
              {loadingVoiceId === voice.id ? (
                <i className="fas fa-spinner fa-spin text-xs"></i>
              ) : (
                <i className="fas fa-play text-[10px] ml-0.5"></i>
              )}
            </button>
          </button>
        ))}
      </div>
      
      <div className="flex items-center gap-2 px-1 text-[10px] text-slate-600">
        <i className="fas fa-info-circle text-indigo-500/50"></i>
        <span>Hover for a quick voice preview.</span>
      </div>
    </div>
  );
};

export default VoiceSelector;
