import { NextResponse } from 'next/server'
import { mockDesignations } from '@/lib/mock-data'
import { persistDesignations } from '@/lib/designation-persistence'

export async function POST() {
  let published = 0

  for (const desig of mockDesignations) {
    if (desig.status === 'pending') {
      desig.status = 'notified'
      desig.notifiedAt = new Date()
      published++
    }
  }

  persistDesignations()

  return NextResponse.json({
    published,
    message: `${published} designación${published !== 1 ? 'es' : ''} publicada${published !== 1 ? 's' : ''}`,
  })
}
