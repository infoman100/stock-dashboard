import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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
  const [themes, setThemes] = useState([]);
  const [isThemesLoading, setIsThemesLoading] = useState(true);
  const [activeTheme, setActiveTheme] = useState(null);
  const [activeStocks, setActiveStocks] = useState([]); 
  const [isLoading, setIsLoading] = useState(false);
  const [rawChartData, setRawChartData] = useState([]); 
  const [selectedPeriod, setSelectedPeriod] = useState('3M'); 
  const [chartType, setChartType] = useState('price'); // 'price' or 'return'
  const [watchList, setWatchList] = useState([]); 
  const [aiReport, setAiReport] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/themes`)
      .then(res => res.json())
      .then(data => {
        if (data && data.data) {
          const cleanThemes = data.data.map(t => ({
            ...t,
            stocks: typeof t.stocks === 'string' ? JSON.parse(t.stocks) : t.stocks
          }));
          setThemes(cleanThemes);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setIsThemesLoading(false));
  }, []);

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
    
    const safeStocks = typeof theme.stocks === 'string' ? JSON.parse(theme.stocks) : theme.stocks;
    setActiveStocks(safeStocks.map(s => s.name)); // 초기에는 전체 선택
    setRawChartData([]); 

    try {
      let mergedData = {};
      for (const stock of safeStocks) {
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
          console.warn(`${stock.ticker} 실패`);
        }
      }

      const sortedData = Object.values(mergedData).sort((a, b) => new Date(a.time) - new Date(b.time));
      let lastKnownPrices = {}; 
      const filledData = sortedData.map(row => {
        const newRow = { ...row };
        safeStocks.forEach(stock => {
          if (newRow[stock.name] !== undefined) lastKnownPrices[stock.name] = newRow[stock.name];
          else if (lastKnownPrices[stock.name] !== undefined) newRow[stock.name] = lastKnownPrices[stock.name];
        });
        return newRow;
      });

      setRawChartData(filledData);

      fetch(`${API_BASE_URL}/api/theme-report/${theme.id}`)
        .then(res => res.json())
        .then(data => setAiReport(data?.report || ""))
        .catch(() => setAiReport("리포트를 가져올 수 없습니다."))
        .finally(() => setIsAiLoading(false));

    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const getEChartsOption = () => {
    if (rawChartData.length === 0 || !activeTheme) return {};

    const safeStocks = typeof activeTheme.stocks === 'string' ? JSON.parse(activeTheme.stocks) : activeTheme.stocks;
    const lastDataPoint = rawChartData[rawChartData.length - 1];
    let startDate = new Date(lastDataPoint.time);
    
    if (selectedPeriod === '1M') startDate.setMonth(startDate.getMonth() - 1);
    else if (selectedPeriod === '3M') startDate.setMonth(startDate.getMonth() - 3);
    else if (selectedPeriod === '1Y') startDate.setFullYear(startDate.getFullYear() - 1);
    else if (selectedPeriod === '3Y') startDate.setFullYear(startDate.getFullYear() - 3);
    else if (selectedPeriod === '5Y') startDate.setFullYear(startDate.getFullYear() - 5);

    const filteredData = rawChartData.filter(d => new Date(d.time) >= startDate);
    if (filteredData.length === 0) return {};

    const series = safeStocks
      .filter(s => activeStocks.includes(s.name))
      .map(stock => {
        let basePrice = null;
        const data = filteredData.map(d => {
          if (d[stock.name] === undefined) return null;
          
          // 🚀 [수익률 로직] 필터링된 데이터의 첫 번째 가격을 0% 기준으로 삼음
          if (basePrice === null) basePrice = d[stock.name];
          
          const val = chartType === 'price' 
            ? d[stock.name] 
            : parseFloat((((d[stock.name] - basePrice) / basePrice) * 100).toFixed(2));
          
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
        axisPointer: { type: 'cross' },
        formatter: (params) => {
          let res = `<div style="font-weight: bold; margin-bottom: 4px;">${new Date(params[0].value[0]).toLocaleDateString()}</div>`;
          params.forEach(item => {
            const suffix = chartType === 'price' ? '원' : '%';
            res += `<div style="display: flex; justify-content: space-between; gap: 20px;">
                      <span><span style="display:inline-block;margin-right:5px;border-radius:10px;width:10px;height:10px;background-color:${item.color};"></span>${item.seriesName}</span>
                      <span style="font-weight: bold;">${item.value[1].toLocaleString()}${suffix}</span>
                    </div>`;
          });
          return res;
        }
      },
      grid: { left: '2%', right: '2%', bottom: '12%', top: '5%', containLabel: true },
      xAxis: { type: 'time', axisLine: { lineStyle: { color: '#334155' } }, splitLine: { show: false }, axisLabel: { color: '#94a3b8', fontSize: 11 } },
      yAxis: { 
        type: 'value', 
        scale: true, 
        splitLine: { lineStyle: { color: 'rgba(51, 65, 85, 0.3)', type: 'dashed' } }, 
        axisLabel: { 
          color: '#94a3b8', 
          fontSize: 11,
          formatter: (value) => chartType === 'price' ? value.toLocaleString() : `${value}%`
        } 
      },
      dataZoom: [ { type: 'inside' }, { type: 'slider', height: 24, bottom: 0, borderColor: 'transparent', backgroundColor: 'rgba(15, 23, 42, 0.5)', fillerColor: 'rgba(59, 130, 246, 0.15)', handleStyle: { color: '#3b82f6' } } ],
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
      <aside className="w-72 bg-[#0b0f19] border-r border-slate-800 flex flex-col z-10 shadow-[4px_0_24px_rgba(0,0,0,0.5)]">
        <div className="p-6 border-b border-slate-800 cursor-pointer hover:bg-slate-900 transition-colors" onClick={goHome}>
          <h1 className="text-2xl font-black text-white tracking-tighter italic">STOCK INSIGHT</h1>
          <p className="text-xs text-slate-500 mt-1 font-bold">AI Theme Analyzer</p>
        </div>
        <nav className="flex-1 p-4 space-y-8 overflow-y-auto">
          <div>
            <p className="text-[10px] font-black text-slate-500 mb-3 px-2 tracking-widest uppercase flex items-center justify-between">
              🔥 Today's Themes
              <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded text-[8px] animate-pulse">LIVE</span>
            </p>
            <div className="space-y-2">
              {isThemesLoading ? (
                <div className="text-center text-xs text-slate-500 py-4">AI 데이터를 불러오는 중...</div>
              ) : themes.map((theme, idx) => (
                <button 
                  key={theme.id} 
                  onClick={() => handleThemeClick(theme)} 
                  className={`w-full flex items-center gap-3 text-left px-4 py-3.5 rounded-xl text-sm font-bold transition-all border ${activeTheme?.id === theme.id ? 'bg-blue-600/10 text-blue-400 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'border-transparent text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'}`}
                >
                  <span className={`text-xs font-black ${idx < 3 ? 'text-blue-500' : 'text-slate-600'}`}>{theme.rank}</span>
                  <span className="truncate">{theme.name.split(" ")[1] || theme.name}</span>
                </button>
              ))}
            </div>
          </div>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col relative bg-gradient-to-br from-[#0f172a] to-[#020617] overflow-y-auto">
        {!activeTheme ? (
          <div className="p-10 max-w-6xl mx-auto w-full h-full flex flex-col animate-fade-in">
            <h2 className="text-4xl font-black text-white tracking-tight mb-10">Market Insight</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-10">
              {themes.map((theme) => {
                const safeStocks = typeof theme.stocks === 'string' ? JSON.parse(theme.stocks) : theme.stocks;
                return (
                  <div key={theme.id} onClick={() => handleThemeClick(theme)} className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 p-6 rounded-3xl hover:bg-[#1e293b]/80 hover:border-blue-500/50 transition-all cursor-pointer group shadow-lg flex flex-col justify-between">
                    <div>
                      <span className="bg-slate-800 text-slate-300 font-black text-xs px-3 py-1 rounded-full group-hover:bg-blue-600 group-hover:text-white transition-colors">TOP {theme.rank}</span>
                      <h3 className="text-xl font-bold text-white mt-4 mb-2 group-hover:text-blue-400 transition-colors">{theme.name}</h3>
                      <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed mb-6">{theme.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {safeStocks?.slice(0, 4).map(stock => (
                        <span key={stock.ticker} className="bg-[#0f172a] border border-slate-700 text-slate-300 text-[10px] px-2 py-1 rounded-lg font-medium flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: stock.color}}></span>{stock.name}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-8 max-w-6xl mx-auto w-full h-full flex flex-col">
            <div className="flex justify-between items-end mb-6">
              <div>
                <button onClick={goHome} className="text-slate-500 hover:text-blue-400 text-sm font-bold mb-2 flex items-center gap-2 transition-colors">← 홈으로 돌아가기</button>
                <h2 className="text-3xl font-black text-white tracking-tight">{activeTheme.name}</h2>
              </div>
              
              {/* 🚀 [신규] 차트 유형(종가/수익률) 및 기간 선택 영역 */}
              <div className="flex gap-4">
                <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700">
                  {['price', 'return'].map(type => (
                    <label key={type} className={`cursor-pointer px-4 py-2 text-xs font-black rounded-lg transition-all ${chartType === type ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
                      <input type="radio" name="chartType" value={type} checked={chartType === type} onChange={(e) => setChartType(e.target.value)} className="hidden"/>
                      {type === 'price' ? '종가' : '수익률'}
                    </label>
                  ))}
                </div>
                <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700">
                  {['1M', '3M', '1Y', '3Y', '5Y'].map(period => (
                    <label key={period} className={`cursor-pointer px-4 py-2 text-xs font-black rounded-lg transition-all ${selectedPeriod === period ? 'bg-slate-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
                      <input type="radio" name="period" value={period} checked={selectedPeriod === period} onChange={(e) => setSelectedPeriod(e.target.value)} className="hidden"/>
                      {period}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="bg-[#1e293b]/80 border border-slate-700 p-5 rounded-2xl mb-6 shadow-lg">
              <div className="flex flex-wrap gap-3">
                {(typeof activeTheme.stocks === 'string' ? JSON.parse(activeTheme.stocks) : activeTheme.stocks).map(stock => {
                  const isActive = activeStocks.includes(stock.name);
                  return (
                    <div key={stock.ticker} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${isActive ? 'bg-slate-800 border-slate-600' : 'border-transparent opacity-40 hover:opacity-100'}`}>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={isActive} onChange={() => toggleStock(stock.name)} className="hidden" />
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stock.color }}></div>
                        <span className="text-sm font-bold text-slate-200">{stock.name}</span>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 bg-[#1e293b]/60 border border-slate-700 rounded-3xl relative overflow-hidden flex flex-col p-4 min-h-[400px] shadow-2xl">
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0f172a]/60 z-20">
                  <div className="w-10 h-10 border-4 border-slate-600 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
              )}
              {rawChartData.length > 0 && !isLoading && (
                <ReactECharts option={getEChartsOption()} style={{ height: '100%', width: '100%' }} notMerge={true} lazyUpdate={true} />
              )}
            </div>
            
            <div className="mt-5 bg-gradient-to-r from-blue-900/30 to-[#0f172a] p-5 rounded-2xl border border-blue-900/50 flex gap-4 min-h-[100px] shadow-xl">
               <span className="text-3xl">🤖</span>
               <div className="flex-1">
                 <h4 className="text-xs font-black tracking-widest text-blue-400 mb-2 uppercase">AI Theme Insight</h4>
                 {isAiLoading ? <div className="animate-pulse w-1/2 h-4 bg-blue-900/50 rounded"></div> : <Typewriter text={aiReport} />}
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}