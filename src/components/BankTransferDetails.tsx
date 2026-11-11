import type { FundingTransferInstructions } from '@/types';
import { useBidiTheme } from '@/context/ThemeContext';
import {
  formatTransferCountdown,
  formatTransferShareText,
  transferExpiresInMs,
} from '@/utils/funding';
import { hapticLight, hapticSuccess } from '@/utils/haptics';
import { useEffect, useState } from 'react';

type Props = {
  instructions: FundingTransferInstructions;
  /** Softer text colors for use on the wallet gradient card. */
  onGradient?: boolean;
};

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const el = document.createElement('textarea');
      el.value = value;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

export function BankTransferDetails({ instructions, onGradient = false }: Props) {
  const { tokens } = useBidiTheme();
  const [countdown, setCountdown] = useState(() =>
    formatTransferCountdown(transferExpiresInMs(instructions.expiresAt)),
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => {
      setCountdown(formatTransferCountdown(transferExpiresInMs(instructions.expiresAt)));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [instructions.expiresAt]);

  const labelColor = onGradient ? tokens.onGradientMuted : tokens.textSecondary;
  const valueColor = onGradient ? tokens.onGradient : tokens.textPrimary;
  const canShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const markCopied = (key: string) => {
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((current) => (current === key ? null : current));
    }, 1500);
  };

  const handleCopy = async (key: string, value: string) => {
    void hapticLight();
    const ok = await copyText(value);
    if (ok) {
      void hapticSuccess();
      markCopied(key);
    }
  };

  const handleCopyAll = async () => {
    void hapticLight();
    const ok = await copyText(formatTransferShareText(instructions));
    if (ok) {
      void hapticSuccess();
      markCopied('all');
    }
  };

  const handleShare = async () => {
    if (!canShare) return;
    void hapticLight();
    try {
      await navigator.share({
        title: 'Bidi top-up transfer',
        text: formatTransferShareText(instructions),
      });
    } catch {
      // User cancelled or share failed — ignore.
    }
  };

  const rows: { key: string; label: string; value: string }[] = [
    { key: 'amount', label: 'Exact amount', value: `GHS ${instructions.amount}` },
    { key: 'bank', label: 'Bank', value: instructions.bankName },
    { key: 'name', label: 'Account name', value: instructions.accountName },
    { key: 'number', label: 'Account number', value: instructions.accountNumber },
  ];

  return (
    <div className="bidi-bank-transfer">
      <p className="bidi-bank-transfer__tip" style={{ color: labelColor }}>
        Send this exact amount with Instant Pay / GIP (not ACH or RTGS).
        {countdown ? ` · ${countdown}` : ''}
      </p>
      <ul className="bidi-bank-transfer__list">
        {rows.map((row) => (
          <li key={row.key} className="bidi-bank-transfer__row">
            <div className="bidi-bank-transfer__meta">
              <span className="bidi-bank-transfer__label" style={{ color: labelColor }}>
                {row.label}
              </span>
              <span
                className="bidi-bank-transfer__value tabular-nums"
                style={{ color: valueColor }}
              >
                {row.value}
              </span>
            </div>
            <button
              type="button"
              className="bidi-bank-transfer__copy"
              style={{ color: onGradient ? tokens.onGradient : tokens.brand.accent600 }}
              onClick={() =>
                void handleCopy(
                  row.key,
                  row.key === 'amount' ? instructions.amount : row.value,
                )
              }
            >
              {copiedKey === row.key ? 'Copied' : 'Copy'}
            </button>
          </li>
        ))}
      </ul>
      <div className="bidi-bank-transfer__actions">
        <button
          type="button"
          className="bidi-wallet-btn bidi-wallet-btn--secondary"
          onClick={() => void handleCopyAll()}
        >
          {copiedKey === 'all' ? 'Copied all' : 'Copy all'}
        </button>
        {canShare ? (
          <button
            type="button"
            className="bidi-wallet-btn bidi-wallet-btn--ghost"
            onClick={() => void handleShare()}
          >
            Share
          </button>
        ) : null}
      </div>
    </div>
  );
}
