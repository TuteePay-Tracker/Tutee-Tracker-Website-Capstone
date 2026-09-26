/// <reference types="vite/client" />

interface Window {
  grecaptcha?: {
    ready?: (callback: () => void) => void;
    render?: (
      container: HTMLElement | string,
      parameters: {
        sitekey: string;
        theme?: 'light' | 'dark';
        size?: 'normal' | 'compact';
        callback?: (token: string) => void;
        'expired-callback'?: () => void;
        'error-callback'?: () => void;
      }
    ) => number;
    reset?: (widgetId?: number) => void;
    enterprise?: {
      ready?: (callback: () => void) => void;
      render?: (
        container: HTMLElement | string,
        parameters: {
          sitekey: string;
          theme?: 'light' | 'dark';
          size?: 'normal' | 'compact';
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        }
      ) => number;
      reset?: (widgetId?: number) => void;
      execute?: (sitekey: string, options?: { action: string }) => Promise<string>;
    };
  };
  onloadRecaptchaCallback?: () => void;
}
