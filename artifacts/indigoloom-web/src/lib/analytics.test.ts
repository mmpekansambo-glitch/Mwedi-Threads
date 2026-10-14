import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackEvent, trackSuccessfulAction } from './analytics';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('optional analytics', () => {
  it('does nothing when the tracker is missing', () => {
    vi.stubGlobal('window', {});

    expect(() => trackEvent('signup_started')).not.toThrow();
  });

  it('does not interrupt signup or successful maker actions when the tracker throws', () => {
    const tracker = vi.fn(() => {
      throw new Error('analytics unavailable');
    });
    vi.stubGlobal('window', { umami: { track: tracker } });

    expect(() => trackEvent('signup_started')).not.toThrow();
    const completeSignup = trackSuccessfulAction('account_completed', () => 'signup complete');
    const createProject = trackSuccessfulAction('project_created', () => 'project created');
    const updateProgress = trackSuccessfulAction('progress_updated', () => 'progress updated');

    expect(completeSignup()).toBe('signup complete');
    expect(createProject()).toBe('project created');
    expect(updateProgress()).toBe('progress updated');
    expect(tracker).toHaveBeenCalledTimes(4);
  });

  it('dispatches a success event only when the success callback runs', () => {
    const tracker = vi.fn();
    const onSuccessfulProjectCreation = vi.fn();
    vi.stubGlobal('window', { umami: { track: tracker } });

    const onSuccess = trackSuccessfulAction('project_created', onSuccessfulProjectCreation);
    expect(tracker).not.toHaveBeenCalled();
    expect(onSuccessfulProjectCreation).not.toHaveBeenCalled();

    onSuccess();

    expect(tracker).toHaveBeenCalledExactlyOnceWith('project_created');
    expect(onSuccessfulProjectCreation).toHaveBeenCalledExactlyOnceWith();
  });

  it('sends only approved event names and never accepts event details', () => {
    const tracker = vi.fn();
    vi.stubGlobal('window', { umami: { track: tracker } });

    trackEvent('signup_started');
    trackEvent('account_completed');
    trackEvent('project_created');
    trackEvent('progress_updated');

    expect(tracker.mock.calls).toEqual([
      ['signup_started'],
      ['account_completed'],
      ['project_created'],
      ['progress_updated'],
    ]);
  });
});
