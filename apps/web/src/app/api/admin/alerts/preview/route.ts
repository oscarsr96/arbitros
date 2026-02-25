import { NextRequest, NextResponse } from 'next/server'
import { mockPersons } from '@/lib/mock-data'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const roles = searchParams.get('roles')?.split(',').filter(Boolean) ?? []
  const categories = searchParams.get('categories')?.split(',').filter(Boolean) ?? []

  let filtered = mockPersons.filter((p) => p.active)

  if (roles.length > 0) {
    filtered = filtered.filter((p) => roles.includes(p.role))
  }

  if (categories.length > 0) {
    filtered = filtered.filter((p) => categories.includes(p.category))
  }

  const recipients = filtered.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    role: p.role,
    category: p.category,
  }))

  return NextResponse.json({ count: recipients.length, recipients })
}
