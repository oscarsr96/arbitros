import { NextRequest, NextResponse } from 'next/server'
import { mockPersons, mockAlertLog } from '@/lib/mock-data'
import type { MockAlert } from '@/lib/mock-data'

async function sendAlertEmails(
  recipients: { name: string; email: string }[],
  weekStart: string,
  message: string,
) {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    for (const r of recipients) {
      console.log(
        `[MOCK EMAIL] To: ${r.email} (${r.name}) — Alerta disponibilidad semana ${weekStart}`,
      )
    }
    if (message) {
      console.log(`[MOCK EMAIL] Mensaje adicional: ${message}`)
    }
    return
  }

  // Dynamic import to avoid errors when resend is not configured
  const { Resend } = await import('resend')
  const resend = new Resend(apiKey)
  const from = process.env.EMAIL_FROM ?? 'designaciones@fbm.es'

  for (const r of recipients) {
    await resend.emails.send({
      from,
      to: r.email,
      subject: `FBM — Recuerda introducir tu disponibilidad (semana ${weekStart})`,
      html: `
        <p>Hola ${r.name},</p>
        <p>Te recordamos que necesitamos tu disponibilidad para la semana del <strong>${weekStart}</strong>.</p>
        ${message ? `<p>${message}</p>` : ''}
        <p>Accede al portal para indicar tus franjas disponibles.</p>
        <p>Gracias,<br/>Departamento de Designaciones FBM</p>
      `,
    })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { weekStart, roles, categories, message } = body as {
    weekStart: string
    roles: string[]
    categories: string[]
    message: string
  }

  let filtered = mockPersons.filter((p) => p.active)

  if (roles && roles.length > 0) {
    filtered = filtered.filter((p) => roles.includes(p.role))
  }

  if (categories && categories.length > 0) {
    filtered = filtered.filter((p) => categories.includes(p.category))
  }

  const recipients = filtered.map((p) => ({ name: p.name, email: p.email }))

  await sendAlertEmails(recipients, weekStart, message ?? '')

  const alert: MockAlert = {
    id: `alert-${Date.now()}`,
    weekStart,
    roles: roles ?? [],
    categories: categories ?? [],
    message: message ?? '',
    recipientCount: recipients.length,
    sentAt: new Date(),
  }
  mockAlertLog.unshift(alert)

  return NextResponse.json({ sent: recipients.length })
}

export async function GET() {
  return NextResponse.json({ alerts: mockAlertLog })
}
