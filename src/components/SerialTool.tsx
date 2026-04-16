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
  History
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
import { analyzeSerialLogs, suggestCommands, isGeminiConfigured } from '@/services/gemini';

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
  
  const scrollRef = useRef<HTMLDivElement>(null);

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
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) addLog('rx', decoder.decode(value));
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

  const sendData = async (data: string = input) => {
    if (!writer || !data) return;
    try {
      let bytes: Uint8Array;
      if (dataFormat === 'hex') {
        const hex = data.replace(/\s+/g, '');
        if (!/^[0-9A-Fa-f]*$/.test(hex)) {
          toast.error('Invalid HEX data');
          return;
        }
        if (hex.length % 2 !== 0) {
          toast.error('HEX data must have an even number of characters');
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
      const newSuggestions = await suggestCommands(recentLogs + `\ntx: ${formatData(latin1String)}`);
      setSuggestions(newSuggestions);
    } catch (error) {
      toast.error('Failed to send: ' + (error as Error).message);
    }
  };

  const handleAnalyze = async () => {
    if (logs.length === 0) {
      toast.error('No logs to analyze');
      return;
    }
    setIsAnalyzing(true);
    const logText = logs.map(l => `[${l.timestamp}] ${l.type.toUpperCase()}: ${(l.type === 'rx' || l.type === 'tx') ? formatData(l.data) : l.data}`).join('\n');
    const result = await analyzeSerialLogs(logText);
    setAnalysis(result);
    setIsAnalyzing(false);
  };

  const clearLogs = () => {
    setLogs([]);
    setAnalysis(null);
    toast.info('Logs cleared');
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
              Your browser does not support the Web Serial API. Please use a modern browser like Chrome or Edge.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden font-sans">
      {/* Header */}
      <header className="h-12 flex items-center justify-between px-4 bg-[#141517] border-b border-[#2C2E33] z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-bold text-sm tracking-tight">
            UART MASTER <span className="text-[10px] text-[#00D1FF] border border-[#00D1FF] px-1 rounded-[2px] uppercase">AI-INTEGRATED</span>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#4CAF50] shadow-[0_0_8px_#4CAF50]' : 'bg-[#909296]'}`} />
            <span className="text-[#E0E0E0] uppercase tracking-wider font-semibold">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          <div className="flex items-center gap-2 bg-[#1A1B1E] p-0.5 rounded border border-[#2C2E33]">
            <Select value={baudRate} onValueChange={setBaudRate} disabled={isConnected}>
              <SelectTrigger className="w-[100px] h-7 border-none bg-transparent focus:ring-0 text-xs">
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
            <Separator orientation="vertical" className="h-4 bg-[#2C2E33]" />
            {isConnected ? (
              <Button variant="ghost" size="sm" onClick={disconnect} className="h-7 text-xs text-[#E53935] hover:text-[#E53935] hover:bg-[#E53935]/10 px-2">
                <WifiOff className="w-3 h-3 mr-1.5" /> DISCONNECT
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={connect} className="h-7 text-xs text-[#4CAF50] hover:text-[#4CAF50] hover:bg-[#4CAF50]/10 px-2">
                <Wifi className="w-3 h-3 mr-1.5" /> CONNECT
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger 
                render={
                  <button className="h-8 w-8 flex items-center justify-center text-[#909296] hover:text-white transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                }
                onClick={clearLogs}
              />
              <TooltipContent>Clear</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger 
                render={
                  <button className="h-8 w-8 flex items-center justify-center text-[#909296] hover:text-white transition-colors">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                }
                onClick={downloadLogs}
              />
              <TooltipContent>Export</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={`flex-1 grid overflow-hidden ${isGeminiConfigured ? 'grid-cols-[240px_1fr_320px]' : 'grid-cols-[240px_1fr]'}`}>
        {/* Sidebar - Settings */}
        <aside className="border-r border-[#2C2E33] bg-[#0C0D0E] flex flex-col overflow-y-auto">
          <div className="panel-header">Serial Configuration</div>
          <div className="p-4 space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] text-[#909296] uppercase tracking-wider">Baud Rate</label>
              <Select value={baudRate} onValueChange={setBaudRate} disabled={isConnected}>
                <SelectTrigger className="h-8 bg-[#1A1B1E] border-[#2C2E33] text-xs">
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
              <label className="text-[11px] text-[#909296] uppercase tracking-wider">Data Bits</label>
              <Select value={dataBits} onValueChange={(v) => setDataBits(v as '7' | '8')} disabled={isConnected}>
                <SelectTrigger className="h-8 bg-[#1A1B1E] border-[#2C2E33] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 Bits</SelectItem>
                  <SelectItem value="8">8 Bits</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-[#909296] uppercase tracking-wider">Parity</label>
              <Select value={parity} onValueChange={(v) => setParity(v as 'none' | 'even' | 'odd')} disabled={isConnected}>
                <SelectTrigger className="h-8 bg-[#1A1B1E] border-[#2C2E33] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="even">Even</SelectItem>
                  <SelectItem value="odd">Odd</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-[#909296] uppercase tracking-wider">Stop Bits</label>
              <Select value={stopBits} onValueChange={(v) => setStopBits(v as '1' | '2')} disabled={isConnected}>
                <SelectTrigger className="h-8 bg-[#1A1B1E] border-[#2C2E33] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Bit</SelectItem>
                  <SelectItem value="2">2 Bits</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator className="bg-[#2C2E33] my-2" />

            <div className="space-y-2">
              <label className="text-[11px] text-[#909296] uppercase tracking-wider">Data Format</label>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant={dataFormat === 'hex' ? 'default' : 'outline'} 
                  className={`h-7 text-[10px] ${dataFormat === 'hex' ? 'bg-[#00D1FF] text-[#0C0D0E]' : 'border-[#2C2E33] text-white hover:bg-white/5'}`}
                  onClick={() => setDataFormat('hex')}
                >
                  HEX
                </Button>
                <Button 
                  variant={dataFormat === 'ascii' ? 'default' : 'outline'} 
                  className={`h-7 text-[10px] ${dataFormat === 'ascii' ? 'bg-[#00D1FF] text-[#0C0D0E]' : 'border-[#2C2E33] text-white hover:bg-white/5'}`}
                  onClick={() => setDataFormat('ascii')}
                >
                  ASCII
                </Button>
              </div>
            </div>
          </div>
        </aside>

        {/* Console Area */}
        <div className="flex flex-col bg-black min-h-0">
          <div className="panel-header">Data Console</div>
          <div className="flex-1 overflow-hidden flex flex-col">
            <div 
              className="flex-1 overflow-y-auto p-3 space-y-0.5 font-mono text-[12px] custom-scrollbar" 
              ref={scrollRef}
            >
              {logs.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-20 mt-20 text-[#A5D6A7]">
                  <Terminal className="w-10 h-10 mb-2" />
                  <p className="text-xs uppercase tracking-widest">Console Ready</p>
                </div>
              )}
              {logs.map((log) => (
                <div key={log.id} className="flex gap-3 px-1">
                  <span className="text-[#5C5F66] shrink-0 select-none">
                    [{log.timestamp}]
                  </span>
                  <span className={`shrink-0 w-8 font-bold ${
                    log.type === 'rx' ? 'text-[#00D1FF]' : 
                    log.type === 'tx' ? 'text-[#FF9800]' : 
                    'text-[#909296]'
                  }`}>
                    {log.type === 'rx' ? 'RX <' : log.type === 'tx' ? 'TX >' : 'INF'}
                  </span>
                  <span className={`flex-1 break-all ${
                    log.type === 'rx' ? 'text-[#A5D6A7]' : 
                    log.type === 'error' ? 'text-[#E53935]' : 
                    'text-[#E0E0E0]'
                  }`}>
                    {(log.type === 'rx' || log.type === 'tx') ? formatData(log.data) : log.data}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Input Area */}
          <div className="h-[50px] flex items-center px-3 gap-2 bg-[#141517] border-t border-[#2C2E33] relative">
            <AnimatePresence>
              {showHistory && commandHistory.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-full left-3 right-3 mb-2 bg-[#1A1B1E] border border-[#2C2E33] rounded-lg shadow-2xl overflow-hidden z-50 max-h-[200px] flex flex-col"
                >
                  <div className="p-2 border-b border-[#2C2E33] flex items-center justify-between bg-[#141517]">
                    <span className="text-[10px] font-bold text-[#909296] uppercase tracking-wider">Command History</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-4 w-4 text-[#909296] hover:text-white"
                      onClick={() => setShowHistory(false)}
                    >
                      <Trash2 className="w-3 h-3" onClick={(e) => { e.stopPropagation(); setCommandHistory([]); setShowHistory(false); }} />
                    </Button>
                  </div>
                  <div className="overflow-y-auto custom-scrollbar">
                    {commandHistory.map((cmd, i) => (
                      <button
                        key={i}
                        className="w-full text-left px-3 py-2 text-[11px] text-[#E0E0E0] hover:bg-[#00D1FF]/10 hover:text-[#00D1FF] transition-colors border-b border-[#2C2E33] last:border-0 font-mono truncate"
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
              placeholder="Enter command or hex (0x..)"
              className="flex-1 h-8 bg-[#0C0D0E] border-[#2C2E33] text-xs focus-visible:ring-[#00D1FF]/50"
              disabled={!isConnected}
            />
            
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 border border-[#2C2E33] hover:bg-white/5 ${showHistory ? 'text-[#00D1FF] border-[#00D1FF]/30 bg-[#00D1FF]/5' : 'text-[#909296]'}`}
              onClick={() => setShowHistory(!showHistory)}
              disabled={commandHistory.length === 0}
            >
              <History className="w-4 h-4" />
            </Button>

            <Button 
              onClick={() => sendData()} 
              disabled={!isConnected || !input}
              className="h-8 px-4 bg-[#00D1FF] hover:bg-[#00D1FF]/90 text-[#0C0D0E] font-bold text-xs"
            >
              SEND
            </Button>
          </div>
        </div>

        {/* AI Sidebar */}
        {isGeminiConfigured && (
          <aside className="bg-[#141517] border-l border-[#2C2E33] flex flex-col overflow-hidden">
            <div className="panel-header">AI Insights & Debugging</div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-4 space-y-4">
                <AnimatePresence mode="wait">
                  {analysis ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4"
                    >
                      <div className="bg-[#00D1FF]/5 border border-[#00D1FF]/20 rounded-lg p-3">
                        <h4 className="text-xs font-bold text-[#00D1FF] mb-2 flex items-center gap-2">
                          <Sparkles className="w-3 h-3" /> AI ANALYSIS
                        </h4>
                        <div className="text-xs leading-relaxed text-[#E0E0E0] prose prose-invert prose-xs">
                          {analysis.split('\n').map((line, i) => (
                            <p key={i} className="mb-2">{line}</p>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="bg-[#00D1FF]/5 border border-[#00D1FF]/20 rounded-lg p-4 text-center opacity-50">
                      <Sparkles className="w-6 h-6 mx-auto mb-2 text-[#00D1FF]" />
                      <p className="text-[11px] text-[#E0E0E0]">Run analysis to see AI insights</p>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || logs.length === 0}
                        className="mt-3 h-7 text-[10px] border border-[#00D1FF]/30 text-[#00D1FF] hover:bg-[#00D1FF]/10"
                      >
                        {isAnalyzing ? 'ANALYZING...' : 'START ANALYSIS'}
                      </Button>
                    </div>
                  )}
                </AnimatePresence>

                {suggestions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-bold text-[#909296] uppercase tracking-wider">Suggested Commands</h4>
                    <div className="grid gap-2">
                      {suggestions.map((s, i) => (
                        <button 
                          key={i} 
                          onClick={() => sendData(s)}
                          className="text-left text-[11px] p-2 bg-white/5 border border-white/5 rounded hover:bg-white/10 transition-colors text-[#E0E0E0]"
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
      <footer className="h-7 bg-[#1A1B1E] border-t border-[#2C2E33] px-3 flex items-center justify-between text-[11px] text-[#909296]">
        <div className="flex items-center gap-4">
          <span className="uppercase tracking-wider font-medium">{dataFormat} VIEW</span>
          <Separator orientation="vertical" className="h-3 bg-[#2C2E33]" />
          <span>{logs.length} ENTRIES</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <span>TX: <span className="text-white font-mono">{formatBytes(stats.tx)}</span></span>
            <span>RX: <span className="text-white font-mono">{formatBytes(stats.rx)}</span></span>
          </div>
          {isGeminiConfigured && (
            <>
              <Separator orientation="vertical" className="h-3 bg-[#2C2E33]" />
              <span className={`font-bold flex items-center gap-1.5 ${isAnalyzing ? 'text-[#FF9800]' : 'text-[#00D1FF]'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isAnalyzing ? 'bg-[#FF9800] animate-pulse' : 'bg-[#00D1FF]'}`} />
                {isAnalyzing ? 'AI ANALYZING...' : 'AI ENGINE READY'}
              </span>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
