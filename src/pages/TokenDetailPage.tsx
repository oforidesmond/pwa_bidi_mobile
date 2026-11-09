import { TokenArtifactCard } from '@/components/TokenArtifactCard';
import { useFeedback } from '@/context/FeedbackContext';
import { useBidiTheme } from '@/context/ThemeContext';
import { formatAxiosError } from '@/utils/apiMessage';
import { getBidiLogo } from '@/utils/bidi-logo';
import { formatDisplayMoney, tabularNumsStyle } from '@/utils/currency-display';
import { getTokenDetailPayload } from '@/utils/token-cache';
import {
  isActiveToken,
  isRefundedTokenStatus,
  normalizeTokenStatus,
  tokenStatusLabel,
} from '@/utils/token-status';
import type { Transaction } from '@/types';
import { QRCodeSVG } from 'qrcode.react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

function buildReceipt(payload: {
  token: string;
  amount: string;
  createdAt: string;
  status?: string;
}): string {
  const lines = [
    'Bidi fuel token',
    `Token: ${payload.token}`,
    `Amount: GHS ${payload.amount || '—'}`,
    `Status: ${tokenStatusLabel(payload.status)}`,
    `Issued: ${new Date(payload.createdAt).toLocaleString()}`,
  ];
  if (isActiveToken(payload.status)) {
    lines.push('Present this token or QR at a Bidi station to redeem fuel.');
  } else if (isRefundedTokenStatus(payload.status)) {
    lines.push('This purchase was refunded to your wallet.');
  }
  return lines.join('\n');
}

function detailCopy(status?: string, rejectionReason?: string): string {
  const s = normalizeTokenStatus(status);
  if (s === 'REJECTED') {
    const reason = rejectionReason?.trim();
    return reason
      ? `This token was rejected at the pump. ${reason} The purchase was refunded to your wallet — check Buy Token or Activity.`
      : 'This token was rejected at the pump. The purchase was refunded to your wallet — check Buy Token or Activity.';
  }
  if (s === 'REVERSED') {
    const reason = rejectionReason?.trim();
    return reason
      ? `This redemption was reversed. ${reason} The purchase was refunded to your wallet — check Buy Token or Activity.`
      : 'This redemption was reversed. The purchase was refunded to your wallet — check Buy Token or Activity.';
  }
  if (s === 'REDEEMED' || s === 'USED') {
    return 'This token has already been redeemed.';
  }
  if (s === 'RESERVED') {
    return 'This token is reserved at a pump. Show the code if the attendant asks.';
  }
  if (s === 'EXPIRED') {
    return 'This token has expired.';
  }
  return 'Show this QR at any Bidi or affiliated station, or share/copy the code above.';
}

export default function TokenDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { tokens } = useBidiTheme();
  const { showMessage } = useFeedback();

  const payload = useMemo(() => {
    const cached = getTokenDetailPayload();
    if (cached && cached.id === id) return cached as Transaction;
    return {
      id: id || '',
      token: '',
      amount: '',
      createdAt: new Date().toISOString(),
      status: '',
      rejectionReason: '',
    } as Transaction;
  }, [id]);

  const redeemable = isActiveToken(payload.status);
  const [showQr, setShowQr] = useState(false);
  const [sharing, setSharing] = useState(false);
  const logoSrc = getBidiLogo('light');

  const copyToken = async () => {
    if (!payload.token) return;
    try {
      await navigator.clipboard.writeText(payload.token);
      showMessage('Token copied to clipboard');
    } catch {
      showMessage('Could not copy automatically — select the code to copy.');
    }
  };

  const shareToken = async () => {
    if (!payload.token) return;
    setSharing(true);
    try {
      const message = buildReceipt({
        token: payload.token,
        amount: String(payload.amount ?? ''),
        createdAt: payload.createdAt,
        status: String(payload.status ?? ''),
      });
      if (navigator.share) {
        await navigator.share({ text: message, title: 'Bidi fuel token' });
      } else {
        await navigator.clipboard.writeText(message);
        showMessage('Sharing not available — receipt copied to clipboard');
      }
    } catch (e) {
      try {
        await navigator.clipboard.writeText(
          buildReceipt({
            token: payload.token,
            amount: String(payload.amount ?? ''),
            createdAt: payload.createdAt,
            status: String(payload.status ?? ''),
          }),
        );
        showMessage('Sharing failed — receipt copied to clipboard');
      } catch {
        showMessage(formatAxiosError(e, 'Could not share token'));
      }
    } finally {
      setSharing(false);
    }
  };

  const issuedDate = payload.createdAt
    ? new Date(payload.createdAt).toLocaleDateString()
    : undefined;

  return (
    <div className="bidi-scroll-page" style={{ backgroundColor: tokens.surfaceBg }}>
      <div className="bidi-detail-header">
        <Link to="/app/tokens" className="bidi-back" style={{ color: tokens.textPrimary }}>
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <h1 className="bidi-detail-title" style={{ color: tokens.textPrimary }}>
          Token detail
        </h1>
      </div>

      <div className="bidi-scroll-inner">
        <TokenArtifactCard
          tokenCode={payload.token || '—'}
          amount={payload.amount}
          issuedAt={issuedDate}
          status={payload.status}
          onQr={redeemable ? () => setShowQr(true) : undefined}
          onShare={shareToken}
          onCopy={copyToken}
          sharing={sharing}
        />

        <div
          className={
            showQr && payload.token && redeemable
              ? 'bidi-layout-detail-split'
              : undefined
          }
        >
          <p className="bidi-detail-body" style={{ color: tokens.textSecondary }}>
            {detailCopy(
              String(payload.status ?? ''),
              payload.rejectionReason ? String(payload.rejectionReason) : undefined,
            )}
          </p>

          {showQr && payload.token && redeemable ? (
            <div
              className="bidi-qr-block"
              style={{ backgroundColor: tokens.surfaceElevated }}
              aria-label="Token QR code"
            >
              <div className="bidi-qr-inner" style={{ backgroundColor: tokens.onGradient }}>
                <QRCodeSVG
                  value={payload.token}
                  size={220}
                  fgColor={tokens.brand.black}
                  bgColor={tokens.onGradient}
                  imageSettings={{
                    src: logoSrc,
                    height: 24,
                    width: 44,
                    excavate: true,
                  }}
                />
              </div>
              <p
                className="tabular-nums bidi-qr-amount"
                style={{ ...tabularNumsStyle, color: tokens.brand.accent500 }}
              >
                {formatDisplayMoney(payload.amount)}
              </p>
              <p
                className="bidi-qr-code-text"
                style={{ color: tokens.textSecondary }}
              >
                {payload.token}
              </p>
              <button
                type="button"
                className="bidi-btn-text"
                onClick={() => setShowQr(false)}
                style={{ color: tokens.brand.accent500 }}
              >
                Hide QR
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
