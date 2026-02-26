import React, { useState } from 'react';
import { SmartTaskResponse } from '../types';
import { parseTaskWithGemini } from '../services/geminiService';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (task: SmartTaskResponse) => void;
}

const AddTaskModal: React.FC<AddTaskModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleSmartAdd = async () => {
    if (!input.trim()) return;
    setIsProcessing(true);
    
    const smartTask = await parseTaskWithGemini(input);
    
    if (smartTask) {
      onAdd(smartTask);
    } else {
      onAdd({ title: input, priority: 'normal' });
    }
    
    setIsProcessing(false);
    setInput('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-surface-dark w-full max-w-md rounded-2xl shadow-xl overflow-hidden transform transition-all">
        <div className="p-6">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">New Task</h3>
          
          <div className="mb-4 relative">
            <textarea
              className="w-full bg-slate-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none transition-all"
              rows={3}
              placeholder="e.g. 'Meeting with Sarah at 2pm at Starbucks'"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isProcessing}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSmartAdd();
                }
              }}
              autoFocus
            />
          </div>
          
          <div className="flex justify-between items-center">
             <div className="text-xs text-slate-500 dark:text-slate-400">
               {process.env.API_KEY ? "✨ AI-Powered" : "Standard mode"}
             </div>
             
             <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={isProcessing}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSmartAdd}
                  disabled={isProcessing || !input.trim()}
                  className="px-6 py-2 bg-primary text-white font-medium rounded-lg shadow-lg shadow-primary/30 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isProcessing ? (
                     <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        Processing
                     </>
                  ) : (
                    "Add Task"
                  )}
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddTaskModal;