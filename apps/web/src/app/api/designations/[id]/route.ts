import { NextRequest, NextResponse } from 'next/server'
import { mockDesignations } from '@/lib/mock-data'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  const body = await request.json()
  const { status } = body as { status: string }

  if (!['confirmed', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const index = mockDesignations.findIndex((d) => d.id === id)
  if (index === -1) {
    return NextResponse.json({ error: 'Designation not found' }, { status: 404 })
  }

  // Mutate in-memory mock data
  const updated = {
    ...mockDesignations[index],
    status: status as (typeof mockDesignations)[number]['status'],
    confirmedAt: status === 'confirmed' ? new Date() : mockDesignations[index].confirmedAt,
  }
  mockDesignations[index] = updated

  return NextResponse.json({ designation: updated })
}
