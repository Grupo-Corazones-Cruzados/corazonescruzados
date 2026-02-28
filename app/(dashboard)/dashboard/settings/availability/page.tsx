"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { DAYS_OF_WEEK } from "@/lib/constants";
import type { MemberSchedule } from "@/lib/types";
import styles from "./page.module.css";

interface ScheduleRow {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

const DEFAULT_SCHEDULES: ScheduleRow[] = Array.from({ length: 7 }, (_, i) => ({
  day_of_week: i,
  start_time: "09:00",
  end_time: "17:00",
  is_active: i >= 1 && i <= 5, // Mon-Fri
}));

export default function AvailabilityPage() {
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<ScheduleRow[]>(DEFAULT_SCHEDULES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch("/api/users/availability");
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.data?.schedules?.length > 0) {
        const merged = DEFAULT_SCHEDULES.map((def) => {
          const found = data.data.schedules.find(
            (s: MemberSchedule) => s.day_of_week === def.day_of_week
          );
          return found
            ? {
                day_of_week: found.day_of_week,
                start_time: found.start_time.slice(0, 5),
                end_time: found.end_time.slice(0, 5),
                is_active: found.is_active,
              }
            : def;
        });
        setSchedules(merged);
      }
    } catch {
      // No schedules yet, use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const updateRow = (day: number, field: keyof ScheduleRow, value: string | boolean) => {
    setSchedules((prev) =>
      prev.map((s) => (s.day_of_week === day ? { ...s, [field]: value } : s))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const active = schedules.filter((s) => s.is_active);
      const res = await fetch("/api/users/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedules: active }),
      });
      if (!res.ok) throw new Error();
      toast("Disponibilidad actualizada", "success");
    } catch {
      toast("Error al guardar disponibilidad", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", paddingTop: "var(--space-20)" }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Disponibilidad"
        description="Configura los horarios en que estás disponible para atender tickets."
        action={
          <Button onClick={handleSave} isLoading={saving}>
            Guardar
          </Button>
        }
      />

      <Card padding="none">
        <div className={styles.table}>
          <div className={styles.headerRow}>
            <span>Día</span>
            <span>Activo</span>
            <span>Inicio</span>
            <span>Fin</span>
          </div>
          {schedules.map((s) => (
            <div key={s.day_of_week} className={styles.row}>
              <span className={styles.dayLabel}>
                {DAYS_OF_WEEK[s.day_of_week]}
              </span>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={s.is_active}
                  onChange={(e) =>
                    updateRow(s.day_of_week, "is_active", e.target.checked)
                  }
                />
                <span className={styles.toggleTrack} />
              </label>
              <input
                type="time"
                className={styles.timeInput}
                value={s.start_time}
                onChange={(e) =>
                  updateRow(s.day_of_week, "start_time", e.target.value)
                }
                disabled={!s.is_active}
              />
              <input
                type="time"
                className={styles.timeInput}
                value={s.end_time}
                onChange={(e) =>
                  updateRow(s.day_of_week, "end_time", e.target.value)
                }
                disabled={!s.is_active}
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
