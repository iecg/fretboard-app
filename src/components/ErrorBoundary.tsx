import { Component, type ReactNode } from 'react'
import styles from './ErrorBoundary.module.css'

declare global {
  interface Window {
    __APP_VERSION__?: string
  }
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

export function ErrorFallback() {
  return (
    <div className={styles["error-fallback"]}>
      <div className={styles["error-fallback__content"]}>
        <h1 className={styles["error-fallback__title"]}>Something went wrong</h1>
        <p className={styles["error-fallback__message"]}>
          {window.__APP_VERSION__
            ? `Version ${window.__APP_VERSION__}`
            : 'An error occurred while rendering the app'}
        </p>
        <button
          className={styles["error-fallback__button"]}
          onClick={() => window.location.reload()}
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
