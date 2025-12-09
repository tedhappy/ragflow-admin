//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors in child components and displays
 * a fallback UI instead of crashing the whole application.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Result, Button } from 'antd';
import { useTranslation } from 'react-i18next';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const ErrorFallback: React.FC<{
  error: Error | null;
  onReset: () => void;
}> = ({ error, onReset }) => {
  const { t } = useTranslation();

  return (
    <Result
      status="error"
      title={t('error.title')}
      subTitle={error?.message || t('error.subtitle')}
      extra={[
        <Button type="primary" key="reload" onClick={() => window.location.reload()}>
          {t('error.reload')}
        </Button>,
        <Button key="retry" onClick={onReset}>
          {t('error.retry')}
        </Button>,
      ]}
    />
  );
};

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
