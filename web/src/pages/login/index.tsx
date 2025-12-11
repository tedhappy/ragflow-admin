//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Checkbox, message } from 'antd';
import { EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';
import { useNavigate } from 'umi';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { saveCredentials, getSavedCredentials, clearCredentials } from '@/services/api';
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

  useEffect(() => {
    const saved = getSavedCredentials();
    if (saved) {
      form.setFieldsValue({
        username: saved.username,
        password: saved.password,
        remember: true,
      });
    }
  }, [form]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (values: LoginForm) => {
    try {
      setLoading(true);
      await login(values.username, values.password);
      
      if (values.remember) {
        saveCredentials(values.username, values.password);
      } else {
        clearCredentials();
      }
      
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
      {/* SVG Background lines like RAGFlow */}
      <div className={styles.bgSvg}>
        <svg className={styles.bgLine} viewBox="0 0 1440 240" preserveAspectRatio="none">
          <path
            d="M0 120 Q 360 40, 720 120 T 1440 120"
            stroke="#00BEB4"
            strokeWidth="1"
            fill="none"
            opacity="0.15"
          />
        </svg>
        <svg className={styles.bgLine2} viewBox="0 0 1440 300" preserveAspectRatio="none">
          <path
            d="M0 150 Q 480 50, 960 150 T 1440 100"
            stroke="#00BEB4"
            strokeWidth="1"
            fill="none"
            opacity="0.1"
          />
        </svg>
      </div>

      {/* Spotlight gradient effect */}
      <div className={styles.spotlight} />

      {/* Header with logo */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <img src="/logo.svg" alt="RAGFlow Admin" />
          <span>RAGFlow Admin</span>
        </div>
        <div className={styles.headerRight}>
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
            initialValues={{ remember: false }}
          >
            <Form.Item
              label={t('login.username')}
              name="username"
              rules={[{ required: true, message: t('login.usernameRequired') }]}
              required
            >
              <Input
                placeholder={t('login.usernamePlaceholder')}
                size="large"
                className={styles.formInput}
              />
            </Form.Item>

            <Form.Item
              label={t('login.password')}
              name="password"
              rules={[{ required: true, message: t('login.passwordRequired') }]}
              required
            >
              <Input.Password
                placeholder={t('login.passwordPlaceholder')}
                size="large"
                className={styles.formInput}
                iconRender={(visible) =>
                  visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                }
              />
            </Form.Item>

            <Form.Item name="remember" valuePropName="checked" className={styles.rememberItem}>
              <Checkbox>{t('login.rememberMe')}</Checkbox>
            </Form.Item>

            <Form.Item className={styles.submitItem}>
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

        {/* Theme toggle below card like RAGFlow */}
        <div className={styles.themeToggleWrapper}>
          <ThemeToggle />
        </div>
      </main>
    </div>
  );
};

const LoginPage: React.FC = () => (
  <ThemeProvider>
    <Login />
  </ThemeProvider>
);

export default LoginPage;
