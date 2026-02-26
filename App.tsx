import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Task, SmartTaskResponse } from './types';
import TaskItem from './components/TaskItem';
import AddTaskModal from './components/AddTaskModal';
import ImageEditorModal from './components/ImageEditorModal';
import AlarmModal from './components/AlarmModal';
import { parseTaskWithGemini } from './services/geminiService';

// Initial Mock Data - Empty by default
const INITIAL_TASKS: Task[] = [];

type VoiceStatus = 'off' | 'standby' | 'listening_command' | 'processing';

export default function App() {
  // Persistence
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('myday-tasks');
    if (saved) {
      try {
        const parsedTasks = JSON.parse(saved);
        return parsedTasks.filter((t: Task) => !t.isCompleted);
      } catch (e) {
        return INITIAL_TASKS;
      }
    }
    return INITIAL_TASKS;
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [activeAlarmTask, setActiveAlarmTask] = useState<Task | null>(null);
  
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'default'
  );
  
  // Voice State
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('off');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  
  // Refs
  const recognitionRef = useRef<any>(null);
  const isIntentionalStop = useRef(false);
  const silenceTimer = useRef<any>(null);
  const notifiedTaskIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
        localStorage.setItem('myday-tasks', JSON.stringify(tasks));
    } catch (error) {
        console.error("Failed to save tasks (likely storage quota exceeded):", error);
    }
  }, [tasks]);

  const todayStr = new Date().toISOString().split('T')[0];

  const overdueTasks = useMemo(() => {
    return tasks.filter(t => t.date < todayStr && !t.isCompleted);
  }, [tasks, todayStr]);

  const todayTasks = useMemo(() => {
    return tasks.filter(t => t.date === todayStr || (t.date < todayStr && t.isCompleted));
  }, [tasks, todayStr]);

  // --- Voice Logic ---
  
  const startListening = (mode: 'standby' | 'listening_command') => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (recognitionRef.current) {
        isIntentionalStop.current = true;
        recognitionRef.current.stop();
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = mode === 'standby'; // Continuous for wake word, single shot for command
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        isIntentionalStop.current = false;
        console.log(`Mic started: ${mode}`);
    };

    recognition.onerror = (event: any) => {
        console.warn("Speech error", event.error);
        if (event.error === 'not-allowed') setVoiceStatus('off');
    };

    recognition.onend = () => {
        if (!isIntentionalStop.current && voiceStatus === 'standby') {
            // Auto-restart if in standby mode (keep listening for wake word)
            try { recognition.start(); } catch (e) {}
        }
    };

    recognition.onresult = (event: any) => {
        const results = Array.from(event.results) as any[];
        const latestResult = results[results.length - 1];
        const transcript = latestResult[0].transcript.toLowerCase().trim();
        const isFinal = latestResult.isFinal;

        if (mode === 'standby') {
            // Wake Word Detection
            const wakeWords = ['hey task manager', 'hey task', 'task manager'];
            const foundWakeWord = wakeWords.find(w => transcript.includes(w));

            if (foundWakeWord) {
                isIntentionalStop.current = true;
                recognition.stop();

                // Check for immediate command (e.g. "hey task manager buy milk")
                const commandPart = transcript.split(foundWakeWord)[1]?.trim();
                
                if (commandPart && commandPart.length > 2) {
                    handleProcessCommand(commandPart);
                } else {
                    handleWakeWordDetected();
                }
            }
        } else if (mode === 'listening_command') {
            // Command Capture
            setVoiceTranscript(transcript);
            
            // Debounce silence to detect end of speech
            if (silenceTimer.current) clearTimeout(silenceTimer.current);
            silenceTimer.current = setTimeout(() => {
                if (transcript.length > 2) {
                    isIntentionalStop.current = true;
                    recognition.stop();
                    handleProcessCommand(transcript);
                }
            }, 2000); // 2 seconds of silence = command done

            if (isFinal && transcript.length > 2) {
                 if (silenceTimer.current) clearTimeout(silenceTimer.current);
                 isIntentionalStop.current = true;
                 recognition.stop();
                 handleProcessCommand(transcript);
            }
        }
    };

    recognitionRef.current = recognition;
    try {
        recognition.start();
    } catch (e) {
        console.error(e);
    }
  };

  const handleWakeWordDetected = () => {
    // Immediately start listening for command without speaking "Hello"
    setVoiceStatus('listening_command');
    startListening('listening_command');
  };

  const handleProcessCommand = async (text: string) => {
      setVoiceStatus('processing');
      
      const smartTask = await parseTaskWithGemini(text);
      const newTask: Task = {
        id: Date.now().toString(),
        title: smartTask?.title || text,
        date: todayStr,
        isCompleted: false,
        time: smartTask?.time,
        location: smartTask?.location,
        tag: smartTask?.tag,
        priority: smartTask?.priority
      };
      
      setTasks(prev => [...prev, newTask]);
      
      // Feedback
      const feedback = new SpeechSynthesisUtterance("Task added");
      feedback.onend = () => {
          setVoiceTranscript("");
          setVoiceStatus('standby');
          startListening('standby'); // Go back to waiting for "Hey Task Manager"
      };
      window.speechSynthesis.speak(feedback);
  };

  const toggleVoice = () => {
      if (voiceStatus === 'off') {
          setVoiceStatus('standby');
          startListening('standby');
      } else {
          setVoiceStatus('off');
          if (recognitionRef.current) {
              isIntentionalStop.current = true;
              recognitionRef.current.stop();
          }
          window.speechSynthesis.cancel();
      }
  };

  // Ensure cleanup on unmount
  useEffect(() => {
      return () => {
          if (recognitionRef.current) recognitionRef.current.stop();
          window.speechSynthesis.cancel();
      };
  }, []);


  // --- Notification Logic ---
  const sendNotification = (title: string, body: string) => {
    if (notificationPermission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert("This browser does not support notifications.");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') {
      const pendingCount = todayTasks.length + overdueTasks.length;
      sendNotification("Notifications Enabled", `We'll remind you of your ${pendingCount} pending tasks.`);
    }
  };

  // Check for time-based reminders
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      // "10:00 AM" format
      const timeString = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }); 
      
      todayTasks.forEach(task => {
        if (task.time && !task.isCompleted && !notifiedTaskIds.current.has(task.id)) {
            // Normalize spaces (some locales use narrow non-breaking space)
            const normalizedTaskTime = task.time.replace(/\s+/g, ' ').toUpperCase().trim();
            const normalizedCurrentTime = timeString.replace(/\s+/g, ' ').toUpperCase().trim();

            if (normalizedTaskTime === normalizedCurrentTime) {
                // 1. Mark as notified so we don't spam
                notifiedTaskIds.current.add(task.id);
                
                // 2. Browser Notification
                if (notificationPermission === 'granted') {
                    sendNotification(`It's time: ${task.title}`, `Scheduled for ${task.time} ${task.location ? `at ${task.location}` : ''}`);
                }

                // 3. In-App Alarm Modal
                setActiveAlarmTask(task);

                // 4. Voice Announcement
                const reminderSpeech = new SpeechSynthesisUtterance(`Reminder: It is time to ${task.title}`);
                window.speechSynthesis.speak(reminderSpeech);
            }
        }
      });
    };
    
    // Check every 5 seconds to ensure we don't miss the minute rollover
    const intervalId = setInterval(checkReminders, 5000); 
    return () => clearInterval(intervalId);
  }, [todayTasks, notificationPermission]);

  const toggleTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    if (!task.isCompleted) {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, isCompleted: true } : t));
      setTimeout(() => setTasks(prev => prev.filter(t => t.id !== id)), 700);
    } else {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, isCompleted: false } : t));
    }
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const handleAddTask = (smartData: SmartTaskResponse) => {
    const newTask: Task = {
      id: Date.now().toString(),
      title: smartData.title,
      date: todayStr,
      isCompleted: false,
      time: smartData.time,
      location: smartData.location,
      tag: smartData.tag,
      priority: smartData.priority
    };
    setTasks(prev => [...prev, newTask]);
  };

  const handleSaveImageTask = (image: string, text: string) => {
    const newTask: Task = {
      id: Date.now().toString(),
      title: text || "Image Task",
      date: todayStr,
      isCompleted: false,
      tag: "Image",
      image: image,
    };
    setTasks(prev => [...prev, newTask]);
    setIsImageModalOpen(false);
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(tasks, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `myday-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleAlarmComplete = () => {
    if (activeAlarmTask) {
        toggleTask(activeAlarmTask.id);
        setActiveAlarmTask(null);
    }
  };

  const headerDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <>
      {/* Top App Bar */}
      <header className="sticky top-0 z-20 w-full bg-white/70 dark:bg-background-dark/95 backdrop-blur-md pt-safe-top transition-colors duration-300 border-b border-transparent dark:border-white/5">
        <div className="flex items-center justify-between p-4 pb-2">
          <div className="flex flex-col">
            <h2 className="text-2xl md:text-3xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white">My Day</h2>
          </div>
          <div className="flex items-center gap-2">
             
             {/* Voice Assistant Toggle */}
             <button 
              onClick={toggleVoice}
              className={`flex items-center justify-center h-10 w-10 rounded-full transition-all ${voiceStatus !== 'off' ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30' : 'text-slate-400 hover:bg-black/5 dark:hover:bg-white/10'}`}
              title={voiceStatus !== 'off' ? "Voice Active" : "Enable Voice Control"}
            >
              <span className="material-symbols-outlined" style={{fontSize: '24px'}}>
                {voiceStatus !== 'off' ? 'mic' : 'mic_off'}
              </span>
            </button>

             {/* Notification Toggle */}
             <button 
              onClick={requestNotificationPermission}
              className={`flex items-center justify-center h-10 w-10 rounded-full transition-colors ${notificationPermission === 'granted' ? 'text-primary dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10' : 'text-slate-400 hover:bg-black/5 dark:hover:bg-white/10'}`}
              title={notificationPermission === 'granted' ? "Notifications Active" : "Enable Notifications"}
            >
              <span className="material-symbols-outlined" style={{fontSize: '24px'}}>
                {notificationPermission === 'granted' ? 'notifications_active' : 'notifications_off'}
              </span>
            </button>

            {/* Image Editor Button */}
            <button 
              onClick={() => setIsImageModalOpen(true)}
              className="flex items-center justify-center h-10 w-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-primary dark:text-blue-400"
              title="AI Image Studio"
            >
              <span className="material-symbols-outlined" style={{fontSize: '24px'}}>auto_fix_high</span>
            </button>
            
            {/* Export Data Button */}
            <button 
              onClick={handleExport}
              className="flex items-center justify-center h-10 w-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-700 dark:text-slate-200"
              title="Export Data"
            >
              <span className="material-symbols-outlined" style={{fontSize: '24px'}}>download</span>
            </button>

            <button className="flex items-center justify-center h-10 w-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
              <span className="material-symbols-outlined text-slate-900 dark:text-white" style={{fontSize: '24px'}}>search</span>
            </button>
          </div>
        </div>
        {/* Date Meta Text */}
        <div className="px-4 pb-4">
          <p className="text-slate-500 dark:text-[#9dabb9] text-sm font-medium uppercase tracking-wide">{headerDate}</p>
        </div>
      </header>

      {/* Scrollable Content */}
      <main className="flex-1 flex flex-col pb-24 px-4 w-full max-w-md mx-auto md:max-w-3xl">
        
        {/* Voice Status Overlay */}
        {voiceStatus === 'standby' && (
            <div className="mb-4 bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center justify-between animate-fade-in">
                <div className="flex items-center gap-3">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                    </span>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Say <span className="font-bold text-primary dark:text-white">"Hey Task Manager"</span>...
                    </p>
                </div>
            </div>
        )}

        {/* Active Listening Overlay */}
        {(voiceStatus === 'listening_command' || voiceStatus === 'processing') && (
            <div className="fixed inset-x-0 bottom-0 z-50 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col items-center justify-end pb-12 animate-fade-in pointer-events-none">
                 <div className="bg-white dark:bg-surface-dark px-6 py-4 rounded-full shadow-2xl flex items-center gap-4 animate-bounce-slight border border-white/10">
                     <span className={`material-symbols-outlined text-3xl ${voiceStatus === 'processing' ? 'animate-spin text-blue-500' : 'animate-pulse text-red-500'}`}>
                        {voiceStatus === 'processing' ? 'sync' : 'mic'}
                     </span>
                     <div className="flex flex-col">
                        <span className="font-bold text-lg text-slate-900 dark:text-white">
                            {voiceStatus === 'processing' ? "Adding task..." : 
                             "I'm listening..."}
                        </span>
                        {voiceTranscript && <span className="text-sm text-slate-500">"{voiceTranscript}"</span>}
                     </div>
                 </div>
            </div>
        )}

        {/* SECTION: OVERDUE */}
        {overdueTasks.length > 0 && (
          <div className="flex flex-col mb-6 animate-fade-in">
            <h3 className="text-slate-900 dark:text-white text-xl font-bold leading-tight py-4 flex items-center gap-2">
              Overdue
              <span className="bg-red-500/10 text-red-600 dark:text-red-400 text-xs px-2 py-0.5 rounded-full font-bold">
                {overdueTasks.length}
              </span>
            </h3>
            <div className="flex flex-col gap-3">
              {overdueTasks.map(task => (
                <TaskItem 
                  key={task.id} 
                  task={task} 
                  isOverdue={true}
                  onToggle={toggleTask}
                  onDelete={deleteTask}
                />
              ))}
            </div>
          </div>
        )}

        {/* SECTION: TODAY */}
        <div className="flex flex-col">
          <h3 className="text-slate-900 dark:text-white text-xl font-bold leading-tight py-4">Today</h3>
          <div className="flex flex-col gap-3">
            {todayTasks.length === 0 && overdueTasks.length === 0 ? (
                 <div className="text-center py-12 text-slate-400">
                    <span className="material-symbols-outlined text-4xl mb-2">check_circle</span>
                    <p>No tasks yet. Enjoy your day!</p>
                 </div>
            ) : (
                todayTasks.map(task => (
                    <TaskItem 
                    key={task.id} 
                    task={task} 
                    onToggle={toggleTask}
                    onDelete={deleteTask}
                    />
                ))
            )}
          </div>
        </div>
      </main>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-30">
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center h-14 w-14 rounded-full bg-primary text-white shadow-[0_8px_16px_rgba(19,127,236,0.3)] hover:scale-105 active:scale-95 transition-transform duration-200 focus:outline-none focus:ring-4 focus:ring-primary/30"
        >
          <span className="material-symbols-outlined text-[28px]">add</span>
        </button>
      </div>

      <AddTaskModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAddTask}
      />
      
      <ImageEditorModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        onSaveToTask={handleSaveImageTask}
      />
      
      <AlarmModal 
        task={activeAlarmTask}
        onDismiss={() => setActiveAlarmTask(null)}
        onComplete={handleAlarmComplete}
      />
    </>
  );
}