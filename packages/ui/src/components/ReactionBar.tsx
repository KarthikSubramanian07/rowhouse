import type { ReactionType } from '@rowhouse/types';
import { REACTION_TYPES } from '@rowhouse/types';
import { Flame, Frown, Laugh, type LucideIcon, Zap } from 'lucide-react';
import * as React from 'react';
import { cn } from '../lib/cn.js';
import { REACTION_COLORS, REACTION_LABELS } from '../lib/reactions.js';

const ICONS: Record<ReactionType, LucideIcon> = {
  fire: Flame,
  laugh: Laugh,
  cry: Frown,
  shock: Zap,
};

export interface ReactionBarProps {
  onReact?: (type: ReactionType) => void;
  className?: string;
  /** Disable all buttons (e.g. while offline). */
  disabled?: boolean;
}

/**
 * The audience's voice. Four reactions — fire / laugh / cry / shock. Each button
 * flashes its own color on press (a quick tap-flash), then settles back to the
 * quiet chrome. Colors come from the reaction palette, never the brand accent.
 */
export function ReactionBar({ onReact, className, disabled = false }: ReactionBarProps) {
  const [flash, setFlash] = React.useState<ReactionType | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const react = (type: ReactionType) => {
    setFlash(type);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFlash(null), 220);
    onReact?.(type);
  };

  return (
    <div
      role="group"
      aria-label="React"
      className={cn('inline-flex items-center gap-1.5', className)}
    >
      {REACTION_TYPES.map((type) => {
        const Icon = ICONS[type];
        const color = REACTION_COLORS[type];
        const isFlashing = flash === type;
        return (
          <button
            key={type}
            type="button"
            disabled={disabled}
            onClick={() => react(type)}
            aria-label={REACTION_LABELS[type]}
            title={REACTION_LABELS[type]}
            className={cn(
              'inline-flex size-9 items-center justify-center rounded-md border',
              'transition-[background-color,border-color,color,transform] duration-150',
              'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
              'disabled:pointer-events-none disabled:opacity-40',
              isFlashing
                ? 'scale-95 border-transparent'
                : 'border-border bg-surface-2 text-text-mid hover:text-text-hi hover:border-text-dim',
            )}
            style={
              isFlashing
                ? {
                    backgroundColor: `color-mix(in srgb, ${color} 22%, transparent)`,
                    color,
                    borderColor: color,
                  }
                : undefined
            }
          >
            <Icon className="size-4.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
