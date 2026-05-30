"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useHousehold } from "@/context/HouseholdContext";
import { getNotifications, markNotificationRead, markAllNotificationsRead, updateAssignmentStatus } from "@/lib/firebase-recipes";
import type { AppNotification } from "@/lib/types";

export default function NotificationBell() {
  const { user } = useAuth();
  const { householdId } = useHousehold();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const uid = user?.uid ?? "";
  const displayName = user?.displayName || user?.email || "";
  const unreadCount = notifications.filter((n) => !n.readBy.includes(uid)).length;
  const [responded, setResponded] = useState<Record<string, "accepted" | "declined">>({});

  useEffect(() => {
    if (!uid) return;
    getNotifications(householdId, 20).then(setNotifications).catch(() => {});
    // Poll every 60s for new notifications
    const interval = setInterval(() => {
      getNotifications(householdId, 20).then(setNotifications).catch(() => {});
    }, 60_000);
    return () => clearInterval(interval);
  }, [uid, householdId]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleMarkRead(notificationId: string) {
    if (!uid) return;
    await markNotificationRead(notificationId, uid).catch(() => {});
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId && !n.readBy.includes(uid)
          ? { ...n, readBy: [...n.readBy, uid] }
          : n
      )
    );
  }

  async function handleMarkAllRead() {
    if (!uid) return;
    const unread = notifications.filter((n) => !n.readBy.includes(uid));
    if (unread.length === 0) return;
    await markAllNotificationsRead(unread, uid).catch(() => {});
    setNotifications((prev) =>
      prev.map((n) =>
        !n.readBy.includes(uid) ? { ...n, readBy: [...n.readBy, uid] } : n
      )
    );
  }

  async function handleRespond(notification: AppNotification, status: "accepted" | "declined") {
    if (!notification.collectionId || !notification.recipeId || !notification.assignedMember) return;
    await updateAssignmentStatus(notification.collectionId, notification.recipeId, notification.assignedMember, status).catch(() => {});
    setResponded((prev) => ({ ...prev, [notification.id]: status }));
    handleMarkRead(notification.id);
  }

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate hover:text-charcoal hover:bg-cream-dark/60 transition-colors cursor-pointer"
        aria-label="Notifications"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
          <path fillRule="evenodd" d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 1 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z" clipRule="evenodd" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-terracotta text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-30 w-80 rounded-xl bg-white shadow-lg ring-1 ring-charcoal/10">
          <div className="flex items-center justify-between px-4 py-3 border-b border-cream-dark/30">
            <h3 className="font-sans text-sm font-semibold text-charcoal">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="font-sans text-xs text-terracotta hover:text-terracotta-dark transition-colors cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center font-sans text-sm text-slate/60">
                No notifications yet
              </p>
            ) : (
              notifications.map((n) => {
                const isUnread = !n.readBy.includes(uid);
                const isAssignment = n.type === "event-assignment" && n.assignedMember === displayName;
                const response = responded[n.id];
                return (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b border-cream-dark/20 last:border-b-0 transition-colors ${isUnread ? "bg-terracotta/5" : ""}`}
                  >
                    <Link
                      href={n.link}
                      onClick={() => { handleMarkRead(n.id); setOpen(false); }}
                      className="block hover:opacity-80"
                    >
                      <p className={`font-sans text-sm ${isUnread ? "font-medium text-charcoal" : "text-slate"}`}>
                        {n.message}
                      </p>
                      <p className="mt-0.5 font-sans text-[10px] text-slate/50">
                        {new Date(n.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </Link>
                    {isAssignment && !response && (
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleRespond(n, "accepted")}
                          className="rounded-lg bg-sage/15 px-3 py-1.5 font-sans text-xs font-medium text-sage-dark hover:bg-sage/25 transition-colors cursor-pointer"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRespond(n, "declined")}
                          className="rounded-lg bg-red-500/10 px-3 py-1.5 font-sans text-xs font-medium text-red-500 hover:bg-red-500/20 transition-colors cursor-pointer"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                    {isAssignment && response && (
                      <p className={`mt-1.5 font-sans text-xs font-medium ${response === "accepted" ? "text-sage-dark" : "text-red-500"}`}>
                        {response === "accepted" ? "Accepted" : "Declined"}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
