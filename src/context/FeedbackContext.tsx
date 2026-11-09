import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type FeedbackState = {
  showMessage: (message: string, duration?: number) => void;
  showSessionExpired: () => void;
};

const FeedbackContext = createContext<FeedbackState | undefined>(undefined);

const SESSION_EXPIRED_MSG = 'Your session expired — please sign in again';

/** Imperative bridge for axios 401 handler (outside React tree). */
let feedbackBridge: FeedbackState | null = null;

export function getFeedbackBridge() {
  return feedbackBridge;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const [duration, setDuration] = useState(3500);

  const showMessage = useCallback((msg: string, dur = 3500) => {
    if (!msg) return;
    setDuration(dur);
    setMessage(msg);
  }, []);

  const showSessionExpired = useCallback(() => {
    showMessage(SESSION_EXPIRED_MSG, 5000);
  }, [showMessage]);

  const value = useMemo(
    () => ({ showMessage, showSessionExpired }),
    [showMessage, showSessionExpired],
  );

  useEffect(() => {
    feedbackBridge = value;
    return () => {
      if (feedbackBridge === value) feedbackBridge = null;
    };
  }, [value]);

  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(() => setMessage(''), duration);
    return () => window.clearTimeout(id);
  }, [message, duration]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div
        className={`bidi-snackbar${message ? ' bidi-snackbar--visible' : ''}`}
        role="status"
        aria-live="polite"
      >
        {message}
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used within FeedbackProvider');
  return ctx;
}
