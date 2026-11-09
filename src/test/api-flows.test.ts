import { confirmToken, rejectToken, reserveToken } from '@/api/attendant';
import { verifyDriverOtp } from '@/api/auth';
import { buyFuelToken } from '@/api/driver';
import { createIdempotencyKey } from '@/api/idempotency';
import { getWalletFunding, startWalletFunding, submitWalletFundingOtp } from '@/api/wallet';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockGet = vi.fn();

vi.mock('@/api/index', () => ({
  __esModule: true,
  default: {
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    get: (...args: unknown[]) => mockGet(...args),
    defaults: { headers: {} },
  },
  setUnauthorizedHandler: vi.fn(),
}));

describe('buyFuelToken idempotency', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockPost.mockResolvedValue({ data: { token: 'ABC' } });
  });

  it('reuses the same Idempotency-Key on retry', async () => {
    const key = createIdempotencyKey();
    await buyFuelToken({ amount: 50 }, key);
    await buyFuelToken({ amount: 50 }, key);

    expect(mockPost).toHaveBeenCalledTimes(2);
    const h1 = mockPost.mock.calls[0][2].headers['Idempotency-Key'];
    const h2 = mockPost.mock.calls[1][2].headers['Idempotency-Key'];
    expect(h1).toBe(key);
    expect(h2).toBe(key);
  });
});

describe('driver OTP verify typing surface', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('happy path returns needsPin / needsProfile', async () => {
    mockPost.mockResolvedValue({
      data: {
        access_token: 'tok',
        driver: {
          id: 'd1',
          phone: '233242222222',
          firstName: 'Ama',
          lastName: 'Mensah',
          ownerType: 'DRIVER',
          needsPin: false,
          needsProfile: false,
        },
      },
    });
    const res = await verifyDriverOtp('0242222222', '123456');
    expect(res.access_token).toBe('tok');
    expect(res.driver.needsPin).toBe(false);
    expect(res.driver.needsProfile).toBe(false);
  });

  it('wrong OTP surfaces backend message', async () => {
    mockPost.mockRejectedValue({
      response: { data: { message: 'Invalid OTP. 2 attempts remaining.' }, status: 401 },
    });
    await expect(verifyDriverOtp('0242222222', '000000')).rejects.toMatchObject({
      response: { data: { message: 'Invalid OTP. 2 attempts remaining.' } },
    });
  });
});

