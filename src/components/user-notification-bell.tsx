"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createTestNotification, deleteAllNotifications, deleteUserNotification, getUserNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/user-api";
import type { UserNotification } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatNotificationTime(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  const deltaMs = Date.now() - date.getTime();
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function playNotificationSound() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
    oscillator.frequency.setValueAtTime(1108.73, audioCtx.currentTime + 0.1); // C#6
    oscillator.frequency.setValueAtTime(1318.51, audioCtx.currentTime + 0.2); // E6

    gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.4);
  } catch {
    // Audio not available, silently ignore
  }
}

export function UserNotificationBell({ isAdmin }: { isAdmin?: boolean }) {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const prevUnreadRef = useRef(0);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getUserNotifications(20);
      if (result.success) {
        const newNotifications = result.notifications || [];
        const newUnreadCount = Number(result.unreadCount || 0);

        // Play sound if new unread notifications arrived
        if (newUnreadCount > prevUnreadRef.current) {
          playNotificationSound();
        }
        prevUnreadRef.current = newUnreadCount;

        setNotifications(newNotifications);
        setUnreadCount(newUnreadCount);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll for new notifications every 15 seconds
  useEffect(() => {
    loadNotifications();
    const interval = window.setInterval(loadNotifications, 15_000);
    return () => window.clearInterval(interval);
  }, [loadNotifications]);

  const visibleUnreadCount = useMemo(() => Math.min(unreadCount, 99), [unreadCount]);

  const handleMarkRead = async (notificationId: string) => {
    setBusyId(notificationId);
    try {
      const result = await markNotificationRead(notificationId);
      if (result.success) {
        setNotifications((items) => items.map((item) => item.id === notificationId ? { ...item, readAt: new Date().toISOString() } : item));
        setUnreadCount((count) => Math.max(0, count - 1));
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (notificationId: string) => {
    setBusyId(notificationId);
    try {
      const target = notifications.find((item) => item.id === notificationId);
      const result = await deleteUserNotification(notificationId);
      if (result.success) {
        setNotifications((items) => items.filter((item) => item.id !== notificationId));
        if (target && !target.readAt) setUnreadCount((count) => Math.max(0, count - 1));
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkAllRead = async () => {
    setBusyId("all");
    try {
      const result = await markAllNotificationsRead();
      if (result.success) {
        const now = new Date().toISOString();
        setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt || now })));
        setUnreadCount(0);
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteAll = async () => {
    setBusyId("delete-all");
    try {
      const result = await deleteAllNotifications();
      if (result.success) {
        setNotifications([]);
        setUnreadCount(0);
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateTest = async () => {
    setBusyId("test");
    try {
      const result = await createTestNotification();
      if (result.success) await loadNotifications();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DropdownMenu onOpenChange={(open) => open && loadNotifications()}>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" className="relative rounded-full">
          <Bell className="h-4 w-4" />
          {visibleUnreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {visibleUnreadCount}
            </span>
          ) : null}
          <span className="sr-only">Open notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(92vw,24rem)] p-0">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={handleMarkAllRead} disabled={busyId === "all" || unreadCount === 0}>
              {busyId === "all" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="mr-1 h-3.5 w-3.5" />}
              Read all
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={handleDeleteAll} disabled={busyId === "delete-all" || notifications.length === 0}>
              {busyId === "delete-all" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1 h-3.5 w-3.5" />}
              Delete all
            </Button>
          </div>
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-[28rem] overflow-y-auto py-1">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading notifications
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium">No notifications yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Important account, wallet, and generation updates will appear here.</p>
              {isAdmin && (
                <Button type="button" variant="outline" size="sm" className="mt-4" onClick={handleCreateTest} disabled={busyId === "test"}>
                  {busyId === "test" && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Create test
                </Button>
              )}
            </div>
          ) : (
            notifications.map((notification) => {
              const unread = !notification.readAt;
              const body = (
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={cn("truncate text-sm font-semibold", unread && "text-primary")}>{notification.title}</p>
                    {unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{notification.message}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatNotificationTime(notification.createdAt)}</p>
                </div>
              );

              return (
                <div key={notification.id} className="flex gap-2 border-b px-3 py-3 last:border-b-0">
                  {notification.href ? (
                    <Link href={notification.href} className="min-w-0 flex-1 rounded-md p-1 transition-colors hover:bg-muted" onClick={() => unread && handleMarkRead(notification.id)}>
                      {body}
                    </Link>
                  ) : (
                    <button type="button" className="min-w-0 flex-1 rounded-md p-1 text-left transition-colors hover:bg-muted" onClick={() => unread && handleMarkRead(notification.id)}>
                      {body}
                    </button>
                  )}
                  <div className="flex shrink-0 flex-col gap-1">
                    {unread ? (
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMarkRead(notification.id)} disabled={busyId === notification.id}>
                        <CheckCheck className="h-3.5 w-3.5" />
                        <span className="sr-only">Mark notification read</span>
                      </Button>
                    ) : null}
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(notification.id)} disabled={busyId === notification.id}>
                      {busyId === notification.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      <span className="sr-only">Delete notification</span>
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}