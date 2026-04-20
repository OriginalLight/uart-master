import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, 
  Settings, 
  Cpu, 
  Play, 
  Square, 
  Trash2, 
  Download, 
  Sparkles, 
  Send,
  Wifi,
  WifiOff,
  ChevronRight,
  AlertCircle,
  History,
  ArrowLeftRight,
  Hash,
  Copy,
  Table,
  Bot,
  Plus,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeSerialLogs, suggestCommands } from '@/services/gemini';
import { translations, Language } from '@/i18n';
import { Languages, Palette, Globe, X } from 'lucide-react';
import { 
  hexToAscii, 
  asciiToHex, 
  hexToBytes, 
  crc16modbus, 
  crc16xmodem, 
  crc32 
} from '@/lib/dataUtils';

interface LogEntry {
  id: string;
  timestamp: string;
  timeMs: number;
  type: 'rx' | 'tx' | 'info' | 'error';
  data: string;
}

export default function SerialTool() {
  const [port, setPort] = useState<SerialPort | null>(null);
  const [reader, setReader] = useState<ReadableStreamDefaultReader | null>(null);
  const [writer, setWriter] = useState<WritableStreamDefaultWriter | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [baudRate, setBaudRate] = useState('115200');
  const [dataBits, setDataBits] = useState<'7' | '8'>('8');
  const [stopBits, setStopBits] = useState<'1' | '2'>('1');
  const [parity, setParity] = useState<'none' | 'even' | 'odd'>('none');
  const [dataFormat, setDataFormat] = useState<'ascii' | 'hex'>('ascii');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isWebSerialSupported, setIsWebSerialSupported] = useState(true);
  const [stats, setStats] = useState({ tx: 0, rx: 0 });
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('uart-master-lang') as Language) || 'zh');
  const [themeMode, setThemeMode] = useState<'dark' | 'light' | 'cyberpunk' | 'system'>(() => (localStorage.getItem('uart-master-theme') as any) || 'dark');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('uart-master-api-key') || '');
  const effectiveApiKey = apiKey || process.env.GEMINI_API_KEY || '';
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [isCrcOpen, setIsCrcOpen] = useState(false);
  const [isAsciiOpen, setIsAsciiOpen] = useState(false);
  const [isMockOpen, setIsMockOpen] = useState(false);
  
  // Tool states
  const [convertInput, setConvertInput] = useState('');
  const [crcInput, setCrcInput] = useState('');
  const [crcAlgo, setCrcAlgo] = useState<'modbus' | 'xmodem' | 'crc32'>('modbus');
  const [mockRules, setMockRules] = useState<{ id: string; request: string; response: string; enabled: boolean; format: 'ascii' | 'hex' }[]>(() => {
    const saved = localStorage.getItem('uart-master-mock-rules');
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return parsed.map((r: any) => ({ ...r, format: r.format || 'ascii' }));
  });

  useEffect(() => {
    localStorage.setItem('uart-master-mock-rules', JSON.stringify(mockRules));
  }, [mockRules]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const mockRulesRef = useRef(mockRules);
  const sendDataRef = useRef<any>(null);

  useEffect(() => {
    mockRulesRef.current = mockRules;
  }, [mockRules]);

  const t = translations[language];

  useEffect(() => {
    localStorage.setItem('uart-master-lang', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('uart-master-theme', themeMode);
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-cyberpunk');
    
    if (themeMode === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (!isDark) root.classList.add('theme-light');
    } else if (themeMode !== 'dark') {
      root.classList.add(`theme-${themeMode}`);
    }
  }, [themeMode]);

  useEffect(() => {
    if (!('serial' in navigator)) {
      setIsWebSerialSupported(false);
      toast.error('Web Serial API is not supported in this browser.');
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (type: LogEntry['type'], data: string) => {
    const now = Date.now();
    const byteCount = new TextEncoder().encode(data).length;
    
    if (type === 'rx') setStats(prev => ({ ...prev, rx: prev.rx + byteCount }));
    if (type === 'tx') setStats(prev => ({ ...prev, tx: prev.tx + byteCount }));

    setLogs(prev => {
      const lastLog = prev[prev.length - 1];
      
      // Group RX data if it arrives within 50ms
      if (lastLog && lastLog.type === 'rx' && type === 'rx' && (now - lastLog.timeMs < 50)) {
        const updatedLog = { 
          ...lastLog, 
          data: lastLog.data + data,
          timeMs: now 
        };
        return [...prev.slice(0, -1), updatedLog];
      }

      const d = new Date(now);
      const timestamp = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${(now % 1000).toString().padStart(3, '0')}`;

      const newLog: LogEntry = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp,
        timeMs: now,
        type,
        data
      };
      return [...prev.slice(-1000), newLog];
    });
  };

  const connect = async () => {
    try {
      const selectedPort = await (navigator as any).serial.requestPort();
      await selectedPort.open({ 
        baudRate: parseInt(baudRate),
        dataBits: parseInt(dataBits),
        stopBits: parseInt(stopBits),
        parity: parity
      });
      
      setPort(selectedPort);
      setIsConnected(true);
      toast.success('Connected to port');
      addLog('info', `Connected: ${baudRate}bps, ${dataBits}N${stopBits}`);

      const reader = selectedPort.readable.getReader();
      setReader(reader);

      const writer = selectedPort.writable.getWriter();
      setWriter(writer);

      // Read loop
      (async () => {
        const decoder = new TextDecoder('latin1');
        let asciiBuffer = '';
        let hexBuffer = '';
        const MAX_BUFFER_SIZE = 1024;
        
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
              const decoded = decoder.decode(value);
              addLog('rx', decoded);
              
              const hexData = Array.from(value).map(v => {
                const hex = (v as number).toString(16).toUpperCase();
                return hex.length < 2 ? '0' + hex : hex;
              }).join(' ');

              asciiBuffer = (asciiBuffer + decoded).slice(-MAX_BUFFER_SIZE);
              hexBuffer = (hexBuffer + hexData.replace(/\s+/g, '')).slice(-MAX_BUFFER_SIZE);
              
              const currentRules = mockRulesRef.current;
              
              // Mock Auto-Reply Logic
              const matchingRule = currentRules.find(r => {
                if (!r.enabled || !r.request) return false;
                if (r.format === 'hex') {
                   const cleanPattern = r.request.replace(/\s+/g, '').toUpperCase();
                   return hexBuffer.includes(cleanPattern);
                }
                return asciiBuffer.includes(r.request);
              });

              if (matchingRule && sendDataRef.current) {
                // Clear buffers on match to prevent re-triggering
                asciiBuffer = '';
                hexBuffer = '';
                // Small delay to simulate processing and avoid collision
                setTimeout(() => sendDataRef.current(matchingRule.response, matchingRule.format), 100);
              }
            }
          }
        } catch (error) {
          console.error('Read error:', error);
        } finally {
          reader.releaseLock();
        }
      })();

    } catch (error) {
      console.error('Connection error:', error);
      toast.error('Failed to connect: ' + (error as Error).message);
    }
  };

  const disconnect = async () => {
    try {
      if (reader) {
        await reader.cancel();
        setReader(null);
      }
      if (writer) {
        await writer.close();
        setWriter(null);
      }
      if (port) {
        await port.close();
        setPort(null);
      }
      
      setIsConnected(false);
      toast.info('Disconnected');
      addLog('info', 'Disconnected');
    } catch (error) {
      console.error('Disconnect error:', error);
      setPort(null);
      setReader(null);
      setWriter(null);
      setIsConnected(false);
    }
  };

  const sendData = async (data: string = input, formatOverride?: 'ascii' | 'hex') => {
    if (!writer || !data) return;
    const targetFormat = formatOverride || dataFormat;
    try {
      let bytes: Uint8Array;
      if (targetFormat === 'hex') {
        const hex = data.replace(/\s+/g, '');
        if (!/^[0-9A-Fa-f]*$/.test(hex)) {
          toast.error(t.invalidHex);
          return;
        }
        if (hex.length % 2 !== 0) {
          toast.error(t.hexEvenError);
          return;
        }
        bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
      } else {
        bytes = new TextEncoder().encode(data + '\r\n');
      }
      
      await writer.write(bytes);
      
      // Log the data as a latin1 string so formatData works consistently
      const latin1String = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
      addLog('tx', latin1String);
      
      // Add to history
      setCommandHistory(prev => [data, ...prev.filter(h => h !== data)].slice(0, 20));
      
      // Get suggestions after sending
      const recentLogs = logs.slice(-10).map(l => `${l.type}: ${formatData(l.data)}`).join('\n');
      const newSuggestions = await suggestCommands(recentLogs + `\ntx: ${formatData(latin1String)}`, t.suggestPrompt, effectiveApiKey);
      setSuggestions(newSuggestions);
    } catch (error) {
      toast.error(t.sendFailed + (error as Error).message);
    }
  };
  
  useEffect(() => {
    sendDataRef.current = sendData;
  }, [sendData]);

  const handleAnalyze = async () => {
    if (logs.length === 0) {
      toast.error(t.analysisFailed);
      return;
    }
    setIsAnalyzing(true);
    const logText = logs.map(l => `[${l.timestamp}] ${l.type.toUpperCase()}: ${(l.type === 'rx' || l.type === 'tx') ? formatData(l.data) : l.data}`).join('\n');
    const result = await analyzeSerialLogs(logText, t.aiPrompt, effectiveApiKey);
    setAnalysis(result || t.analysisFailed);
    setIsAnalyzing(false);
  };

  const clearLogs = () => {
    setLogs([]);
    setAnalysis(null);
    toast.info(t.logsCleared);
  };

  const downloadLogs = () => {
    const logText = logs.map(l => `[${l.timestamp}] ${l.type.toUpperCase()}: ${(l.type === 'rx' || l.type === 'tx') ? formatData(l.data) : l.data}`).join('\n');
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `serial_logs_${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatData = (data: string) => {
    if (dataFormat === 'ascii') return data;
    return data.split('').map(char => char.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase()).join(' ');
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isWebSerialSupported) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md w-full glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-6 h-6" />
              Unsupported Browser
            </CardTitle>
            <CardDescription>
              {t.webSerialNotSupported}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden font-sans">
      {/* Header */}
      <header className="h-12 flex items-center justify-between px-4 bg-background border-b border-border z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-bold text-sm tracking-tight">
            {t.title} <span className="text-[10px] text-[#00D1FF] border border-[#00D1FF] px-1 rounded-[2px] uppercase">AI-INTEGRATED</span>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#4CAF50] shadow-[0_0_8px_#4CAF50]' : 'bg-[#909296]'}`} />
            <span className="text-muted-foreground uppercase tracking-wider font-semibold">
              {isConnected ? t.statusConnected : t.statusDisconnected}
            </span>
          </div>
          
          <div className="flex items-center gap-2 bg-muted/30 p-0.5 rounded border border-border">
            <Select value={baudRate} onValueChange={setBaudRate} disabled={isConnected}>
              <SelectTrigger className="w-[100px] h-7 border-none bg-transparent focus:ring-0 text-xs text-foreground">
                <SelectValue placeholder="Baud" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="9600">9600</SelectItem>
                <SelectItem value="19200">19200</SelectItem>
                <SelectItem value="38400">38400</SelectItem>
                <SelectItem value="57600">57600</SelectItem>
                <SelectItem value="115200">115200</SelectItem>
                <SelectItem value="230400">230400</SelectItem>
                <SelectItem value="460800">460800</SelectItem>
                <SelectItem value="921600">921600</SelectItem>
              </SelectContent>
            </Select>
            <Separator orientation="vertical" className="h-4 bg-border" />
            {isConnected ? (
              <Button variant="ghost" size="sm" onClick={disconnect} className="h-7 text-xs text-[#E53935] hover:text-[#E53935] hover:bg-[#E53935]/10 px-2">
                <WifiOff className="w-3 h-3 mr-1.5" /> {t.disconnect.toUpperCase()}
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={connect} className="h-7 text-xs text-[#4CAF50] hover:text-[#4CAF50] hover:bg-[#4CAF50]/10 px-2">
                <Wifi className="w-3 h-3 mr-1.5" /> {t.connect.toUpperCase()}
              </Button>
            )}
          </div>

          <Tooltip>
            <TooltipTrigger 
              render={
                <button 
                  onClick={() => setIsSettingsOpen(true)}
                  className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Settings className="w-4 h-4" />
                </button>
              }
            />
            <TooltipContent>{t.settings}</TooltipContent>
          </Tooltip>
        </div>
      </header>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/50">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-card-foreground">{t.settings}</h2>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Language Settings */}
                <div className="space-y-3">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Globe className="w-3 h-3" /> {t.language}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setLanguage('zh')}
                      className={`h-9 rounded-lg border text-xs font-medium transition-all ${language === 'zh' ? 'bg-primary/10 border-primary text-primary' : 'bg-background border-border text-muted-foreground hover:border-muted-foreground'}`}
                    >
                      {t.langZh}
                    </button>
                    <button
                      onClick={() => setLanguage('en')}
                      className={`h-9 rounded-lg border text-xs font-medium transition-all ${language === 'en' ? 'bg-primary/10 border-primary text-primary' : 'bg-background border-border text-muted-foreground hover:border-muted-foreground'}`}
                    >
                      {t.langEn}
                    </button>
                  </div>
                </div>

                {/* Theme Settings */}
                <div className="space-y-3">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Palette className="w-3 h-3" /> {t.theme}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setThemeMode('dark')}
                      className={`h-9 rounded-lg border text-[10px] font-medium transition-all ${themeMode === 'dark' ? 'bg-primary/10 border-primary text-primary' : 'bg-background border-border text-muted-foreground hover:border-muted-foreground'}`}
                    >
                      {t.themeDark}
                    </button>
                    <button
                      onClick={() => setThemeMode('light')}
                      className={`h-9 rounded-lg border text-[10px] font-medium transition-all ${themeMode === 'light' ? 'bg-primary/10 border-primary text-primary' : 'bg-background border-border text-muted-foreground hover:border-muted-foreground'}`}
                    >
                      {t.themeLight}
                    </button>
                    <button
                      onClick={() => setThemeMode('system')}
                      className={`h-9 rounded-lg border text-[10px] font-medium transition-all ${themeMode === 'system' ? 'bg-primary/10 border-primary text-primary' : 'bg-background border-border text-muted-foreground hover:border-muted-foreground'}`}
                    >
                      {t.themeSystem}
                    </button>
                  </div>
                </div>

                {/* API Key Settings */}
                <div className="space-y-3">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Sparkles className="w-3 h-3" /> {t.apiKeyLabel}
                  </label>
                  <Input 
                    type="password"
                    value={apiKey}
                    onChange={(e) => {
                      const val = e.target.value;
                      setApiKey(val);
                      localStorage.setItem('uart-master-api-key', val);
                    }}
                    placeholder={t.apiKeyPlaceholder}
                    className="h-9 bg-background border-border text-xs focus:ring-primary/30"
                  />
                  <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                    {t.apiKeyLabel}
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 bg-background/50 border-t border-border flex justify-end">
                <Button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="h-8 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-[11px] uppercase tracking-widest"
                >
                  {t.save}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Convert Tool Modal */}
      <AnimatePresence>
        {isConvertOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/50">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-card-foreground">{t.toolConvert}</h2>
                </div>
                <button onClick={() => setIsConvertOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Input</label>
                  <textarea
                    value={convertInput}
                    onChange={(e) => setConvertInput(e.target.value)}
                    className="w-full h-24 bg-background border border-border rounded-lg p-3 text-xs font-mono focus:ring-1 focus:ring-primary/50 outline-none resize-none custom-scrollbar"
                    placeholder="Enter HEX or ASCII..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{t.convertHexToAscii}</label>
                    <div className="relative group">
                      <div className="w-full min-h-[60px] bg-muted/30 border border-border rounded-lg p-3 text-xs font-mono break-all whitespace-pre-wrap select-all">
                        {hexToAscii(convertInput) || (convertInput ? 'Invalid HEX' : '-')}
                      </div>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(hexToAscii(convertInput));
                          toast.success('Copied to clipboard');
                        }}
                        className="absolute top-2 right-2 p-1 bg-background border border-border rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{t.convertAsciiToHex}</label>
                    <div className="relative group">
                      <div className="w-full min-h-[60px] bg-muted/30 border border-border rounded-lg p-3 text-xs font-mono break-all whitespace-pre-wrap select-all">
                        {asciiToHex(convertInput) || (convertInput ? '-' : '-')}
                      </div>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(asciiToHex(convertInput));
                          toast.success('Copied to clipboard');
                        }}
                        className="absolute top-2 right-2 p-1 bg-background border border-border rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CRC Tool Modal */}
      <AnimatePresence>
        {isCrcOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/50">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-card-foreground">{t.toolCrc}</h2>
                </div>
                <button onClick={() => setIsCrcOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{t.crcInput}</label>
                  <textarea
                    value={crcInput}
                    onChange={(e) => setCrcInput(e.target.value)}
                    className="w-full h-20 bg-background border border-border rounded-lg p-3 text-xs font-mono focus:ring-1 focus:ring-primary/50 outline-none resize-none custom-scrollbar"
                    placeholder="e.g. 01 03 00 00 00 01"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{t.crcAlgorithm}</label>
                  <Select value={crcAlgo} onValueChange={(v) => setCrcAlgo(v as any)}>
                    <SelectTrigger className="h-9 bg-background border-border text-xs font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="modbus">CRC-16/MODBUS</SelectItem>
                      <SelectItem value="xmodem">CRC-16/XMODEM</SelectItem>
                      <SelectItem value="crc32">CRC-32</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-2">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{t.crcResult}</label>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1 h-10 bg-muted/40 border border-border rounded-lg flex items-center px-4 font-mono text-primary font-bold">
                      {(() => {
                        const bytes = hexToBytes(crcInput);
                        if (bytes.length === 0) return '0x0000';
                        let res = 0;
                        if (crcAlgo === 'modbus') res = crc16modbus(bytes);
                        else if (crcAlgo === 'xmodem') res = crc16xmodem(bytes);
                        else if (crcAlgo === 'crc32') res = crc32(bytes);
                        
                        return '0x' + res.toString(16).toUpperCase().padStart(crcAlgo === 'crc32' ? 8 : 4, '0');
                      })()}
                    </div>
                    <Button 
                      variant="outline" 
                      className="h-10 border-border"
                      onClick={() => {
                        const bytes = hexToBytes(crcInput);
                        let res = 0;
                        if (crcAlgo === 'modbus') res = crc16modbus(bytes);
                        else if (crcAlgo === 'xmodem') res = crc16xmodem(bytes);
                        else if (crcAlgo === 'crc32') res = crc32(bytes);
                        const hex = res.toString(16).toUpperCase().padStart(crcAlgo === 'crc32' ? 8 : 4, '0');
                        navigator.clipboard.writeText(hex);
                        toast.success('Copied to clipboard');
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {isAsciiOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/50">
                <div className="flex items-center gap-2">
                  <Table className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-card-foreground">{t.toolAscii}</h2>
                </div>
                <button onClick={() => setIsAsciiOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-auto custom-scrollbar p-6">
                <div className="grid grid-cols-4 gap-x-6 gap-y-4">
                  <div className="contents text-[10px] uppercase tracking-widest text-muted-foreground font-bold border-b border-border">
                    <div className="pb-2 border-b border-border">Dec</div>
                    <div className="pb-2 border-b border-border">Hex</div>
                    <div className="pb-2 border-b border-border">Char</div>
                    <div className="pb-2 border-b border-border">Desc</div>
                  </div>
                  {Array.from({ length: 128 }).map((_, i) => {
                    let char = String.fromCharCode(i);
                    let desc = '';
                    
                    // Control characters
                    if (i === 0) { char = 'NUL'; desc = 'Null'; }
                    else if (i === 7) { char = 'BEL'; desc = 'Bell'; }
                    else if (i === 8) { char = 'BS'; desc = 'Backspace'; }
                    else if (i === 9) { char = 'HT'; desc = 'Tab'; }
                    else if (i === 10) { char = 'LF'; desc = 'Line Feed'; }
                    else if (i === 13) { char = 'CR'; desc = 'Carriage Return'; }
                    else if (i === 27) { char = 'ESC'; desc = 'Escape'; }
                    else if (i === 32) { char = 'SPC'; desc = 'Space'; }
                    else if (i < 32 || i === 127) {
                       desc = i === 127 ? 'Delete' : 'Control';
                       if (i === 1) char = 'SOH';
                       else if (i === 2) char = 'STX';
                       else if (i === 3) char = 'ETX';
                       else if (i === 4) char = 'EOT';
                       else if (i === 5) char = 'ENQ';
                       else if (i === 6) char = 'ACK';
                    }

                    return (
                      <div key={i} className="contents group">
                        <div className="text-xs font-mono text-muted-foreground py-1 group-hover:bg-primary/5 transition-colors">{i.toString().padStart(3, '0')}</div>
                        <div className="text-xs font-mono text-muted-foreground py-1 group-hover:bg-primary/5 transition-colors">0x{i.toString(16).toUpperCase().padStart(2, '0')}</div>
                        <div className={`text-xs font-mono font-bold py-1 group-hover:bg-primary/5 transition-colors ${i < 32 || i === 127 ? 'text-primary' : 'text-foreground'}`}>{char}</div>
                        <div className="text-[10px] text-muted-foreground truncate py-1 group-hover:bg-primary/5 transition-colors">{desc}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
        {isMockOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/50">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-card-foreground">{t.toolMock}</h2>
                </div>
                <button onClick={() => setIsMockOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-4">
                <div className="flex items-center justify-between">
                   <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Auto-Reply Rules</span>
                   <Button 
                     size="sm" 
                     variant="outline" 
                     className="h-7 px-3 text-[10px] gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                     onClick={() => setMockRules([...mockRules, { id: Date.now().toString(), request: '', response: '', enabled: true, format: 'ascii' }])}
                   >
                     <Plus className="w-3 h-3" /> {t.mockAdd}
                   </Button>
                </div>

                {mockRules.length === 0 && (
                  <div className="py-12 flex flex-col items-center justify-center text-muted-foreground/30 italic text-xs">
                    <Bot className="w-8 h-8 mb-2 opacity-20" />
                    {t.mockEmpty}
                  </div>
                )}

                <div className="space-y-3">
                  {mockRules.map((rule, idx) => (
                    <div key={rule.id} className="p-4 rounded-xl border border-border bg-muted/20 relative group transition-all hover:border-primary/30">
                      <div className="flex items-center justify-between mb-3">
                         <div className="flex items-center gap-2">
                           <span className="text-[9px] uppercase tracking-tighter text-muted-foreground font-bold">{t.mockFormat}:</span>
                           <div className="flex border border-border rounded overflow-hidden">
                             <button
                               onClick={() => {
                                 const newRules = [...mockRules];
                                 newRules[idx].format = 'ascii';
                                 setMockRules(newRules);
                               }}
                               className={`px-2 py-0.5 text-[8px] font-bold transition-colors ${rule.format === 'ascii' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                             >
                               ASCII
                             </button>
                             <button
                               onClick={() => {
                                 const newRules = [...mockRules];
                                 newRules[idx].format = 'hex';
                                 setMockRules(newRules);
                               }}
                               className={`px-2 py-0.5 text-[8px] font-bold transition-colors ${rule.format === 'hex' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                             >
                               HEX
                             </button>
                           </div>
                         </div>
                      </div>
                      <div className="grid grid-cols-[1fr_24px_1fr] items-center gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[9px] uppercase tracking-tighter text-muted-foreground font-bold">{t.mockRequest}</label>
                          <Input 
                            value={rule.request}
                            onChange={(e) => {
                              const newRules = [...mockRules];
                              newRules[idx].request = e.target.value;
                              setMockRules(newRules);
                            }}
                            className="h-8 bg-background text-[11px] font-mono"
                            placeholder="AT+CMD..."
                          />
                        </div>
                        <div className="pt-4 flex justify-center">
                          <ArrowRight className="w-3 h-3 text-muted-foreground/50" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] uppercase tracking-tighter text-muted-foreground font-bold">{t.mockResponse}</label>
                          <Input 
                            value={rule.response}
                            onChange={(e) => {
                              const newRules = [...mockRules];
                              newRules[idx].response = e.target.value;
                              setMockRules(newRules);
                            }}
                            className="h-8 bg-background text-[11px] font-mono"
                            placeholder="OK"
                          />
                        </div>
                      </div>
                      <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            const newRules = [...mockRules];
                            newRules[idx].enabled = !newRules[idx].enabled;
                            setMockRules(newRules);
                          }}
                          className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${rule.enabled ? 'bg-primary border-primary text-primary-foreground' : 'bg-background border-border text-muted-foreground'}`}
                        >
                           <Play className="w-2.5 h-2.5" />
                        </button>
                        <button 
                          onClick={() => setMockRules(mockRules.filter(r => r.id !== rule.id))}
                          className="w-6 h-6 rounded-full border border-border bg-background text-destructive flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-all"
                        >
                           <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className={`flex-1 grid overflow-hidden ${effectiveApiKey.length > 0 ? 'grid-cols-[240px_1fr_320px]' : 'grid-cols-[240px_1fr]'}`}>
        <aside className="border-r border-border bg-card flex flex-col overflow-y-auto">
          <div className="panel-header uppercase tracking-widest text-[10px] py-2 px-4 border-b border-border bg-muted/20 font-bold">{t.baudRate}</div>
          <div className="p-4 space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider">{t.baudRate}</label>
              <Select value={baudRate} onValueChange={setBaudRate} disabled={isConnected}>
                <SelectTrigger className="h-8 bg-background border-border text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9600">9600</SelectItem>
                  <SelectItem value="19200">19200</SelectItem>
                  <SelectItem value="38400">38400</SelectItem>
                  <SelectItem value="57600">57600</SelectItem>
                  <SelectItem value="115200">115200</SelectItem>
                  <SelectItem value="230400">230400</SelectItem>
                  <SelectItem value="460800">460800</SelectItem>
                  <SelectItem value="921600">921600</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider">{t.dataBits}</label>
              <Select value={dataBits} onValueChange={(v) => setDataBits(v as '7' | '8')} disabled={isConnected}>
                <SelectTrigger className="h-8 bg-background border-border text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 Bits</SelectItem>
                  <SelectItem value="8">8 Bits</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider">{t.parity}</label>
              <Select value={parity} onValueChange={(v) => setParity(v as 'none' | 'even' | 'odd')} disabled={isConnected}>
                <SelectTrigger className="h-8 bg-background border-border text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t.none}</SelectItem>
                  <SelectItem value="even">{t.even}</SelectItem>
                  <SelectItem value="odd">{t.odd}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider">{t.stopBits}</label>
              <Select value={stopBits} onValueChange={(v) => setStopBits(v as '1' | '2')} disabled={isConnected}>
                <SelectTrigger className="h-8 bg-background border-border text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Bit</SelectItem>
                  <SelectItem value="2">2 Bits</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator className="bg-border my-2" />

            <div className="space-y-2">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider">{t.dataFormat}</label>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant={dataFormat === 'hex' ? 'default' : 'outline'} 
                  className={`h-7 text-[10px] ${dataFormat === 'hex' ? 'bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-accent'}`}
                  onClick={() => setDataFormat('hex')}
                >
                  HEX
                </Button>
                <Button 
                  variant={dataFormat === 'ascii' ? 'default' : 'outline'} 
                  className={`h-7 text-[10px] ${dataFormat === 'ascii' ? 'bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-accent'}`}
                  onClick={() => setDataFormat('ascii')}
                >
                  ASCII
                </Button>
              </div>
            </div>

            <Separator className="bg-border my-2" />

            <div className="space-y-2">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider">{t.tools}</label>
              <div className="grid grid-cols-1 gap-2">
                <Button 
                  variant="outline" 
                  className="h-9 w-full border-border text-foreground hover:bg-accent justify-start px-3 gap-2 text-xs transition-all hover:border-primary/50"
                  onClick={() => setIsConvertOpen(true)}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-primary" />
                  <span className="font-medium">{t.toolConvert}</span>
                </Button>

                <Button 
                  variant="outline" 
                  className="h-9 w-full border-border text-foreground hover:bg-accent justify-start px-3 gap-2 text-xs transition-all hover:border-primary/50"
                  onClick={() => setIsCrcOpen(true)}
                >
                  <Hash className="w-3.5 h-3.5 text-primary" />
                  <span className="font-medium">{t.toolCrc}</span>
                </Button>

                <Button 
                  variant="outline" 
                  className="h-9 w-full border-border text-foreground hover:bg-accent justify-start px-3 gap-2 text-xs transition-all hover:border-primary/50"
                  onClick={() => setIsAsciiOpen(true)}
                >
                  <Table className="w-3.5 h-3.5 text-primary" />
                  <span className="font-medium">{t.toolAscii}</span>
                </Button>

                <Button 
                  variant="outline" 
                  className="h-9 w-full border-border text-foreground hover:bg-accent justify-start px-3 gap-2 text-xs transition-all hover:border-primary/50"
                  onClick={() => setIsMockOpen(true)}
                >
                  <Bot className="w-3.5 h-3.5 text-primary" />
                  <span className="font-medium">{t.toolMock}</span>
                </Button>
              </div>
            </div>
          </div>
        </aside>

        {/* Console Area */}
        <div className="flex flex-col bg-background min-h-0">
          <div className="panel-header flex items-center justify-between uppercase tracking-widest text-[10px] py-1.5 px-4 border-b border-border bg-muted/20 font-bold">
            <span>{t.console}</span>
            <div className="flex items-center gap-1 pr-1">
              <Tooltip>
                <TooltipTrigger 
                  render={
                    <button className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  }
                  onClick={clearLogs}
                />
                <TooltipContent>{t.clear}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger 
                  render={
                    <button className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                      <Download className="w-3 h-3" />
                    </button>
                  }
                  onClick={downloadLogs}
                />
                <TooltipContent>{t.export}</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            <div 
              className="flex-1 overflow-y-auto p-3 space-y-0.5 font-mono text-[12px] custom-scrollbar bg-background" 
              ref={scrollRef}
            >
              {logs.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-20 mt-20 text-primary">
                  <Terminal className="w-10 h-10 mb-2" />
                  <p className="text-xs uppercase tracking-widest">{t.consoleReady}</p>
                </div>
              )}
              {logs.map((log) => (
                <div key={log.id} className="flex gap-3 px-1">
                  <span className="text-muted-foreground shrink-0 select-none">
                    [{log.timestamp}]
                  </span>
                  <span className={`shrink-0 w-8 font-bold ${
                    log.type === 'rx' ? 'text-primary' : 
                    log.type === 'tx' ? 'text-destructive' : 
                    'text-muted-foreground'
                  }`}>
                    {log.type === 'rx' ? 'RX <' : log.type === 'tx' ? 'TX >' : 'INF'}
                  </span>
                  <span className={`flex-1 break-all ${
                    log.type === 'rx' ? 'text-primary' : 
                    log.type === 'error' ? 'text-destructive' : 
                    'text-foreground'
                  }`}>
                    {(log.type === 'rx' || log.type === 'tx') ? formatData(log.data) : log.data}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Input Area */}
          <div className="h-[50px] flex items-center px-3 gap-2 bg-muted/10 border-t border-border relative">
            <AnimatePresence>
              {showHistory && commandHistory.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-full left-3 right-3 mb-2 bg-card border border-border rounded-lg shadow-2xl overflow-hidden z-50 max-h-[200px] flex flex-col"
                >
                  <div className="p-2 border-b border-border flex items-center justify-between bg-muted/30">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t.historyTitle}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-4 w-4 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowHistory(false)}
                      title={t.clearHistory}
                    >
                      <Trash2 className="w-3 h-3" onClick={(e) => { e.stopPropagation(); setCommandHistory([]); setShowHistory(false); }} />
                    </Button>
                  </div>
                  <div className="overflow-y-auto custom-scrollbar">
                    {commandHistory.map((cmd, i) => (
                      <button
                        key={i}
                        className="w-full text-left px-3 py-2 text-[11px] text-foreground hover:bg-primary/10 hover:text-primary transition-colors border-b border-border last:border-0 font-mono truncate"
                        onClick={() => {
                          setInput(cmd);
                          setShowHistory(false);
                        }}
                      >
                        {cmd}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendData()}
              placeholder={t.inputPlaceholder}
              className="flex-1 h-8 bg-background border-border text-xs focus-visible:ring-primary/50"
              disabled={!isConnected}
            />
            
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 border border-border hover:bg-accent ${showHistory ? 'text-primary border-primary/30 bg-primary/5' : 'text-muted-foreground'}`}
              onClick={() => setShowHistory(!showHistory)}
              disabled={commandHistory.length === 0}
              title={t.history}
            >
              <History className="w-4 h-4" />
            </Button>

            <Button 
              onClick={() => sendData()} 
              disabled={!isConnected || !input}
              className="h-8 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs"
            >
              {t.send}
            </Button>
          </div>
        </div>

        {/* AI Sidebar */}
        {effectiveApiKey.length > 0 && (
          <aside className="bg-card border-l border-border flex flex-col overflow-hidden">
            <div className="panel-header uppercase tracking-widest text-[10px] py-2 px-4 border-b border-border bg-muted/20 font-bold">{t.aiInsights}</div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-4 space-y-4">
                <AnimatePresence mode="wait">
                  {analysis ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4"
                    >
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                        <h4 className="text-xs font-bold text-primary mb-2 flex items-center gap-2">
                          <Sparkles className="w-3 h-3" /> {t.aiAnalysis}
                        </h4>
                        <div className="text-xs leading-relaxed text-foreground prose-xs">
                          {analysis.split('\n').map((line, i) => (
                            <p key={i} className="mb-2 last:mb-0">{line}</p>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
                      <Sparkles className="w-6 h-6 mx-auto mb-2 text-primary" />
                      <p className="text-[11px] text-foreground font-medium">{t.runAnalysis}</p>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || logs.length === 0}
                        className="mt-3 h-7 text-[10px] border border-primary/30 text-primary hover:bg-primary/10"
                      >
                        {isAnalyzing ? t.analyzing : t.startAnalysis}
                      </Button>
                    </div>
                  )}
                </AnimatePresence>

                {suggestions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{t.suggestedCommands}</h4>
                    <div className="grid gap-2">
                      {suggestions.map((s, i) => (
                        <button 
                          key={i} 
                          onClick={() => sendData(s)}
                          className="text-left text-[11px] p-2 bg-muted/30 border border-border rounded hover:bg-primary/10 hover:text-primary transition-colors text-foreground"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </aside>
        )}
      </main>

      {/* Footer */}
      <footer className="h-7 bg-card border-t border-border px-3 flex items-center justify-between text-[11px] text-muted-foreground group-data-[theme=light]:bg-muted/10">
        <div className="flex items-center gap-4">
          <span className="uppercase tracking-wider font-medium">{dataFormat} VIEW</span>
          <Separator orientation="vertical" className="h-3 bg-border" />
          <span>{logs.length} {t.entries.toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <span>TX: <span className="text-foreground font-mono">{formatBytes(stats.tx)}</span></span>
            <span>RX: <span className="text-foreground font-mono">{formatBytes(stats.rx)}</span></span>
          </div>
          {effectiveApiKey.length > 0 && (
            <>
              <Separator orientation="vertical" className="h-3 bg-border" />
              <span className={`font-bold flex items-center gap-1.5 ${isAnalyzing ? 'text-destructive' : 'text-primary'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isAnalyzing ? 'bg-destructive animate-pulse' : 'bg-primary'}`} />
                {isAnalyzing ? t.aiAnalyzing : t.aiEngineReady}
              </span>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
