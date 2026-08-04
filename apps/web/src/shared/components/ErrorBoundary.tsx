import { Component, type ReactNode } from "react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary]", error, info)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-lg border border-destructive/50 bg-destructive/10 p-8 text-center">
          <p className="font-semibold text-destructive">حدث خطأ غير متوقع</p>
          <p className="text-sm text-muted-foreground">{this.state.error?.message}</p>
          <button
            className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
            onClick={() => {
              const message = this.state.error?.message ?? ""
              if (/dynamically imported module|module script failed|loading chunk/i.test(message)) {
                window.location.reload()
                return
              }
              this.setState({ hasError: false, error: null })
            }}
          >
            حاول مجدداً
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
