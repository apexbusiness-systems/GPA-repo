import React from 'react';
import { CoachProfile, COACH_ROSTER } from '../state';

export interface CoachCardProps {
  coach: CoachProfile;
  transcript: {
    text: string;
    action?: string;
    confidence?: number;
    coach?: CoachProfile;
  } | string | null;
  onSwitchCoach?: (coachId: string) => void;
}

export const CoachCard: React.FC<CoachCardProps> = ({
  coach,
  transcript,
  onSwitchCoach,
}) => {
  const transcriptText =
    typeof transcript === 'string'
      ? transcript
      : transcript?.text ?? coach.cue;

  const recommendedAction =
    typeof transcript === 'object' && transcript !== null
      ? transcript.action
      : undefined;

  return (
    <article
      className="gpa-hud-card p-4 flex flex-col gap-3 max-w-md w-full select-none"
      aria-label={`Tactical coach advice from ${coach.name}`}
    >
      {/* Top Header: Coach Identity & Quick Switcher */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-900 border border-slate-700/80 shadow-md flex-shrink-0">
            <img
              data-testid="coach-portrait"
              src={coach.portrait}
              alt={`${coach.name}, ${coach.role}`}
              className="w-full h-full object-cover"
              loading="eager"
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <strong className="gpa-text-primary text-sm uppercase tracking-wide">
                {coach.name}
              </strong>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 uppercase">
                {coach.tone}
              </span>
            </div>
            <span className="gpa-text-secondary text-xs">{coach.role}</span>
          </div>
        </div>

        {/* Coach Switcher Controls with minimum 44x44px targets */}
        <div className="flex items-center gap-1.5" role="group" aria-label="Switch tactical coach">
          {COACH_ROSTER.map((c) => (
            <button
              key={c.id}
              data-testid={`switch-coach-${c.id}`}
              type="button"
              onClick={() => onSwitchCoach?.(c.id)}
              className={`gpa-target-min px-2.5 py-1 text-xs font-mono font-bold rounded transition-all ${
                c.id === coach.id
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/60 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                  : 'bg-slate-900/90 text-slate-400 border border-slate-800 hover:text-slate-200 hover:border-slate-700'
              }`}
              title={`Switch coach to ${c.name} (${c.role})`}
              aria-label={`Switch coach to ${c.name}`}
              aria-pressed={c.id === coach.id}
            >
              {c.name.slice(0, 3).toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Main Transcript Body */}
      <div className="flex flex-col gap-2 pt-1">
        <p className="gpa-text-primary text-xs leading-relaxed font-medium">
          {transcriptText}
        </p>

        {recommendedAction && recommendedAction !== 'none' && (
          <div className="flex items-center gap-1.5 text-xs font-mono font-semibold gpa-text-accent bg-amber-950/30 border border-amber-800/40 rounded px-2 py-1.5 mt-1">
            <span aria-hidden="true">→</span>
            <span>{recommendedAction}</span>
          </div>
        )}
      </div>
    </article>
  );
};
