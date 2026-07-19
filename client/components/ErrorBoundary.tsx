import React, { Component, ComponentType, PropsWithChildren } from "react";

import { ErrorFallback, ErrorFallbackProps } from "@/components/ErrorFallback";
import { reportCapturedError } from "@/lib/globalErrorReporter";

export type ErrorBoundaryProps = PropsWithChildren<{
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, stackTrace: string) => void;
}>;

type ErrorBoundaryState = {
  error: Error | null;
  componentStack: string | null;
};

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null, componentStack: null };

  static defaultProps: {
    FallbackComponent: ComponentType<ErrorFallbackProps>;
  } = {
    FallbackComponent: ErrorFallback,
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }): void {
    const componentStack = info.componentStack ?? "";
    this.setState({ componentStack });
    reportCapturedError(error, {
      componentStack,
      source: "react-error-boundary",
    });
    if (typeof this.props.onError === "function") {
      this.props.onError(error, componentStack);
    }
  }

  resetError = (): void => {
    this.setState({ error: null, componentStack: null });
  };

  render() {
    const { FallbackComponent } = this.props;

    return this.state.error && FallbackComponent ? (
      <FallbackComponent
        error={this.state.error}
        componentStack={this.state.componentStack ?? undefined}
        source="react-error-boundary"
        resetError={this.resetError}
      />
    ) : (
      this.props.children
    );
  }
}
