import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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

export default function App() {
  const [activeTheme, setActiveTheme] = useState(null);
  const [activeStocks, setActiveStocks] = useState([]); 
  const [isLoading, setIsLoading] = useState(false);
  const [isSecretMode, setIsSecretMode] = useState(true); 

  // 🚀 [추가 1] 원본 데이터를 보관할 State
  const [rawChartData, setRawChartData] = useState([]);

  // 🚀 [추가 2] 사용자가 선택한 조회 조건 State
  const [selectedPeriod, setSelectedPeriod] = useState('3M'); // 1M, 3M, 1Y, 5Y, ALL
  const [chartType, setChartType] = useState('return'); // 'return'(수익률) or 'price'(주가추이)

  // 테마 클릭 시 DB에서 10년 치 데이터를 몽땅 가져옵니다.
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
          mergedData[item.Date][stockName] = item.Close; // 일단 '순수 가격'만 저장
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

  // 🚀 [추가 3] 조건에 맞춰 차트 데이터를 가공하는 핵심 마법 (useMemo)
  const displayChartData = useMemo(() => {
    if (rawChartData.length === 0 || !activeTheme) return [];

    // 1. 주말 방어 로직: DB에 있는 가장 '최근 거래일'을 기준점(현재)으로 잡습니다.
    const lastDataPoint = rawChartData[rawChartData.length - 1];
    const endDate = new Date(lastDataPoint.time);
    let startDate = new Date(endDate);

    // 2. 라디오 버튼 기간 필터링
    if (selectedPeriod === '1M') startDate.setMonth(startDate.getMonth() - 1);
    else if (selectedPeriod === '3M') startDate.setMonth(startDate.getMonth() - 3);
    else if (selectedPeriod === '1Y') startDate.setFullYear(startDate.getFullYear() - 1);
    else if (selectedPeriod === '5Y') startDate.setFullYear(startDate.getFullYear() - 5);
    else startDate = new Date('1900-01-01'); // ALL

    const filteredData = rawChartData.filter(d => new Date(d.time) >= startDate);
    if (filteredData.length === 0) return [];

    // 3. 차트 타입(수익률 vs 주가추이)에 따른 데이터 변환
    if (chartType === 'price') {
      return filteredData; // 주가 추이는 있는 그대로 반환
    } else {
      // 누적 수익률 모드: 조회된 기간의 '첫 날 가격'을 0% 기준으로 잡음
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

  return (
    <div className="flex h-screen bg-[#111827] text-slate-300 font-sans overflow-hidden">
      
      {/* 좌측 사이드바 */}
      <aside className="w-64 bg-[#0b0f19] border-r border-slate-800 flex flex-col z-10 shadow-2xl">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-black text-white tracking-tighter">STOCK INSIGHT</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
          <div>
            <p className="text-xs font-bold text-slate-500 mb-3 px-2">MARKET THEMES</p>
            <div className="space-y-1">
              {THEMES.map(theme => (
                <button 
                  key={theme.id}
                  onClick={() => handleThemeClick(theme)}
                  className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold transition-all ${activeTheme?.id === theme.id ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                >
                  {theme.name}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <div className="flex justify-between items-center mb-3 px-2">
              <span className="text-xs font-bold text-slate-500">MY PORTFOLIO</span>
              <button onClick={() => setIsSecretMode(!isSecretMode)} className="text-slate-400 hover:text-white text-xs bg-slate-800 px-2 py-1 rounded">
                {isSecretMode ? '👁️ 보이기' : '🙈 숨기기'}
              </button>
            </div>
            <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 mx-2">
              <p className="text-[10px] text-slate-500 mb-1">총 평가금액</p>
              <p className="text-lg font-mono font-black text-slate-100">
                {isSecretMode ? '***,***,*** 원' : '42,500,000 원'}
              </p>
            </div>
          </div>
        </nav>
      </aside>

      {/* 메인 영역 */}
      <main className="flex-1 flex flex-col relative bg-[#111827]">
        {!activeTheme ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <span className="text-4xl mb-4">📊</span>
            <p className="text-lg font-bold">좌측에서 분석할 테마를 선택해주세요.</p>
          </div>
        ) : (
          <div className="p-8 max-w-6xl mx-auto w-full h-full flex flex-col">
            
            <div className="flex justify-between items-end mb-6">
              <h2 className="text-2xl font-black text-white">{activeTheme.name}</h2>
              
              {/* 🚀 [추가] 라디오 버튼: 기간 필터 */}
              <div className="flex bg-slate-800 p-1 rounded-lg">
                {['1M', '3M', '1Y', '5Y', 'ALL'].map(period => (
                  <label key={period} className={`cursor-pointer px-4 py-1.5 text-xs font-bold rounded-md transition-all ${selectedPeriod === period ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
                    <input type="radio" name="period" value={period} checked={selectedPeriod === period} onChange={(e) => setSelectedPeriod(e.target.value)} className="hidden"/>
                    {period === '1M' ? '1개월' : period === '3M' ? '3개월' : period === '1Y' ? '1년' : period === '5Y' ? '5년' : '전체'}
                  </label>
                ))}
              </div>
            </div>
            
            {/* 종목 체크박스 & 차트 타입 토글 */}
            <div className="bg-[#1e293b] border border-slate-700 p-5 rounded-2xl mb-6 flex justify-between items-center">
              <div>
                <p className="text-[10px] font-bold text-slate-400 mb-2">비교 대상 종목</p>
                <div className="flex flex-wrap gap-2">
                  {activeTheme.stocks.map(stock => {
                    const isActive = activeStocks.includes(stock.name);
                    return (
                      <label key={stock.ticker} className={`flex items-center gap-1.5 cursor-pointer px-3 py-1.5 rounded-lg border transition-all ${isActive ? 'bg-slate-800 border-slate-600' : 'border-transparent opacity-40 hover:opacity-80'}`}>
                        <input type="checkbox" checked={isActive} onChange={() => toggleStock(stock.name)} className="hidden" />
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stock.color }}></div>
                        <span className="text-xs font-bold text-slate-200">{stock.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 🚀 [추가] 라디오 버튼: 차트 모드 토글 */}
              <div className="border-l border-slate-700 pl-6">
                 <p className="text-[10px] font-bold text-slate-400 mb-2">차트 보기 방식</p>
                 <div className="flex bg-slate-900 rounded-lg p-1">
                   <button onClick={() => setChartType('return')} className={`px-3 py-1 text-xs font-bold rounded ${chartType === 'return' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>누적 수익률(%)</button>
                   <button onClick={() => setChartType('price')} className={`px-3 py-1 text-xs font-bold rounded ${chartType === 'price' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>일자별 주가(원)</button>
                 </div>
              </div>
            </div>

            {/* 메인 차트 */}
            <div className="flex-1 bg-[#1e293b] border border-slate-700 p-6 rounded-2xl relative min-h-[350px]">
              <div className="absolute top-6 left-6 z-10">
                <h3 className="text-sm font-bold text-slate-200">
                  {chartType === 'return' ? '기간 내 누적 수익률 비교' : '기간 내 일자별 주가 흐름'}
                </h3>
              </div>

              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center z-20">
                  <div className="w-8 h-8 border-4 border-slate-600 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
              ) : (
                <div className="w-full h-full pt-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={displayChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                      <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill:'#64748b', fontSize:10}} minTickGap={30} dy={10} />
                      <YAxis 
                        domain={['auto', 'auto']} 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill:'#64748b', fontSize:10}} 
                        tickFormatter={(val) => chartType === 'return' ? `${val}%` : `${val.toLocaleString()}원`} 
                        width={65} 
                      />
                      <Tooltip 
                        contentStyle={{backgroundColor:'#0f172a', borderColor:'#334155', borderRadius:'8px', color:'#f8fafc'}}
                        formatter={(value) => chartType === 'return' ? [`${value}%`] : [`${value.toLocaleString()}원`]}
                      />
                      
                      {activeTheme.stocks.map(stock => (
                        activeStocks.includes(stock.name) && (
                          <Line key={stock.ticker} type="monotone" dataKey={stock.name} stroke={stock.color} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                        )
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            
            {/* 향후 AI 리포트 공간 */}
            <div className="mt-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
               <p className="text-xs text-blue-400 font-bold flex items-center"><span className="mr-2">🤖</span> AI Insight</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}