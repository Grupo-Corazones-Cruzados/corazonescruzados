"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Notification } from "@/lib/types";
import styles from "./NotificationBell.module.css";

const POLL_INTERVAL = 30_000;

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
}

interface Props {
  collapsed?: boolean;
}

export default function NotificationBell({ collapsed }: Props) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const json = await res.json();
      setNotifications(json.data ?? []);
      setUnreadCount(json.unread_count ?? 0);
    } catch {
      // silently ignore
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  async function handleMarkAllRead() {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all_read: true }),
      });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch {
      // silently ignore
    }
  }

  async function handleClickNotification(n: Notification) {
    if (!n.is_read) {
      fetch(`/api/notifications/${n.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_read: true }),
      }).catch(() => {});
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === n.id
            ? { ...item, is_read: true, read_at: new Date().toISOString() }
            : item
        )
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        ref={bellRef}
        className={styles.bellBtn}
        onClick={() => {
          if (!open && bellRef.current) {
            const rect = bellRef.current.getBoundingClientRect();
            setDropdownPos({ top: rect.bottom + 8, left: rect.left });
          }
          setOpen((v) => !v);
        }}
        aria-label="Notificaciones"
        title={collapsed ? "Notificaciones" : undefined}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M10 2a5 5 0 00-5 5v3l-1.3 2.6a.5.5 0 00.45.7h11.7a.5.5 0 00.45-.7L15 10V7a5 5 0 00-5-5zM8 15a2 2 0 104 0"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unreadCount > 0 && (
          <span className={styles.badge}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={styles.dropdown}
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          <div className={styles.header}>
            <span className={styles.headerTitle}>Notificaciones</span>
            {unreadCount > 0 && (
              <button className={styles.markAll} onClick={handleMarkAllRead}>
                Marcar todas como leídas
              </button>
            )}
          </div>

          <div className={styles.list}>
            {notifications.length === 0 ? (
              <div className={styles.empty}>No hay notificaciones</div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  className={styles.item}
                  onClick={() => handleClickNotification(n)}
                >
                  <span className={n.is_read ? styles.readDot : styles.unreadDot} />
                  <div className={styles.itemContent}>
                    <div className={styles.itemTitle}>{n.title}</div>
                    {n.message && (
                      <div className={styles.itemMessage}>{n.message}</div>
                    )}
                    <div className={styles.itemTime}>
                      {relativeTime(n.created_at)}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
