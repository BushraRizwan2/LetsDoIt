
import React, { useState, useRef, useEffect } from 'react';
import { createAssistantChat } from '../services/geminiService';
import { showToast } from '../utils/toast';
import { GenerateContentResponse, GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

interface Message {
  role: 'user' | 'model';
  text: string;
  sources?: { web: { uri: string; title: string } }[];
  isLive?: boolean;
}

// Defining the missing ScriptAssistantProps interface
interface ScriptAssistantProps {
  onApplyScript: (text: string) => void;
  currentScript: string;
}

// Audio Utils for Live API
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const ScriptAssistant: React.FC<ScriptAssistantProps> = ({ onApplyScript, currentScript }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const chatRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Live API Refs
  const liveSessionRef = useRef<any>(null);
  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    chatRef.current = createAssistantChat();
    setMessages([{ 
      role: 'model', 
      text: "Hello! I'm your Script Architect. I can help you research facts, analyze your current script's tone, or write a whole new story from scratch. I now also support Live Voice conversations! How can I help today?" 
    }]);

    return () => {
      stopLiveSession();
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response: GenerateContentResponse = await chatRef.current.sendMessage({ message: input });
      const modelText = response.text || "I'm sorry, I couldn't process that.";
      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks as any;

      setMessages(prev => [...prev, { 
        role: 'model', 
        text: modelText,
        sources: sources?.filter((c: any) => c.web).map((c: any) => c.web)
      }]);
    } catch (err: any) {
      console.error("Chat error:", err);
      showToast("Intelligence connection error. Please try again.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const startLiveSession = async () => {
    if (isConnecting || isLiveMode) return;
    setIsConnecting(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      audioContextInRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextOutRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

      let currentInputTranscription = '';
      let currentOutputTranscription = '';

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsLiveMode(true);
            setIsConnecting(false);
            showToast("Voice link established", "success");
            
            const source = audioContextInRef.current!.createMediaStreamSource(streamRef.current!);
            const scriptProcessor = audioContextInRef.current!.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextInRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.outputTranscription) {
              currentOutputTranscription += message.serverContent.outputTranscription.text;
            } else if (message.serverContent?.inputTranscription) {
              currentInputTranscription += message.serverContent.inputTranscription.text;
            }

            if (message.serverContent?.turnComplete) {
              if (currentInputTranscription || currentOutputTranscription) {
                setMessages(prev => [
                  ...prev,
                  { role: 'user', text: currentInputTranscription, isLive: true },
                  { role: 'model', text: currentOutputTranscription, isLive: true }
                ]);
              }
              currentInputTranscription = '';
              currentOutputTranscription = '';
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && audioContextOutRef.current) {
              const ctx = audioContextOutRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              
              source.onended = () => sourcesRef.current.delete(source);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => {
                try {
                  s.stop();
                } catch(e) {}
              });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            showToast("Voice link closed", "info");
            stopLiveSession();
          },
          onerror: (e) => {
            console.error("Live session error:", e);
            showToast("Voice session error occurred.", "error");
            stopLiveSession();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: 'You are an elite Script Architect. You are in a live voice conversation with a user. Keep your responses concise and natural for a voice conversation. Help them brainstorm and refine scripts.'
        },
      });

      liveSessionRef.current = await sessionPromise;
    } catch (err) {
      console.error("Failed to start live session:", err);
      showToast("Access denied: Microphone is required.", "error");
      setIsConnecting(false);
      stopLiveSession();
    }
  };

  const stopLiveSession = () => {
    if (liveSessionRef.current) {
      try {
        liveSessionRef.current.close();
      } catch (e) {}
      liveSessionRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    
    if (audioContextInRef.current) {
      if (audioContextInRef.current.state !== 'closed') {
        audioContextInRef.current.close().catch(console.error);
      }
      audioContextInRef.current = null;
    }
    
    if (audioContextOutRef.current) {
      if (audioContextOutRef.current.state !== 'closed') {
        audioContextOutRef.current.close().catch(console.error);
      }
      audioContextOutRef.current = null;
    }
    
    setIsLiveMode(false);
    setIsConnecting(false);
  };

  const analyzeCurrent = () => {
    if (!currentScript.trim()) {
      showToast("Input Empty: No script found in editor to analyze.", "error");
      return;
    }
    setInput(`Analyze this script for tone, pacing, and emotional impact: "${currentScript.slice(0, 1000)}..."`);
  };

  return (
    <div className="flex flex-col h-[600px] bg-slate-900/30 rounded-3xl overflow-hidden border border-slate-700/50 relative">
      <div className="p-4 bg-slate-800/50 border-b border-slate-700/50 flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isLiveMode ? 'bg-rose-500 animate-pulse' : 'bg-indigo-500'}`}>
            <i className={`fas ${isLiveMode ? 'fa-microphone' : 'fa-brain'} text-white text-xs`}></i>
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              {isLiveMode ? 'Live Architect' : 'Script Architect'}
            </h3>
            <p className={`text-[9px] font-bold uppercase ${isLiveMode ? 'text-rose-400' : 'text-emerald-400'}`}>
              {isLiveMode ? 'Voice Mode Active' : 'Pro Intelligence Active'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={isLiveMode ? stopLiveSession : startLiveSession}
            disabled={isConnecting}
            className={`text-[10px] px-4 py-1.5 rounded-lg border transition-all font-bold uppercase flex items-center gap-2 ${
              isLiveMode 
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500 hover:text-white' 
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-white'
            }`}
          >
            {isConnecting ? (
              <><i className="fas fa-spinner fa-spin"></i> Connecting</>
            ) : isLiveMode ? (
              <><i className="fas fa-phone-slash"></i> End Talk</>
            ) : (
              <><i className="fas fa-headset"></i> Talk to AI</>
            )}
          </button>
          <button 
            onClick={analyzeCurrent}
            className="text-[10px] bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 px-3 py-1.5 rounded-lg border border-indigo-500/20 transition-all font-bold uppercase"
          >
            Analyze Editor
          </button>
        </div>
      </div>

      {isLiveMode && (
        <div className="absolute inset-0 top-16 bg-slate-950/80 backdrop-blur-md z-20 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
          <div className="relative mb-8">
            <div className="w-32 h-32 rounded-full bg-indigo-500/20 flex items-center justify-center border-4 border-indigo-500/30">
               <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center animate-pulse shadow-[0_0_40px_rgba(79,70,229,0.5)]">
                 <i className="fas fa-microphone text-white text-2xl"></i>
               </div>
            </div>
            <div className="absolute inset-0 rounded-full border border-indigo-500 animate-[ping_2s_infinite] opacity-20"></div>
            <div className="absolute inset-0 rounded-full border border-indigo-500 animate-[ping_3s_infinite] opacity-10"></div>
          </div>
          <h4 className="text-xl font-black text-white mb-2">Architect is Listening</h4>
          <p className="text-slate-400 text-sm max-w-xs mx-auto mb-8">Speak naturally. I'll help you refine your script structure and flow in real-time.</p>
          <button 
            onClick={stopLiveSession}
            className="px-8 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-rose-600/20 transition-all"
          >
            Stop Voice Session
          </button>
        </div>
      )}

      <div ref={scrollRef} className={`flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar ${isLiveMode ? 'opacity-20 pointer-events-none' : ''}`}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-600/10' 
                : 'bg-slate-800/80 text-slate-200 rounded-tl-none border border-slate-700/50 shadow-xl'
            }`}>
              {msg.isLive && (
                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-indigo-400 mb-1 tracking-tighter">
                  <i className="fas fa-headset"></i> Live Transcript
                </div>
              )}
              <div className="whitespace-pre-wrap">{msg.text}</div>
              
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase mb-2">Sources Found:</p>
                  <div className="flex flex-wrap gap-2">
                    {msg.sources.map((s, idx) => (
                      <a 
                        key={idx} 
                        href={s.uri} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[9px] bg-slate-900 px-2 py-1 rounded hover:text-indigo-400 transition-colors flex items-center gap-1 border border-slate-700"
                      >
                        <i className="fas fa-link"></i>
                        {s.title || 'Source'}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {msg.role === 'model' && msg.text.length > 20 && (
                <button
                  onClick={() => onApplyScript(msg.text)}
                  className="mt-4 w-full py-2 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-400 hover:text-white rounded-xl text-[10px] font-bold uppercase transition-all border border-indigo-500/20"
                >
                  <i className="fas fa-file-export mr-2"></i>
                  Apply to Studio Editor
                </button>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800/50 p-4 rounded-2xl rounded-tl-none border border-slate-700/50">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={`p-4 bg-slate-800/30 border-t border-slate-700/50 ${isLiveMode ? 'opacity-20 pointer-events-none' : ''}`}>
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask to research a topic or write a script..."
            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-all disabled:opacity-50"
          >
            <i className={`fas ${isLoading ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScriptAssistant;
