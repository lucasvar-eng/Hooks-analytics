import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { PRESETS, setPreset, setCustomRange, toggleCompare } from '../../store/dateSlice';

const PRESET_LABELS = {
  today: 'Hoy',
  yesterday: 'Ayer',
  last7: 'Últimos 7 días',
  last30: 'Últimos 30 días',
  thisMonth: 'Este mes',
  lastMonth: 'Mes pasado',
};

const QUICK_RANGES = [
  ['today', 'Hoy'],
  ['yesterday', 'Ayer'],
  ['last7', 'Últimos 7 días'],
  ['last30', 'Últimos 30 días'],
  ['thisMonth', 'Este mes'],
  ['lastMonth', 'Mes pasado'],
];

const WEEK_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function formatDate(date) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatIso(date) {
  return date.toISOString().slice(0, 10);
}

function parseIso(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function sameDay(a, b) {
  return a && b && formatIso(a) === formatIso(b);
}

function isBetween(date, start, end) {
  if (!start || !end) return false;
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const from = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const to = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return current > from && current < to;
}

function buildCalendarDays(monthDate) {
  const first = startOfMonth(monthDate);
  const last = endOfMonth(monthDate);
  const firstWeekday = (first.getDay() + 6) % 7;
  const days = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    days.push(null);
  }

  for (let day = 1; day <= last.getDate(); day += 1) {
    days.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), day));
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

