'use strict';

const workerThreads = require('worker_threads');

const OriginalWorker = workerThreads.Worker;

function sanitize(value, seen) {
  if (typeof value === 'function') {
    return null;
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return seen.get(value);
  }

  if (value instanceof Date || value instanceof RegExp) {
    return value;
  }

  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    return value;
  }

  if (typeof SharedArrayBuffer !== 'undefined' && value instanceof SharedArrayBuffer) {
    return value;
  }

  if (typeof URL !== 'undefined' && value instanceof URL) {
    return value;
  }

  if (workerThreads.MessagePort && value instanceof workerThreads.MessagePort) {
    return value;
  }

  if (value instanceof Map) {
    const out = new Map();
    seen.set(value, out);
    for (const [key, entry] of value.entries()) {
      out.set(sanitize(key, seen), sanitize(entry, seen));
    }
    return out;
  }

  if (value instanceof Set) {
    const out = new Set();
    seen.set(value, out);
    for (const entry of value.values()) {
      out.add(sanitize(entry, seen));
    }
    return out;
  }

  if (value instanceof Error) {
    const out = {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
    seen.set(value, out);
    for (const [key, entry] of Object.entries(value)) {
      out[key] = sanitize(entry, seen);
    }
    return out;
  }

  if (Array.isArray(value)) {
    const out = new Array(value.length);
    seen.set(value, out);
    for (let i = 0; i < value.length; i += 1) {
      out[i] = sanitize(value[i], seen);
    }
    return out;
  }

  const out = {};
  seen.set(value, out);
  for (const [key, entry] of Object.entries(value)) {
    out[key] = sanitize(entry, seen);
  }
  return out;
}

class PatchedWorker extends OriginalWorker {
  constructor(filename, options) {
    if (options && typeof options === 'object') {
      const safeOptions = {
        ...options,
        workerData: sanitize(options.workerData, new WeakMap()),
      };
      super(filename, safeOptions);
      return;
    }

    super(filename, options);
  }
}

const originalPostMessage = OriginalWorker.prototype.postMessage;
PatchedWorker.prototype.postMessage = function patchedPostMessage(message, ...args) {
  return originalPostMessage.call(this, sanitize(message, new WeakMap()), ...args);
};

workerThreads.Worker = PatchedWorker;
