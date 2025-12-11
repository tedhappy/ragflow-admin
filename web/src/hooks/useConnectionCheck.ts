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
        setChecking(false);
      }
    };

    checkConnection();
  }, []);

  return { checking, connected };
}

export default useConnectionCheck;
