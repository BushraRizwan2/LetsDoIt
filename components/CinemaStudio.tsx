
import React, { useState, useRef } from 'react';
import { generateVideo } from '../services/geminiService';
import { VideoGeneration } from '../types';
import { showToast } from '../utils/toast';

const CinemaStudio: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [imageContent, setImageContent] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [resolution, setResolution] = useState<'720p' | '1080p'>('1080p');
  const [isGenerating, setIsGenerating] = useState(false);
  const [videos, setVideos] = useState<VideoGeneration[]>([]);
  const [loadingStep, setLoadingStep] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadingMessages = [
    "Analyzing visual assets...",
    "Synthesizing motion frames...",
    "Interpolating temporal depth...",
    "Encoding cinematic high-res...",
    "Finalizing cinematic sequence..."
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      setImageContent(base64);
      showToast("Base frame loaded into buffer.", "info");
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!imageContent || isGenerating) {
      if (!imageContent) showToast("Cinematics Blocked: Source image frame is required.", "error");
      return;
    }
    
    setIsGenerating(true);
    setLoadingStep(0);
    showToast("Beginning Cinematic Synthesis (Long Polling)...", "info");

    const msgInterval = setInterval(() => {
      setLoadingStep(prev => (prev + 1) % loadingMessages.length);
    }, 15000);

    try {
      const videoUrl = await generateVideo(
        prompt || "Animate this scene with natural cinematic motion.",
        imageContent,
        aspectRatio,
        resolution
      );

      const newVideo: VideoGeneration = {
        id: crypto.randomUUID(),
        prompt: prompt,
        thumbnailUrl: `data:image/png;base64,${imageContent}`,
        videoUrl: videoUrl,
        timestamp: Date.now(),
        status: 'completed'
      };

      setVideos(prev => [newVideo, ...prev]);
      showToast("Cinematic rendering complete.", "success");
    } catch (err: any) {
      showToast(err.message || "Video generation failed.", "error");
    } finally {
      clearInterval(msgInterval);
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-[750px] bg-slate-950/20 rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden animate-fade-in relative">
      <div className="flex-1 flex flex-col md:flex-row">
        <div className="flex-1 p-6 lg:p-10 flex flex-col overflow-hidden bg-slate-900/10">
          <div className="flex-1 rounded-[2rem] bg-slate-950/40 border border-white/5 shadow-inner relative group overflow-hidden flex items-center justify-center">
            {videos.length > 0 ? (
              <div className="w-full h-full p-4 flex flex-col animate-fade-in">
                <video src={videos[0].videoUrl} className="w-full h-full object-contain rounded-2xl bg-black" controls autoPlay loop />
                <div className="mt-4 flex items-center justify-between px-2">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></span>
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">Cinematic Sequence Rendered</span>
                    </div>
                  </div>
                  <a href={videos[0].videoUrl} download={`voxgem-cinema-${videos[0].id.slice(0,8)}.mp4`} className="text-[10px] font-black text-indigo-400 hover:text-white uppercase tracking-widest transition-colors flex items-center gap-2">
                    <i className="fas fa-download"></i> Save Master
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center px-12 animate-fade-in">
                <div className="w-24 h-24 bg-slate-900/50 rounded-full flex items-center justify-center mb-8 border border-white/5 shadow-2xl"><i className="fas fa-film text-4xl text-rose-500/20"></i></div>
                <h3 className="text-sm font-black text-slate-200 uppercase tracking-[0.4em] mb-3">Cinematic Engine Ready</h3>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed max-w-[280px]">Upload a starting image below and describe the motion instructions to generate high-fidelity cinematic video.</p>
              </div>
            )}
            {isGenerating && (
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex flex-col items-center justify-center gap-8">
                <div className="relative">
                  <div className="w-32 h-32 border-[4px] border-rose-500/10 rounded-full"></div>
                  <div className="w-32 h-32 border-[4px] border-rose-500 border-t-transparent rounded-full animate-spin absolute top-0"></div>
                  <div className="absolute inset-0 flex items-center justify-center"><i className="fas fa-clapperboard text-rose-500 text-2xl animate-pulse"></i></div>
                </div>
                <div className="text-center">
                  <h4 className="text-xs font-black text-white uppercase tracking-[0.5em] mb-3">{loadingMessages[loadingStep]}</h4>
                  <p className="text-[9px] text-slate-500 uppercase font-bold tracking-[0.2em]">This may take 2-4 minutes. Do not close this tab.</p>
                </div>
              </div>
            )}
          </div>
        </div>
        <aside className="w-full md:w-80 border-l border-white/5 bg-slate-950/60 backdrop-blur-xl p-6 flex flex-col gap-6">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-2 h-6 bg-rose-500 rounded-full"></div>
              <h2 className="text-xs font-black text-slate-100 uppercase tracking-widest">Director Controls</h2>
            </div>
            <div className="mb-6">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-4">Starting Image</label>
              <div onClick={() => fileInputRef.current?.click()} className={`aspect-video rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center overflow-hidden ${imageContent ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 hover:border-indigo-500 bg-slate-900/50'}`}>
                {imageContent ? <img src={`data:image/png;base64,${imageContent}`} className="w-full h-full object-cover" /> : <><i className="fas fa-image text-lg mb-2 text-slate-700"></i><span className="text-[7px] font-black uppercase text-slate-500">Upload Base Frame</span></>}
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="space-y-2">
                <label className="text-[9px] font-bold text-slate-600 uppercase">Ratio</label>
                <div className="flex gap-1">{['16:9', '9:16'].map(r => <button key={r} onClick={() => setAspectRatio(r as any)} className={`flex-1 py-2 rounded-lg text-[8px] font-black transition-all ${aspectRatio === r ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-500'}`}>{r}</button>)}</div>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-bold text-slate-600 uppercase">Resolution</label>
                <div className="flex gap-1">{['720p', '1080p'].map(res => <button key={res} onClick={() => setResolution(res as any)} className={`flex-1 py-2 rounded-lg text-[8px] font-black transition-all ${resolution === res ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-500'}`}>{res}</button>)}</div>
              </div>
            </div>
          </div>
          <div className="flex-1 flex flex-col">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-4">Motion Instructions</label>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the cinematic motion (e.g., 'A dramatic zoom into the character's eyes as they glow red')..." className="flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl p-4 text-xs text-white placeholder-slate-700 focus:outline-none focus:border-rose-500/50 resize-none leading-relaxed" />
          </div>
          <button onClick={handleGenerate} disabled={isGenerating || !imageContent} className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-2xl ${isGenerating || !imageContent ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 active:scale-95'}`}>
            {isGenerating ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-play"></i>}
            {isGenerating ? 'Synthesizing...' : 'Generate Cinema'}
          </button>
        </aside>
      </div>
    </div>
  );
};

export default CinemaStudio;
