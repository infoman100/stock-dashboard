import React, { useState, useEffect } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

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

  // 데이터 패칭 로직 (안전한 순차 호출 및 Forward Fill 유지)
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
          console.warn(`${stock.ticker} 데이터를 가져오는 데 실패했습니다.`);
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

  // 🚀 Highcharts를 위한 데이터 가공 (React 친화적 선언형 방식)
  const getChartOptions = () => {
    if (rawChartData.length === 0 || !activeTheme) return {};

    // 1. 기간 필터링
    const lastDataPoint = rawChartData[rawChartData.length - 1];
    let startDate = new Date(lastDataPoint.time);
    
    if (selectedPeriod === '1M') startDate.setMonth(startDate.getMonth() - 1);
    else if (selectedPeriod === '3M') startDate.setMonth(startDate.getMonth() - 3);
    else if (selectedPeriod === '1Y') startDate.setFullYear(startDate.getFullYear() - 1);
    else if (selectedPeriod === '3Y') startDate.setFullYear(startDate.getFullYear() - 3);
    else if (selectedPeriod === '5Y') startDate.setFullYear(startDate.getFullYear() - 5);

    const filteredData = rawChartData.filter(d => new Date(d.time) >= startDate);
    if (filteredData.length === 0) return {};

    // 2. Highcharts Series 형식에 맞게 변환
    const series = activeTheme.stocks
      .filter(s => activeStocks.includes(s.name))
      .map(stock => {
        let basePrice = null;
        const data = filteredData.map(d => {
          if (d[stock.name] === undefined) return null;
          if (basePrice === null) basePrice = d[stock.name];
          const val = chartType === 'price' ? d[stock.name] : parseFloat((((d[stock.name] - basePrice) / basePrice) * 100).toFixed(2));
          // Highcharts는 [timestamp, value] 배열을 요구함
          return [new Date(d.time).getTime(), val];
        }).filter(p => p !== null);

        return { name: stock.name, data: data, color: stock.color };
      });

    // 3. Highcharts 옵션 설정 (프리미엄 다크 테마 및 줌 기능)
    return {
      chart: {
        type: 'line',
        backgroundColor: 'transparent',
        zoomType: 'x', // 🚀 마우스 드래그로 X축 줌 기능
        panning: true,
        panKey: 'shift', // Shift + 드래그로 패닝
        style: { fontFamily: 'inherit' }
      },
      title: { text: null },
      xAxis: {
        type: 'datetime',
        lineColor: '#334155',
        tickColor: '#334155',
        labels: { style: { color: '#94a3b8' } },
        crosshair: { color: '#475569', dashStyle: 'dash' }
      },
      yAxis: {
        title: { text: null },
        gridLineColor: '#1e293b',
        labels: {
          style: { color: '#94a3b8' },
          formatter: function() { return chartType === 'price' ? this.value.toLocaleString() + '원' : this.value + '%'; }
        }
      },
      tooltip: {
        shared: true, // 여러 종목 데이터를 한 툴팁에 표시
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#334155',
        borderRadius: 8,
        style: { color: '#f8fafc', fontSize: '12px' },
        valueSuffix: chartType === 'price' ? ' 원' : '%',
        valueDecimals: chartType === 'price' ? 0 : 2
      },
      plotOptions: {
        series: {
          marker: { enabled: false, states: { hover: { enabled: true, radius: 5 } } },
          lineWidth: 2.5,
          states: { hover: { lineWidth: 3 } }
        }
      },
      legend: { enabled: false }, // 커스텀 체크박스 사용하므로 숨김
      credits: { enabled: false },
      series: series
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

            {/* 🚀 Highcharts React 공식 컴포넌트 사용 (절대 뻗지 않음) */}
            <div className="flex-1 bg-[#1e293b]/60 backdrop-blur-sm border border-slate-700 rounded-3xl relative shadow-[0_8px_30px_rgb(0,0,0,0.5)] overflow-hidden flex flex-col p-4">
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0f172a]/60 backdrop-blur-md z-20">
                  <div className="w-10 h-10 border-4 border-slate-600 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
              )}
              {rawChartData.length > 0 && !isLoading && (
                <HighchartsReact
                  highcharts={Highcharts}
                  options={getChartOptions()}
                  containerProps={{ style: { height: "100%", width: "100%" } }}
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