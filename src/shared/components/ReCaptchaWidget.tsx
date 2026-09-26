import { useEffect, useRef } from 'react';

interface ReCaptchaWidgetProps {
  onVerify: (token: string | null) => void;
  siteKey?: string;
  theme?: 'light' | 'dark';
}

export const ReCaptchaWidget = ({
  onVerify,
  siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY,
  theme = 'light',
}: ReCaptchaWidgetProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!siteKey) {
      console.warn('reCAPTCHA siteKey is missing.');
      return;
    }

    const renderWidget = () => {
      if (!containerRef.current) return;
      if (widgetIdRef.current !== null) return; // Already rendered

      const recaptchaAPI = window.grecaptcha?.enterprise || window.grecaptcha;
      if (recaptchaAPI?.render) {
        try {
          widgetIdRef.current = recaptchaAPI.render(containerRef.current, {
            sitekey: siteKey,
            theme,
            callback: (token: string) => {
              onVerify(token);
            },
            'expired-callback': () => {
              onVerify(null);
            },
            'error-callback': () => {
              onVerify(null);
            },
          });
        } catch (err) {
          console.error('Error rendering reCAPTCHA:', err);
        }
      }
    };

    // Check if reCAPTCHA script is already loaded
    if (window.grecaptcha?.enterprise?.render || window.grecaptcha?.render) {
      renderWidget();
    } else {
      // Define global onload callback
      window.onloadRecaptchaCallback = () => {
        renderWidget();
      };

      // Load script if not present
      if (!document.getElementById('recaptcha-enterprise-script')) {
        const script = document.createElement('script');
        script.id = 'recaptcha-enterprise-script';
        script.src = `https://www.google.com/recaptcha/enterprise.js?onload=onloadRecaptchaCallback&render=explicit`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    }

    return () => {
      // Clean up widget on unmount
      const recaptchaAPI = window.grecaptcha?.enterprise || window.grecaptcha;
      if (widgetIdRef.current !== null && recaptchaAPI?.reset) {
        try {
          recaptchaAPI.reset(widgetIdRef.current);
        } catch (e) {
          // ignore reset error during unmount
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, theme, onVerify]);

  if (!siteKey) {
    return (
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs text-center">
        reCAPTCHA Key missing in .env
      </div>
    );
  }

  return (
    <div className="flex justify-center my-4">
      <div ref={containerRef} />
    </div>
  );
};
