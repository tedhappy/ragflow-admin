//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'umi';
import { Spin } from 'antd';
import { useAuthStore } from '@/stores/auth';

const AuthWrapper: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, checkAuth } = useAuthStore();
  const [checking, setChecking] = useState(true);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const verify = async () => {
      const authenticated = await checkAuth();
      if (!authenticated) {
        navigate('/login', { replace: true });
      } else {
        setShouldRender(true);
      }
      setChecking(false);
    };
    verify();
  }, [checkAuth, navigate]);

  if (checking || !shouldRender) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
      }}>
        <Spin size="large" />
      </div>
    );
  }

  return <Outlet />;
};

export default AuthWrapper;
