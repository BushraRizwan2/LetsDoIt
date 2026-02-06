
import React, { useState, useEffect, useRef } from 'react';
import { generateImage, upscaleImage, ImageReferences } from '../services/geminiService';
import { ImageGeneration } from '../types';
import { showToast } from '../utils/toast';

interface VisualStudioProps {
  onApplyToEditor: (text: string) => void;
}

type RefItem = { type: 'image' | 'text', data: string };

const VisualStudio: React.FC<VisualStudioProps> = ({ onApplyToEditor }) => {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [images, setImages] = useState<ImageGeneration[]>([]);
  const [previewImage, setPreviewImage] = useState<ImageGeneration | null>(null);
  const [selectedImage, setSelectedImage] = useState<ImageGeneration | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // References State
  const [subjects, setSubjects] = useState<RefItem[]>([]);
  const [styleRef, setStyleRef] = useState<RefItem | null>(null);
  const [sceneRef, setSceneRef] = useState<RefItem | null>(null);
  const [mainImageRef, setMainImageRef] = useState<string | null>(null);
  const [isRefLoading, setIsRefLoading] = useState(false);

  // Modal State for text input
  const [textModal, setTextModal] = useState<{ type: 'subject' | 'style' | 'scene', index?: number } | null>(null);
  const [textInputValue, setTextInputValue] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const styleInputRef = useRef<HTMLInputElement>(null);
  const sceneInputRef = useRef<HTMLInputElement>(null);
  const mainInputRef = useRef<HTMLInputElement>(null);

  const aspectRatioPresets = [
    { label: '1:1', value: '1:1', icon: 'fa-square' },
    { label: '16:9', value: '16:9', icon: 'fa-tv' },
    { label: '9:16', value: '9:16', icon: 'fa-mobile-screen-button' },
    { label: '4:3', value: '4:3', icon: 'fa-desktop' },
  ];

  useEffect(() => {
    if (images.length > 0 && !selectedImage) {
      setSelectedImage(images[0]);
    }
  }, [images]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'subject' | 'style' | 'scene' | 'main') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsRefLoading(true);
    try {
      if (type === 'subject') {
        const newBase64s = await Promise.all(
          Array.from(files).slice(0, 5 - subjects.length).map(fileToBase64)
        );
        const newItems: RefItem[] = newBase64s.map(b => ({ type: 'image', data: b }));
        setSubjects(prev => [...prev, ...newItems].slice(0, 5));
      } else {
        const base64 = await fileToBase64(files[0]);
        const newItem: RefItem = { type: 'image', data: base64 };
        if (type === 'style') setStyleRef(newItem);
        if (type === 'scene') setSceneRef(newItem);
        if (type === 'main') setMainImageRef(base64);
      }
      showToast(`Visual asset added to ${type} buffer.`, "info");
    } catch (err) {
      showToast(`Failed to process ${type} image.`, "error");
    } finally {
      setIsRefLoading(false);
      e.target.value = '';
    }
  };

  const handleAddTextRef = () => {
    if (!textModal || !textInputValue.trim()) return;
    const newItem: RefItem = { type: 'text', data: textInputValue };
    if (textModal.type === 'subject') {
      setSubjects(prev => [...prev, newItem].slice(0, 5));
    } else if (textModal.type === 'style') {
      setStyleRef(newItem);
    } else if (textModal.type === 'scene') {
      setSceneRef(newItem);
    }
    setTextInputValue('');
    setTextModal(null);
    showToast("Semantic reference locked.", "info");
  };

  const handleGenerate = async () => {
    if (!prompt.trim() && !mainImageRef && subjects.length === 0 && !styleRef && !sceneRef) {
      showToast("Generation Blocked: Please provide a prompt or any reference.", "error");
      return;
    }
    setIsGenerating(true);
    try {
      const references: ImageReferences = {
        subjects: subjects,
        style: styleRef || undefined,
        scene: sceneRef || undefined,
        mainImage: mainImageRef || undefined,
      };
      const result = await generateImage(prompt, aspectRatio, references);
      const newImage: ImageGeneration = {
        id: crypto.randomUUID(),
        prompt: prompt || "Guided Asset Generation",
        url: result.url,
        base64: result.base64,
        timestamp: Date.now(),
        aspectRatio: aspectRatio,
      };
      setImages(prev => [newImage, ...prev]);
      setSelectedImage(newImage);
      showToast("Visual asset synthesized.", "success");
    } catch (err: any) {
      showToast(err.message || "Visual generation failed.", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpscale = async () => {
    if (!selectedImage || isUpscaling) return;
    setIsUpscaling(true);
    showToast("Initiating 2K Master Upscale...", "info");
    try {
      const result = await upscaleImage(selectedImage.base64, selectedImage.prompt);
      const upscaledImage: ImageGeneration = {
        id: crypto.randomUUID(),
        prompt: `[UPSCALED 2K] ${selectedImage.prompt}`,
        url: result.url,
        base64: result.base64,
        timestamp: Date.now(),
        aspectRatio: selectedImage.aspectRatio,
      };
      setImages(prev => [upscaledImage, ...prev]);
      setSelectedImage(upscaledImage);
      showToast("Upscaling successful. High-res version added.", "success");
    } catch (err: any) {
      showToast(err.message || "Upscaling failed.", "error");
    } finally {
      setIsUpscaling(false);
    }
  };

  const removeHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      if (selectedImage?.id === id) {
        setSelectedImage(filtered.length > 0 ? filtered[0] : null);
      }
      return filtered;
    });
  };

  const renderSlot = (item: RefItem | null, onRemove: () => void, onAddClick: () => void, type: 'subject' | 'style' | 'scene', label?: string) => {
    if (item) {
      return (
        <div className="relative aspect-square rounded-xl overflow-hidden border border-slate-800 bg-slate-900 group shadow-inner animate-fade-in">
          {item.type === 'image' ? (
            <img src={`data:image/png;base64,${item.data}`} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-indigo-900/40">
              <i className="fas fa-quote-left text-[10px] text-indigo-400 mb-1"></i>
              <span className="text-[7px] text-slate-100 font-medium line-clamp-3 leading-tight">{item.data}</span>
            </div>
          )}
          <button 
            onClick={onRemove}
            className="absolute inset-0 bg-rose-600/80 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs transition-opacity"
          >
            <i className="fas fa-times"></i>
          </button>
          {type === 'style' && (
            <div className="absolute top-1 right-1 pointer-events-none bg-indigo-500/80 w-3 h-3 rounded-full flex items-center justify-center">
               <i className="fas fa-lock text-[6px] text-white"></i>
            </div>
          )}
          {label && (
             <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm py-0.5 text-[6px] font-black text-white text-center uppercase tracking-widest pointer-events-none">
               {label}
             </div>
          )}
        </div>
      );
    }

    return (
      <div className="relative aspect-square rounded-xl border-2 border-dashed border-slate-800 bg-slate-800/20 group overflow-hidden transition-all hover:border-indigo-500/50">
        <div className="absolute inset-0 flex flex-col">
          <button 
            onClick={onAddClick}
            className="flex-1 hover:bg-indigo-500/10 flex flex-col items-center justify-center text-slate-600 hover:text-indigo-400 transition-all border-b border-slate-800/50"
          >
            <i className="fas fa-upload text-[8px] mb-0.5"></i>
            <span className="text-[6px] font-black uppercase">Img</span>
          </button>
          <button 
            onClick={() => setTextModal({ type })}
            className="flex-1 hover:bg-indigo-500/10 flex flex-col items-center justify-center text-slate-600 hover:text-indigo-400 transition-all"
          >
            <i className="fas fa-pen-nib text-[8px] mb-0.5"></i>
            <span className="text-[6px] font-black uppercase">Txt</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-[800px] bg-slate-950/20 rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden animate-fade-in relative">
      <aside className={`relative flex flex-col transition-all duration-300 ease-in-out border-r border-white/5 bg-slate-950/60 backdrop-blur-xl shrink-0 z-30 ${isSidebarOpen ? 'w-[320px]' : 'w-20'}`}>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="absolute -right-3 top-10 w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-indigo-500 transition-all z-40 border border-white/20">
          <i className={`fas ${isSidebarOpen ? 'fa-chevron-left' : 'fa-chevron-right'} text-[10px]`}></i>
        </button>
        <div className={`flex-1 flex flex-col overflow-y-auto custom-scrollbar p-6 transition-opacity duration-200 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-2 h-6 bg-indigo-500 rounded-full"></div>
            <h2 className="text-xs font-black text-slate-100 uppercase tracking-widest whitespace-nowrap">Asset Config</h2>
          </div>
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <i className="fas fa-user-group text-indigo-400 text-[10px]"></i>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Subjects ({subjects.length}/5)</label>
              </div>
              {subjects.length > 0 && (
                <button onClick={() => setSubjects([])} className="text-[9px] text-rose-500 hover:text-rose-400 font-bold uppercase transition-colors">Reset All</button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {subjects.map((sub, idx) => (
                <React.Fragment key={idx}>
                  {renderSlot(sub, () => setSubjects(prev => prev.filter((_, i) => i !== idx)), () => {}, 'subject', `Sub ${idx+1}`)}
                </React.Fragment>
              ))}
              {subjects.length < 5 && renderSlot(null, () => {}, () => fileInputRef.current?.click(), 'subject')}
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => handleUpload(e, 'subject')} />
            </div>
            <p className="mt-3 text-[8px] text-slate-600 font-medium">Add up to 5 semantic character references.</p>
          </div>
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <i className="fas fa-palette text-indigo-400 text-[10px]"></i>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Style Aesthetics</label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {renderSlot(styleRef, () => setStyleRef(null), () => styleInputRef.current?.click(), 'style', 'Style')}
              <input type="file" ref={styleInputRef} className="hidden" accept="image/*" onChange={(e) => handleUpload(e, 'style')} />
            </div>
          </div>
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <i className="fas fa-mountain-sun text-emerald-400 text-[10px]"></i>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Structural Base</label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {renderSlot(sceneRef, () => setSceneRef(null), () => sceneInputRef.current?.click(), 'scene', 'Scene')}
              <input type="file" ref={sceneInputRef} className="hidden" accept="image/*" onChange={(e) => handleUpload(e, 'scene')} />
            </div>
          </div>
          <div className="mt-auto pt-6 border-t border-white/5 space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {aspectRatioPresets.map((preset) => (
                <button key={preset.value} onClick={() => setAspectRatio(preset.value)} className={`flex flex-col items-center justify-center py-2.5 rounded-xl border transition-all ${aspectRatio === preset.value ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700'}`}>
                  <i className={`fas ${preset.icon} text-[10px] mb-1`}></i>
                  <span className="text-[8px] font-black">{preset.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        {!isSidebarOpen && (
          <div className="flex-1 flex flex-col items-center py-10 gap-10 animate-fade-in overflow-hidden relative">
             <div className="flex flex-col items-center gap-12 mt-12">
               <button onClick={() => setIsSidebarOpen(true)} className="relative group w-12 h-12 rounded-xl flex items-center justify-center transition-all bg-slate-900/40 hover:bg-indigo-600/20 border border-white/5">
                 <i className={`fas fa-user-group text-lg ${subjects.length > 0 ? 'text-indigo-400' : 'text-slate-600'}`}></i>
                 {subjects.length > 0 && <span className="absolute -top-1.5 -right-1.5 bg-indigo-600 text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center text-white border-2 border-slate-950">{subjects.length}</span>}
               </button>
               <button onClick={() => setIsSidebarOpen(true)} className="relative group w-12 h-12 rounded-xl flex items-center justify-center transition-all bg-slate-900/40 hover:bg-indigo-600/20 border border-white/5">
                 <i className={`fas fa-palette text-lg ${styleRef ? 'text-indigo-400' : 'text-slate-600'}`}></i>
                 {styleRef && <i className="fas fa-lock absolute -bottom-1 -right-1 text-[10px] text-indigo-400"></i>}
               </button>
               <button onClick={() => setIsSidebarOpen(true)} className="relative group w-12 h-12 rounded-xl flex items-center justify-center transition-all bg-slate-900/40 hover:bg-emerald-600/20 border border-white/5">
                 <i className={`fas fa-mountain-sun text-lg ${sceneRef ? 'text-emerald-400' : 'text-slate-600'}`}></i>
               </button>
             </div>
            <div className="mt-auto pb-6">
              <button onClick={() => setIsSidebarOpen(true)} className="group w-12 h-12 rounded-xl flex items-center justify-center transition-all bg-slate-900/40 hover:bg-slate-700 border border-white/5">
                <div className="flex flex-col items-center gap-1">
                  <i className="fas fa-vector-square text-slate-600 group-hover:text-slate-300"></i>
                  <span className="text-[7px] font-black text-slate-500 uppercase">{aspectRatio}</span>
                </div>
              </button>
            </div>
          </div>
        )}
      </aside>
      <main className="flex-1 flex flex-col relative bg-slate-900/10">
        <div className="flex-1 p-6 lg:p-10 flex flex-col overflow-hidden">
          <div className="flex-1 rounded-[2.5rem] bg-slate-950/40 border border-white/5 shadow-inner relative group overflow-hidden flex items-center justify-center">
            {selectedImage ? (
              <div className="w-full h-full p-4 flex flex-col animate-fade-in">
                <div className="flex-1 relative rounded-2xl overflow-hidden bg-slate-900/30 cursor-zoom-in" onClick={() => setPreviewImage(selectedImage)}>
                  <img src={selectedImage.url} alt="Generated Asset" className="w-full h-full object-contain mx-auto transition-transform duration-700 group-hover:scale-[1.01]" />
                  <div className="absolute top-6 right-6 flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <button onClick={(e) => { e.stopPropagation(); downloadImage(selectedImage); }} className="w-12 h-12 bg-slate-900/90 backdrop-blur-xl hover:bg-indigo-600 text-white rounded-2xl flex items-center justify-center transition-all border border-white/10 shadow-2xl"><i className="fas fa-download"></i></button>
                    <button onClick={(e) => { e.stopPropagation(); handleUpscale(); }} disabled={isUpscaling} className="w-12 h-12 bg-slate-900/90 backdrop-blur-xl hover:bg-emerald-600 text-white rounded-2xl flex items-center justify-center transition-all border border-white/10 shadow-2xl disabled:opacity-50"><i className={`fas ${isUpscaling ? 'fa-spinner fa-spin' : 'fa-arrow-up-right-dots'}`}></i></button>
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-between px-2">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(79,70,229,0.8)]"></span><span className="text-[10px] font-black text-white uppercase tracking-widest">Asset Rendered</span></div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{selectedImage.aspectRatio} Mode</span>
                  </div>
                  <button onClick={() => onApplyToEditor(selectedImage.prompt)} className="text-[10px] font-black text-indigo-400 hover:text-white uppercase tracking-widest transition-colors flex items-center gap-2"><i className="fas fa-file-export"></i> Use in Studio</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center px-12 animate-fade-in">
                <div className="w-24 h-24 bg-slate-900/50 rounded-full flex items-center justify-center mb-8 border border-white/5 shadow-2xl"><i className="fas fa-palette text-4xl text-indigo-500/20"></i></div>
                <h3 className="text-sm font-black text-slate-200 uppercase tracking-[0.4em] mb-3">Workspace Empty</h3>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed max-w-[280px]">Use the Sidebar to lock in character descriptions, styles, and structural references before generating.</p>
              </div>
            )}
            {isGenerating && (
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex flex-col items-center justify-center gap-8">
                <div className="relative">
                  <div className="w-24 h-24 border-[3px] border-indigo-500/10 rounded-full"></div>
                  <div className="w-24 h-24 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin absolute top-0"></div>
                  <div className="absolute inset-0 flex items-center justify-center"><i className="fas fa-magic-wand-sparkles text-indigo-500 animate-pulse"></i></div>
                </div>
                <h4 className="text-xs font-black text-white uppercase tracking-[0.5em] mb-3">Synthesizing Asset</h4>
              </div>
            )}
          </div>
        </div>
        <div className="px-6 pb-6 lg:px-10 lg:pb-10 relative">
          <div className="relative group bg-slate-950/60 backdrop-blur-2xl rounded-[2rem] p-4 shadow-2xl border border-white/5 flex items-end gap-4">
            <div className="shrink-0">
              <div onClick={() => mainInputRef.current?.click()} className={`w-20 h-20 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center overflow-hidden ${mainImageRef ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_10px_rgba(79,70,229,0.3)]' : 'border-slate-800 hover:border-indigo-500 bg-slate-900/50 text-slate-600 hover:text-indigo-400'}`}>
                {mainImageRef ? (
                  <div className="relative w-full h-full group">
                    <img src={`data:image/png;base64,${mainImageRef}`} className="w-full h-full object-cover" />
                    <button onClick={(e) => { e.stopPropagation(); setMainImageRef(null); }} className="absolute inset-0 bg-rose-600/80 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs transition-opacity"><i className="fas fa-times"></i></button>
                    <div className="absolute bottom-0 left-0 right-0 bg-indigo-600/80 text-[6px] font-black text-white text-center py-0.5 uppercase tracking-widest pointer-events-none">Foundation</div>
                  </div>
                ) : (
                  <>
                    <i className="fas fa-image text-lg mb-1 opacity-50"></i>
                    <span className="text-[7px] font-black uppercase text-center px-2">Image-to-Image</span>
                  </>
                )}
                <input type="file" ref={mainInputRef} className="hidden" accept="image/*" onChange={(e) => handleUpload(e, 'main')} />
              </div>
            </div>
            <div className="flex-1 relative">
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full h-20 bg-transparent border-none py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-0 transition-all resize-none text-sm leading-relaxed" placeholder="Final creative instructions for the composition..." onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }} />
            </div>
            <button onClick={handleGenerate} disabled={isGenerating} className={`px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-3 shadow-2xl ${isGenerating ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 active:scale-95'}`}>
              {isGenerating ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-sparkles"></i>}
              {isGenerating ? 'Rendering' : 'Generate'}
            </button>
          </div>
        </div>
        <div className="px-6 lg:px-10 pb-6">
          <div className="flex items-center justify-between mb-3 px-2">
            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Iteration Stream</h3>
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">{images.length} Generations</span>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
            {images.map((img) => (
              <div key={img.id} onClick={() => setSelectedImage(img)} className={`group relative h-20 aspect-video shrink-0 rounded-2xl overflow-hidden border-2 transition-all cursor-pointer ${selectedImage?.id === img.id ? 'border-indigo-500 scale-105 shadow-[0_0_20px_rgba(79,70,229,0.2)]' : 'border-slate-800/50 hover:border-slate-600 grayscale hover:grayscale-0'}`}>
                <img src={img.url} className="w-full h-full object-cover" />
                <button onClick={(e) => removeHistoryItem(img.id, e)} className="absolute top-1 right-1 w-6 h-6 bg-rose-600/90 text-white rounded-lg flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"><i className="fas fa-times"></i></button>
              </div>
            ))}
            {images.length === 0 && (
              <div className="flex-1 h-20 border-2 border-dashed border-slate-900/20 rounded-2xl flex items-center justify-center italic text-slate-800 text-[8px] uppercase font-bold tracking-[0.3em]">History Pipeline Clear</div>
            )}
          </div>
        </div>
      </main>
      {textModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-lg animate-fade-in">
          <div className="bg-slate-900 w-full max-w-md rounded-[2rem] border border-white/10 p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] mb-6 flex items-center gap-3"><i className="fas fa-pen-nib text-indigo-500"></i>Describe {textModal.type}</h3>
            <textarea autoFocus className="w-full h-32 bg-slate-800 border border-slate-700 rounded-xl p-4 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none text-sm mb-6" placeholder={`Enter detailed descriptive instructions for the ${textModal.type}...`} value={textInputValue} onChange={(e) => setTextInputValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddTextRef(); } }} />
            <div className="flex gap-3">
              <button onClick={() => { setTextModal(null); setTextInputValue(''); }} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Cancel</button>
              <button onClick={handleAddTextRef} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-600/20">Lock Reference</button>
            </div>
          </div>
        </div>
      )}
      {previewImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/95 backdrop-blur-3xl animate-fade-in" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-7xl w-full" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreviewImage(null)} className="absolute -top-14 right-0 w-12 h-12 bg-white/10 hover:bg-rose-600 text-white rounded-full flex items-center justify-center transition-all border border-white/10"><i className="fas fa-times text-xl"></i></button>
            <div className="bg-slate-900/40 rounded-[3rem] overflow-hidden shadow-[0_0_120px_rgba(79,70,229,0.15)] border border-white/5">
              <img src={previewImage.url} alt="Master View" className="w-full h-auto max-h-[75vh] object-contain mx-auto" />
              <div className="p-10 border-t border-white/5 bg-slate-950/80 backdrop-blur-2xl flex flex-col lg:flex-row justify-between items-center gap-10">
                <div className="flex-1">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-4">Prompt Strategy</span>
                  <p className="text-slate-100 text-base italic leading-relaxed font-light">"{previewImage.prompt}"</p>
                </div>
                <button onClick={() => downloadImage(previewImage)} className="bg-white text-slate-950 hover:bg-indigo-100 px-10 py-4 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all shadow-2xl"><i className="fas fa-download mr-3"></i> Export Master</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisualStudio;

function downloadImage(img: ImageGeneration) {
  const a = document.createElement('a');
  a.href = img.url;
  a.download = `voxgem-asset-${img.id.slice(0, 8)}.png`;
  a.click();
}
