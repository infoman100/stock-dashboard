import React, { useState, useMemo, useEffect, useRef } from 'react';
// 🚀 [해결책 1] Vercel이 코드를 삭제하지 못하도록 통째로 가져오는 방식
import * as LightweightCharts from 'lightweight-charts';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const THEMES = [
  { 
    id: 'ai_hbm', 
    name: '🔥 AI & 반도체 대장주', 
    stocks: [
      { ticker: '005930.KS', name: '삼성전자', color: '#ef4444' },    
      { ticker: '000660.KS', name: 'SK하이닉스', color: '#3b82f6' },  
      { ticker: '042700.KS', name: '한미반도체', color: '#10b981' }
    ]
  },
  { 
    id: 'nuclear', 
    name: '⚡ K-원전 르네상스', 
    stocks: [
      { ticker: '034020.KS', name: '두산에너빌리티', color: '#ef4444' },
      { ticker: '015760.KS', name: '한국전력', color: '#3b82f6' },
      { ticker: '000720.KS', name: '현대건설', color: '#10b981' },
      { ticker: '051600.KS', name: '한전KPS', color: '#f59e0b' },
      { ticker: '053690.KS', name: '한전기술', color: '#8b5cf6' }
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

// 🚀 [해결책 2] 다른 화면과 충돌하지 않도록 완전히 격리시킨 "독립형 차트 컴포넌트"
const TradingChart = ({ rawChartData, selectedPeriod, chartType, activeTheme, activeStocks }) => {
  const chartContainerRef = useRef(null);

  useEffect(() => {
    if (!chartContainerRef.current || rawChartData.length === 0 || !activeTheme) return;

    // 데이터 기간 자르기
    const lastDataPoint = rawChartData[rawChartData.length - 1];
    if (!lastDataPoint) return; 
    
    const endDate = new Date(lastDataPoint.time);
    let startDate = new Date(endDate);

    if (selectedPeriod === '1M') startDate.setMonth(startDate.getMonth() - 1);
    else if (selectedPeriod === '3M') startDate.setMonth(startDate.getMonth() - 3);
    else if (selectedPeriod === '1Y') startDate.setFullYear(startDate.getFullYear() - 1);
    else if (selectedPeriod === '3Y') startDate.setFullYear(startDate.getFullYear() - 3);
    else if (selectedPeriod === '5Y') startDate.setFullYear(startDate.getFullYear() - 5);

    const filteredData = rawChartData.filter(d => new Date(d.time) >= startDate);
    if (filteredData.length === 0) return;

    // 도화지 초기화
    chartContainerRef.current.innerHTML = '';

    // 차트 생성 (통째로 가져온 LightweightCharts 모듈 사용)
    const chart = LightweightCharts.createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight || 400,
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: 'rgba(51, 65, 85, 0.2)' }, horzLines: { color: 'rgba(51, 65, 85, 0.2)' } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, fixLeftEdge: true, fixRightEdge: true },
      crosshair: { mode: LightweightCharts.CrosshairMode.Magnet },
    });

    const toolTip = document.createElement('div');
    toolTip.className = 'absolute top-4 left-4 z-50 pointer-events-none bg-[#0f172a]/95 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl transition-opacity opacity-0 min-w-[200px]';
    chartContainerRef.current.appendChild(toolTip);

    const seriesMap = new Map();

    // 종목 라인 생성
    activeTheme.stocks.forEach(stock => {
      if (!activeStocks.includes(stock.name)) return;

      const lineSeries = chart.addLineSeries({
        color: stock.color,
        lineWidth: 2.5,
        crosshairMarkerRadius: 5,
      });

      let basePrice = null;
      const dataPoints = filteredData.map(d => {
        if (d[stock.name] === undefined) return null;
        if (basePrice === null) basePrice = d[stock.name];
        const val = chartType === 'price' ? d[stock.name] : (((d[stock.name] - basePrice) / basePrice) * 100);
        return { time: d.time, value: val };
      }).filter(p => p !== null);

      if (dataPoints.length > 0) {
        lineSeries.setData(dataPoints);
        seriesMap.set(stock.name, { series: lineSeries, color: stock.color });
      }
    });

    // 툴팁 연동
    chart.subscribeCrosshairMove(param => {
      if (!param.point || !param.time || param.point.x < 0 || param.point.y < 0) {
        toolTip.style.opacity = '0';
      } else {
        toolTip.style.opacity = '1';
        let html = `<div class="text-xs font-black tracking-widest text-slate-400 mb-3 pb-2 border-b border-slate-700 uppercase">${param.time}</div>`;
        
        seriesMap.forEach(({ series, color }, stockName) => {
          const data = param.seriesData.get(series);
          if (data) {
            const valStr = chartType === 'price' ? data.value.toLocaleString() + '원' : data.value.toFixed(2) + '%';
            html += `
              <div class="flex justify-between items-center gap-6 mb-2">
                <div class="flex items-center gap-2">
                  <div class="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.2)]" style="background-color: ${color}"></div>
                  <span class="text-sm font-bold text-slate-200">${stockName}</span>
                </div>
                <span class="text-sm font-mono font-black" style="color: ${color}">${valStr}</span>
              </div>`;
          }
        });
        toolTip.innerHTML = html;
      }
    });

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        });
      }
    };
    window.addEventListener('resize', handleResize);

    // 깔끔한 메모리 해제
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [rawChartData, selectedPeriod, chartType, activeTheme, activeStocks]);

  return <div ref={chartContainerRef} className="w-full h-full min-h-[350px] relative" />;
};


