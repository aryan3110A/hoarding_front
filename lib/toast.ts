type ToastType = "success" | "error" | "info";

type ToastOptions = {
  timeout?: number;
  title?: string | null;
  hideTitle?: boolean;
};

export function showToast(
  type: ToastType,
  message: string,
  timeoutOrOptions?: number | ToastOptions
) {
  // Strip ANSI escape sequences if present
  const stripped = message.replace(/\u001b\[[0-9;]*m/g, "");

  const options: ToastOptions =
    typeof timeoutOrOptions === "number" || timeoutOrOptions === undefined
      ? { timeout: timeoutOrOptions }
      : timeoutOrOptions;

  window.dispatchEvent(
    new CustomEvent("app-toast", {
      detail: {
        type,
        message: stripped,
        timeout: options.timeout,
        title: options.title,
        hideTitle: options.hideTitle,
      },
    })
  );
}

export function showSuccess(message: string, timeout?: number) {
  showToast("success", message, timeout);
}

export function showError(message: string, timeout?: number) {
  showToast("error", message, timeout);
}

export function showInfo(message: string, timeout?: number) {
  showToast("info", message, timeout);
}

export function showErrorNoTitle(message: string, timeout?: number) {
  showToast("error", message, { timeout, title: "" });
}
