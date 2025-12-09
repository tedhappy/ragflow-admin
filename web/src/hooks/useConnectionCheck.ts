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
 * Hook to verify MySQL database connection status on component mount.
 * Automatically redirects to Settings page if the connection is not established.
 * 
 * @returns Object containing connection check status
 * @returns {boolean} checking - True while connection check is in progress
 * @returns {boolean} connected - True if MySQL connection is established
 * 
 * @example
 * ```tsx
 * const { checking, connected } = useConnectionCheck();
 * 
 * if (checking) return <Loading />;
 * if (!connected) return null; // Will redirect to settings
 * ```
 */
export function useConnectionCheck(): ConnectionCheckResult {
  const [checking, setChecking] = useState(true);
  const [connected, setConnected] = useState(false);
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (hasRedirected.current || window.location.pathname === '/settings') {
      setChecking(false);
      return;
    }

    const checkConnection = async () => {
      try {
        setChecking(true);
        
        // Add timeout to prevent infinite loading
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 10000)
        );
        
        const status = await Promise.race([
          systemApi.getStatus(),
          timeoutPromise
        ]) as any;
        
        if (status?.mysql_status === 'connected') {
          setConnected(true);
        } else {
          hasRedirected.current = true;
          window.location.href = '/settings?reason=not_connected';
        }
      } catch (error) {
        hasRedirected.current = true;
        window.location.href = '/settings?reason=connection_failed';
      } finally {
        // Always end checking state
        setChecking(false);
      }
    };

    checkConnection();
  }, []);

  return { checking, connected };
}

export default useConnectionCheck;
