import React, { useState, useEffect } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';

const WindowTitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const isElectron = typeof window !== 'undefined' && window.process && (window.process as any).type === 'renderer';

  useEffect(() => {
    if (!isElectron) return;

    const { ipcRenderer } = (window as any).require('electron');
    
    const handleMaximized = (_event: any, state: boolean) => setIsMaximized(state);
    
    ipcRenderer.on('window-is-maximized', handleMaximized);
    
    return () => {
      ipcRenderer.removeListener('window-is-maximized', handleMaximized);
    };
  }, [isElectron]);

  if (!isElectron) return null;

  const handleMinimize = () => {
    (window as any).require('electron').ipcRenderer.send('window-minimize');
  };

  const handleMaximize = () => {
    (window as any).require('electron').ipcRenderer.send('window-maximize');
  };

  const handleClose = () => {
    (window as any).require('electron').ipcRenderer.send('window-close');
  };

  return (
    <div className="h-8 flex items-center justify-between bg-background border-b border-border select-none window-drag">
      <div className="flex items-center px-3 gap-2 pointer-events-none">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Uart Master</span>
      </div>
      
      <div className="flex items-center h-full no-drag">
        <button
          onClick={handleMinimize}
          className="h-full px-4 hover:bg-muted/50 transition-colors flex items-center justify-center text-muted-foreground hover:text-foreground"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className="h-full px-4 hover:bg-muted/50 transition-colors flex items-center justify-center text-muted-foreground hover:text-foreground"
          title={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? <Copy className="w-3 h-3 rotate-180" /> : <Square className="w-2.5 h-2.5" />}
        </button>
        <button
          onClick={handleClose}
          className="h-full px-5 hover:bg-[#E81123] hover:text-white transition-colors flex items-center justify-center text-muted-foreground"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default WindowTitleBar;
