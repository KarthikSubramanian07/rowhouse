// Minimal ambient shape for @pushforge/builder (used only on the optional
// real-web-push path). If the installed package ships richer types, prefer those
// and delete this file.
declare module '@pushforge/builder' {
  export function buildPushPayload(
    message: { data: unknown; options?: { ttl?: number; urgency?: string; topic?: string } },
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    vapid: { subject: string; publicKey: string; privateKey: string },
  ): Promise<{ endpoint: string; headers: Record<string, string>; body: ArrayBuffer }>;
}
