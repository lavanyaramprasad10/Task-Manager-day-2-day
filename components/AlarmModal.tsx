import React from 'react';
import { Task } from '../types';

interface AlarmModalProps {
  task: Task | null;
  onDismiss: () => void;
  onComplete: () => void;
}

const AlarmModal: React.FC<AlarmModalProps> = ({ task, onDismiss, onComplete }) => {
  if (!task) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-primary/90 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-surface-dark w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden p-8 flex flex-col items-center text-center animate-bounce-slight border-4 border-white/20">
        
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
            <span className="material-symbols-outlined text-primary text-5xl">alarm_on</span>
        </div>

        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Reminder!</h2>
        <p className="text-slate-500 dark:text-slate-400 text-lg mb-8">It is time for:</p>
        
        <div className="bg-slate-50 dark:bg-background-dark w-full p-4 rounded-xl border border-gray-100 dark:border-gray-700 mb-8">
            <p className="text-xl font-bold text-slate-900 dark:text-white break-words">{task.title}</p>
            {task.location && (
                <p className="text-sm text-slate-500 mt-2 flex items-center justify-center gap-1">
                    <span className="material-symbols-outlined text-sm">location_on</span>
                    {task.location}
                </p>
            )}
        </div>

        <div className="flex flex-col w-full gap-3">
            <button 
                onClick={onComplete}
                className="w-full py-3.5 bg-primary text-white font-bold text-lg rounded-xl shadow-lg shadow-primary/30 hover:brightness-110 hover:scale-105 transition-all"
            >
                Complete Task
            </button>
            <button 
                onClick={onDismiss}
                className="w-full py-3.5 text-slate-500 font-medium hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
            >
                Dismiss
            </button>
        </div>
      </div>
    </div>
  );
};

export default AlarmModal;