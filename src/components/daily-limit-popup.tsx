"use client";

import { useEffect, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function DailyLimitPopup() {
  const [open, setOpen] = useState(false);
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) {
      return;
    }

    const url = new URL(window.location.href);
    if (url.searchParams.get('dailyLimitReached') === '1') {
      handledRef.current = true;
      setOpen(true);

      url.searchParams.delete('dailyLimitReached');
      const nextUrl = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState(window.history.state, '', nextUrl || '/');
    }
  }, []);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Daily contribution limit reached</AlertDialogTitle>
          <AlertDialogDescription>
            Your daily limit contribution has been reached. Please try again tomorrow.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction>OK</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