// 메인 대시보드 화면
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

  const handleThemeClick = async (theme) => {
    setIsLoading(true);
    setIsAiLoading(true);
    setAiReport(""); 
    setActiveTheme(theme);
    setActiveStocks(theme.stocks.map(s => s.name));
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
          console.warn(`${stock.ticker} 데이터를 가져오는 데 실패했습니다.`, fetchErr);
        }
      }

      const sortedData = Object.values(mergedData).sort((a, b) => new Date(a.time) - new Date(b.time));
      
      let lastKnownPrices = {}; 
      const filledData = sortedData.map(row => {
        const newRow = { ...row };
        theme.stocks.forEach(stock => {
          if (newRow[stock.name] !== undefined) {
            lastKnownPrices[stock.name] = newRow[stock.name];
          } else if (lastKnownPrices[stock.name] !== undefined) {
            newRow[stock.name] = lastKnownPrices[stock.name];
          }
        });
        return newRow;
      });

      setRawChartData(filledData);

      fetch(`${API_BASE_URL}/api/theme-report/${theme.id}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.report) setAiReport(data.report);
          else setAiReport("현재 테마에 대한 AI 분석 데이터를 불러올 수 없습니다.");
        })
        .catch(err => setAiReport("AI 서버와 연결이 지연되고 있습니다."))
        .finally(() => setIsAiLoading(false));

    } catch (error) {
      console.error("전체 데이터 로딩 중 에러 발생:", error);
    } finally {
      setIsLoading(false);
    }
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
      <aside className="w-72 bg-[#0b0f19] border-r border-slate-800 flex flex-col z-10 shadow-[4px_0_24px_rgba(0,0,0,0.5)]">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-2xl font-black text-white tracking-tighter italic">STOCK INSIGHT</h1>
          <p className="text-xs text-slate-500 mt-1 font-bold">Premium Theme Analysis</p>
        </div>
        <nav className="flex-1 p-4 space-y-8 overflow-y-auto">
          <div>
            <p className="text-[10px] font-black text-slate-500 mb-3 px-2 tracking-widest uppercase">🔥 Today's Themes</p>
            <div className="space-y-2">
              {THEMES.map(theme => (
                <button key={theme.id} onClick={() => handleThemeClick(theme)} className={`w-full text-left px-4 py-3.5 rounded-xl text-sm font-bold transition-all border ${activeTheme?.id === theme.id ? 'bg-blue-600/10 text-blue-400 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'border-transparent text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'}`}>{theme.name}</button>
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

      <main className="flex-1 flex flex-col relative bg-gradient-to-br from-[#0f172a] to-[#020617]">
        {!activeTheme ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
            <span className="text-6xl mb-6 drop-shadow-2xl">📉</span>
            <p className="text-xl font-bold">분석할 테마를 선택해 주세요.</p>
          </div>
        ) : (
          <div className="p-8 max-w-6xl mx-auto w-full h-full flex flex-col">
            <div className="flex justify-between items-end mb-6">
              <h2 className="text-3xl font-black text-white tracking-tight">{activeTheme.name}</h2>
              <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700 shadow-inner">
                {['1M', '3M', '1Y', '3Y', '5Y'].map(period => (
                  <label key={period} className={`cursor-pointer px-5 py-2 text-xs font-black rounded-lg transition-all ${selectedPeriod === period ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
                    <input type="radio" name="period" value={period} checked={selectedPeriod === period} onChange={(e) => setSelectedPeriod(e.target.value)} className="hidden"/>
                    {period === '1M' ? '1개월' : period === '3M' ? '3개월' : period === '1Y' ? '1년' : period === '3Y' ? '3년' : '5년'}
                  </label>
                ))}
              </div>
            </div>
            
            <div className="bg-[#1e293b]/80 backdrop-blur-md border border-slate-700 p-5 rounded-2xl mb-6 flex justify-between items-center shadow-lg">
              <div className="flex-1">
                <p className="text-[10px] font-black text-slate-500 mb-3 uppercase tracking-widest">비교 대상 종목</p>
                <div className="flex flex-wrap gap-3">
                  {activeTheme.stocks.map(stock => {
                    const isActive = activeStocks.includes(stock.name);
                    const isStarred = watchList.find(w => w.ticker === stock.ticker);
                    return (
                      <div key={stock.ticker} className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${isActive ? 'bg-slate-800 border-slate-600 shadow-md' : 'border-transparent opacity-40 hover:opacity-100'}`}>
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
              <div className="border-l border-slate-700 pl-6 ml-4">
                 <p className="text-[10px] font-black text-slate-500 mb-3 uppercase tracking-widest">조회 기준</p>
                 <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800 shadow-inner">
                   <button onClick={() => setChartType('price')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${chartType === 'price' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>주가(원)</button>
                   <button onClick={() => setChartType('return')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${chartType === 'return' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>수익률(%)</button>
                 </div>
              </div>
            </div>

            {/* 🚀 독립된 컴포넌트로 완벽하게 보호받는 차트 영역 */}
            <div className="flex-1 bg-[#1e293b]/60 backdrop-blur-sm border border-slate-700 rounded-3xl relative shadow-[0_8px_30px_rgb(0,0,0,0.5)] overflow-hidden flex flex-col">
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0f172a]/60 backdrop-blur-md z-20">
                  <div className="w-10 h-10 border-4 border-slate-600 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
              )}
              
              <TradingChart 
                rawChartData={rawChartData} 
                selectedPeriod={selectedPeriod} 
                chartType={chartType} 
                activeTheme={activeTheme} 
                activeStocks={activeStocks} 
              />

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