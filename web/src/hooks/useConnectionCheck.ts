//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

import { useEffect, useState, useRef } from 'react';
import { systemApi } from '@/services/api';

interface ConnectionCheckResult {
  checking: boolean;
  connected: boolean;
}

/**
 * Hook to check MySQL connection status.
 * Redirects to Settings page if not connected.
 */
export function useConnectionCheck(): ConnectionCheckResult {
  const [checking, setChecking] = useState(true);
  const [connected, setConnected] = useState(false);
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Skip if already redirecting or on settings page
    if (hasRedirected.current || window.location.pathname === '/settings') {
      setChecking(false);
      return;
    }

    const checkConnection = async () => {
      try {
        setChecking(true);
        const status = await systemApi.getStatus();
        
        if (status.mysql_status === 'connected') {
          setConnected(true);
          setChecking(false);
        } else {
          hasRedirected.current = true;
          // Redirect with reason parameter
          window.location.href = '/settings?reason=not_connected';
        }
      } catch (error) {
        hasRedirected.current = true;
        // Redirect with reason parameter
        window.location.href = '/settings?reason=connection_failed';
      }
    };

    checkConnection();
  }, []);

  return { checking, connected };
}

export default useConnectionCheck;
