import type { ITransport } from './ITransport'
import { MockTransport } from './mock'
import { XmtpTransport } from './xmtp'

export type TransportType = 'mock' | 'xmtp' | 'webrtc'

export function createTransport(type: TransportType): ITransport {
  switch (type) {
    case 'mock':
      return new MockTransport()
    case 'xmtp':
      return new XmtpTransport()
    case 'webrtc':
      throw new Error('WebRTC transport is not yet implemented.')
    default:
      throw new Error(`Unknown transport type: ${type}`)
  }
}