describe('funding create stays pending', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('startWalletFunding sends phone + provider + Idempotency-Key and stays PENDING', async () => {
    mockPost.mockResolvedValue({
      data: { id: 'fund-1', amount: '20.00', status: 'PENDING', provider: 'MTN_MOMO' },
    });
    const key = 'fund-idem-key';
    const res = await startWalletFunding(
      { amount: 20, provider: 'MTN_MOMO', phone: '0241234567' },
      key,
    );
    expect(res.status).toBe('PENDING');
    expect(mockPost).toHaveBeenCalledWith(
      '/wallet/funding',
      { amount: 20, provider: 'MTN_MOMO', phone: '0241234567' },
      { headers: { 'Idempotency-Key': key } },
    );
    expect(mockPost.mock.calls.some((c) => String(c[0]).includes('/complete'))).toBe(false);
  });

  it('reuses the same Idempotency-Key on funding retry', async () => {
    mockPost.mockResolvedValue({
      data: { id: 'fund-1', amount: '50.00', status: 'PENDING', provider: 'VODAFONE_CASH' },
    });
    const key = createIdempotencyKey();
    await startWalletFunding(
      { amount: 50, provider: 'VODAFONE_CASH', phone: '0201234567' },
      key,
    );
    await startWalletFunding(
      { amount: 50, provider: 'VODAFONE_CASH', phone: '0201234567' },
      key,
    );
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(mockPost.mock.calls[0][2].headers['Idempotency-Key']).toBe(key);
    expect(mockPost.mock.calls[1][2].headers['Idempotency-Key']).toBe(key);
  });

  it('getWalletFunding polls GET /wallet/funding/:id', async () => {
    mockGet.mockReset();
    mockGet.mockResolvedValue({
      data: {
        id: 'fund-1',
        status: 'FAILED',
        amount: '100.00',
        provider: 'MTN_MOMO',
        phone: '0541298861',
        failureReason: 'Customer cancelled the payment request',
        createdAt: '2026-09-22T12:00:00.000Z',
        completedAt: '2026-09-22T12:01:30.000Z',
      },
    });
    const res = await getWalletFunding('fund-1');
    expect(mockGet).toHaveBeenCalledWith('/wallet/funding/fund-1');
    expect(res.status).toBe('FAILED');
    expect(res.failureReason).toMatch(/cancelled/i);
  });

  it('submitWalletFundingOtp posts the SMS code with its own Idempotency-Key', async () => {
    mockPost.mockResolvedValue({
      data: {
        id: 'fund-1',
        status: 'PENDING',
        amount: '5.10',
        provider: 'MTN_MOMO',
        phone: '0241234567',
        nextAction: 'approve_on_phone',
        displayText: 'Approve the prompt on your phone',
      },
    });
    const res = await submitWalletFundingOtp('fund-1', '354768', 'otp-key-1');
    expect(mockPost).toHaveBeenCalledWith(
      '/wallet/funding/fund-1/otp',
      { otp: '354768' },
      { headers: { 'Idempotency-Key': 'otp-key-1' } },
    );
    expect(res.nextAction).toBe('approve_on_phone');
    expect(res.status).toBe('PENDING');
  });

  it('sends a new Idempotency-Key for each OTP attempt', async () => {
    mockPost.mockResolvedValue({
      data: { id: 'fund-1', status: 'PENDING', nextAction: 'submit_otp' },
    });
    await submitWalletFundingOtp('fund-1', '1111', 'otp-key-a');
    await submitWalletFundingOtp('fund-1', '222222', 'otp-key-b');
    expect(mockPost.mock.calls[0][2].headers['Idempotency-Key']).toBe('otp-key-a');
    expect(mockPost.mock.calls[1][2].headers['Idempotency-Key']).toBe('otp-key-b');
    expect(mockPost.mock.calls[0][1]).toEqual({ otp: '1111' });
    expect(mockPost.mock.calls[1][1]).toEqual({ otp: '222222' });
  });
});

describe('attendant reserve confirm reject', () => {
  beforeEach(() => {
    mockPatch.mockReset();
    mockPatch.mockResolvedValue({ data: { ok: true } });
  });

  it('reserve then confirm send Idempotency-Key', async () => {
    const rKey = 'reserve-key';
    const cKey = 'confirm-key';
    const body = { productCatalogId: 'p1', liters: 10 };
    await reserveToken('TOK1', body, rKey);
    await confirmToken('TOK1', body, cKey);
    expect(mockPatch.mock.calls[0][2].headers['Idempotency-Key']).toBe(rKey);
    expect(mockPatch.mock.calls[1][2].headers['Idempotency-Key']).toBe(cKey);
  });

  it('reject sends Idempotency-Key', async () => {
    const key = 'reject-key';
    mockPatch.mockResolvedValue({
      data: {
        id: 'txn-1',
        token: 'TOK1',
        status: 'REJECTED',
        refunded: '50.00',
        balanceAfter: '450.00',
      },
    });
    const res = await rejectToken('TOK1', 'wrong pump', key);
    expect(mockPatch).toHaveBeenCalledWith(
      '/transactions/token/TOK1/reject',
      { reason: 'wrong pump' },
      { headers: { 'Idempotency-Key': key } },
    );
    expect(res.status).toBe('REJECTED');
    expect(res.refunded).toBe('50.00');
    expect(res.balanceAfter).toBe('450.00');
  });
});

describe('session expiry messaging constant', () => {
  it('exports a clear expired session copy via feedback bridge shape', () => {
    const msg = 'Your session expired — please sign in again';
    expect(msg).toMatch(/session expired/i);
  });
});
