import React from 'react';

export interface VoiceOrbProps {
  isListening: boolean;
  amplitude?: number;
  onToggle?: () => void;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  isListening,
  amplitude = 0,
  onToggle,
}) => {
  // Deterministic scale calculation based on mic amplitude (0.0 to 1.0)
  const normalizedAmp = Math.max(0, Math.min(1, amplitude));
  const scale = isListening ? 1 + normalizedAmp * 0.45 : 1;
  const glowIntensity = isListening ? 0.8 + normalizedAmp * 0.2 : 0.3;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={isListening ? 'Voice agent listening' : 'Voice agent standby'}
      aria-pressed={isListening}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle?.();
        }
      }}
      className="gpa-target-min relative rounded-full flex items-center justify-center cursor-pointer select-none transition-transform duration-100 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      style={{
        transform: `scale(${scale})`,
        width: '56px',
        height: '56px',
      }}
    >
      {/* Outer Halo Scrim Ring */}
      <div
        className="absolute inset-0 rounded-full transition-opacity duration-150"
        style={{
          boxShadow: isListening
            ? `0 0 24px rgba(16, 185, 129, ${glowIntensity}), 0 0 0 2px rgba(16, 185, 129, 0.8)`
            : `0 0 16px rgba(245, 158, 11, ${glowIntensity}), 0 0 0 1px rgba(245, 158, 11, 0.4)`,
        }}
      />

      {/* Core High-Contrast Orb Foundation */}
      <div className="relative w-11 h-11 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center shadow-inner overflow-hidden">
        {/* Animated Radial Energy Field */}
        <div
          className={`w-7 h-7 rounded-full transition-all duration-150 ${
            isListening
              ? 'bg-gradient-to-tr from-emerald-500 to-teal-300 shadow-[0_0_12px_#10b981]'
              : 'bg-gradient-to-tr from-amber-500 to-yellow-300 shadow-[0_0_8px_#f59e0b]'
          }`}
          style={{
            opacity: isListening ? 0.95 : 0.75,
            transform: `scale(${0.85 + normalizedAmp * 0.3})`,
          }}
        />

        {/* Center Mic Activity Glyphs */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isListening ? 'bg-white shadow-[0_0_6px_#ffffff]' : 'bg-slate-900'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
