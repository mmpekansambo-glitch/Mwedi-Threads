export type AnalyticsEvent =
  | 'signup_started'
  | 'account_completed'
  | 'project_created'
  | 'progress_updated';

declare global {
  interface Window {
    umami?: {
      track(name: AnalyticsEvent): void;
    };
  }
}

export function trackEvent(name: AnalyticsEvent): void {
  if (typeof window === 'undefined') return;

  try {
    window.umami?.track(name);
  } catch {
    // Analytics is optional and must never block app use.
  }
}

export function trackSuccessfulAction<Args extends unknown[], Result>(
  name: AnalyticsEvent,
  onSuccess: (...args: Args) => Result,
): (...args: Args) => Result {
  return (...args) => {
    trackEvent(name);
    return onSuccess(...args);
  };
}
