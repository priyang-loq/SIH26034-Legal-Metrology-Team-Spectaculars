import React from 'react';

interface RulerBarProps {
  label?: string;
  className?: string;
}

export const RulerBar: React.FC<RulerBarProps> = ({ label = "LEGAL METROLOGY STANDARDS CALIBRATION [ACT 2009 / PCR 2011]", className = "" }) => {
  return (
    <div className={`w-full overflow-hidden select-none border-y border-[#D6DEEA] bg-[#E3E9F2] py-1 text-[#5B6B84] text-[10px] font-mono ${className}`}>
      <div className="flex items-center justify-between px-3">
        <span className="tracking-widest uppercase text-[9px] font-semibold text-[#14224A]/70">{label}</span>
        <span className="hidden sm:inline tracking-wider">UNIT: STANDARD SI METRIC (RULE 12 COMPLIANT)</span>
      </div>
      <div className="mt-1 h-3 flex items-end justify-between px-1 opacity-60">
        {Array.from({ length: 48 }).map((_, i) => {
          const isMajor = i % 8 === 0;
          const isMid = i % 4 === 0;
          return (
            <div key={i} className="flex flex-col items-center">
              <div 
                className={`w-[1px] bg-[#14224A] ${
                  isMajor ? 'h-3 bg-[#14224A]' : isMid ? 'h-2 bg-[#5B6B84]' : 'h-1 bg-[#8B99B0]'
                }`} 
              />
              {isMajor && (
                <span className="text-[7px] text-[#14224A] -mt-0.5 leading-none font-mono">
                  {i * 10}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
