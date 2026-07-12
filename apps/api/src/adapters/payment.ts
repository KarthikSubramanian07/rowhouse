/**
 * PaymentProvider — Phase-2 seam. The core platform is FREE FOREVER (spec §12);
 * Pro ($4.99), creator subscriptions, and super-reactions are additive. Mock is a
 * no-op that keeps the seam typed without wiring a processor. Stripe activates
 * here later. Never gates core functionality.
 */
import type { Env } from '../env.js';

export interface CheckoutRequest {
  userId: string;
  plan: 'pro' | 'creator_sub' | 'super_reaction';
  amountCents: number;
  reference?: string;
}

export interface CheckoutResult {
  provider: string;
  checkoutUrl: string | null;
  status: 'stub' | 'created';
}

export interface PaymentProvider {
  readonly name: 'mock' | 'stripe';
  createCheckout(req: CheckoutRequest): Promise<CheckoutResult>;
}

export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock' as const;
  async createCheckout(): Promise<CheckoutResult> {
    return { provider: 'mock', checkoutUrl: null, status: 'stub' };
  }
}

export function resolvePayment(_env: Env): PaymentProvider {
  return new MockPaymentProvider();
}
