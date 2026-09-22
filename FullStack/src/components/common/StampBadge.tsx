import React from 'react';
import { ComplianceStatus } from '../../types';

interface StampBadgeProps {
  status: ComplianceStatus | 'INSPECTING';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  customText?: string;
  rotation?: number; // e.g. -6
  className?: string;
}

export const StampBadge: React.FC<StampBadgeProps> = ({
  status,
  size = 'md',
  customText,
  rotation = -5,
  className = ''
}) => {
  const isPass = status === 'COMPLIANT';
  const isFail = status === 'NON_COMPLIANT';
  const isPending = status === 'FLAGGED_REVIEW' || status === 'INSPECTING' || status === 'NEEDS_REVIEW';

  const sizeClasses = {
    sm: 'w-20 h-20 text-[8px]',
    md: 'w-28 h-28 text-[10px]',
    lg: 'w-36 h-36 text-[12px]',
    xl: 'w-44 h-44 text-[14px]'
  }[size];

  const colorStyles = isPass
    ? 'text-[#1B7A43] border-[#1B7A43] bg-[#1B7A43]/5 shadow-[0_0_0_1px_rgba(47,107,79,0.2)]'
    : isFail
    ? 'text-[#B42318] border-[#B42318] bg-[#B42318]/5 shadow-[0_0_0_1px_rgba(178,58,46,0.2)]'
    : 'text-[#B45309] border-[#B45309] bg-[#B45309]/5 shadow-[0_0_0_1px_rgba(217,143,43,0.2)]';

  const defaultTop = isPass ? 'LEGAL METROLOGY' : isFail ? 'STATUTORY NOTICE' : 'VERIFICATION';
  const defaultCenter = customText || (isPass ? 'COMPLIANT' : isFail ? 'REJECTED' : status === 'NEEDS_REVIEW' || status === 'FLAGGED_REVIEW' ? 'NEEDS REVIEW' : 'INSPECTING');
  const defaultBottom = isPass ? 'LMPC 2011 PASSED' : isFail ? 'SEC 36 VIOLATION' : 'AUDIT PENDING';

  return (
    <div 
      className={`relative inline-flex items-center justify-center select-none font-mono font-bold tracking-widest ${className}`}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      {/* Outer Stamp Circle */}
      <div 
        className={`rounded-full flex flex-col items-center justify-center p-1.5 transition-all duration-300 ${sizeClasses} ${colorStyles}`}
        style={{
          borderWidth: size === 'sm' ? '2.5px' : '3.5px',
          borderStyle: 'dashed'
        }}
      >
        {/* Inner Solid Ring */}
        <div 
          className="w-full h-full rounded-full flex flex-col items-center justify-center p-2 text-center"
          style={{
            borderWidth: size === 'sm' ? '1px' : '1.5px',
            borderStyle: 'solid',
            borderColor: 'currentColor'
          }}
        >
          {/* Top Arc Label */}
          <span className="text-[7px] md:text-[8px] uppercase tracking-wider opacity-85 leading-tight font-semibold">
            {defaultTop}
          </span>

          {/* Center Main Verdict */}
          <span className={`my-0.5 font-extrabold uppercase tracking-widest leading-none ${
            size === 'xl' ? 'text-lg' : size === 'lg' ? 'text-base' : size === 'md' ? 'text-xs' : 'text-[9px]'
          }`}>
            {defaultCenter}
          </span>

          {/* Horizontal Divider Line */}
          <div className="w-4/5 h-[1px] bg-current my-0.5 opacity-60" />

          {/* Bottom Subtext */}
          <span className="text-[6.5px] md:text-[7.5px] uppercase tracking-tight opacity-90 leading-tight">
            {defaultBottom}
          </span>
        </div>
      </div>
    </div>
  );
};
