import { NextResponse } from 'next/server'
import { persistDesignations } from '@/lib/designation-persistence'
import { mockDesignations } from '@/lib/mock-data'

export async function POST() {
  persistDesignations()

  return NextResponse.json({ saved: mockDesignations.length })
}
