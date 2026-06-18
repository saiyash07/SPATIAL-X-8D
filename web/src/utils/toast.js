/**
 * toast.js — Lightweight global toast notification system.
 * No Provider needed. Call show() from anywhere.
 * React components subscribe with useToasts().
 */

import { useState, useEffect } from 'react';

let _id = 0;
let _toasts = [];
const _listeners = new Set();

function notify() {
  _listeners.forEach(l => l([..._toasts]));
}

export function showToast(message, type = 'success', durationMs = 2800) {
  const id = ++_id;
  _toasts = [..._toasts, { id, message, type }];
  notify();
  setTimeout(() => {
    _toasts = _toasts.filter(t => t.id !== id);
    notify();
  }, durationMs);
}

export function useToasts() {
  const [toasts, setToasts] = useState([..._toasts]);
  useEffect(() => {
    _listeners.add(setToasts);
    return () => _listeners.delete(setToasts);
  }, []);
  return toasts;
}
