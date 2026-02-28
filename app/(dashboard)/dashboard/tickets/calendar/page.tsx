"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { Button, Badge, Card, Select, Spinner } from "@/components/ui";
import styles from "./page.module.css";

interface CalendarSlot {
  id: number;
  ticket_id: number;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  ticket_title: string | null;
  ticket_status: string;
  client_name: string | null;
  member_name: string | null;
}

interface MemberOption {
  value: string;
  label: string;
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const STATUS_COLOR: Record<string, string> = {
  pending: "var(--warning)",
  confirmed: "var(--accent)",
  in_progress: "var(--accent)",
  completed: "var(--success)",
  cancelled: "var(--error)",
};

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

export default function TicketCalendarPage() {
  const router = useRouter();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [slots, setSlots] = useState<CalendarSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberId, setMemberId] = useState("");
  const [members, setMembers] = useState<MemberOption[]>([]);

  // Load members for filter
  useEffect(() => {
    fetch("/api/members?per_page=200&active_only=true")
      .then((r) => r.json())
      .then((json) => {
        setMembers(
          (json.data || []).map((m: { id: number; name: string }) => ({
            value: String(m.id),
            label: m.name,
          }))
        );
      })
      .catch(() => {});
  }, []);

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    const from = toDateStr(year, month, 1);
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = toDateStr(year, month, lastDay);

    const params = new URLSearchParams({ from, to });
    if (memberId) params.set("member_id", memberId);

    try {
      const res = await fetch(`/api/tickets/calendar?${params}`);
      const json = await res.json();
      setSlots(json.data || []);
    } catch {
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [year, month, memberId]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: { day: number; date: string; slots: CalendarSlot[] }[] = [];

    // Leading empty cells
    for (let i = 0; i < firstDow; i++) {
      days.push({ day: 0, date: "", slots: [] });
    }

    // Slot map by date
    const slotMap: Record<string, CalendarSlot[]> = {};
    for (const s of slots) {
      const d = s.date.slice(0, 10);
      if (!slotMap[d]) slotMap[d] = [];
      slotMap[d].push(s);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = toDateStr(year, month, d);
      days.push({
        day: d,
        date: dateStr,
        slots: slotMap[dateStr] || [],
      });
    }

    return days;
  }, [year, month, slots]);

  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const goPrev = () => {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else {
      setMonth(month - 1);
    }
  };

  const goNext = () => {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else {
      setMonth(month + 1);
    }
  };

  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  return (
    <div>
      <PageHeader
        title="Calendario de Tickets"
        description="Vista mensual de horarios programados."
        action={
          <Button variant="secondary" onClick={() => router.push("/dashboard/tickets")}>
            Ver lista
          </Button>
        }
      />

      <div className={styles.controls}>
        <div className={styles.nav}>
          <button className={styles.navBtn} onClick={goPrev} aria-label="Mes anterior">
            &#8249;
          </button>
          <span className={styles.monthLabel}>
            {MONTHS[month]} {year}
          </span>
          <button className={styles.navBtn} onClick={goNext} aria-label="Mes siguiente">
            &#8250;
          </button>
          <button className={styles.todayBtn} onClick={goToday}>
            Hoy
          </button>
        </div>
        <div className={styles.filter}>
          <Select
            options={[{ value: "", label: "Todos los miembros" }, ...members]}
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>
          <Spinner />
        </div>
      ) : (
        <div className={styles.calendar}>
          {WEEKDAYS.map((wd) => (
            <div key={wd} className={styles.weekdayHeader}>
              {wd}
            </div>
          ))}
          {calendarDays.map((cell, i) => (
            <div
              key={i}
              className={`${styles.dayCell} ${cell.day === 0 ? styles.emptyCell : ""} ${
                cell.date === todayStr ? styles.todayCell : ""
              }`}
            >
              {cell.day > 0 && (
                <>
                  <span className={styles.dayNumber}>{cell.day}</span>
                  <div className={styles.daySlots}>
                    {cell.slots.slice(0, 3).map((slot) => (
                      <button
                        key={slot.id}
                        className={styles.slotChip}
                        style={{
                          borderLeftColor: STATUS_COLOR[slot.ticket_status] || "var(--gray-400)",
                        }}
                        onClick={() => router.push(`/dashboard/tickets/${slot.ticket_id}`)}
                        title={`${slot.ticket_title || "Ticket"} — ${slot.start_time}-${slot.end_time}`}
                      >
                        <span className={styles.slotTime}>{slot.start_time.slice(0, 5)}</span>
                        <span className={styles.slotTitle}>
                          {slot.ticket_title || `#${slot.ticket_id}`}
                        </span>
                      </button>
                    ))}
                    {cell.slots.length > 3 && (
                      <span className={styles.moreLabel}>+{cell.slots.length - 3} más</span>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
