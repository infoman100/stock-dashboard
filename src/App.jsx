import React, { useState, useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// 🗂️ 확장된 테마 데이터 (추후 백엔드 AI 파이프라인에서 10x10 배열로 받아올 데이터 구조)
const THEMES = [
  { 
    id: 'ai_semiconductor', 
    name: '🔥 AI & 반도체 슈퍼사이클', 
    description: '엔비디아 훈풍과 HBM 수요 폭발로 수혜를 받는 밸류체인 핵심 기업들',
    stocks: [
      { ticker: '005930.KS', name: '삼성전자', color: '#ef4444' },    
      { ticker: '000660.KS', name: 'SK하이닉스', color: '#3b82f6' },  
      { ticker: '042700.KS', name: '한미반도체', color: '#10b981' },
      { ticker: '077360.KQ', name: '캠시스', color: '#f59e0b' },
      { ticker: '036540.KQ', name: 'SFA반도체', color: '#8b5cf6' },
      { ticker: '039030.KS', name: '이오테크닉스', color: '#ec4899' }
    ]
  },
  { 
    id: 'nuclear', 
    name: '⚡ K-원전 르네상스', 
    description: '체코 원전 수주 기대감과 AI 전력 난 해소를 위한 SMR(소형모듈원전) 관련주',
    stocks: [
      { ticker: '034020.KS', name: '두산에너빌리티', color: '#ef4444' },
      { ticker: '015760.KS', name: '한국전력', color: '#3b82f6' },
      { ticker: '000720.KS', name: '현대건설', color: '#10b981' },
      { ticker: '051600.KS', name: '한전KPS', color: '#f59e0b' },
      { ticker: '053690.KS', name: '한전기술', color: '#8b5cf6' },
      { ticker: '032680.KQ', name: '우진엔텍', color: '#ec4899' }
    ]
  },
  { 
    id: 'bio_health', 
    name: '🧬 K-바이오 & 비만치료제', 
    description: '글로벌 빅파마의 비만치료제 열풍과 FDA 승인 모멘텀을 가진 바이오텍',
    stocks: [
      { ticker: '207940.KS', name: '삼성바이오로직스', color: '#ef4444' },
      { ticker: '068270.KS', name: '셀트리온', color: '#3b82f6' },
      { ticker: '000100.KS', name: '유한양행', color: '#10b981' },
      { ticker: '028300.KQ', name: 'HLB', color: '#f59e0b' },
      { ticker: '196170.KQ', name: '알테오젠', color: '#8b5cf6' },
      { ticker: '282000.KQ', name: '펩트론', color: '#ec4899' }
    ]
  },
  { 
    id: 'ev_battery', 
    name: '🔋 2차전지 & 전고체', 
    description: '전기차 캐즘(Chasm) 극복 이후 반등을 준비하는 양극재 및 전고체 배터리 핵심주',
    stocks: [
      { ticker: '373220.KS', name: 'LG에너지솔루션', color: '#ef4444' },
      { ticker: '006400.KS', name: '삼성SDI', color: '#3b82f6' },
      { ticker: '051910.KS', name: 'LG화학', color: '#10b981' },
      { ticker: '003670.KS', name: '포스코퓨처엠', color: '#f59e0b' },
      { ticker: '247540.KQ', name: '에코프로비엠', color: '#8b5cf6' },
      { ticker: '066970.KQ', name: '엘앤에프', color: '#ec4899' }
    ]
  }
];

const Typewriter = ({ text }) => {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    setDisplayedText("");
    if (!text) return;
    let i = 0;
    const timer = setInterval(() => {
      setDisplayedText(text.slice(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [text]);

  return <p className="text-sm text-blue-300 font-medium leading-relaxed whitespace-pre-line">{displayedText}</p>;
};

export default function App() {
  const [activeTheme, setActiveTheme] = useState(null);
  const [activeStocks, setActiveStocks] = useState([]); 
  const [isLoading, setIsLoading] = useState(false);
  const [rawChartData, setRawChartData] = useState([]); 
  const [selectedPeriod, setSelectedPeriod] = useState('3M'); 
  const [chartType, setChartType] = useState('price'); 
  const [watchList, setWatchList] = useState([]); 
  const [aiReport, setAiReport] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // 로고 클릭 시 홈 화면으로 돌아가기
  const goHome = () => {
    setActiveTheme(null);
    setRawChartData([]);
    setAiReport("");
  };

  const handleThemeClick = async (theme) => {
    setIsLoading(true);
    setIsAiLoading(true);
    setAiReport(""); 
    setActiveTheme(theme);
    // 기본적으로 상위 5개 종목만 먼저 켜두기 (10개가 다 켜지면 지저분하므로)
    setActiveStocks(theme.stocks.slice(0, 5).map(s => s.name));
    setRawChartData([]); 

    try {
      let mergedData = {};
      for (const stock of theme.stocks) {
        try {
          const res = await fetch(`${API_BASE_URL}/api/stock/${stock.ticker}`).then(r => r.json());
          if (res && res.data) {
            res.data.forEach(item => {
              const dateStr = item.Date.split('T')[0];
              if (!mergedData[dateStr]) mergedData[dateStr] = { time: dateStr };
              mergedData[dateStr][stock.name] = item.Close; 
            });
          }
        } catch (fetchErr) {
          console.warn(`${stock.ticker} 데이터 로딩 실패.`);
        }
      }

      const sortedData = Object.values(mergedData).sort((a, b) => new Date(a.time) - new Date(b.time));
      
      let lastKnownPrices = {}; 
      const filledData = sortedData.map(row => {
        const newRow = { ...row };
        theme.stocks.forEach(stock => {
          if (newRow[stock.name] !== undefined) lastKnownPrices[stock.name] = newRow[stock.name];
          else if (lastKnownPrices[stock.name] !== undefined) newRow[stock.name] = lastKnownPrices[stock.name];
        });
        return newRow;
      });

      setRawChartData(filledData);

      fetch(`${API_BASE_URL}/api/theme-report/${theme.id}`)
        .then(res => res.json())
        .then(data => setAiReport(data?.report || "분석 데이터를 불러올 수 없습니다."))
        .catch(() => setAiReport("서버 연결 지연."))
        .finally(() => setIsAiLoading(false));

    } catch (error) {
      console.error("로딩 에러:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getEChartsOption = () => {
    if (rawChartData.length === 0 || !activeTheme) return {};

    const lastDataPoint = rawChartData[rawChartData.length - 1];
    let startDate = new Date(lastDataPoint.time);
    
    if (selectedPeriod === '1M') startDate.setMonth(startDate.getMonth() - 1);
    else if (selectedPeriod === '3M') startDate.setMonth(startDate.getMonth() - 3);
    else if (selectedPeriod === '1Y') startDate.setFullYear(startDate.getFullYear() - 1);
    else if (selectedPeriod === '3Y') startDate.setFullYear(startDate.getFullYear() - 3);
    else if (selectedPeriod === '5Y') startDate.setFullYear(startDate.getFullYear() - 5);

    const filteredData = rawChartData.filter(d => new Date(d.time) >= startDate);
    if (filteredData.length === 0) return {};

    const series = activeTheme.stocks
      .filter(s => activeStocks.includes(s.name))
      .map(stock => {
        let basePrice = null;
        const data = filteredData.map(d => {
          if (d[stock.name] === undefined) return null;
          if (basePrice === null) basePrice = d[stock.name];
          const val = chartType === 'price' ? d[stock.name] : parseFloat((((d[stock.name] - basePrice) / basePrice) * 100).toFixed(2));
          return [new Date(d.time).getTime(), val];
        }).filter(p => p !== null);

        return {
          name: stock.name,
          type: 'line',
          showSymbol: false,
          data: data,
          itemStyle: { color: stock.color },
          lineStyle: { width: 2.5 },
          emphasis: { focus: 'series', lineStyle: { width: 4 } }
        };
      });

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#334155',
        textStyle: { color: '#f8fafc' },
        axisPointer: { type: 'cross', label: { backgroundColor: '#334155' } },
        formatter: function (params) {
          if (!params || params.length === 0) return '';
          let date = new Date(params[0].value[0]);
          let dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          
          let html = `<div style="font-size:11px;font-weight:900;color:#94a3b8;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #334155;letter-spacing:1px;">${dateStr}</div>`;
          
          params.forEach(p => {
            const val = chartType === 'price' ? p.value[1].toLocaleString() + '원' : p.value[1].toFixed(2) + '%';
            html += `
              <div style="display:flex;justify-content:space-between;align-items:center;gap:24px;margin-bottom:6px;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="width:10px;height:10px;border-radius:50%;background-color:${p.color};box-shadow:0 0 8px rgba(255,255,255,0.2);"></span>
                  <span style="font-size:13px;font-weight:bold;color:#e2e8f0;">${p.seriesName}</span>
                </div>
                <span style="font-size:14px;font-family:monospace;font-weight:900;color:${p.color};">${val}</span>
              </div>`;
          });
          return html;
        }
      },
      grid: { left: '2%', right: '2%', bottom: '12%', top: '5%', containLabel: true },
      xAxis: { type: 'time', axisLine: { lineStyle: { color: '#334155' } }, splitLine: { show: false }, axisLabel: { color: '#94a3b8', fontSize: 11 } },
      yAxis: { type: 'value', scale: true, splitLine: { lineStyle: { color: 'rgba(51, 65, 85, 0.3)', type: 'dashed' } }, axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (val) => chartType === 'price' ? val.toLocaleString() : val + '%' } },
      dataZoom: [
        { type: 'inside', xAxisIndex: 0, filterMode: 'filter' },
        { type: 'slider', xAxisIndex: 0, height: 24, bottom: 0, borderColor: 'transparent', backgroundColor: 'rgba(15, 23, 42, 0.5)', fillerColor: 'rgba(59, 130, 246, 0.15)', handleStyle: { color: '#3b82f6', borderColor: '#60a5fa' }, textStyle: { color: '#64748b' } }
      ],
      series: series,
      animationDuration: 500
    };
  };

  const toggleStock = (stockName) => {
    setActiveStocks(prev => prev.includes(stockName) ? prev.filter(n => n !== stockName) : [...prev, stockName]);
  };

  const toggleWatchList = (stock, e) => {
    e.stopPropagation();
    setWatchList(prev => prev.find(item => item.ticker === stock.ticker) ? prev.filter(item => item.ticker !== stock.ticker) : [...prev, stock]);
  };

  return (
    <div className="flex h-screen bg-[#0f172a] text-slate-300 font-sans overflow-hidden selection:bg-blue-500/30">
      
      {/* 좌측 사이드바 */}
      <aside className="w-72 bg-[#0b0f19] border-r border-slate-800 flex flex-col z-10 shadow-[4px_0_24px_rgba(0,0,0,0.5)]">
        <div className="p-6 border-b border-slate-800 cursor-pointer hover:bg-slate-900 transition-colors" onClick={goHome}>
          <h1 className="text-2xl font-black text-white tracking-tighter italic">STOCK INSIGHT</h1>
          <p className="text-xs text-slate-500 mt-1 font-bold">AI Theme Analyzer</p>
        </div>
        <nav className="flex-1 p-4 space-y-8 overflow-y-auto">
          <div>
            <p className="text-[10px] font-black text-slate-500 mb-3 px-2 tracking-widest uppercase flex items-center justify-between">
              🔥 Today's Themes
              <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-[8px]">LIVE</span>
            </p>
            <div className="space-y-2">
              {THEMES.map((theme, idx) => (
                <button 
                  key={theme.id} 
                  onClick={() => handleThemeClick(theme)} 
                  className={`w-full flex items-center gap-3 text-left px-4 py-3.5 rounded-xl text-sm font-bold transition-all border ${activeTheme?.id === theme.id ? 'bg-blue-600/10 text-blue-400 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'border-transparent text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'}`}
                >
                  <span className={`text-xs font-black ${idx < 3 ? 'text-blue-500' : 'text-slate-600'}`}>{idx + 1}</span>
                  <span className="truncate">{theme.name.split(' ')[1]}</span>
                </button>
              ))}
            </div>
          </div>
          
          <div className="pt-4 border-t border-slate-800">
            <p className="text-[10px] font-black text-slate-500 mb-3 px-2 tracking-widest uppercase">⭐ My Watchlist</p>
            {watchList.length === 0 ? (
              <div className="mx-2 p-4 bg-slate-900/50 rounded-xl border border-slate-800 border-dashed text-center">
                <p className="text-xs text-slate-500">차트에서 별표를 눌러<br/>관심 종목을 추가해보세요.</p>
              </div>
            ) : (
              <div className="space-y-2 mx-2">
                {watchList.map(stock => (
                  <div key={stock.ticker} className="flex items-center justify-between p-3 bg-slate-800/40 rounded-lg border border-slate-700/50 group">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stock.color }}></div>
                      <span className="text-sm font-bold text-slate-200">{stock.name}</span>
                    </div>
                    <button onClick={(e) => toggleWatchList(stock, e)} className="text-yellow-400 text-xs opacity-50 group-hover:opacity-100 transition-opacity">★</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </nav>
      </aside>

      {/* 우측 메인 영역 */}
      <main className="flex-1 flex flex-col relative bg-gradient-to-br from-[#0f172a] to-[#020617] overflow-y-auto">
        {!activeTheme ? (
          // 🚀 [신규] 10x10 구조를 위한 토스증권 스타일 대시보드 홈 화면
          <div className="p-10 max-w-6xl mx-auto w-full h-full flex flex-col animate-fade-in">
            <div className="mb-10">
               <h2 className="text-4xl font-black text-white tracking-tight mb-2">Market Insight</h2>
               <p className="text-slate-400 font-medium">AI가 실시간 뉴스 흐름을 분석해 선별한 상위 10개 테마입니다.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 pb-10">
              {THEMES.map((theme, index) => (
                <div 
                  key={theme.id} 
                  onClick={() => handleThemeClick(theme)}
                  className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 p-6 rounded-3xl hover:bg-[#1e293b]/80 hover:border-blue-500/50 transition-all cursor-pointer group shadow-lg hover:shadow-[0_10px_40px_rgba(59,130,246,0.15)] flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="bg-slate-800 text-slate-300 font-black text-xs px-3 py-1 rounded-full shadow-inner group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        TOP {index + 1}
                      </span>
                      <span className="text-slate-500 group-hover:text-blue-400 transition-colors">➔</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">{theme.name}</h3>
                    <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed mb-6">{theme.description}</p>
                  </div>
                  
                  <div>
                    <p className="text-[10px] font-black tracking-widest text-slate-500 mb-3 uppercase">💡 주요 대장주</p>
                    <div className="flex flex-wrap gap-2">
                      {theme.stocks.slice(0, 4).map(stock => (
                        <span key={stock.ticker} className="bg-[#0f172a] border border-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-lg shadow-sm font-medium">
                          {stock.name}
                        </span>
                      ))}
                      {theme.stocks.length > 4 && (
                        <span className="bg-slate-800/50 text-slate-400 text-xs px-3 py-1.5 rounded-lg font-medium">
                          +{theme.stocks.length - 4}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* 임시 더미 카드 (AI 연동 후 삭제) */}
              <div className="bg-slate-900/30 border border-slate-800 border-dashed p-6 rounded-3xl flex flex-col items-center justify-center text-slate-600 min-h-[220px]">
                 <span className="text-3xl mb-2 animate-bounce">🤖</span>
                 <p className="text-sm font-bold">AI가 추가 테마를 분석 중입니다...</p>
                 <p className="text-xs mt-1">곧 10개의 테마가 모두 채워질 예정입니다.</p>
              </div>
            </div>
          </div>
        ) : (
          // 🚀 기존 ECharts 상세 화면 (상단 타이틀에 뒤로가기 버튼 추가)
          <div className="p-8 max-w-6xl mx-auto w-full h-full flex flex-col">
            <div className="flex justify-between items-end mb-6">
              <div>
                <button onClick={goHome} className="text-slate-500 hover:text-blue-400 text-sm font-bold mb-2 flex items-center gap-2 transition-colors">
                  ← 홈으로 돌아가기
                </button>
                <h2 className="text-3xl font-black text-white tracking-tight">{activeTheme.name}</h2>
              </div>
              <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700 shadow-inner hidden md:flex">
                {['1M', '3M', '1Y', '3Y', '5Y'].map(period => (
                  <label key={period} className={`cursor-pointer px-5 py-2 text-xs font-black rounded-lg transition-all ${selectedPeriod === period ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
                    <input type="radio" name="period" value={period} checked={selectedPeriod === period} onChange={(e) => setSelectedPeriod(e.target.value)} className="hidden"/>
                    {period === '1M' ? '1개월' : period === '3M' ? '3개월' : period === '1Y' ? '1년' : period === '3Y' ? '3년' : '5년'}
                  </label>
                ))}
              </div>
            </div>
            
            {/* 종목 컨트롤 패널 */}
            <div className="bg-[#1e293b]/80 backdrop-blur-md border border-slate-700 p-5 rounded-2xl mb-6 flex justify-between items-center shadow-lg">
              <div className="flex-1">
                <p className="text-[10px] font-black text-slate-500 mb-3 uppercase tracking-widest">비교 대상 종목 (최대 10개)</p>
                <div className="flex flex-wrap gap-3">
                  {activeTheme.stocks.map(stock => {
                    const isActive = activeStocks.includes(stock.name);
                    const isStarred = watchList.find(w => w.ticker === stock.ticker);
                    return (
                      <div key={stock.ticker} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${isActive ? 'bg-slate-800 border-slate-600 shadow-md' : 'border-transparent opacity-40 hover:opacity-100'}`}>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={isActive} onChange={() => toggleStock(stock.name)} className="hidden" />
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stock.color }}></div>
                          <span className="text-sm font-bold text-slate-200">{stock.name}</span>
                        </label>
                        <button onClick={(e) => toggleWatchList(stock, e)} className={`ml-1 ${isStarred ? 'text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]' : 'text-slate-600 hover:text-yellow-400'}`}>{isStarred ? '★' : '☆'}</button>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="border-l border-slate-700 pl-6 ml-4 hidden lg:block">
                 <p className="text-[10px] font-black text-slate-500 mb-3 uppercase tracking-widest">조회 기준</p>
                 <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800 shadow-inner">
                   <button onClick={() => setChartType('price')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${chartType === 'price' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>주가(원)</button>
                   <button onClick={() => setChartType('return')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${chartType === 'return' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>수익률(%)</button>
                 </div>
              </div>
            </div>

            <div className="flex-1 bg-[#1e293b]/60 backdrop-blur-sm border border-slate-700 rounded-3xl relative shadow-[0_8px_30px_rgb(0,0,0,0.5)] overflow-hidden flex flex-col p-4 min-h-[350px]">
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0f172a]/60 backdrop-blur-md z-20">
                  <div className="w-10 h-10 border-4 border-slate-600 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
              )}
              {rawChartData.length > 0 && !isLoading && (
                <ReactECharts 
                  option={getEChartsOption()} 
                  style={{ height: '100%', width: '100%' }} 
                  notMerge={true} 
                  lazyUpdate={true}
                />
              )}
            </div>
            
            <div className="mt-5 bg-gradient-to-r from-blue-900/30 to-[#0f172a] p-5 rounded-2xl border border-blue-900/50 flex gap-4 min-h-[100px] shadow-lg">
               <span className="text-3xl animate-pulse">🤖</span>
               <div className="flex-1">
                 <h4 className="text-xs font-black tracking-widest text-blue-400 mb-2 uppercase flex items-center gap-2">
                   AI Theme Insight <span className="bg-blue-600/30 px-2 py-0.5 rounded text-[10px] text-blue-300">PRO</span>
                 </h4>
                 {isAiLoading ? (
                   <div className="flex space-x-1 mt-3">
                     <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                     <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-75"></div>
                     <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-150"></div>
                   </div>
                 ) : (
                   <Typewriter text={aiReport} />
                 )}
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}