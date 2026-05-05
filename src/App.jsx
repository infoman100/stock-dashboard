import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// 🚀 백엔드 API 주소 세팅 (클라우드 환경변수 우선)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// 🗂️ [핵심 1] 테마 및 대장주(Top 5) 수동 큐레이션 데이터
const THEMES = [
  { 
    id: 'semiconductor', 
    name: '🔥 AI & 반도체 대장주', 
    stocks: [
      { ticker: '005930.KS', name: '삼성전자', color: '#ef4444' },    // 기준 A (시총)
      { ticker: '000660.KS', name: 'SK하이닉스', color: '#3b82f6' },  // 기준 A (시총)
      { ticker: '042700.KS', name: '한미반도체', color: '#10b981' },  // 기준 B (트렌드)
      { ticker: '028300.KS', name: 'HLB', color: '#f59e0b' },        // 기준 B (트렌드)
      { ticker: '041510.KS', name: '에스엠', color: '#8b5cf6' }       // 임시 (실제 대장주로 교체 필요)
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
  const [chartData, setChartData] = useState([]);
  const [activeStocks, setActiveStocks] = useState([]); // 체크박스로 선택된 종목들
  const [isLoading, setIsLoading] = useState(false);
  
  // 🗂️ [핵심 2] 사무실 시크릿 모드 (기본값: true)
  const [isSecretMode, setIsSecretMode] = useState(true); 

  // 테마 클릭 시 DB에서 데이터 가져오기 및 '수익률(%)' 변환 로직
  const handleThemeClick = async (theme) => {
    setIsLoading(true);
    setActiveTheme(theme);
    
    // 처음엔 Top 3 종목만 기본으로 체크해둡니다 (화면 복잡도 방지)
    const initialStocks = theme.stocks.slice(0, 3).map(s => s.name);
    setActiveStocks(initialStocks);

    try {
      // 5개 대장주 데이터를 DB에서 한 번에 긁어옵니다.
      // (주의: DB에 저장된 실제 티커명에 맞게 호출해야 합니다. 예: .KS가 필요하다면 붙여야 함)
      const promises = theme.stocks.map(stock => 
        fetch(`${API_BASE_URL}/api/stock/${stock.ticker}`).then(res => res.json())
      );
      const results = await Promise.all(promises);

      let mergedData = {};

      results.forEach((res, index) => {
        if (!res.data || res.data.length === 0) return;
        
        const stockName = theme.stocks[index].name;
        
        // 🗂️ [핵심 3] 수익률 영점(0%) 조정: 조회된 기간의 첫 날 가격을 기준점으로 잡습니다.
        const basePrice = res.data[0].Close;

        res.data.forEach(item => {
          if (!mergedData[item.Date]) mergedData[item.Date] = { time: item.Date };
          // 수익률 공식: ((현재가 - 기준가) / 기준가) * 100
          const returnRate = ((item.Close - basePrice) / basePrice) * 100;
          mergedData[item.Date][stockName] = parseFloat(returnRate.toFixed(2));
        });
      });

      // 날짜순으로 정렬하여 차트 데이터 완성
      const sortedData = Object.values(mergedData).sort((a, b) => new Date(a.time) - new Date(b.time));
      setChartData(sortedData);

    } catch (error) {
      console.error("데이터 로딩 실패:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 체크박스 클릭 시 선을 끄고 켜는 함수
  const toggleStock = (stockName) => {
    setActiveStocks(prev => 
      prev.includes(stockName) ? prev.filter(name => name !== stockName) : [...prev, stockName]
    );
  };

  return (
    <div className="flex h-screen bg-[#111827] text-slate-300 font-sans overflow-hidden selection:bg-blue-500/30">
      
      {/* --- 사이드바 (사무실 친화적 다크톤) --- */}
      <aside className="w-64 bg-[#0b0f19] border-r border-slate-800 flex flex-col z-10">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-black text-white tracking-tighter">STOCK INSIGHT</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
          {/* 테마 리스트 */}
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

          {/* 시크릿 포트폴리오 영역 */}
          <div className="pt-4 border-t border-slate-800">
            <div className="flex justify-between items-center mb-3 px-2">
              <span className="text-xs font-bold text-slate-500">MY PORTFOLIO</span>
              <button 
                onClick={() => setIsSecretMode(!isSecretMode)} 
                className="text-slate-400 hover:text-white text-xs bg-slate-800 px-2 py-1 rounded"
              >
                {isSecretMode ? '👁️ 보이기' : '🙈 숨기기'}
              </button>
            </div>
            <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 mx-2">
              <p className="text-[10px] text-slate-500 mb-1">총 평가금액</p>
              <p className="text-lg font-mono font-black text-slate-100">
                {isSecretMode ? '***,***,*** 원' : '42,500,000 원'}
              </p>
              <p className={`text-sm font-bold mt-1 ${isSecretMode ? 'text-slate-600' : 'text-red-400'}`}>
                {isSecretMode ? '+ *.*%' : '+ 14.2%'}
              </p>
            </div>
          </div>
        </nav>
      </aside>

      {/* --- 메인 대시보드 --- */}
      <main className="flex-1 flex flex-col relative">
        {!activeTheme ? (
          // 초기 화면 (테마 선택 유도)
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <span className="text-4xl mb-4">📊</span>
            <p className="text-lg font-bold">좌측에서 분석할 테마를 선택해주세요.</p>
            <p className="text-sm mt-2">대장주 5종목의 누적 수익률을 한눈에 비교할 수 있습니다.</p>
          </div>
        ) : (
          // 테마 선택 시 보여지는 오버레이 차트 화면
          <div className="p-8 max-w-6xl mx-auto w-full h-full flex flex-col animate-fade-in">
            <h2 className="text-2xl font-black text-white mb-6">{activeTheme.name}</h2>
            
            {/* 상단 컨트롤 패널 (체크박스) */}
            <div className="bg-[#1e293b] border border-slate-700 p-5 rounded-2xl mb-6">
              <p className="text-xs font-bold text-slate-400 mb-3">비교할 대장주 선택 (Top 5)</p>
              <div className="flex flex-wrap gap-3">
                {activeTheme.stocks.map(stock => {
                  const isActive = activeStocks.includes(stock.name);
                  return (
                    <label key={stock.ticker} className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border transition-all ${isActive ? 'bg-slate-800 border-slate-600' : 'border-transparent opacity-40 hover:opacity-80'}`}>
                      <input 
                        type="checkbox" 
                        checked={isActive}
                        onChange={() => toggleStock(stock.name)}
                        className="hidden" // 기본 체크박스는 숨기고 디자인된 UI 사용
                      />
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stock.color }}></div>
                      <span className="text-sm font-bold text-slate-200">{stock.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 수익률 오버레이 차트 */}
            <div className="flex-1 bg-[#1e293b] border border-slate-700 p-6 rounded-2xl relative min-h-[400px]">
              <div className="absolute top-6 left-6 z-10">
                <h3 className="text-sm font-bold text-slate-200">누적 수익률 비교 (%)</h3>
                <p className="text-[10px] text-slate-500 mt-1">조회 기간 첫 날 기준</p>
              </div>

              {isLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1e293b]/80 backdrop-blur-sm z-20 rounded-2xl">
                  <div className="w-8 h-8 border-4 border-slate-600 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                  <p className="text-sm font-bold text-blue-400">데이터를 동기화하고 있습니다...</p>
                </div>
              ) : (
                <div className="w-full h-full pt-12">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                      <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill:'#64748b', fontSize:11}} minTickGap={30} dy={10} />
                      <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{fill:'#64748b', fontSize:11}} tickFormatter={(val) => `${val}%`} width={50} />
                      <Tooltip 
                        contentStyle={{backgroundColor:'#0f172a', borderColor:'#334155', borderRadius:'8px', color:'#f8fafc'}}
                        itemStyle={{fontWeight:'bold'}}
                        labelStyle={{color:'#94a3b8', marginBottom:'8px'}}
                        formatter={(value) => [`${value}%`]}
                      />
                      
                      {/* 선택된 종목만 Line으로 그림 */}
                      {activeTheme.stocks.map(stock => (
                        activeStocks.includes(stock.name) && (
                          <Line 
                            key={stock.ticker} 
                            type="monotone" 
                            dataKey={stock.name} 
                            stroke={stock.color} 
                            strokeWidth={2.5} 
                            dot={false} 
                            activeDot={{ r: 6, strokeWidth: 0 }} 
                          />
                        )
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* 향후 AI 리포트가 들어갈 공간 (디자인 뼈대만 잡아둠) */}
            <div className="mt-6 bg-blue-900/10 border border-blue-900/30 p-5 rounded-2xl">
               <p className="text-sm text-blue-400 font-bold flex items-center">
                 <span className="mr-2">🤖</span> AI 테마 브리핑 준비 중...
               </p>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}