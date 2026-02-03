import type { ReactNode } from 'react'
import { Component } from 'react'
import { Panel } from '../../ui/components/Panel'
import { Button } from '../../ui/components/Button'
import { Toast } from '../../ui/components/Toast'
import { safeUserMessageFromError } from '../../core/validate/redact'
import { logLocalError } from './localTelemetry'

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
  errorId: string | null
  message: string
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    errorId: null,
    message: 'Something went wrong.',
  }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      errorId: null,
      message: safeUserMessageFromError(error),
    }
  }

  componentDidCatch(error: unknown): void {
    const errorId = logLocalError({ scope: 'AppErrorBoundary', error })
    this.setState({ errorId })
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleReset = () => {
    // Clear boundary state; routing layer can re-render.
    this.setState({ hasError: false, errorId: null, message: 'Something went wrong.' })
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <main className="min-h-screen bg-(--color-bg) px-4 py-8 text-fg">
        <div className="mx-auto max-w-xl space-y-4">
          <Panel title="Retrochat crashed (recovered)" description="The app hit an unexpected error, but we prevented a blank screen.">
            <div className="space-y-3">
              <Toast kind="warning">{this.state.message}</Toast>
              {this.state.errorId ? (
                <p className="text-xs text-fg-muted">
                  Error id: <code className="font-mono">{this.state.errorId}</code>
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button onClick={this.handleReload}>Reload</Button>
                <Button variant="outline" onClick={this.handleReset}>
                  Try to continue
                </Button>
              </div>
              <p className="text-xs text-fg-muted">
                Telemetry is local-only and redacted; nothing is sent to a server.
              </p>
            </div>
          </Panel>
        </div>
      </main>
    )
  }
}

