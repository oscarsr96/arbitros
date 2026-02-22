import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ message: 'Optimization service not configured' }, { status: 501 })
}
