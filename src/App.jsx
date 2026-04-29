import React, { useState, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const mockRadarData = [
  { subject: '성장성', score: 95, fullMark: 100 },
  { subject: '수익성', score: 88, fullMark: 100 },
  { subject: '수급강도', score: 92, fullMark: 100 },
  { subject: '가격매력', score: 45, fullMark: 100 },
  { subject: '배당/안정', score: 60, fullMark: 100 },
];

export default function App() {
  const [activeMenu, setActiveMenu] = useState('국내증시');
  const [viewMode, setViewMode] = useState('dashboard');
  const [selectedStock, setSelectedStock] = useState({ name: '', ticker: '' }); // 선택된 종목 객체
  
  // 상태 관리
  const [fullChartData, setFullChartData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('1Y'); 
  
  
  // 🚀 검색창 관련 상태 추가
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // 🚀 [추가] AI 리포트 데이터를 담을 상태들
  const [aiReport, setAiReport] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // 검색어 입력 시 백엔드 API 호출하는 함수
  const handleSearchChange = async (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    // 두 글자 이상 입력되었을 때만 검색 실행
    if (value.trim().length >= 1) {
      try {
        const response = await fetch(`http://localhost:8000/api/search?keyword=${value}`);
        const result = await response.json();
        setSearchResults(result.data || []);
      } catch (error) {
        console.error("검색 에러:", error);
      }
    } else {
      setSearchResults([]); // 검색어가 짧으면 결과 초기화
    }
  };

  // 종목 선택 시 상세 리포트로 이동하는 함수
  const goToDetail = async (stock) => {
  setSelectedStock({ name: stock.name, ticker: stock.ticker });
  setViewMode('detail');
  setIsLoading(true);
  
  // 🚀 [추가] AI 리포트 호출 준비
  setIsAiLoading(true); 
  setAiReport(''); 
  
  setSelectedPeriod('1Y'); 
  setSearchTerm(''); 
  setSearchResults([]); 

  try {
    // 1. 기존 주가 데이터 가져오기 로직 (그대로 유지)
    const response = await fetch(`http://localhost:8000/api/stock/${stock.ticker}`);
    const result = await response.json();
    if (result.data) {
      const formattedData = result.data.map(item => ({
        time: item.Date, 
        [stock.name]: item.Close
      })).sort((a, b) => new Date(a.time) - new Date(b.time)); 
      setFullChartData(formattedData);
    }

    // 🚀 [추가] 2. 백엔드 AI 리포트 API 호출하기
    const aiRes = await fetch(`http://localhost:8000/api/ai-report/${stock.ticker}?stock_name=${stock.name}`);
    const aiResult = await aiRes.json();
    setAiReport(aiResult.report); // 받아온 분석글 저장

  } catch (error) {
    console.error("데이터 통신 에러:", error);
  } finally {
    setIsLoading(false);
    // 🚀 [추가] AI 로딩 종료
    setIsAiLoading(false); 
  }
};

  const displayChartData = useMemo(() => {
    if (fullChartData.length === 0) return [];
    if (selectedPeriod === '10Y') return fullChartData;

    const lastData = fullChartData[fullChartData.length - 1];
    const endDate = new Date(lastData.time);
    const startDate = new Date(endDate);

    if (selectedPeriod === '1M') startDate.setMonth(endDate.getMonth() - 1);
    else if (selectedPeriod === '3M') startDate.setMonth(endDate.getMonth() - 3);
    else if (selectedPeriod === '1Y') startDate.setFullYear(endDate.getFullYear() - 1);

    return fullChartData.filter(item => new Date(item.time) >= startDate);
  }, [fullChartData, selectedPeriod]);

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      
      {/* 왼쪽 사이드바 */}
      <aside className="w-60 bg-slate-900 text-white flex flex-col shadow-xl z-10">
        <div className="p-6 border-b border-slate-800 text-xl font-black tracking-tighter">STOCK INSIGHT</div>
        <nav className="flex-1 p-4 space-y-1">
          {['국내증시', '해외증시', '포트폴리오'].map(m => (
            <button 
              key={m} 
              onClick={() => { setActiveMenu(m); setViewMode('dashboard'); }} 
              className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold transition-all ${activeMenu === m ? 'bg-blue-600' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              {m}
            </button>
          ))}
        </nav>
      </aside>

      {/* 메인 영역 */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        
        {viewMode === 'dashboard' ? (
          <div className="p-8 space-y-6 max-w-6xl mx-auto w-full relative">
            <h2 className="text-3xl font-black text-slate-900 mb-8">🔥 종목 검색</h2>
            
            {/* 🚀 검색창 UI */}
            <div className="relative w-full max-w-2xl">
              <input 
                type="text" 
                placeholder="종목명을 입력하세요 (예: 삼성, 카카오)" 
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full px-6 py-4 text-lg border-2 border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
              />
              
              {/* 검색 결과 드롭다운 */}
              {searchResults.length > 0 && (
                <ul className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                  {searchResults.map((stock) => (
                    <li 
                      key={stock.ticker} 
                      onClick={() => goToDetail(stock)}
                      className="px-6 py-3 border-b border-slate-50 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition-colors"
                    >
                      <span className="font-bold text-slate-800">{stock.name}</span>
                      <span className="text-sm text-slate-400">{stock.ticker}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            <p className="text-slate-500 mt-4">데이터베이스에 저장된 2,500여 개의 상장 종목을 검색하고 10년 치 분석 리포트를 확인하세요.</p>

          </div>
        ) : (
          /* 상세 리포트 뷰 (이전과 동일, selectedStock.name 사용) */
          <div className="p-8 max-w-6xl mx-auto w-full space-y-6">
            {/* 🚀 [교체] 왼쪽: 가짜 차트 대신 진짜 🤖 AI 애널리스트 리포트 박스 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-1 h-[22rem] overflow-y-auto">
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
                <span className="text-xl mr-2">🤖</span> AI 애널리스트 요약
              </h3>
              
              {isAiLoading ? (
                // 로딩 중일 때 보여줄 화면
                <div className="flex flex-col items-center justify-center h-48 space-y-4">
                  <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                  <p className="text-sm font-bold text-blue-600 animate-pulse">최근 30일치 데이터를 분석 중입니다...</p>
                </div>
              ) : (
                // 분석이 완료되었을 때 글자 보여주기
                <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {aiReport || "분석 데이터를 불러오지 못했습니다."}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-1">
                <h3 className="text-sm font-bold text-slate-800 mb-4">📊 펀더멘탈 점수</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={mockRadarData}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 12, fontWeight: 'bold' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name={selectedStock.name} dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.5} />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2 relative">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-bold text-slate-800">📈 주가 추이 (Real Data)</h3>
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                    {['1M', '3M', '1Y', '10Y'].map(period => (
                      <button 
                        key={period}
                        onClick={() => setSelectedPeriod(period)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${selectedPeriod === period ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        {period === '1M' ? '1개월' : period === '3M' ? '3개월' : period === '1Y' ? '1년' : '10년'}
                      </button>
                    ))}
                  </div>
                </div>
                
                {isLoading && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-2xl z-10">
                    <div className="text-blue-600 font-bold animate-pulse">데이터를 불러오는 중입니다...</div>
                  </div>
                )}

                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={displayChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill:'#94a3b8', fontSize:10}} minTickGap={selectedPeriod === '10Y' ? 100 : 20} dy={10} />
                      <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{fill:'#94a3b8', fontSize:12}} width={80} />
                      <Tooltip contentStyle={{borderRadius:'12px', border:'none', boxShadow:'0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                      <Line type="monotone" dataKey={selectedStock.name} stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}