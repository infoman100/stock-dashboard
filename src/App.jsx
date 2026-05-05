import React, { useState, useMemo, useEffect } from 'react';
import Chart from 'react-apexcharts';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const THEMES = [
  { 
    id: 'ai_hbm', // 백엔드의 테마 ID와 맞춤
    name: '🔥 AI & 반도체 대장주', 
    stocks: [
      { ticker: '005930.KS', name: '삼성전자', color: '#ef4444' },    
      { ticker: '000660.KS', name: 'SK하이닉스', color: '#3b82f6' },  
      { ticker: '042700.KS', name: '한미반도체', color: '#10b981' },  
      { ticker: '028300.KQ', name: 'HLB', color: '#f59e0b' },        
      { ticker: '041510.KQ', name: '에스엠', color: '#8b5cf6' }       
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

// 🚀 [신규] 한 글자씩 타이핑되는 마법의 컴포넌트
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
    }, 30); // 30ms 간격으로 한 글자씩 출력 (타이핑 속도)

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

  // 🚀 [신규] AI 리포트 상태 관리
  const [aiReport, setAiReport] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleThemeClick = async (theme) => {
    setIsLoading(true);
    setIsAiLoading(true); // AI 로딩 시작
    setAiReport(""); // 기존 분석 글 초기화
    setActiveTheme(theme);
    setActiveStocks(theme.stocks.map(s => s.name));

    try {
      // 1. 차트 주가 데이터 불러오기
      const promises = theme.stocks.map(stock => 
        fetch(`${API_BASE_URL}/api/stock/${stock.ticker}`).then(res => res.json())
      );
      const results = await Promise.all(promises);

      let mergedData = {};
      results.forEach((res, index) => {
        if (!res.data || res.data.length === 0) return;
        const stockName = theme.stocks[index].name;
        res.data.forEach(item => {
          if (!mergedData[item.Date]) mergedData[item.Date] = { time: item.Date };
          mergedData[item.Date][stockName] = item.Close; 
        });
      });

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

      // 🚀 2. [신규] 백엔드에서 AI 캐싱 리포트 불러오기
      // 차트가 다 그려진 후 AI 리포트를 쏴줍니다.
      fetch(`${API_BASE_URL}/api/theme-report/${theme.id}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.report) {
            setAiReport(data.report);
          } else {
            setAiReport("현재 테마에 대한 AI 분석 데이터를 불러올 수 없습니다.");
          }
        })
        .catch(err => setAiReport("AI 서버와 연결이 지연되고 있습니다."))
        .finally(() => setIsAiLoading(false));

    } catch (error) {
      console.error("데이터 로딩 실패:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const series = useMemo(() => {
    if (rawChartData.length === 0 || !activeTheme) return [];

    const lastDataPoint = rawChartData[rawChartData.length - 1];
    const endDate = new Date(lastDataPoint.time);
    let startDate = new Date(endDate);

    if (selectedPeriod === '1M') startDate.setMonth(startDate.getMonth() - 1);
    else if (selectedPeriod === '3M') startDate.setMonth(startDate.getMonth() - 3);
    else if (selectedPeriod === '1Y') startDate.setFullYear(startDate.getFullYear() - 1);
    else if (selectedPeriod === '3Y') startDate.setFullYear(startDate.getFullYear() - 3);
    else if (selectedPeriod === '5Y') startDate.setFullYear(startDate.getFullYear() - 5);

    const filteredData = rawChartData.filter(d => new Date(d.time) >= startDate);
    
    return activeTheme.stocks
      .filter(s => activeStocks.includes(s.name))
      .map(s => {
        let basePrice = null;
        const dataPoints = filteredData.map(d => {
          if (d[s.name] === undefined) return null;
          if (basePrice === null) basePrice = d[s.name];

          const val = chartType === 'price' 
            ? d[s.name] 
            : parseFloat((((d[s.name] - basePrice) / basePrice) * 100).toFixed(2));
          
          return { x: new Date(d.time).getTime(), y: val };
        }).filter(p => p !== null);

        return { name: s.name, data: dataPoints, color: s.color };
      });
  }, [rawChartData, selectedPeriod, chartType, activeTheme, activeStocks]);

  const options = {
    chart: {
      type: 'line',
      background: 'transparent',
      foreColor: '#64748b',
      zoom: { enabled: true, type: 'x', autoSelected: 'zoom' },
      toolbar: { show: true, tools: { download: false, selection: true, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true } },
      animations: { enabled: false }
    },
    stroke: { curve: 'smooth', width: 2.5 },
    grid: { borderColor: '#334155', xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
    xaxis: { type: 'datetime', axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { formatter: (val) => chartType === 'price' ? `${val.toLocaleString()}원` : `${val}%` } },
    tooltip: {
      theme: 'dark',
      x: { format: 'yyyy-MM-dd' },
      y: { formatter: (val) => chartType === 'price' ? `${val.toLocaleString()} 원` : `${val}%`, title: { formatter: (seriesName) => `${seriesName} : ` } },
      style: { fontSize: '12px' }
    },
    legend: { show: false },
    theme: { mode: 'dark' }
  };

  const toggleStock = (stockName) => {
    setActiveStocks(prev => prev.includes(stockName) ? prev.filter(n => n !== stockName) : [...prev, stockName]);
  };

  const toggleWatchList = (stock, e) => {
    e.stopPropagation();
    setWatchList(prev => prev.find(item => item.ticker === stock.ticker) ? prev.filter(item => item.ticker !== stock.ticker) : [...prev, stock]);
  };

  return (
    <div className="flex h-screen bg-[#0f172a] text-slate-300 font-sans overflow-hidden">
      <aside className="w-72 bg-[#0b0f19] border-r border-slate-800 flex flex-col z-10 shadow-2xl">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-2xl font-black text-white tracking-tighter italic">STOCK INSIGHT</h1>
          <p className="text-xs text-slate-500 mt-1 font-bold">Premium Theme Analysis</p>
        </div>
        <nav className="flex-1 p-4 space-y-8 overflow-y-auto">
          <div>
            <p className="text-xs font-black text-slate-500 mb-3 px-2 tracking-wider">🔥 TODAY'S THEMES</p>
            <div className="space-y-2">
              {THEMES.map(theme => (
                <button key={theme.id} onClick={() => handleThemeClick(theme)} className={`w-full text-left px-4 py-3.5 rounded-xl text-sm font-bold transition-all border ${activeTheme?.id === theme.id ? 'bg-blue-600/10 text-blue-400 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'border-transparent text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'}`}>{theme.name}</button>
              ))}
            </div>
          </div>
          <div className="pt-4 border-t border-slate-800">
            <p className="text-xs font-black text-slate-500 mb-3 px-2 tracking-wider">⭐ MY WATCHLIST</p>
            {watchList.length === 0 ? (
              <div className="mx-2 p-4 bg-slate-900/50 rounded-xl border border-slate-800 border-dashed text-center">
                <p className="text-xs text-slate-500">차트에서 별표를 눌러<br/>관심 종목을 추가해보세요.</p>
              </div>
            ) : (
              <div className="space-y-2 mx-2">
                {watchList.map(stock => (
                  <div key={stock.ticker} className="flex items-center justify-between p-3 bg-slate-800/40 rounded-lg border border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stock.color }}></div>
                      <span className="text-sm font-bold text-slate-200">{stock.name}</span>
                    </div>
                    <button onClick={(e) => toggleWatchList(stock, e)} className="text-yellow-400 text-xs">★</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col relative bg-[#0f172a]">
        {!activeTheme ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
            <span className="text-6xl mb-6">📉</span>
            <p className="text-xl font-bold">분석할 테마를 선택해 주세요.</p>
          </div>
        ) : (
          <div className="p-8 max-w-6xl mx-auto w-full h-full flex flex-col">
            <div className="flex justify-between items-end mb-6">
              <h2 className="text-3xl font-black text-white tracking-tight">{activeTheme.name}</h2>
              <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700">
                {['1M', '3M', '1Y', '3Y', '5Y'].map(period => (
                  <label key={period} className={`cursor-pointer px-5 py-2 text-xs font-black rounded-lg transition-all ${selectedPeriod === period ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                    <input type="radio" name="period" value={period} checked={selectedPeriod === period} onChange={(e) => setSelectedPeriod(e.target.value)} className="hidden"/>
                    {period === '1M' ? '1개월' : period === '3M' ? '3개월' : period === '1Y' ? '1년' : period === '3Y' ? '3년' : '5년'}
                  </label>
                ))}
              </div>
            </div>
            
            <div className="bg-[#1e293b] border border-slate-700 p-5 rounded-2xl mb-6 flex justify-between items-center">
              <div className="flex-1">
                <p className="text-[10px] font-black text-slate-500 mb-3 uppercase tracking-widest">비교 대상 종목</p>
                <div className="flex flex-wrap gap-3">
                  {activeTheme.stocks.map(stock => {
                    const isActive = activeStocks.includes(stock.name);
                    const isStarred = watchList.find(w => w.ticker === stock.ticker);
                    return (
                      <div key={stock.ticker} className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${isActive ? 'bg-slate-800 border-slate-600' : 'border-transparent opacity-40 hover:opacity-100'}`}>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={isActive} onChange={() => toggleStock(stock.name)} className="hidden" />
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stock.color }}></div>
                          <span className="text-sm font-bold text-slate-200">{stock.name}</span>
                        </label>
                        <button onClick={(e) => toggleWatchList(stock, e)} className={`ml-1 ${isStarred ? 'text-yellow-400' : 'text-slate-600 hover:text-yellow-400'}`}>{isStarred ? '★' : '☆'}</button>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="border-l border-slate-700 pl-6 ml-4">
                 <p className="text-[10px] font-black text-slate-500 mb-3 uppercase tracking-widest">조회 기준</p>
                 <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800">
                   <button onClick={() => setChartType('price')} className={`px-4 py-2 text-xs font-bold rounded-lg ${chartType === 'price' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>주가(원)</button>
                   <button onClick={() => setChartType('return')} className={`px-4 py-2 text-xs font-bold rounded-lg ${chartType === 'return' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>수익률(%)</button>
                 </div>
              </div>
            </div>

            <div className="flex-1 bg-[#1e293b] border border-slate-700 p-6 rounded-3xl relative shadow-2xl overflow-hidden flex flex-col">
              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-[#1e293b]/50 backdrop-blur-sm z-20">
                  <div className="w-10 h-10 border-4 border-slate-600 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
              ) : (
                <div className="w-full h-full">
                  <Chart options={options} series={series} type="line" height="100%" width="100%" />
                </div>
              )}
            </div>
            
            {/* 🚀 [신규] AI 리포트 출력 영역 (타이핑 효과 적용) */}
            <div className="mt-5 bg-gradient-to-r from-blue-900/30 to-[#0f172a] p-5 rounded-2xl border border-blue-900/50 flex gap-4 min-h-[100px] shadow-lg">
               <span className="text-3xl animate-pulse">🤖</span>
               <div className="flex-1">
                 <h4 className="text-xs font-black tracking-widest text-blue-400 mb-2 uppercase flex items-center gap-2">
                   AI Theme Insight <span className="bg-blue-600/30 px-2 py-0.5 rounded text-[10px]">PRO</span>
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