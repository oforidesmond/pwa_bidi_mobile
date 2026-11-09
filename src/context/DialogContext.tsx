import { useBidiTheme } from '@/context/ThemeContext';
import { hapticMedium } from '@/utils/haptics';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Sheet } from '@/components/Sheet';

export type DialogButton = {
  label: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export type ShowAlertOptions = {
  title: string;
  message?: string;
  buttons?: DialogButton[];
};

export type ShowConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  promptPlaceholder?: string;
  onConfirm: (promptValue?: string) => void;
  onCancel?: () => void;
};

type DialogContextValue = {
  showAlert: (options: ShowAlertOptions) => void;
  showConfirm: (options: ShowConfirmOptions) => void;
};

const DialogContext = createContext<DialogContextValue | null>(null);

type ActiveDialog =
  | ({ kind: 'alert' } & ShowAlertOptions)
  | ({ kind: 'confirm' } & ShowConfirmOptions);

export function DialogProvider({ children }: { children: ReactNode }) {
  const { tokens } = useBidiTheme();
  const [dialog, setDialog] = useState<ActiveDialog | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const closingRef = useRef(false);

  const dismiss = useCallback(() => {
    setDialog(null);
    setPromptValue('');
    closingRef.current = false;
  }, []);

  const showAlert = useCallback((options: ShowAlertOptions) => {
    setPromptValue('');
    setDialog({ kind: 'alert', ...options });
  }, []);

  const showConfirm = useCallback((options: ShowConfirmOptions) => {
    setPromptValue('');
    setDialog({ kind: 'confirm', ...options });
  }, []);

  const value = useMemo(() => ({ showAlert, showConfirm }), [showAlert, showConfirm]);

  const runAndClose = (fn?: () => void, withMediumHaptic = false) => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (withMediumHaptic) {
      void hapticMedium();
    }
    dismiss();
    fn?.();
  };

  const buttons: DialogButton[] =
    dialog?.kind === 'alert'
      ? dialog.buttons?.length
        ? dialog.buttons
        : [{ label: 'OK', style: 'default' }]
      : dialog?.kind === 'confirm'
        ? [
            {
              label: dialog.cancelLabel ?? 'Cancel',
              style: 'cancel',
              onPress: () => dialog.onCancel?.(),
            },
            {
              label: dialog.confirmLabel ?? (dialog.destructive ? 'Confirm' : 'OK'),
              style: dialog.destructive ? 'destructive' : 'default',
              onPress: () =>
                dialog.onConfirm(
                  dialog.promptPlaceholder != null ? promptValue.trim() || undefined : undefined,
                ),
            },
          ]
        : [];

  return (
    <DialogContext.Provider value={value}>
      {children}
      <Sheet
        open={!!dialog}
        onClose={() => {
          if (dialog?.kind === 'confirm') {
            runAndClose(() => dialog.onCancel?.());
          } else {
            dismiss();
          }
        }}
        ariaLabel={dialog?.title ?? 'Dialog'}
      >
        {dialog ? (
          <div className="bidi-sheet-body">
            <h2 className="bidi-sheet-title">{dialog.title}</h2>
            {dialog.message ? (
              <p className="bidi-sheet-message" style={{ color: tokens.textSecondary }}>
                {dialog.message}
              </p>
            ) : null}
            {dialog.kind === 'confirm' && dialog.promptPlaceholder != null ? (
              <textarea
                className="bidi-input bidi-input--multiline"
                rows={3}
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                placeholder={dialog.promptPlaceholder}
                aria-label={dialog.promptPlaceholder}
              />
            ) : null}
            <div className="bidi-dialog-actions">
              {buttons.map((btn, index) => {
                const isDestructive = btn.style === 'destructive';
                const isCancel = btn.style === 'cancel';
                const cls = isDestructive
                  ? 'bidi-btn bidi-btn--danger'
                  : isCancel
                    ? 'bidi-btn bidi-btn--outline'
                    : 'bidi-btn bidi-btn--primary';
                return (
                  <button
                    key={`${btn.label}-${index}`}
                    type="button"
                    className={cls}
                    onClick={() =>
                      runAndClose(btn.onPress, dialog?.kind === 'confirm' && !isCancel)
                    }
                  >
                    {btn.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </Sheet>
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error('useDialog must be used within DialogProvider');
  }
  return ctx;
}
