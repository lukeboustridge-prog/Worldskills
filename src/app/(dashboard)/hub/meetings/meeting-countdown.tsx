"use client";

import { useEffect, useState } from "react";
import { differenceInSeconds } from "date-fns";

interface MeetingCountdownProps {
  targetDate: Date;
}

export function MeetingCountdown({ targetDate }: MeetingCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const diff = differenceInSeconds(targetDate, now);

      if (diff <= 0) {
        return null;
      }

      const days = Math.floor(diff / (60 * 60 * 24));
      const hours = Math.floor((diff % (60 * 60 * 24)) / (60 * 60));
      const minutes = Math.floor((diff % (60 * 60)) / 60);
      const seconds = diff % 60;

      return { days, hours, minutes, seconds };
    };

    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  if (!timeLeft) {
    return (
      <div className="text-right">
        <p className="text-lg font-semibold text-primary">Starting now</p>
      </div>
    );
  }

  return (
    <div className="text-right">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        Starts in
      </p>
      <div className="mt-1 flex gap-2">
        {timeLeft.days > 0 && (
          <div className="text-center">
            <p className="text-2xl font-bold">{timeLeft.days}</p>
            <p className="text-xs text-muted-foreground">days</p>
          </div>
        )}
        <div className="text-center">
          <p className="text-2xl font-bold">
            {String(timeLeft.hours).padStart(2, "0")}
          </p>
          <p className="text-xs text-muted-foreground">hrs</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold">
            {String(timeLeft.minutes).padStart(2, "0")}
          </p>
          <p className="text-xs text-muted-foreground">min</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold">
            {String(timeLeft.seconds).padStart(2, "0")}
          </p>
          <p className="text-xs text-muted-foreground">sec</p>
        </div>
      </div>
    </div>
  );
}
