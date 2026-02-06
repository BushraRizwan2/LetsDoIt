
export type ToastType = 'error' | 'success' | 'info';

export interface ToastEventDetail {
  message: string;
  type: ToastType;
  id: string;
}

export const showToast = (message: string, type: ToastType = 'error') => {
  const event = new CustomEvent('voxgem-toast', {
    detail: {
      message,
      type,
      id: crypto.randomUUID(),
    } as ToastEventDetail,
  });
  window.dispatchEvent(event);
};
