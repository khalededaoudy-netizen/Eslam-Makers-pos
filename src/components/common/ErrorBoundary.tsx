import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallbackTitle?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: any) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center bg-card border border-border rounded-2xl m-4 shadow-xl">
          <div className="text-destructive text-xl font-bold mb-2">
            {this.props.fallbackTitle || 'حدث خطأ غير متوقع'}
          </div>
          <div className="text-muted-foreground text-xs font-mono mb-4 bg-muted/40 p-3 rounded-lg max-w-lg mx-auto overflow-x-auto text-start">
            {this.state.error?.message || 'Unknown error occurred'}
          </div>
          <button
            className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl text-xs hover:bg-primary/90 transition-colors shadow-sm"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            إعادة المحاولة
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
