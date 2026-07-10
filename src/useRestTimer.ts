import { useState, useEffect, useCallback } from 'react';

// Module-level state so timer survives component mount/unmount
let _seconds = 60;
let _remaining = 60;
let _running = false;
let _intervalId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(fn => fn());
}

function tick() {
  if (_remaining <= 1) {
    if (_intervalId) { clearInterval(_intervalId); _intervalId = null; }
    _running = false;
    _remaining = 0;
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
    notify();
    return;
  }
  _remaining--;
  notify();
}

export function useRestTimer() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const fn = () => forceUpdate(n => n + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  const startPause = useCallback(() => {
    if (_remaining <= 0) _remaining = _seconds;
    _running = !_running;
    if (_running) {
      if (_intervalId) clearInterval(_intervalId);
      _intervalId = setInterval(tick, 1000);
    } else {
      if (_intervalId) { clearInterval(_intervalId); _intervalId = null; }
    }
    notify();
  }, []);

  const reset = useCallback(() => {
    _running = false;
    if (_intervalId) { clearInterval(_intervalId); _intervalId = null; }
    _remaining = _seconds;
    notify();
  }, []);

  const setPreset = useCallback((s: number) => {
    _running = false;
    if (_intervalId) { clearInterval(_intervalId); _intervalId = null; }
    _seconds = s;
    _remaining = s;
    notify();
  }, []);

  const addTime = useCallback(() => {
    _remaining += 15;
    if (!_running) _seconds += 15;
    notify();
  }, []);

  // Cleanup on unmount if timer not running — keep running if active
  useEffect(() => {
    return () => {
      // Don't stop the interval on unmount — it should keep running
    };
  }, []);

  return {
    seconds: _seconds,
    remaining: _remaining,
    running: _running,
    startPause,
    reset,
    setPreset,
    addTime,
  };
}
