
import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  Sparkles, 
  Download, 
  History, 
  Loader2, 
  Trash2, 
  RefreshCw, 
  Sun, 
  Moon, 
  ChevronLeft, 
  ChevronRight, 
  Info, 
  X, 
  CheckCircle2, 
  Key, 
  ShieldCheck, 
  ShieldAlert, 
  Users, 
  MapPin, 
  Building2, 
  UserCheck, 
  Home, 
  Trees 
} from 'lucide-react';
import { WorkMode, PlacementType, BackgroundType, AISuggestion, GenerationHistory, AnalysisResult } from './types.ts';
import { analyzeProductImage, generateStudioShot, validateApiKey } from './services/geminiService.ts';

// IndexedDB 설정
const DB_NAME = 'RSA_GoodsShot_History_V10';
const STORE_NAME = 'history';
const DB_VERSION = 1;
const MAX_HISTORY = 10;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveHistoryDB = async (item: GenerationHistory) => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(item);
  return tx.oncomplete;
};

const deleteHistoryDB = async (id: string) => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(id);
  return tx.oncomplete;
};

const getAllHistoryDB = async (): Promise<GenerationHistory[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result as GenerationHistory[]).sort((a, b) => b.createdAt - a.createdAt));
    request.onerror = () => reject(request.error);
  });
};

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [isHowToOpen, setIsHowToOpen] = useState(false);
  const [isApiSettingsOpen, setIsApiSettingsOpen] = useState(false);
  
  const [customApiKey, setCustomApiKey] = useState(() => localStorage.getItem('rsa_custom_api_key') || '');
  const [isKeyValidating, setIsKeyValidating] = useState(false);
  const [keyValidationStatus, setKeyValidationStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [keyValidationMessage, setKeyValidationMessage] = useState('');

  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [workMode, setWorkMode] = useState<WorkMode>('BACKGROUND');
  const [placementType, setPlacementType] = useState<PlacementType>('PEOPLE');
  const [backgroundType, setBackgroundType] = useState<BackgroundType>('INDOOR');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<AISuggestion | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 툴팁 상태 관리
  const [hoveredTip, setHoveredTip] = useState<{title: string, content: string, x: number, y: number} | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) { root.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
    else { root.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  }, [isDarkMode]);

  useEffect(() => {
    getAllHistoryDB().then(data => setHistory(data.slice(0, MAX_HISTORY))).catch(console.error);
  }, []);

  const handleApiKeyValidation = async () => {
    if (!customApiKey.trim()) return alert("API 키를 입력해주세요.");
    setIsKeyValidating(true);
    setKeyValidationStatus('IDLE');
    setKeyValidationMessage("구글 서버 독립 검증 중...");
    const result = await validateApiKey(customApiKey);
    setIsKeyValidating(false);
    setKeyValidationStatus(result.success ? 'SUCCESS' : 'ERROR');
    setKeyValidationMessage(result.message);
  };

  const saveApiKey = () => {
    localStorage.setItem('rsa_custom_api_key', customApiKey);
    setIsApiSettingsOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setOriginalImage(base64);
        setAnalysis(null);
        setSelectedSuggestion(null);
        setResultImage(null);
        setError(null);
        handleAnalysis(base64, workMode, placementType, backgroundType);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalysis = async (img: string, mode: WorkMode, pType: PlacementType, bType: BackgroundType) => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeProductImage(img, mode, pType, bType);
      setAnalysis(result);
    } catch (err: any) {
      setError(err.message || "분석 실패. API 설정을 확인하세요.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleModeChange = (newMode: WorkMode) => {
    setWorkMode(newMode);
    if (originalImage) {
      setSelectedSuggestion(null);
      handleAnalysis(originalImage, newMode, placementType, backgroundType);
    }
  };

  const handlePlacementChange = (newPType: PlacementType) => {
    setPlacementType(newPType);
    if (originalImage && workMode === 'MODEL') {
      setSelectedSuggestion(null);
      handleAnalysis(originalImage, 'MODEL', newPType, backgroundType);
    }
  };

  const handleBackgroundChange = (newBType: BackgroundType) => {
    setBackgroundType(newBType);
    if (originalImage && workMode === 'BACKGROUND') {
      setSelectedSuggestion(null);
      handleAnalysis(originalImage, 'BACKGROUND', placementType, newBType);
    }
  };

  const handleGenerate = async () => {
    if (!originalImage || !selectedSuggestion) return;
    setIsGenerating(true);
    setError(null);
    try {
      const result = await generateStudioShot(originalImage, selectedSuggestion.prompt);
      setResultImage(result);
      const newItem: GenerationHistory = {
        id: Date.now().toString(),
        originalImage: "", 
        resultImage: result,
        mode: workMode,
        styleTitle: selectedSuggestion.title,
        createdAt: Date.now(),
      };
      await saveHistoryDB(newItem);
      setHistory(prev => [newItem, ...prev].slice(0, MAX_HISTORY));
    } catch (err: any) {
      setError(err.message || "생성 실패");
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteHistory = async (id: string) => {
    await deleteHistoryDB(id);
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const scrollGallery = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const amount = direction === 'left' ? -300 : 300;
      scrollContainerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  // 툴팁 노출 핸들러
  const handleSuggestionHover = (e: React.MouseEvent, s: AISuggestion) => {
    setHoveredTip({
      title: s.title,
      content: s.description,
      x: e.clientX,
      y: e.clientY
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      
      {/* 전역 툴팁 컴포넌트 */}
      {hoveredTip && (
        <div 
          className="fixed z-[999] pointer-events-none animate-in fade-in zoom-in-95 duration-200"
          style={{ 
            left: hoveredTip.x + 15, 
            top: hoveredTip.y + 15,
            maxWidth: '300px'
          }}
        >
          <div className="bg-slate-900/90 dark:bg-indigo-950/90 backdrop-blur-xl border border-white/10 dark:border-indigo-500/30 p-5 rounded-3xl shadow-2xl">
            <h4 className="text-indigo-400 font-black text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
              <Sparkles className="w-3 h-3" /> {hoveredTip.title}
            </h4>
            <p className="text-white text-[13px] font-bold leading-relaxed">{hoveredTip.content}</p>
            <div className="absolute -left-2 top-2 w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[10px] border-r-slate-900/90 dark:border-r-indigo-950/90" />
          </div>
        </div>
      )}

      {/* 가이드 모달 */}
      {isHowToOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
            <div className="p-8 bg-indigo-600 text-white flex justify-between items-center">
              <h2 className="text-xl font-black flex items-center gap-2"><Info className="w-6 h-6" /> 이용 가이드</h2>
              <button onClick={() => setIsHowToOpen(false)}><X className="w-6 h-6" /></button>
            </div>
            <div className="p-10 space-y-6">
              <div className="p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl border-l-4 border-indigo-500">
                <h3 className="font-black text-indigo-500 mb-1">1. 이미지 업로드</h3>
                <p className="text-sm font-bold opacity-70">상품 이미지를 업로드하세요. 배경이 단순할수록 좋습니다.</p>
              </div>
              <div className="p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl border-l-4 border-indigo-500">
                <h3 className="font-black text-indigo-500 mb-1">2. 연출 및 서브 옵션</h3>
                <p className="text-sm font-bold opacity-70">배경합성(실내/실외) 또는 모델/장소(인물/건물)를 상세히 선택하세요.</p>
              </div>
              <div className="p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl border-l-4 border-indigo-500">
                <h3 className="font-black text-indigo-500 mb-1">3. AI 분석 및 생성</h3>
                <p className="text-sm font-bold opacity-70">AI의 5가지 제안 중 하나를 골라 고화질 화보를 완성합니다.</p>
              </div>
              <button onClick={() => setIsHowToOpen(false)} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-lg">이해했습니다</button>
            </div>
          </div>
        </div>
      )}

      {/* API 설정 */}
      {isApiSettingsOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
              <h2 className="text-xl font-black flex items-center gap-2 text-indigo-400"><Key className="w-5 h-5" /> API Settings</h2>
              <button onClick={() => setIsApiSettingsOpen(false)}><X className="w-6 h-6" /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Gemini API Key</label>
                <input 
                  type="password" 
                  value={customApiKey} 
                  onChange={(e) => {setCustomApiKey(e.target.value); setKeyValidationStatus('IDLE');}} 
                  placeholder="API 키를 입력하세요..." 
                  className={`w-full px-6 py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl border-2 outline-none font-mono text-sm transition-all ${keyValidationStatus === 'SUCCESS' ? 'border-emerald-500' : keyValidationStatus === 'ERROR' ? 'border-red-500' : 'border-slate-200 dark:border-slate-700 focus:border-indigo-500'}`}
                />
                {keyValidationMessage && (
                  <p className={`text-[11px] font-black px-1 ${keyValidationStatus === 'SUCCESS' ? 'text-emerald-500' : 'text-red-500'}`}>{keyValidationMessage}</p>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <button onClick={handleApiKeyValidation} disabled={isKeyValidating} className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-slate-200 transition-all">
                  {isKeyValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} 독립 서버 검증
                </button>
                <button onClick={saveApiKey} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-500/20 active:scale-95">설정 저장</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <header className="sticky top-0 z-50 w-full px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 rounded-2xl text-white shadow-lg"><Sparkles className="w-6 h-6" /></div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">RSA Goods Shot</h1>
            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-1">Premium Creative Engine</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsHowToOpen(true)} className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-black text-sm border border-indigo-100 dark:border-indigo-800 active:scale-95 transition-all"><Info className="w-4 h-4" /> 가이드</button>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all">{isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>
          <button onClick={() => setIsApiSettingsOpen(true)} className="p-3.5 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-lg active:scale-95"><Key className="w-5 h-5" /></button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-6">
        {!originalImage ? (
          <div className="flex flex-col gap-10">
            {/* 업로드 필드 */}
            <div onClick={() => fileInputRef.current?.click()} className="group h-[320px] border-4 border-dashed border-slate-300 dark:border-slate-700 rounded-[3rem] flex flex-col items-center justify-center gap-6 cursor-pointer hover:border-indigo-500 hover:bg-white dark:hover:bg-slate-900/40 transition-all duration-500 shadow-sm relative overflow-hidden">
              <div className="p-8 bg-slate-100 dark:bg-slate-800 rounded-[2rem] group-hover:scale-110 transition-transform"><Upload className="w-12 h-12 text-slate-400 group-hover:text-indigo-500" /></div>
              <div className="text-center px-8 z-10">
                <p className="text-3xl font-black text-slate-800 dark:text-slate-100 mb-2 tracking-tight">상품 이미지 업로드</p>
                <p className="text-slate-500 dark:text-slate-400 font-bold">AI가 분석하여 최적의 커머셜 스타일을 제안합니다</p>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
            </div>

            {/* 브랜드 섹션 */}
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="text-5xl md:text-6xl font-black text-slate-800 dark:text-white tracking-tighter text-3d flex items-center justify-center gap-6 flex-wrap">
                <span>2026</span>
                <span className="uppercase">RSA AI FORUM</span>
              </div>
              <p className="text-[12px] font-black uppercase tracking-[0.6em] text-slate-400 dark:text-slate-600 opacity-80">Premium Commercial Design Workflow</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-700">
            {/* 좌측 컨트롤 */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-6 shadow-sm">
                <div className="flex justify-between items-center mb-5">
                  <h2 className="text-base font-black flex items-center gap-2"><ImageIcon className="w-5 h-5 text-indigo-500" /> 원본 상품</h2>
                  <button onClick={() => setOriginalImage(null)} className="text-[10px] font-black text-slate-400 hover:text-indigo-500 flex items-center gap-1 transition-colors"><RefreshCw className="w-3 h-3" /> 교체</button>
                </div>
                <div className="aspect-square max-h-[260px] mx-auto rounded-3xl overflow-hidden bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex items-center justify-center p-6 shadow-inner relative group">
                  <img src={originalImage} className="max-w-full max-h-full object-contain drop-shadow-2xl transition-transform group-hover:scale-105" />
                </div>
                <div className="mt-6 space-y-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Step 1. 메인 연출 선택</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => handleModeChange('BACKGROUND')} className={`py-4 rounded-xl border-2 transition-all font-black text-sm active:scale-95 ${workMode === 'BACKGROUND' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500'}`}>배경 합성</button>
                    <button onClick={() => handleModeChange('MODEL')} className={`py-4 rounded-xl border-2 transition-all font-black text-sm active:scale-95 ${workMode === 'MODEL' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500'}`}>모델 / 장소</button>
                  </div>

                  {workMode === 'BACKGROUND' && (
                    <div className="animate-in slide-in-from-top-2 duration-300">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1 mb-3">Step 2. 상세 환경</h3>
                      <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl flex gap-1 border border-slate-200 dark:border-slate-700">
                        <button onClick={() => handleBackgroundChange('INDOOR')} className={`flex-1 py-2.5 rounded-lg font-black text-[12px] flex items-center justify-center gap-2 transition-all ${backgroundType === 'INDOOR' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500'}`}><Home className="w-4 h-4" /> 실내</button>
                        <button onClick={() => handleBackgroundChange('OUTDOOR')} className={`flex-1 py-2.5 rounded-lg font-black text-[12px] flex items-center justify-center gap-2 transition-all ${backgroundType === 'OUTDOOR' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500'}`}><Trees className="w-4 h-4" /> 실외</button>
                      </div>
                    </div>
                  )}

                  {workMode === 'MODEL' && (
                    <div className="animate-in slide-in-from-top-2 duration-300">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1 mb-3">Step 2. 배치 유형</h3>
                      <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl flex gap-1 border border-slate-200 dark:border-slate-700">
                        <button onClick={() => handlePlacementChange('PEOPLE')} className={`flex-1 py-2.5 rounded-lg font-black text-[12px] flex items-center justify-center gap-2 transition-all ${placementType === 'PEOPLE' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500'}`}><UserCheck className="w-4 h-4" /> 인물 모델</button>
                        <button onClick={() => handlePlacementChange('PLACE')} className={`flex-1 py-2.5 rounded-lg font-black text-[12px] flex items-center justify-center gap-2 transition-all ${placementType === 'PLACE' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500'}`}><Building2 className="w-4 h-4" /> 건물 / 장소</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 스타일 제안 */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-6 shadow-sm flex flex-col min-h-[350px]">
                <h2 className="text-base font-black mb-5 flex items-center gap-2"><Sparkles className="w-5 h-5 text-amber-500" /> AI 스타일 제안</h2>
                {isAnalyzing ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8">
                    <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
                    <p className="text-sm font-black text-slate-500">최적의 연출 분석 중...</p>
                  </div>
                ) : analysis ? (
                  <div className="space-y-4 flex-1 flex flex-col">
                    <div className="space-y-2 max-h-[250px] overflow-y-auto no-scrollbar flex-1">
                      {analysis.suggestions.map((s) => (
                        <button 
                          key={s.id} 
                          onClick={() => setSelectedSuggestion(s)} 
                          onMouseEnter={(e) => handleSuggestionHover(e, s)}
                          onMouseMove={(e) => setHoveredTip(prev => prev ? {...prev, x: e.clientX, y: e.clientY} : null)}
                          onMouseLeave={() => setHoveredTip(null)}
                          className={`w-full text-left p-4 rounded-xl border-2 transition-all group active:scale-[0.98] ${selectedSuggestion?.id === s.id ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-500' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-700 hover:border-slate-300'}`}
                        >
                          <h4 className={`font-black text-sm mb-1 ${selectedSuggestion?.id === s.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'}`}>{s.title}</h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 font-bold leading-relaxed">{s.description}</p>
                        </button>
                      ))}
                    </div>
                    <button onClick={handleGenerate} disabled={!selectedSuggestion || isGenerating} className="w-full mt-4 py-5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl active:scale-95 disabled:opacity-50">
                      {isGenerating ? <><Loader2 className="w-5 h-5 animate-spin" /> 렌더링 중...</> : <><Sparkles className="w-5 h-5" /> 프리미엄 화보 생성</>}
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400 font-bold text-sm text-center px-6">연출 모드를 변경하면 AI가 실시간으로 스타일을 다시 분석합니다.</div>
                )}
                {error && <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-100 rounded-xl text-[10px] font-black">{error}</div>}
              </div>
            </div>

            {/* 우측 결과 */}
            <div className="lg:col-span-7">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[3rem] p-8 flex flex-col items-center justify-center min-h-[600px] shadow-2xl relative overflow-hidden">
                {!resultImage && !isGenerating ? (
                  <div className="text-center space-y-6">
                    <ImageIcon className="w-16 h-16 text-slate-200 dark:text-slate-700 mx-auto" />
                    <h3 className="text-xl font-black text-slate-400 tracking-tight leading-relaxed">생성된 화보가 이곳에 나타납니다.</h3>
                  </div>
                ) : isGenerating ? (
                  <div className="flex flex-col items-center gap-10">
                    <div className="relative"><Loader2 className="w-16 h-16 animate-spin text-indigo-500" /><Sparkles className="w-6 h-6 text-indigo-500 absolute inset-0 m-auto animate-pulse" /></div>
                    <p className="text-2xl font-black animate-pulse text-indigo-600">Rendering Premium Shot...</p>
                  </div>
                ) : (
                  <div className="w-full space-y-6 animate-in zoom-in-95 duration-700">
                    <div className="w-full aspect-square rounded-[2.5rem] overflow-hidden border-4 border-slate-100 dark:border-slate-800 shadow-2xl relative group">
                      <img src={resultImage!} className="w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-105" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                        <button onClick={() => { const l = document.createElement('a'); l.href = resultImage!; l.download = 'rsa_shot.png'; l.click(); }} className="px-10 py-5 bg-white text-slate-900 rounded-2xl font-black text-xl flex items-center gap-4 hover:scale-110 transition-transform"><Download className="w-6 h-6" /> 저장하기</button>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <button onClick={() => { const l = document.createElement('a'); l.href = resultImage!; l.download = 'rsa_shot.png'; l.click(); }} className="flex-1 py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xl shadow-xl shadow-indigo-500/30 active:scale-95 transition-all">다운로드</button>
                      <button onClick={handleGenerate} className="px-8 py-5 border-3 border-slate-200 dark:border-slate-700 rounded-2xl font-black hover:border-indigo-500 transition-all active:scale-95"><RefreshCw className="w-6 h-6" /></button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 히스토리 */}
        {history.length > 0 && (
          <div className="pt-16 border-t border-slate-200 dark:border-slate-800 animate-in fade-in duration-1000">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black flex items-center gap-3"><History className="w-6 h-6 text-indigo-500" /> 나의 히스토리 (최대 10개)</h2>
              <div className="flex gap-2">
                <button onClick={() => scrollGallery('left')} className="p-3 bg-white dark:bg-slate-900 rounded-full shadow hover:bg-slate-50 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                <button onClick={() => scrollGallery('right')} className="p-3 bg-white dark:bg-slate-900 rounded-full shadow hover:bg-slate-50 transition-colors"><ChevronRight className="w-5 h-5" /></button>
              </div>
            </div>
            <div ref={scrollContainerRef} className="flex gap-6 overflow-x-auto pb-6 no-scrollbar scroll-smooth">
              {history.map((item) => (
                <div key={item.id} className="min-w-[280px] w-[280px] bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 overflow-hidden group shadow-md hover:shadow-xl transition-all">
                  <div className="aspect-square relative overflow-hidden bg-slate-50 dark:bg-slate-800">
                    <img src={item.resultImage} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[1.5s]" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 p-6 backdrop-blur-[2px]">
                      <button onClick={() => { const l = document.createElement('a'); l.href = item.resultImage; l.download = 'rsa_shot.png'; l.click(); }} className="w-full py-3 bg-white text-slate-900 rounded-xl font-black text-sm active:scale-95">다운로드</button>
                      <button onClick={() => deleteHistory(item.id)} className="w-full py-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-black text-sm hover:bg-red-500/30 active:scale-95">삭제</button>
                    </div>
                  </div>
                  <div className="p-5">
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">{item.mode === 'BACKGROUND' ? '배경 합성' : '모델/장소'}</p>
                    <h4 className="text-sm font-black text-slate-700 dark:text-slate-200 truncate">{item.styleTitle}</h4>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* 푸터 */}
      <footer className="py-12 border-t border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950/20 flex flex-col items-center justify-center gap-4">
        <div className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 flex flex-col md:flex-row items-center gap-6 md:gap-12 opacity-80">
          <p className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-indigo-500" /> RSA Goods Shot AI STUDIO</p>
          <div className="hidden md:block w-1.5 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full"></div>
          <p className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Professional Workflow</p>
          <div className="hidden md:block w-1.5 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full"></div>
          <p className="flex items-center gap-2">2026 RSA AI FORUM - All Rights Reserved</p>
        </div>
      </footer>
    </div>
  );
}
