//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Checkbox, message } from 'antd';
import { UserOutlined, LockOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';
import { useNavigate } from 'umi';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { translateErrorMessage } from '@/utils/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeToggle from '@/components/ThemeToggle';
import { ThemeProvider } from '@/components/ThemeProvider';
import styles from './index.less';

interface LoginForm {
  username: string;
  password: string;
  remember: boolean;
}

const Login: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form] = Form.useForm<LoginForm>();
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAuthStore();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (values: LoginForm) => {
    try {
      setLoading(true);
      await login(values.username, values.password, values.remember);
      message.success(t('login.success'));
      navigate('/dashboard', { replace: true });
    } catch (error: any) {
      const errorMsg = translateErrorMessage(error.message, t) || t('login.failed');
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Background decorations */}
      <div className={styles.bgDecoration}>
        <div className={styles.circle1}></div>
        <div className={styles.circle2}></div>
        <div className={styles.circle3}></div>
      </div>

      {/* Header with logo */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <img src="/logo.svg" alt="RAGFlow" />
          <span>RAGFlow</span>
        </div>
        <div className={styles.headerRight}>
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </header>

      {/* Main content */}
      <main className={styles.main}>
        <h1 className={styles.title}>{t('login.slogan')}</h1>

        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>{t('login.title')}</h2>

          <Form
            form={form}
            name="login"
            onFinish={handleSubmit}
            autoComplete="off"
            layout="vertical"
            initialValues={{ remember: true }}
          >
            <Form.Item
              label={t('login.username')}
              name="username"
              rules={[{ required: true, message: t('login.usernameRequired') }]}
            >
              <Input
                prefix={<UserOutlined className={styles.inputIcon} />}
                placeholder={t('login.usernamePlaceholder')}
                size="large"
              />
            </Form.Item>

            <Form.Item
              label={t('login.password')}
              name="password"
              rules={[{ required: true, message: t('login.passwordRequired') }]}
            >
              <Input.Password
                prefix={<LockOutlined className={styles.inputIcon} />}
                placeholder={t('login.passwordPlaceholder')}
                size="large"
                iconRender={(visible) =>
                  visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                }
              />
            </Form.Item>

            <Form.Item name="remember" valuePropName="checked">
              <Checkbox>{t('login.rememberMe')}</Checkbox>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                size="large"
                className={styles.submitBtn}
              >
                {t('login.submit')}
              </Button>
            </Form.Item>
          </Form>
        </div>
      </main>
    </div>
  );
};

// Wrap with ThemeProvider since login page doesn't use main layout
const LoginPage: React.FC = () => (
  <ThemeProvider>
    <Login />
  </ThemeProvider>
);

export default LoginPage;
