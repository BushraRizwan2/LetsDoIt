
import React, { useState, useRef, useEffect } from 'react';
import { VOICES, MAX_CHARS, VoiceOption, Generation } from './types';
import { generateSpeech } from './services/geminiService';
import { audioBlobToVideo } from './utils/audioUtils';
import { showToast, ToastEventDetail } from './utils/toast';
import VoiceSelector from './components/VoiceSelector';
import AudioPlayer from './components/AudioPlayer';
import GenerationHistory from './components/GenerationHistory';
import ScriptAssistant from './components/ScriptAssistant';
import VisualStudio from './components/VisualStudio';
import CinemaStudio from './components/CinemaStudio';
import JSZip from 'jszip';

const Toast: React.FC<{ toast: ToastEventDetail; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const config = {
    error: { icon: 'fa-triangle-exclamation', border: 'border-rose-500/30', bg: 'bg-rose-500/10', text: 'text-rose-400', glow: 'shadow-rose-500/20' },
    success: { icon: 'fa-circle-check', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', text: 'text-emerald-400', glow: 'shadow-emerald-500/20' },
    info: { icon: 'fa-circle-info', border: 'border-indigo-500/30', bg: 'bg-indigo-500/10', text: 'text-indigo-400', glow: 'shadow-indigo-500/20' }
  }[toast.type];

  return (
    <div className={`flex items-center gap-4 p-4 rounded-2xl border backdrop-blur-xl shadow-2xl animate-fade-in-up transition-all ${config.border} ${config.bg} ${config.glow}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${config.text} bg-black/20`}>
        <i className={`fas ${config.icon}`}></i>
      </div>
      <p className="text-sm font-bold text-white pr-8">{toast.message}</p>
      <button onClick={() => onDismiss(toast.id)} className="absolute top-2 right-3 text-white/20 hover:text-white transition-colors">
        <i className="fas fa-times text-[10px]"></i>
      </button>
    </div>
  );
};

const App: React.FC = () => {
  const [text, setText] = useState('');
  const [activeTab, setActiveTab] = useState<'editor' | 'assistant' | 'visual' | 'cinema'>('editor');
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption>(VOICES[0]);
  const [speechSpeed, setSpeechSpeed] = useState(1.0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });
  const [history, setHistory] = useState<Generation[]>([]);
  const [toasts, setToasts] = useState<ToastEventDetail[]>([]);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handleToast = (e: any) => {
      setToasts(prev => [...prev, e.detail]);
    };
    window.addEventListener('voxgem-toast', handleToast);
    return () => window.removeEventListener('voxgem-toast', handleToast);
  }, []);

  const handleGenerate = async () => {
    if (!text.trim()) {
      showToast("Validation Error: Please enter some text to generate audio.", "error");
      return;
    }
    
    setIsGenerating(true);

    try {
      const audioBlob = await generateSpeech(text, selectedVoice.id, speechSpeed);
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const newGeneration: Generation = {
        id: crypto.randomUUID(),
        text: text,
        voiceId: `${selectedVoice.id} (${speechSpeed}x)`,
        timestamp: Date.now(),
        audioUrl: audioUrl,
        blob: audioBlob,
      };

      setHistory(prev => [newGeneration, ...prev]);
      showToast("Audio synthesis successful!", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to generate speech. Please try again.", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportAll = async () => {
    if (history.length === 0) return;
    
    setIsExporting(true);
    setExportProgress({ current: 0, total: history.length });
    
    try {
      const zip = new JSZip();
      const folderWav = zip.folder("wav_audio");
      const folderMp4 = zip.folder("mp4_video");
      
      let manifest = "VoxGem AI Voiceover Export\nGenerated: " + new Date().toLocaleString() + "\n\n";
      
      for (let i = 0; i < history.length; i++) {
        const gen = history[i];
        const safeName = gen.voiceId.replace(/[^a-z0-9]/gi, '_');
        const baseFilename = `${i + 1}_${safeName}_${gen.id.slice(0, 8)}`;
        
        folderWav?.file(`${baseFilename}.wav`, gen.blob);
        
        const mp4Blob = await audioBlobToVideo(gen.blob, gen.text, gen.voiceId);
        const ext = mp4Blob.type.includes('mp4') ? 'mp4' : 'webm';
        folderMp4?.file(`${baseFilename}.${ext}`, mp4Blob);
        
        manifest += `[Item ${i+1}]\nVoice: ${gen.voiceId}\nDate: ${new Date(gen.timestamp).toLocaleString()}\nText: ${gen.text}\nFiles: ${baseFilename}.wav, ${baseFilename}.${ext}\n\n`;
        
        setExportProgress(prev => ({ ...prev, current: i + 1 }));
      }
      
      zip.file("manifest.txt", manifest);
      
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `voxgem-studio-export-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Studio bundle export completed.", "success");
    } catch (err) {
      showToast("Bulk export failed during video synthesis.", "error");
    } finally {
      setIsExporting(false);
      setExportProgress({ current: 0, total: 0 });
    }
  };

  const applyAssistantText = (assistantText: string) => {
    setText(assistantText.slice(0, MAX_CHARS));
    setActiveTab('editor');
    if (textareaRef.current) textareaRef.current.focus();
    showToast("Script applied to editor", "info");
  };

  const removeHistoryItem = (id: string) => {
    setHistory(prev => {
      const item = prev.find(i => i.id === id);
      if (item) URL.revokeObjectURL(item.audioUrl);
      return prev.filter(i => i.id !== id);
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 relative">
      {/* Global Toast Container */}
      <div className="fixed top-8 right-8 z-[200] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <Toast toast={t} onDismiss={(id) => setToasts(prev => prev.filter(x => x.id !== id))} />
          </div>
        ))}
      </div>

      <header className="w-full max-w-6xl mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-3 rounded-2xl shadow-xl shadow-indigo-600/20">
            <i className="fas fa-microphone-lines text-2xl text-white"></i>
          </div>
          <div>
            <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-br from-white via-indigo-200 to-indigo-400 tracking-tight">
              VoxGem Studio
            </h1>
            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-[0.2em]">Multimedia AI Suite</p>
          </div>
        </div>
        
        <div className="bg-slate-800/50 p-1 rounded-2xl border border-slate-700/50 flex flex-wrap gap-1 shadow-2xl justify-center">
          {[
            { id: 'editor', icon: 'fa-keyboard', label: 'Studio' },
            { id: 'assistant', icon: 'fa-sparkles', label: 'Assistant' },
            { id: 'visual', icon: 'fa-palette', label: 'Visuals' },
            { id: 'cinema', icon: 'fa-clapperboard', label: 'Cinema' }
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 md:px-6 py-2 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === tab.id 
                  ? 'bg-indigo-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <i className={`fas ${tab.icon}`}></i>
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          {activeTab === 'editor' && (
            <section className="glass rounded-[2rem] p-8 shadow-2xl relative overflow-hidden animate-fade-in">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 blur-[100px] -z-10"></div>
              
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <i className="fas fa-align-left text-indigo-500"></i>
                  <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest">Voiceover Input</h2>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setText('')}
                    className="text-[10px] font-bold text-slate-500 hover:text-rose-400 transition-colors uppercase"
                  >
                    Clear
                  </button>
                  <div className={`px-2 py-1 rounded text-[10px] font-mono font-bold ${text.length > MAX_CHARS * 0.9 ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-800 text-slate-500'}`}>
                    {text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
                  </div>
                </div>
              </div>
              
              <textarea
                ref={textareaRef}
                className="w-full h-80 bg-slate-900/50 border border-slate-700/50 rounded-2xl p-6 text-slate-100 placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none leading-relaxed"
                placeholder="Write your script or use the Script Assistant to brainstorm..."
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
              />

              <div className="mt-8 flex flex-col sm:flex-row gap-4 items-center">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !text.trim()}
                  className={`w-full sm:w-auto px-10 py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-3 shadow-xl ${
                    isGenerating || !text.trim()
                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                    : 'bg-gradient-to-br from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-indigo-600/20 active:scale-[0.98]'
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <i className="fas fa-circle-notch fa-spin"></i>
                      Synthesizing...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-microphone-lines"></i>
                      Generate Voiceover
                    </>
                  )}
                </button>
                <div className="text-left">
                  <p className="text-[11px] text-slate-500 font-medium leading-tight">Using Gemini 2.5 TTS</p>
                  <p className="text-[9px] text-slate-600 uppercase tracking-widest font-bold">Studio Mode Active</p>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'assistant' && (
            <ScriptAssistant onApplyScript={applyAssistantText} currentScript={text} />
          )}

          {activeTab === 'visual' && (
            <VisualStudio onApplyToEditor={applyAssistantText} />
          )}

          {activeTab === 'cinema' && (
            <CinemaStudio />
          )}

          {(activeTab === 'editor' || activeTab === 'assistant') && history.length > 0 && (
            <section className="glass rounded-[2rem] p-8 shadow-xl animate-fade-in-up">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-white flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                  Recent Capture
                </h2>
                <div className="flex items-center gap-3">
                  {isExporting && (
                    <div className="flex items-center gap-2 text-[10px] text-indigo-400 font-bold uppercase">
                      <i className="fas fa-video animate-pulse"></i>
                      Exporting {exportProgress.current}/{exportProgress.total}
                    </div>
                  )}
                  <button
                    onClick={handleExportAll}
                    disabled={isExporting}
                    className="group text-[10px] font-black text-indigo-400 hover:text-white transition-all flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-600 rounded-xl border border-indigo-500/20 disabled:opacity-50"
                  >
                    {isExporting ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-file-zipper"></i>}
                    BUNDLE ALL ({history.length})
                  </button>
                </div>
              </div>
              <AudioPlayer generation={history[0]} />
            </section>
          )}
        </div>

        <div className="lg:col-span-4 space-y-6">
          <section className="glass rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-600/10 blur-[60px] -z-10"></div>
            <h2 className="text-sm font-bold text-slate-300 mb-6 uppercase tracking-widest flex items-center gap-2">
              <i className="fas fa-sliders text-indigo-500"></i>
              Voice Engine
            </h2>
            <VoiceSelector 
              voices={VOICES} 
              selected={selectedVoice} 
              onSelect={setSelectedVoice}
              speed={speechSpeed}
              onSpeedChange={setSpeechSpeed}
            />
          </section>

          {history.length > 1 && (activeTab === 'editor') && (
            <section className="glass rounded-[2rem] p-6 shadow-xl animate-fade-in">
              <h2 className="text-sm font-bold text-slate-300 mb-6 uppercase tracking-widest flex items-center gap-2">
                <i className="fas fa-folder-open text-indigo-500"></i>
                History
              </h2>
              <GenerationHistory 
                history={history.slice(1)} 
                onRemove={removeHistoryItem} 
              />
            </section>
          )}

          {activeTab === 'cinema' && (
            <section className="glass rounded-[2rem] p-6 shadow-xl animate-fade-in bg-rose-900/10 border-rose-500/20">
              <h2 className="text-xs font-black text-rose-400 mb-4 uppercase tracking-widest">Veo Director's Key</h2>
              <p className="text-[10px] text-slate-400 leading-relaxed mb-4">
                Video generation requires a <strong>paid API key</strong> from a project with billing enabled.
              </p>
              <div className="flex flex-col gap-2">
                <a 
                  href="https://ai.google.dev/gemini-api/docs/billing" 
                  target="_blank" 
                  className="text-[9px] font-bold text-indigo-400 hover:text-white transition-colors flex items-center gap-2"
                >
                  <i className="fas fa-credit-card"></i> Billing Setup Guide
                </a>
              </div>
            </section>
          )}
        </div>
      </main>

      <footer className="mt-16 pb-10 text-slate-600 text-[11px] font-medium flex flex-col items-center gap-4">
        <div className="flex items-center gap-3 opacity-50">
          <div className="w-1 h-1 rounded-full bg-slate-700"></div>
          <p>VoxGem Multimedia Studio &copy; 2025</p>
          <div className="w-1 h-1 rounded-full bg-slate-700"></div>
        </div>
      </footer>
    </div>
  );
};

export default App;
