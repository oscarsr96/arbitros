import { NextResponse } from 'next/server'
import { mockDesignations } from '@/lib/mock-data'

export async function POST() {
  let published = 0

  for (const desig of mockDesignations) {
    if (desig.status === 'pending') {
      desig.status = 'notified'
      desig.notifiedAt = new Date()
      published++
    }
  }

  return NextResponse.json({
    published,
    message: `${published} designación${published !== 1 ? 'es' : ''} publicada${published !== 1 ? 's' : ''}`,
  })
}
