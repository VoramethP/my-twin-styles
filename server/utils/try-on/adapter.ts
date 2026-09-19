import type { RenderSlot } from '#shared/outfit'

// ADR-0001: ผู้ให้บริการ AI try-on ห่อไว้หลัง interface เดียว — เปลี่ยนเจ้าได้โดยไม่แตะ flow
// ยังไม่ได้เลือกเจ้าจริง (WORKLOG 2026-09-19) → ช่วงพัฒนาใช้ mock

export interface TryOnRequest {
  tryOnId: string
  poseImageUrl: string // signed URL อายุสั้น — ห้ามส่ง path ถาวร (ADR-0003)
  garments: { slot: RenderSlot, imageUrl: string }[]
  callbackUrl: string
}

export interface TryOnSubmission {
  providerJobId: string
}

export type TryOnResult =
  | { providerJobId: string, status: 'succeeded', imageUrl: string }
  | { providerJobId: string, status: 'failed', errorCode: string }

export class InvalidWebhookSignature extends Error {
  constructor() { super('invalid_webhook_signature') }
}

export interface TryOnAdapter {
  readonly name: string
  submit(req: TryOnRequest): Promise<TryOnSubmission>
  // ตรวจลายเซ็นก่อนเชื่อ payload เสมอ (ADR-0005) — ไม่ผ่านให้ throw InvalidWebhookSignature
  parseWebhook(headers: Record<string, string | undefined>, rawBody: string): TryOnResult
}
