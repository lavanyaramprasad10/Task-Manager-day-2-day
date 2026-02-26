import React, { useState, useRef } from 'react';
import { editImageWithGemini } from '../services/geminiService';

interface ImageEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveToTask: (image: string, title: string) => void;
}

const ImageEditorModal: React.FC<ImageEditorModalProps> = ({ isOpen, onClose, onSaveToTask }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Compress image to avoid LocalStorage quota limits and speed up AI processing
  const compressImage = (dataUrl: string, maxWidth = 800, quality = 0.7): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
            resolve(dataUrl); // Fallback
        }
      };
      img.onerror = () => resolve(dataUrl);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawResult = reader.result as string;
        try {
            const compressed = await compressImage(rawResult);
            setSelectedImage(compressed);
            setGeneratedImage(null);
        } catch (e) {
            console.warn("Compression failed, using raw", e);
            setSelectedImage(rawResult);
            setGeneratedImage(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!selectedImage || !prompt.trim()) return;

    setIsLoading(true);
    try {
      // Extract base64 data and mime type
      const [metadata, base64Data] = selectedImage.split(',');
      const mimeType = metadata.match(/:(.*?);/)?.[1] || 'image/png';

      const resultBase64 = await editImageWithGemini(base64Data, mimeType, prompt);

      if (resultBase64) {
        setGeneratedImage(`data:image/png;base64,${resultBase64}`);
      } else {
        alert("Could not generate image. Please try again or check if you have a valid API key.");
      }
    } catch (error) {
      console.error(error);
      alert("Error generating image.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (generatedImage) {
      const link = document.createElement('a');
      link.href = generatedImage;
      link.download = `edited-image-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleSaveToTask = () => {
    const imageToSave = generatedImage || selectedImage;
    if (imageToSave) {
        // Use prompt as title if it exists, otherwise it will default in App.tsx
        onSaveToTask(imageToSave, prompt);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-surface-dark w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">auto_fix_high</span>
            Add Image Task
          </h3>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors"
          >
            <span className="material-symbols-outlined text-slate-500">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          
          {/* Image Preview Area */}
          <div className="relative w-full aspect-square bg-slate-50 dark:bg-black/20 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden group">
             {generatedImage ? (
                <img src={generatedImage} alt="Generated" className="w-full h-full object-contain" />
             ) : selectedImage ? (
                <img src={selectedImage} alt="Original" className="w-full h-full object-contain opacity-80" />
             ) : (
                <div className="text-center p-6 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                   <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">add_photo_alternate</span>
                   <p className="text-slate-500 text-sm">Tap to upload image</p>
                </div>
             )}

             {/* Loading Overlay */}
             {isLoading && (
               <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex flex-col items-center justify-center text-white z-10">
                 <span className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin mb-2"></span>
                 <p className="text-sm font-medium animate-pulse">Generating...</p>
               </div>
             )}
             
             {/* Upload Trigger (if no image or hovering) */}
             <input 
               type="file" 
               ref={fileInputRef} 
               onChange={handleFileChange} 
               className="hidden" 
               accept="image/*"
             />
             {!isLoading && (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className={`absolute bottom-4 right-4 bg-black/70 hover:bg-black text-white p-2 rounded-lg backdrop-blur-sm transition-all ${selectedImage ? 'opacity-0 group-hover:opacity-100' : 'hidden'}`}
                  title="Change Image"
                >
                  <span className="material-symbols-outlined text-sm">upload_file</span>
                </button>
             )}
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-3">
             <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
               Task Description / AI Prompt
             </label>
             <div className="relative">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe image task OR prompt AI to edit..."
                  className="w-full bg-slate-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none pr-12"
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                />
                {process.env.API_KEY && (
                    <button 
                    onClick={handleGenerate}
                    disabled={!selectedImage || !prompt.trim() || isLoading}
                    className="absolute right-2 top-1.5 p-1.5 bg-primary text-white rounded-lg hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-primary/20"
                    title="Generate with AI"
                    >
                    <span className="material-symbols-outlined text-[20px]">auto_fix_high</span>
                    </button>
                )}
             </div>
             {process.env.API_KEY && (
                 <p className="text-xs text-slate-400 dark:text-slate-500 px-1">
                   Tip: Click the magic wand to edit with AI, or just click "Add to Tasks" to save.
                 </p>
             )}
          </div>
        </div>

        {/* Footer Actions */}
        {(generatedImage || selectedImage) && (
          <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex gap-3 justify-end bg-slate-50 dark:bg-black/10">
             <button 
                onClick={() => { setSelectedImage(null); setGeneratedImage(null); setPrompt(''); }}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-sm font-medium transition-colors"
             >
                Reset
             </button>
             
             <button 
                onClick={handleSaveToTask}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:brightness-110 transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
             >
                <span className="material-symbols-outlined text-[18px]">add_task</span>
                Add to Tasks
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageEditorModal;