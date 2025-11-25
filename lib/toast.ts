export function showToast(type: 'success' | 'error' | 'info', message: string, timeout?: number) {
  // Strip ANSI escape sequences if present
  const stripped = message.replace(/\u001b\[[0-9;]*m/g, '');
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { type, message: stripped, timeout } }));
}

export function showSuccess(message: string, timeout?: number) {
  showToast('success', message, timeout);
}

export function showError(message: string, timeout?: number) {
  showToast('error', message, timeout);
}

export function showInfo(message: string, timeout?: number) {
  showToast('info', message, timeout);
}
