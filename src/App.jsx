import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush } from 'recharts';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// 임시 테마 데이터 (향후 백엔드 DB 자동화 로직으로 대체될 예정)
const THEMES = [
  { 
    id: 'semiconductor', 
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

// 🚀 [추가] 커스텀 툴팁: 마우스 오버 시 직관적인 설명 박스 생성
const CustomTooltip = ({ active, payload, label, chartType }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0f172a] border border-slate-700 p-4 rounded-xl shadow-2xl min-w-[180px]">
        <p className="text-xs font-bold text-slate-400 mb-3 border-b border-slate-700 pb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></div>
              <span className="text-sm font-bold text-slate-200">{entry.name}</span>
            </div>
            <span className="text-sm font-mono font-bold" style={{ color: entry.color }}>
              {chartType === 'price' ? `${entry.value.toLocaleString()} 원` : `${entry.value}%`}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function App() {
  const [activeTheme, setActiveTheme] = useState(null);
  const [activeStocks, setActiveStocks] = useState([]); 
  const [isLoading, setIsLoading] = useState(false);

  const [rawChartData, setRawChartData] = useState([]);
  
  // 🚀 [수정] 대안C: 최대 5년으로 제한. 라디오 버튼 구성 변경
  const [selectedPeriod, setSelectedPeriod] = useState('3M'); // 1M, 3M, 1Y, 3Y, 5Y
  
  // 🚀 [수정] Default를 '일자별 주가(원)'으로 변경
  const [chartType, setChartType] = useState('price'); 

  // 🚀 [추가] 관심 종목(Watchlist) 상태 관리
  const [watchList, setWatchList] = useState([]);

  const handleThemeClick = async (theme) => {
    setIsLoading(true);
    setActiveTheme(theme);
    const initialStocks = theme.stocks.map(s => s.name);
    setActiveStocks(initialStocks);

    try {
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
      setRawChartData(sortedData);

    } catch (error) {
      console.error("데이터 로딩 실패:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const displayChartData = useMemo(() => {
    if (rawChartData.length === 0 || !activeTheme) return [];

    const lastDataPoint = rawChartData[rawChartData.length - 1];
    const endDate = new Date(lastDataPoint.time);
    let startDate = new Date(endDate);

    // 대안C: 전체(ALL)를 없애고 최대 5년까지만 제공하여 차트 잘림 현상 방지
    if (selectedPeriod === '1M') startDate.setMonth(startDate.getMonth() - 1);
    else if (selectedPeriod === '3M') startDate.setMonth(startDate.getMonth() - 3);
    else if (selectedPeriod === '1Y') startDate.setFullYear(startDate.getFullYear() - 1);
    else if (selectedPeriod === '3Y') startDate.setFullYear(startDate.getFullYear() - 3);
    else if (selectedPeriod === '5Y') startDate.setFullYear(startDate.getFullYear() - 5);

    const filteredData = rawChartData.filter(d => new Date(d.time) >= startDate);
    if (filteredData.length === 0) return [];

    if (chartType === 'price') {
      return filteredData;
    } else {
      const basePrices = {};
      activeTheme.stocks.forEach(s => {
        const firstValidRow = filteredData.find(row => row[s.name] !== undefined);
        basePrices[s.name] = firstValidRow ? firstValidRow[s.name] : 1;
      });

      return filteredData.map(row => {
        const newRow = { time: row.time };
        activeTheme.stocks.forEach(s => {
          if (row[s.name] !== undefined) {
            newRow[s.name] = parseFloat((((row[s.name] - basePrices[s.name]) / basePrices[s.name]) * 100).toFixed(2));
          }
        });
        return newRow;
      });
    }
  }, [rawChartData, selectedPeriod, chartType, activeTheme]);

  const toggleStock = (stockName) => {
    setActiveStocks(prev => 
      prev.includes(stockName) ? prev.filter(name => name !== stockName) : [...prev, stockName]
    );
  };

  // 관심 종목 추가/제거 로직
  const toggleWatchList = (stock, e) => {
    e.stopPropagation();
    setWatchList(prev => 
      prev.find(item => item.ticker === stock.ticker) 
        ? prev.filter(item => item.ticker !== stock.ticker) 
        : [...prev, stock]
    );
  };

  return (
    <div className="flex h-screen bg-[#111827] text-slate-300 font-sans overflow-hidden">
      
      {/* --- 사이드바 --- */}
      <aside className="w-72 bg-[#0b0f19] border-r border-slate-800 flex flex-col z-10 shadow-2xl">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-2xl font-black text-white tracking-tighter">STOCK INSIGHT</h1>
          <p className="text-xs text-slate-500 mt-1 font-bold">Smart Theme Analyzer</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-8 overflow-y-auto">
          {/* 테마 리스트 */}
          <div>
            <p className="text-xs font-black text-slate-500 mb-3 px-2 tracking-wider">🔥 TODAY'S THEMES</p>
            <div className="space-y-2">
              {THEMES.map(theme => (
                <button 
                  key={theme.id}
                  onClick={() => handleThemeClick(theme)}
                  className={`w-full text-left px-4 py-3.5 rounded-xl text-sm font-bold transition-all border ${activeTheme?.id === theme.id ? 'bg-blue-600/10 text-blue-400 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'border-transparent text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'}`}
                >
                  {theme.name}
                </button>
              ))}
            </div>
          </div>

          {/* 🚀 [수정] 내 자산 제거 -> 관심 종목 (Watchlist) 으로 변경 */}
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

      {/* --- 메인 영역 --- */}
      <main className="flex-1 flex flex-col relative bg-[#111827]">
        {!activeTheme ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <span className="text-5xl mb-6">📈</span>
            <p className="text-xl font-bold text-slate-300">좌측에서 분석할 테마를 선택해주세요.</p>
            <p className="text-sm mt-2">대장주 5종목의 시계열 추이와 딥러닝 인사이트를 제공합니다.</p>
          </div>
        ) : (
          <div className="p-8 max-w-6xl mx-auto w-full h-full flex flex-col animate-fade-in">
            
            {/* 상단 타이틀 & 기간 라디오 버튼 */}
            <div className="flex justify-between items-end mb-6">
              <h2 className="text-3xl font-black text-white tracking-tight">{activeTheme.name}</h2>
              
              <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700">
                {['1M', '3M', '1Y', '3Y', '5Y'].map(period => (
                  <label key={period} className={`cursor-pointer px-5 py-2 text-xs font-black rounded-lg transition-all ${selectedPeriod === period ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
                    <input type="radio" name="period" value={period} checked={selectedPeriod === period} onChange={(e) => setSelectedPeriod(e.target.value)} className="hidden"/>
                    {period === '1M' ? '1개월' : period === '3M' ? '3개월' : period === '1Y' ? '1년' : period === '3Y' ? '3년' : '5년'}
                  </label>
                ))}
              </div>
            </div>
            
            {/* 컨트롤 패널 (종목 체크 & 차트 방식) */}
            <div className="bg-[#1e293b] border border-slate-700 p-5 rounded-2xl mb-6 flex justify-between items-center shadow-lg">
              <div className="flex-1">
                <p className="text-[10px] font-black tracking-widest text-slate-400 mb-3 uppercase">비교 대상 종목 (클릭하여 끄기/켜기)</p>
                <div className="flex flex-wrap gap-3">
                  {activeTheme.stocks.map(stock => {
                    const isActive = activeStocks.includes(stock.name);
                    const isStarred = watchList.find(w => w.ticker === stock.ticker);
                    return (
                      <div key={stock.ticker} className={`flex items-center gap-1 cursor-pointer px-4 py-2 rounded-xl border transition-all ${isActive ? 'bg-slate-800 border-slate-600 shadow-sm' : 'border-transparent opacity-40 hover:opacity-80'}`}>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={isActive} onChange={() => toggleStock(stock.name)} className="hidden" />
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stock.color }}></div>
                          <span className="text-sm font-bold text-slate-200">{stock.name}</span>
                        </label>
                        {/* 관심종목 별표 버튼 */}
                        <button onClick={(e) => toggleWatchList(stock, e)} className={`ml-2 text-sm ${isStarred ? 'text-yellow-400' : 'text-slate-600 hover:text-yellow-400'}`}>
                          {isStarred ? '★' : '☆'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-l border-slate-700 pl-6 ml-4">
                 <p className="text-[10px] font-black tracking-widest text-slate-400 mb-3 uppercase">차트 보기 방식</p>
                 <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800">
                   <button onClick={() => setChartType('price')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${chartType === 'price' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>일자별 주가(원)</button>
                   <button onClick={() => setChartType('return')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${chartType === 'return' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>누적 수익률(%)</button>
                 </div>
              </div>
            </div>

            {/* 🚀 메인 차트 (Zoom/Pan 적용) */}
            <div className="flex-1 bg-[#1e293b] border border-slate-700 p-6 rounded-2xl relative min-h-[400px] shadow-lg flex flex-col">
              <div className="absolute top-6 left-6 z-10">
                <h3 className="text-sm font-bold text-slate-200">
                  {chartType === 'return' ? '기간 내 누적 수익률 비교' : '기간 내 일자별 주가 흐름'}
                </h3>
              </div>

              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-[#1e293b]/50 backdrop-blur-sm rounded-2xl">
                  <div className="w-10 h-10 border-4 border-slate-600 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
              ) : (
                <div className="w-full h-full pt-10 pb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={displayChartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.5} />
                      <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill:'#64748b', fontSize:11}} minTickGap={40} dy={10} />
                      <YAxis 
                        domain={['auto', 'auto']} 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill:'#64748b', fontSize:11}} 
                        tickFormatter={(val) => chartType === 'return' ? `${val}%` : `${val.toLocaleString()}`} 
                        width={65} 
                      />
                      {/* 🚀 고도화된 커스텀 툴팁 */}
                      <Tooltip content={<CustomTooltip chartType={chartType} />} cursor={{ stroke: '#475569', strokeWidth: 1, strokeDasharray: '4 4' }} />
                      
                      {activeTheme.stocks.map(stock => (
                        activeStocks.includes(stock.name) && (
                          <Line key={stock.ticker} type="monotone" dataKey={stock.name} stroke={stock.color} strokeWidth={2.5} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />
                        )
                      ))}
                      
                      {/* 🚀 줌인/줌아웃 및 패딩을 위한 브러쉬 컨트롤러 */}
                      <Brush 
                        dataKey="time" 
                        height={25} 
                        stroke="#475569" 
                        fill="#0f172a" 
                        travellerWidth={10}
                        tickFormatter={() => ''} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            
            {/* 향후 AI 리포트 공간 */}
            <div className="mt-5 bg-gradient-to-r from-blue-900/20 to-transparent p-4 rounded-xl border border-blue-900/30 flex items-center gap-3">
               <span className="text-xl">🤖</span>
               <p className="text-sm text-blue-300/80 font-bold">이 테마에 대한 AI 데일리 브리핑 자동화 파이프라인이 준비 중입니다.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}