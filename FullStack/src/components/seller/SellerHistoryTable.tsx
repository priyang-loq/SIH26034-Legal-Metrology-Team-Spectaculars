import React from 'react';
import { SellerHistoryItem } from '../../types';
import { History, CheckCircle2, AlertTriangle, ExternalLink, RotateCcw } from 'lucide-react';
import { StampBadge } from '../common/StampBadge';

interface SellerHistoryTableProps {
  history: SellerHistoryItem[];
  onRecheck: (item: SellerHistoryItem) => void;
}

export const SellerHistoryTable: React.FC<SellerHistoryTableProps> = ({ history, onRecheck }) => {
  return (
    <div className="bg-white rounded-xl border border-[#D6DEEA] p-5 shadow-xs">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#E3E9F2]">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-[#14224A]" />
          <h3 className="font-heading font-bold text-base text-[#14224A]">
            Seller Pre-Listing Scan History
          </h3>
        </div>
        <span className="text-xs font-mono text-[#5B6B84]">
          Total Pre-Flight Checks: {history.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-[#D6DEEA] bg-[#EEF2F8] text-[#5B6B84]">
              <th className="py-2.5 px-3">DATE & TIME</th>
              <th className="py-2.5 px-3 font-sans">PRODUCT NAME & SKU</th>
              <th className="py-2.5 px-3">CATEGORY</th>
              <th className="py-2.5 px-3">VERDICT</th>
              <th className="py-2.5 px-3 text-right">COMPLIANCE</th>
              <th className="py-2.5 px-3 text-center">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E3E9F2]">
            {history.map((item) => {
              const isPass = item.status === 'COMPLIANT';
              return (
                <tr key={item.id} className="hover:bg-[#EEF2F8] transition-colors">
                  <td className="py-3 px-3 whitespace-nowrap text-[#5B6B84]">
                    {item.date}
                  </td>
                  <td className="py-3 px-3 font-sans">
                    <div className="font-bold text-[#14224A]">{item.productName}</div>
                    <div className="text-[11px] text-[#5B6B84] font-mono">SKU: {item.sku} | Brand: {item.brand}</div>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap text-[#5B6B84]">
                    {item.category}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded ${
                      isPass ? 'bg-[#E7F5EC] text-[#1B7A43]' : 'bg-[#FCEAE8] text-[#B42318]'
                    }`}>
                      {isPass ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      <span>{item.status === 'COMPLIANT' ? 'PASSED (LISTING APPROVED)' : 'FLAGGED (ACTION REQ)'}</span>
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-bold">
                    <span className={isPass ? 'text-[#1B7A43]' : 'text-[#B42318]'}>
                      {item.score}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    <button
                      onClick={() => onRecheck(item)}
                      className="px-2.5 py-1 bg-[#E3E9F2] hover:bg-[#14224A] hover:text-white rounded text-[11px] font-medium transition-colors inline-flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Review Details</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
