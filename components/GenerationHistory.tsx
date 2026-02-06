
import React from 'react';
import { Generation } from '../types';

interface GenerationHistoryProps {
  history: Generation[];
  onRemove: (id: string) => void;
}

const GenerationHistory: React.FC<GenerationHistoryProps> = ({ history, onRemove }) => {
  return (
    <div className="space-y-3">
      {history.map((item) => (
        <div 
          key={item.id} 
          className="group relative bg-slate-800/30 hover:bg-slate-800/50 rounded-xl p-3 border border-slate-700/30 transition-all flex items-center justify-between gap-3"
        >
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-slate-500 flex items-center gap-2 mb-1">
              <span className="bg-slate-900 px-1.5 py-0.5 rounded text-indigo-400">{item.voiceId}</span>
              <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="text-sm text-slate-300 truncate pr-4">
              {item.text}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const a = document.createElement('a');
                a.href = item.audioUrl;
                a.download = `voiceover-${item.id.slice(0, 4)}.wav`;
                a.click();
              }}
              className="w-8 h-8 rounded-lg bg-slate-700/50 hover:bg-slate-600 text-slate-400 hover:text-white flex items-center justify-center transition-all"
              title="Download"
            >
              <i className="fas fa-download text-xs"></i>
            </button>
            <button
              onClick={() => onRemove(item.id)}
              className="w-8 h-8 rounded-lg bg-rose-900/20 hover:bg-rose-900/40 text-rose-500/50 hover:text-rose-500 flex items-center justify-center transition-all"
              title="Delete"
            >
              <i className="fas fa-trash-can text-xs"></i>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default GenerationHistory;
