import React from 'react';
import { Task } from '../types';

interface TaskItemProps {
  task: Task;
  isOverdue?: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, isOverdue, onToggle, onDelete }) => {
  return (
    <div className={`group flex items-start gap-4 bg-surface-light dark:bg-surface-dark p-4 rounded-xl shadow-sm border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-all duration-700 ease-in-out ${task.isCompleted ? 'opacity-0 -translate-x-4 pointer-events-none' : 'opacity-100 translate-x-0'}`}>
      <div className="flex size-6 items-center justify-center shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={task.isCompleted}
          onChange={() => onToggle(task.id)}
          className="appearance-none h-6 w-6 rounded-full border-2 border-gray-300 dark:border-gray-600 bg-transparent text-primary checked:bg-primary checked:border-primary checked:bg-[image:--checkbox-tick-svg] focus:ring-0 focus:ring-offset-0 focus:outline-none transition-all cursor-pointer hover:scale-110"
          title="Mark as Done (Auto-delete)"
        />
      </div>

      <div className="flex flex-col justify-center flex-1 min-w-0">
        <p className={`text-slate-900 dark:text-white text-base font-medium leading-normal break-words transition-all duration-500 ${task.isCompleted ? 'line-through decoration-gray-500 text-gray-400' : ''}`}>
          {task.title}
        </p>
        
        {task.image && (
          <div className="mt-3 mb-1">
             <img src={task.image} className="rounded-lg w-full max-w-[200px] h-auto object-cover border border-gray-100 dark:border-gray-700 shadow-sm" alt="Task attachment" />
          </div>
        )}

        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {isOverdue && !task.isCompleted && (
            <>
              <span className="material-symbols-outlined text-red-500 text-[16px]">schedule</span>
              <p className="text-red-500 text-sm font-medium leading-normal truncate">Yesterday</p>
              <span className="text-gray-400 text-xs">•</span>
            </>
          )}

          {!isOverdue && task.time && (
            <p className="text-slate-500 dark:text-[#9dabb9] text-sm font-normal leading-normal truncate">
               {task.time} {task.location ? `• ${task.location}` : ''}
            </p>
          )}

          {isOverdue && task.time && (
             <p className="text-slate-500 dark:text-[#9dabb9] text-sm font-normal leading-normal truncate">
             {task.time} {task.location ? `• ${task.location}` : ''}
            </p>
          )}

          {task.priority === 'high' && !task.isCompleted && (
             <span className="text-slate-500 dark:text-slate-400 text-xs font-medium bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">High Priority</span>
          )}

          {task.tag && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${task.tag === 'Work' ? 'text-blue-500 bg-blue-500/10' : 'text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400'}`}>
              {task.tag}
            </span>
          )}
        </div>
      </div>

      <button 
        onClick={() => onDelete(task.id)}
        className="shrink-0 text-gray-400 hover:text-red-500 transition-colors p-2 -mr-2 opacity-0 group-hover:opacity-100"
        title="Delete Immediately"
      >
        <span className="material-symbols-outlined">delete</span>
      </button>
    </div>
  );
};

export default TaskItem;