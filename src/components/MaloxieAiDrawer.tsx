import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Check, RotateCcw, X } from 'lucide-react';
import Strands from '../../components/Strands';
import { BubbleButton } from './BubbleControls';
import {
  analyzeActiveWeek,
  createInitialAiGreeting,
  generateMaloxieAiReply,
  type MaloxieAction,
  type MaloxieMessage,
  type PlannerContext,
} from '../utils/maloxieAiEngine';
import { DEFAULT_PRICING_CONFIG, formatCurrency } from '../utils/currencyUtils';

interface MaloxieAiDrawerProps {
  visible: boolean;
  context: PlannerContext;
  onApplyAction: (action: MaloxieAction) => void;
}

const CRYSTAL_COLORS = [
  '#B86B4B',
  '#D69E85',
  '#FAF8F6',
  '#F0EAE6',
  '#D9D0CB',
  '#908B6F',
  '#6A6754',
];

export const MaloxieAiDrawer: React.FC<MaloxieAiDrawerProps> = ({
  visible,
  context,
  onApplyAction,
}) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [appliedActionIds, setAppliedActionIds] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<MaloxieMessage[]>(() => [
    createInitialAiGreeting(context),
  ]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const replyTimerRef = useRef<number | null>(null);

  const liveAudit = useMemo(() => analyzeActiveWeek(context), [context]);
  const activeCurrencyCode = (context.pricing || DEFAULT_PRICING_CONFIG).currencyCode;
  const quickPrompts = useMemo(() => {
    const budgetTargetLabel = formatCurrency(
      Math.max(1, Math.round(context.targets.weeklyBudget * 0.75)),
      activeCurrencyCode,
      { compact: true }
    );
    return [
      'Review my week',
      'Create a high-protein week',
      'Fill my empty slots',
      `Create a budget week under ${budgetTargetLabel}`,
      'Quick 20-minute weeknight plan',
      'Vegetarian week plan',
    ];
  }, [context.targets.weeklyBudget, activeCurrencyCode]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 180);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isThinking, open]);

  useEffect(() => {
    return () => {
      if (replyTimerRef.current !== null) {
        window.clearTimeout(replyTimerRef.current);
      }
    };
  }, []);

  if (!visible) return null;

  const sendPrompt = (rawText: string) => {
    const text = rawText.trim();
    if (!text || isThinking) return;

    const userMsg: MaloxieMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      body: text,
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    if (replyTimerRef.current !== null) {
      window.clearTimeout(replyTimerRef.current);
    }

    replyTimerRef.current = window.setTimeout(() => {
      const reply = generateMaloxieAiReply(text, context);
      setMessages((prev) => [...prev, reply]);
      setIsThinking(false);
      replyTimerRef.current = null;
    }, 360);
  };

  const handleReset = () => {
    if (replyTimerRef.current !== null) {
      window.clearTimeout(replyTimerRef.current);
      replyTimerRef.current = null;
    }
    setIsThinking(false);
    setAppliedActionIds({});
    setMessages([createInitialAiGreeting(context)]);
  };

  const handleTriggerAction = (msgId: string, actionIdx: number, action: MaloxieAction) => {
    onApplyAction(action);
    setAppliedActionIds((prev) => ({
      ...prev,
      [`${msgId}-${actionIdx}`]: true,
    }));
  };

  return (
    <>
      {/* Floating Crystal Ball Launcher when Drawer is Closed */}
      {!open && (
        <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open Maloxie AI"
            className="group relative flex items-center gap-2.5 rounded-full bg-[#2E2D24]/92 hover:bg-[#2E2D24] border border-[#D9D0CB]/35 pl-1.5 pr-4 py-1.5 shadow-[0_14px_34px_rgba(20,19,15,0.48)] transition-transform duration-200 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9D0CB]"
          >
            <div className="w-11 h-11 rounded-full overflow-hidden shrink-0">
              <Strands
                colors={CRYSTAL_COLORS}
                count={3}
                speed={0.95}
                energy={0.62}
                glass
                glassSize={1.08}
                refraction={1.05}
                dispersion={0.9}
                rim={1.1}
                interactive
                clickPulse={false}
                maxDevicePixelRatio={1}
              />
            </div>
            <div className="text-left leading-tight">
              <div className="font-display text-xs font-semibold text-[#FAF8F6] whitespace-nowrap">
                Maloxie AI
              </div>
              <div className="text-[11px] text-[#D9D0CB] whitespace-nowrap">
                Plan &amp; feedback
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Backdrop Scrim */}
      {open && (
        <div
          aria-hidden="true"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-[#1B1A15]/45 transition-opacity"
        />
      )}

      {/* Slide-Over Maloxie AI Drawer */}
      {open && (
        <aside
          role="dialog"
          aria-label="Maloxie AI Meal Planner Assistant"
          className="fixed inset-y-0 right-0 z-50 w-full max-w-[460px] bg-[#24231D] border-l border-[#D9D0CB]/20 shadow-2xl flex flex-col text-[#FAF8F6]"
        >
          {/* Crystal Ball Header */}
          <div className="px-5 pt-4 pb-3.5 border-b border-[#D9D0CB]/14 bg-[#2E2D24]/70">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 text-xs text-[#D9D0CB] hover:text-[#FAF8F6] transition-colors whitespace-nowrap shrink-0"
                title="Reset conversation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>New chat</span>
              </button>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close Maloxie AI"
                className="p-1.5 rounded-full text-[#D9D0CB] hover:text-[#FAF8F6] hover:bg-[#FAF8F6]/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-1 flex flex-col items-center text-center">
              <button
                type="button"
                onClick={() => sendPrompt('Review my week')}
                aria-label="Analyze active week with Maloxie AI crystal ball"
                title="Click crystal ball to review active week"
                className="w-[132px] h-[132px] rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9D0CB]"
              >
                <Strands
                  colors={CRYSTAL_COLORS}
                  count={3}
                  speed={isThinking ? 1.55 : 0.95}
                  energy={isThinking ? 0.95 : 0.62}
                  listening={isThinking}
                  glass
                  glassSize={1.06}
                  refraction={1.1}
                  dispersion={1}
                  rim={1.15}
                  interactive
                  clickPulse
                  maxDevicePixelRatio={1.25}
                />
              </button>

              <h2 className="mt-1 font-display text-lg font-bold tracking-tight text-[#FAF8F6]">
                Maloxie AI
              </h2>
              <div className="mt-0.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-xs text-[#D9D0CB] font-mono tabular-nums">
                <span>Week {context.activeWeekIndex + 1}</span>
                <span aria-hidden="true">·</span>
                <span>{liveAudit.plannedMeals} meals</span>
                <span aria-hidden="true">·</span>
                <span>{liveAudit.avgCalories} kcal/day</span>
                <span aria-hidden="true">·</span>
                <span>
                  {formatCurrency(liveAudit.estWeeklyCost, activeCurrencyCode, {
                    compact: true,
                  })}{' '}
                  est.
                </span>
              </div>
            </div>
          </div>

          {/* Quick Prompt Bar */}
          <div className="px-4 py-2.5 border-b border-[#D9D0CB]/12 flex items-center gap-1.5 overflow-x-auto bg-[#2A2922]">
            {quickPrompts.map((q) => (
              <button
                key={q}
                type="button"
                disabled={isThinking}
                onClick={() => sendPrompt(q)}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#3B392D] hover:bg-[#4B493A] text-[#E8E2DC] hover:text-[#FAF8F6] border border-[#D9D0CB]/15 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Conversation History */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5"
          >
            {messages.map((msg) => {
              if (msg.role === 'user') {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[82%] rounded-2xl rounded-br-sm bg-[#6A6754] border border-[#D9D0CB]/20 px-3.5 py-2.5 text-xs sm:text-[13px] text-[#FAF8F6] leading-relaxed">
                      {msg.body}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className="rounded-2xl rounded-bl-sm bg-[#323028] border border-[#D9D0CB]/15 p-3.5 space-y-2.5"
                >
                  {msg.title && (
                    <h3 className="font-display text-sm font-semibold text-[#FAF8F6]">
                      {msg.title}
                    </h3>
                  )}

                  <p className="text-xs sm:text-[13px] text-[#E8E2DC] leading-relaxed">
                    {msg.body}
                  </p>

                  {msg.highlights && msg.highlights.length > 0 && (
                    <ul className="space-y-1.5 pt-1 border-t border-[#D9D0CB]/12 text-xs text-[#D9D0CB]">
                      {msg.highlights.map((line, i) => (
                        <li key={i} className="flex items-start gap-2 leading-relaxed">
                          <span
                            aria-hidden="true"
                            className="mt-1.5 w-1 h-1 rounded-full bg-[#B86B4B] shrink-0"
                          />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {msg.planPreview && msg.planPreview.length > 0 && (
                    <div className="pt-2 border-t border-[#D9D0CB]/12 space-y-1.5">
                      <div className="text-[11px] font-medium text-[#D9D0CB]">
                        7-Day Preview
                      </div>
                      <div className="divide-y divide-[#D9D0CB]/10 rounded-xl bg-[#24231D]/75 border border-[#D9D0CB]/12 overflow-hidden">
                        {msg.planPreview.map((day) => (
                          <div
                            key={day.date}
                            className="px-2.5 py-2 text-[11px] leading-snug"
                          >
                            <div className="font-mono font-semibold text-[#FAF8F6]">
                              {day.label}
                            </div>
                            <div className="mt-0.5 text-[#D9D0CB] truncate">
                              B: {day.breakfast}
                            </div>
                            <div className="text-[#D9D0CB] truncate">
                              L: {day.lunch}
                            </div>
                            <div className="text-[#E4A88E] truncate">
                              D: {day.dinner}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {msg.actions && msg.actions.length > 0 && (
                    <div className="pt-1 flex flex-wrap gap-2">
                      {msg.actions.map((action, idx) => {
                        const isApplied = Boolean(appliedActionIds[`${msg.id}-${idx}`]);
                        return (
                          <BubbleButton
                            key={idx}
                            variant={isApplied ? 'sage' : 'primary'}
                            size="sm"
                            disabled={isApplied}
                            onClick={() => handleTriggerAction(msg.id, idx, action)}
                          >
                            {isApplied && <Check className="w-3.5 h-3.5" />}
                            <span>{isApplied ? 'Applied' : action.label}</span>
                          </BubbleButton>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {isThinking && (
              <div className="rounded-2xl rounded-bl-sm bg-[#323028] border border-[#D9D0CB]/15 px-3.5 py-2.5 text-xs text-[#D9D0CB] inline-block">
                Analyzing your meal plan...
              </div>
            )}
          </div>

          {/* Prompt Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendPrompt(input);
            }}
            className="p-3.5 border-t border-[#D9D0CB]/14 bg-[#2E2D24]/80 flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask for a plan, macro goal, or week feedback..."
              className="maloxie-input flex-1 rounded-full px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#D9D0CB]/45"
            />
            <BubbleButton
              type="submit"
              variant="primary"
              size="md"
              disabled={!input.trim() || isThinking}
              aria-label="Send message to Maloxie AI"
            >
              <ArrowUp className="w-4 h-4" />
            </BubbleButton>
          </form>
        </aside>
      )}
    </>
  );
};
