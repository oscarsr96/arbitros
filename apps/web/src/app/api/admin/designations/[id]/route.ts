import { NextResponse } from 'next/server'
import { mockDesignations } from '@/lib/mock-data'

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const index = mockDesignations.findIndex((d) => d.id === params.id)

  if (index === -1) {
    return NextResponse.json({ error: 'Designación no encontrada' }, { status: 404 })
  }

  const designation = mockDesignations[index]

  if (designation.status === 'confirmed') {
    return NextResponse.json(
      { error: 'No se puede eliminar una designación confirmada' },
      { status: 400 },
    )
  }

  mockDesignations.splice(index, 1)

  return NextResponse.json({ success: true })
}