function CalendarMonth({ monthDate, draftFrom, draftTo, onSelect }) {
  const days = buildCalendarDays(monthDate);

  return (
    <div className="min-w-[220px]">
      <div className="mb-2 flex items-center justify-center">
        <p className="text-[12px] font-semibold text-white capitalize">
          {monthDate.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })}
        </p>
      </div>
      <div className="mb-1.5 grid grid-cols-7 gap-1">
        {WEEK_DAYS.map((day) => (
          <div key={day} className="px-1 py-1 text-center text-[9px] font-semibold uppercase tracking-[0.08em] text-app-muted">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="h-8 rounded-lg" />;
          }

          const isStart = sameDay(date, draftFrom);
          const isEnd = sameDay(date, draftTo);
          const inRange = isBetween(date, draftFrom, draftTo);
          const isSelected = isStart || isEnd;

          return (
            <button
              key={formatIso(date)}
              onClick={() => onSelect(date)}
              className={`relative h-8 rounded-lg text-[11px] transition ${
                isSelected
                  ? 'bg-app-accent text-white font-semibold'
                  : inRange
                    ? 'bg-app-accent/15 text-app-primary'
                    : 'text-app-secondary hover:bg-white/[0.05] hover:text-white'
              }`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DateRangePicker() {
  const dispatch = useDispatch();
  const { from, to, preset, compareEnabled } = useSelector((state) => state.date);
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(() => parseIso(from));
  const [draftTo, setDraftTo] = useState(() => parseIso(to));
  const [selectionStep, setSelectionStep] = useState('from');
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(parseIso(from)));
  const rootRef = useRef(null);

  useEffect(() => {
    setDraftFrom(parseIso(from));
    setDraftTo(parseIso(to));
    setVisibleMonth(startOfMonth(parseIso(from)));
  }, [from, to, open]);

  useEffect(() => {
    if (!open) return undefined;

    const handleClickOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const summaryLabel = useMemo(() => {
    if (preset !== 'custom' && PRESET_LABELS[preset]) {
      return PRESET_LABELS[preset];
    }
    return `${formatDate(parseIso(from))} - ${formatDate(parseIso(to))}`;
  }, [from, to, preset]);

  const handleQuickRange = (key) => {
    dispatch(setPreset(key));
    const next = PRESETS[key]?.();
    if (next) {
      setDraftFrom(parseIso(next.from));
      setDraftTo(parseIso(next.to));
      setVisibleMonth(startOfMonth(parseIso(next.from)));
    }
  };

  const handleSelectDate = (date) => {
    if (selectionStep === 'from' || !draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(date);
      setDraftTo(null);
      setSelectionStep('to');
      return;
    }

    if (date < draftFrom) {
      setDraftTo(draftFrom);
      setDraftFrom(date);
    } else {
      setDraftTo(date);
    }
    setSelectionStep('from');
  };

  const applyRange = () => {
    if (!draftFrom || !draftTo) return;
    dispatch(setCustomRange({ from: formatIso(draftFrom), to: formatIso(draftTo) }));
    setOpen(false);
  };

  const resetToCurrent = () => {
    setDraftFrom(parseIso(from));
    setDraftTo(parseIso(to));
    setSelectionStep('from');
  };

  return (
    <div ref={rootRef} className="relative w-full xl:w-auto">
      <div className="flex w-full items-center justify-center">
        <button
          onClick={() => setOpen((prev) => !prev)}
          className="flex min-w-[240px] max-w-full items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-left shadow-[0_0_0_1px_rgba(255,255,255,0.02)] transition hover:bg-white/[0.05]"
        >
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-app-muted">Rango</p>
            <p className="mt-1 truncate text-[13px] font-semibold text-white">{summaryLabel}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden md:flex rounded-xl border border-white/[0.06] bg-black/20 p-0.5">
              {Object.entries(PRESET_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={(event) => {
                    event.stopPropagation();
                    dispatch(setPreset(key));
                  }}
                  className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition ${
                    preset === key
                      ? 'bg-app-accent text-white'
                      : 'text-app-secondary hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  {label.length > 8 ? label.replace('Últimos ', '') : label}
                </button>
              ))}
            </div>
            <svg className={`h-4 w-4 text-app-secondary transition ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>
      </div>

      {open && (
        <div className="absolute left-1/2 top-[calc(100%+10px)] z-40 w-[min(430px,calc(100vw-20px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121212] shadow-2xl shadow-black/50">
          <div className="p-3">
            <aside className="border-b border-white/[0.06] pb-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-app-muted">Rangos rápidos</p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {QUICK_RANGES.map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => handleQuickRange(key)}
                    className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-[11px] transition ${
                      preset === key
                        ? 'bg-app-accent/12 text-white border border-app-accent/25'
                        : 'text-app-secondary hover:bg-white/[0.04] hover:text-white border border-transparent'
                    }`}
                  >
                    <span>{label}</span>
                    {preset === key && <span className="inline-flex h-2.5 w-2.5 rounded-full bg-app-accent" />}
                  </button>
                ))}
              </div>
            </aside>

            <div className="pt-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <button
                  onClick={() => setVisibleMonth((prev) => addMonths(prev, -1))}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2 text-app-secondary hover:text-white hover:bg-white/[0.05] transition"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="text-center">
                  <p className="text-[11px] font-semibold text-white capitalize">
                    {visibleMonth.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })}
                  </p>
                  <p className="text-[10px] text-app-secondary">America/Argentina/Tucuman</p>
                </div>
                <button
                  onClick={() => setVisibleMonth((prev) => addMonths(prev, 1))}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2 text-app-secondary hover:text-white hover:bg-white/[0.05] transition"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <CalendarMonth monthDate={visibleMonth} draftFrom={draftFrom} draftTo={draftTo} onSelect={handleSelectDate} />

              <div className="mt-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex flex-col gap-2.5">
                  <label className="flex items-center gap-2 text-[12px] text-app-secondary">
                    <input
                      type="checkbox"
                      checked={compareEnabled}
                      onChange={() => dispatch(toggleCompare())}
                    />
                    Comparar
                  </label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      type="date"
                      value={draftFrom ? formatIso(draftFrom) : ''}
                      onChange={(event) => setDraftFrom(parseIso(event.target.value))}
                      className="date-input-dark"
                    />
                    <input
                      type="date"
                      value={draftTo ? formatIso(draftTo) : ''}
                      onChange={(event) => setDraftTo(parseIso(event.target.value))}
                      className="date-input-dark"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end gap-2.5 border-t border-white/[0.06] pt-3">
                <button
                  onClick={resetToCurrent}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2 text-[12px] text-app-secondary hover:text-white hover:bg-white/[0.05] transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={applyRange}
                  disabled={!draftFrom || !draftTo}
                  className="rounded-xl bg-app-accent px-3.5 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
                >
                  Actualizar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
