import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { RegulatorTrendData } from '../../types';
import { TrendingUp, BarChart3, AlertOctagon, Filter } from 'lucide-react';

interface TrendChartsProps {
  data: RegulatorTrendData[];
}

export const TrendCharts: React.FC<TrendChartsProps> = ({ data }) => {
  const [chartMode, setChartMode] = useState<'violations' | 'categories' | 'compliance_rate'>('violations');

  // Compute calculated rates
  const formattedData = data.map(item => ({
    ...item,
    complianceRate: Math.round((item.compliantCount / item.totalScans) * 100),
    violationRate: Math.round((item.nonCompliantCount / item.totalScans) * 100),
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#14224A] text-[#F3F6FB] p-3 rounded-lg border border-[#D6DEEA] shadow-xl text-xs font-mono">
          <p className="font-bold text-[#B45309] mb-1.5 border-b border-white/20 pb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 py-0.5">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span>{entry.name}:</span>
              </span>
              <strong className="text-white">
                {entry.value} {entry.unit || ''}
              </strong>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-xl border border-[#D6DEEA] p-5 shadow-xs">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-[#E3E9F2]">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#1B7A43]" />
            <h3 className="font-heading font-bold text-base text-[#14224A]">
              Statutory Violation Trajectory & Compliance Trends
            </h3>
          </div>
          <p className="text-xs text-[#5B6B84] font-medium mt-0.5">
            12-Month Audited Packaging Violations under Legal Metrology (Packaged Commodities) Rules, 2011
          </p>
        </div>

        {/* View Switcher Controls */}
        <div className="inline-flex p-1 bg-[#E3E9F2] rounded-lg text-xs font-mono">
          <button
            onClick={() => setChartMode('violations')}
            className={`px-3 py-1 rounded-md transition-all font-medium ${
              chartMode === 'violations'
                ? 'bg-[#14224A] text-[#F3F6FB] shadow-xs'
                : 'text-[#5B6B84] hover:text-[#14224A]'
            }`}
          >
            Violations Trajectory
          </button>
          <button
            onClick={() => setChartMode('categories')}
            className={`px-3 py-1 rounded-md transition-all font-medium ${
              chartMode === 'categories'
                ? 'bg-[#14224A] text-[#F3F6FB] shadow-xs'
                : 'text-[#5B6B84] hover:text-[#14224A]'
            }`}
          >
            By Sector / Category
          </button>
          <button
            onClick={() => setChartMode('compliance_rate')}
            className={`px-3 py-1 rounded-md transition-all font-medium ${
              chartMode === 'compliance_rate'
                ? 'bg-[#14224A] text-[#F3F6FB] shadow-xs'
                : 'text-[#5B6B84] hover:text-[#14224A]'
            }`}
          >
            Compliance % Rate
          </button>
        </div>
      </div>

      {/* Main Chart Canvas */}
      <div className="h-72 w-full">
        {chartMode === 'violations' && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCompliant" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1B7A43" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#1B7A43" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="colorViolations" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#B42318" stopOpacity={0.5}/>
                  <stop offset="95%" stopColor="#B42318" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="colorCritical" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#B45309" stopOpacity={0.6}/>
                  <stop offset="95%" stopColor="#B45309" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E3E9F2" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#5B6B84', fontSize: 11, fontFamily: 'JetBrains Mono' }} />
              <YAxis tick={{ fill: '#5B6B84', fontSize: 11, fontFamily: 'JetBrains Mono' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: '11px', fontFamily: 'JetBrains Mono', paddingTop: '8px' }}
              />
              <Area
                type="monotone"
                dataKey="compliantCount"
                name="Compliant Packages"
                stroke="#1B7A43"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCompliant)"
              />
              <Area
                type="monotone"
                dataKey="nonCompliantCount"
                name="Violating Packages"
                stroke="#B42318"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorViolations)"
              />
              <Area
                type="monotone"
                dataKey="criticalViolations"
                name="Critical Offenses (Sec 36 Notices)"
                stroke="#B45309"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCritical)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {chartMode === 'categories' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formattedData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E3E9F2" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#5B6B84', fontSize: 11, fontFamily: 'JetBrains Mono' }} />
              <YAxis tick={{ fill: '#5B6B84', fontSize: 11, fontFamily: 'JetBrains Mono' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: '11px', fontFamily: 'JetBrains Mono', paddingTop: '8px' }}
              />
              <Bar dataKey="fmcgViolations" name="Food & FMCG" fill="#1B7A43" radius={[3, 3, 0, 0]} />
              <Bar dataKey="electronicsViolations" name="Electronics & Gadgets" fill="#B45309" radius={[3, 3, 0, 0]} />
              <Bar dataKey="cosmeticsViolations" name="Cosmetics & Personal Care" fill="#B42318" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {chartMode === 'compliance_rate' && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E3E9F2" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#5B6B84', fontSize: 11, fontFamily: 'JetBrains Mono' }} />
              <YAxis domain={[50, 100]} unit="%" tick={{ fill: '#5B6B84', fontSize: 11, fontFamily: 'JetBrains Mono' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ fontSize: '11px', fontFamily: 'JetBrains Mono', paddingTop: '8px' }}
              />
              <Area
                type="monotone"
                dataKey="complianceRate"
                unit="%"
                name="Overall Industry Compliance %"
                stroke="#1B7A43"
                strokeWidth={3}
                fill="#1B7A43"
                fillOpacity={0.15}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Metric Ledger Footer */}
      <div className="mt-4 pt-3 border-t border-[#E3E9F2] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div className="bg-[#EEF2F8] p-2.5 rounded border border-[#D6DEEA]">
          <span className="text-[#5B6B84] text-[10px] block">ANNUAL AUDIT VOLUME</span>
          <strong className="text-[#14224A] text-sm">34,970 Packages</strong>
        </div>
        <div className="bg-[#E7F5EC] p-2.5 rounded border border-[#1B7A43]/30">
          <span className="text-[#1B7A43] text-[10px] block">AVG COMPLIANCE RATE</span>
          <strong className="text-[#1B7A43] text-sm">77.6% (Up +6.8% YoY)</strong>
        </div>
        <div className="bg-[#FCEAE8] p-2.5 rounded border border-[#B42318]/30">
          <span className="text-[#B42318] text-[10px] block">TOTAL VIOLATIONS</span>
          <strong className="text-[#B42318] text-sm">7,833 Cases Flagged</strong>
        </div>
        <div className="bg-[#FDF3D8] p-2.5 rounded border border-[#B45309]/30">
          <span className="text-[#B45309] text-[10px] block">SEC 36 PENAL PROCEEDINGS</span>
          <strong className="text-[#B45309] text-sm">1,842 Notices Issued</strong>
        </div>
      </div>
    </div>
  );
};
