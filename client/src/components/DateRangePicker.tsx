import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { 
  format, subDays, startOfWeek, endOfWeek, startOfMonth, 
  endOfMonth, subMonths, isSameDay, isWithinInterval, 
  startOfDay, parseISO, isAfter, isBefore, addMonths
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate: string;
  onChange: (start: string, end: string) => void;
}

type Preset = 'today' | 'yesterday' | 'thisWeek' | 'last7' | 'lastWeek' | 'last28' | 'last30' | 'thisMonth' | 'lastMonth' | 'last90' | 'custom';

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ startDate, endDate, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<Preset>('custom');
  const [tempStart, setTempStart] = useState<Date>(parseISO(startDate));
  const [tempEnd, setTempEnd] = useState<Date>(parseISO(endDate));
  const [viewDateLeft, setViewDateLeft] = useState<Date>(subMonths(parseISO(endDate), 1));
  const [viewDateRight, setViewDateRight] = useState<Date>(parseISO(endDate));
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [selectionStep, setSelectionStep] = useState<0 | 1 | 2>(0);
  const [popoverPos, setPopoverPos] = useState({ top: 0, right: 0 });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPopoverPos({
      top: rect.bottom + window.scrollY + 8,
      right: window.innerWidth - rect.right,
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    }
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        popoverRef.current && !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTempStart(parseISO(startDate));
      setTempEnd(parseISO(endDate));
      setSelectionStep(0);
      setViewDateRight(parseISO(endDate));
      setViewDateLeft(subMonths(parseISO(endDate), 1));
    }
  }, [isOpen, startDate, endDate]);

  const selectPreset = (preset: Preset) => {
    setActivePreset(preset);
    const today = startOfDay(new Date());
    let start = tempStart;
    let end = tempEnd;

    switch (preset) {
      case 'today':
        start = today; end = today; break;
      case 'yesterday':
        start = subDays(today, 1); end = subDays(today, 1); break;
      case 'thisWeek':
        start = startOfWeek(today, { weekStartsOn: 1 }); end = today; break;
      case 'last7':
        start = subDays(today, 6); end = today; break;
      case 'lastWeek': {
        const lastWeekDay = subDays(today, 7);
        start = startOfWeek(lastWeekDay, { weekStartsOn: 0 });
        end = endOfWeek(lastWeekDay, { weekStartsOn: 0 });
        break;
      }
      case 'last28':
        start = subDays(today, 27); end = today; break;
      case 'last30':
        start = subDays(today, 29); end = today; break;
      case 'thisMonth':
        start = startOfMonth(today); end = today; break;
      case 'lastMonth': {
        const prevM = subMonths(today, 1);
        start = startOfMonth(prevM); end = endOfMonth(prevM); break;
      }
      case 'last90':
        start = subDays(today, 89); end = today; break;
      case 'custom':
        return;
    }

    setTempStart(start);
    setTempEnd(end);
    setViewDateRight(end);
    setViewDateLeft(subMonths(end, 1));
  };

  const handleApply = () => {
    if (tempStart && tempEnd) {
      const s = tempStart <= tempEnd ? tempStart : tempEnd;
      const e = tempStart <= tempEnd ? tempEnd : tempStart;
      onChange(format(s, 'yyyy-MM-dd'), format(e, 'yyyy-MM-dd'));
      setIsOpen(false);
    }
  };

  const handleDayClick = (day: Date) => {
    setActivePreset('custom');
    if (selectionStep === 0 || selectionStep === 2) {
      setTempStart(day);
      setTempEnd(day);
      setSelectionStep(1);
    } else if (selectionStep === 1) {
      if (isBefore(day, tempStart)) {
        setTempStart(day);
        setTempEnd(day);
      } else {
        setTempEnd(day);
        setSelectionStep(2);
      }
    }
  };

  const renderCalendar = (viewDate: Date) => {
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(monthStart);
    const startDateOffset = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDateOffset = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const rows = [];
    let days: React.ReactNode[] = [];
    let day = startDateOffset;

    while (day <= endDateOffset) {
      for (let i = 0; i < 7; i++) {
        const cloneDay = day;
        const formattedDate = format(day, 'd');

        let isInRange = false;
        const rangeEnd = selectionStep === 1 && hoverDate ? hoverDate : tempEnd;
        if (tempStart && rangeEnd) {
          const rangeStart2 = isBefore(rangeEnd, tempStart) ? rangeEnd : tempStart;
          const rangeEnd2 = isAfter(rangeEnd, tempStart) ? rangeEnd : tempStart;
          isInRange = isWithinInterval(cloneDay, { start: rangeStart2, end: rangeEnd2 });
        }

        const isSelected = isSameDay(cloneDay, tempStart) || isSameDay(cloneDay, tempEnd);
        const isCurrentMonth = cloneDay.getMonth() === monthStart.getMonth();

        days.push(
          <div
            className={`drp-day${!isCurrentMonth ? ' disabled' : ''}${isSelected ? ' selected' : ''}${isInRange && !isSelected ? ' in-range' : ''}`}
            key={day.toISOString()}
            onClick={() => isCurrentMonth && handleDayClick(cloneDay)}
            onMouseEnter={() => isCurrentMonth && setHoverDate(cloneDay)}
          >
            <span>{formattedDate}</span>
          </div>
        );
        day = subDays(day, -1);
      }
      rows.push(<div className="drp-row" key={day.toISOString()}>{days}</div>);
      days = [];
    }

    return (
      <div className="drp-calendar">
        <div className="drp-month-label">{format(monthStart, 'LLL yyyy', { locale: vi }).toUpperCase()}</div>
        <div className="drp-weekdays">
          <div>T2</div><div>T3</div><div>T4</div><div>T5</div><div>T6</div><div>T7</div><div>CN</div>
        </div>
        <div className="drp-days">{rows}</div>
      </div>
    );
  };

  const popoverContent = isOpen ? ReactDOM.createPortal(
    <div
      ref={popoverRef}
      className="drp-popover"
      style={{
        position: 'fixed',
        top: popoverPos.top,
        right: popoverPos.right,
        zIndex: 99999,
      }}
    >
      <div className="drp-presets">
        <button className={activePreset === 'today' ? 'active' : ''} onClick={() => selectPreset('today')}>Hôm nay</button>
        <button className={activePreset === 'yesterday' ? 'active' : ''} onClick={() => selectPreset('yesterday')}>Hôm qua</button>
        <button className={activePreset === 'thisWeek' ? 'active' : ''} onClick={() => selectPreset('thisWeek')}>Tuần này (CN - Hôm nay)</button>
        <button className={activePreset === 'last7' ? 'active' : ''} onClick={() => selectPreset('last7')}>7 ngày trước</button>
        <button className={activePreset === 'lastWeek' ? 'active' : ''} onClick={() => selectPreset('lastWeek')}>Tuần trước (CN - T7)</button>
        <button className={activePreset === 'last28' ? 'active' : ''} onClick={() => selectPreset('last28')}>28 ngày trước</button>
        <button className={activePreset === 'last30' ? 'active' : ''} onClick={() => selectPreset('last30')}>30 ngày trước</button>
        <button className={activePreset === 'thisMonth' ? 'active' : ''} onClick={() => selectPreset('thisMonth')}>Tháng này</button>
        <button className={activePreset === 'lastMonth' ? 'active' : ''} onClick={() => selectPreset('lastMonth')}>Tháng trước</button>
        <button className={activePreset === 'last90' ? 'active' : ''} onClick={() => selectPreset('last90')}>90 ngày trước</button>
        <button className={activePreset === 'custom' ? 'active' : ''} onClick={() => setActivePreset('custom')}>Tuỳ chỉnh</button>
      </div>
      <div className="drp-main">
        <div className="drp-inputs">
          <div className="drp-input-box">
            <label>Ngày bắt đầu</label>
            <div>{format(tempStart, 'd LLL, yyyy', { locale: vi })}</div>
          </div>
          <span style={{ color: 'var(--text-muted)' }}>–</span>
          <div className="drp-input-box">
            <label>Ngày kết thúc</label>
            <div>{format(tempEnd, 'd LLL, yyyy', { locale: vi })}</div>
          </div>
        </div>
        <div className="drp-calendars" onMouseLeave={() => setHoverDate(null)}>
          <button className="drp-nav-left" onClick={() => {
            setViewDateLeft(subMonths(viewDateLeft, 1));
            setViewDateRight(subMonths(viewDateRight, 1));
          }}><ChevronLeft size={20} /></button>
          {renderCalendar(viewDateLeft)}
          {renderCalendar(viewDateRight)}
          <button className="drp-nav-right" onClick={() => {
            setViewDateLeft(addMonths(viewDateLeft, 1));
            setViewDateRight(addMonths(viewDateRight, 1));
          }}><ChevronRight size={20} /></button>
        </div>
        <div className="drp-actions">
          <button className="drp-btn-cancel" onClick={() => setIsOpen(false)}>Hủy</button>
          <button className="drp-btn-apply" onClick={handleApply}>Áp dụng</button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="drp-container">
      <button ref={triggerRef} className="drp-trigger" onClick={() => setIsOpen(!isOpen)}>
        <CalendarIcon size={16} />
        <span>{format(parseISO(startDate), 'dd MMM yyyy', { locale: vi })} – {format(parseISO(endDate), 'dd MMM yyyy', { locale: vi })}</span>
      </button>
      {popoverContent}
    </div>
  );
};
