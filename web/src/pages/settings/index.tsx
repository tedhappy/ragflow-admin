import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Button, Space, Tag, message, Typography, Divider, Spin } from 'antd';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  ExclamationCircleOutlined,
  ApiOutlined,
  SaveOutlined,
  LinkOutlined,
  KeyOutlined,
  LoadingOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { systemApi } from '@/services/api';
import ErrorBoundary from '@/components/ErrorBoundary';
import { translateErrorMessage } from '@/utils/i18n';

const { Title, Text } = Typography;

// Storage key for settings
const SETTINGS_KEY = 'ragflow_admin_settings';

interface SettingsForm {
  ragflow_url: string;
  api_key: string;
}

interface ConnectionStatus {
  status: 'connected' | 'disconnected' | 'error' | 'timeout' | 'unknown' | 'untested';
  message?: string;
}

const Settings: React.FC = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm<SettingsForm>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ status: 'untested' });

  // Check if redirected from other pages and show message
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reason = params.get('reason');
    
    if (reason === 'not_connected') {
      message.warning(t('connection.notConnected'));
      // Clean URL
      window.history.replaceState({}, '', '/settings');
    } else if (reason === 'connection_failed') {
      message.error(t('connection.failed'));
      window.history.replaceState({}, '', '/settings');
    }
  }, [t]);

  // Load settings from localStorage or backend on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        
        // First try localStorage
        const saved = localStorage.getItem(SETTINGS_KEY);
        if (saved) {
          const settings = JSON.parse(saved);
          form.setFieldsValue(settings);
        } else {
          // If localStorage is empty, try to get URL from backend
          try {
            const status = await systemApi.getStatus();
            if (status.ragflow_url) {
              form.setFieldsValue({
                ragflow_url: status.ragflow_url,
                api_key: '', // Don't fill API key for security
              });
              // If backend is connected, show status
              if (status.ragflow_status === 'connected') {
                setConnectionStatus({
                  status: 'connected',
                  message: undefined,
                });
              }
            }
          } catch {
            // Backend not available, leave form empty
          }
        }
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, [form]);

  // Test connection with user-provided values
  const handleTestConnection = async () => {
    try {
      const values = await form.validateFields();
      setTesting(true);

      const result = await systemApi.testConnection({
        ragflow_url: values.ragflow_url,
        api_key: values.api_key,
      });

      const translatedError = translateErrorMessage(result.error_message || undefined, t);
      
      setConnectionStatus({
        status: result.ragflow_status,
        message: translatedError || undefined,
      });

      if (result.ragflow_status === 'connected') {
        message.success(t('common.success'));
      } else {
        message.error(translatedError || t('common.error'));
      }
    } catch (error: any) {
      const translatedError = translateErrorMessage(error.message, t);
      setConnectionStatus({
        status: 'error',
        message: translatedError,
      });
      message.error(translatedError || t('common.error'));
    } finally {
      setTesting(false);
    }
  };

  // Save settings to backend and config.yaml
  const handleSave = async () => {
    // Must test connection first
    if (connectionStatus.status !== 'connected') {
      message.warning(t('settings.testConnectionFirst'));
      return;
    }
    
    try {
      const values = await form.validateFields();
      setSaving(true);
      
      // Save to backend (updates config.yaml)
      await systemApi.saveConfig({
        ragflow_url: values.ragflow_url,
        api_key: values.api_key,
      });
      
      // Also save to localStorage for form persistence
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(values));
      
      message.success(t('settings.saveSuccess'));
    } catch (error: any) {
      message.error(error.message || t('settings.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  // Render connection status tag
  const renderStatusTag = () => {
    const { status, message: msg } = connectionStatus;
    
    const statusConfig = {
      connected: { icon: <CheckCircleOutlined />, color: 'success', text: t('settings.status.connected') },
      disconnected: { icon: <CloseCircleOutlined />, color: 'error', text: t('settings.status.disconnected') },
      error: { icon: <CloseCircleOutlined />, color: 'error', text: t('settings.status.error') },
      timeout: { icon: <ExclamationCircleOutlined />, color: 'warning', text: t('settings.status.timeout') },
      unknown: { icon: <LoadingOutlined />, color: 'default', text: t('settings.status.unknown') },
      untested: { icon: <ApiOutlined />, color: 'default', text: t('settings.status.untested') },
    };

    const config = statusConfig[status] || statusConfig.unknown;
    const translatedMsg = translateErrorMessage(msg, t);
    
    return (
      <Space>
        <Tag icon={config.icon} color={config.color}>
          {config.text}
        </Tag>
        {translatedMsg && <Text type="danger">{translatedMsg}</Text>}
      </Space>
    );
  };

  return (
    <ErrorBoundary>
      <Spin spinning={loading} size="large">
        <div style={{ minHeight: loading ? 400 : 'auto', visibility: loading ? 'hidden' : 'visible' }}>
          <Title level={4} style={{ marginBottom: 8 }}>{t('settings.title')}</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
            {t('settings.subtitle')}
          </Text>

          <Card>
            <Form
              form={form}
              layout="vertical"
              requiredMark={false}
              style={{ maxWidth: 480 }}
            >
              {/* Connection Status */}
              <Form.Item label={t('settings.connectionStatus')} style={{ marginBottom: 24 }}>
                {renderStatusTag()}
              </Form.Item>

              <Divider style={{ margin: '16px 0' }} />

              {/* RAGFlow URL */}
              <Form.Item
                name="ragflow_url"
                label={t('settings.ragflowUrl')}
                rules={[
                  { required: true, message: t('settings.ragflowUrlRequired') },
                  { type: 'url', message: t('settings.ragflowUrlInvalid') },
                ]}
                tooltip={t('settings.ragflowUrlTooltip')}
                style={{ marginBottom: 20 }}
              >
                <Input 
                  prefix={<LinkOutlined style={{ color: '#bfbfbf' }} />}
                  placeholder={t('settings.ragflowUrlPlaceholder')}
                  onChange={() => setConnectionStatus({ status: 'untested' })}
                />
              </Form.Item>

              {/* API Key */}
              <Form.Item
                name="api_key"
                label={t('settings.apiKey')}
                rules={[
                  { required: true, message: t('settings.apiKeyRequired') },
                ]}
                tooltip={t('settings.apiKeyTooltip')}
                style={{ marginBottom: 24 }}
              >
                <Input.Password 
                  prefix={<KeyOutlined style={{ color: '#bfbfbf' }} />}
                  placeholder={t('settings.apiKeyPlaceholder')}
                  onChange={() => setConnectionStatus({ status: 'untested' })}
                />
              </Form.Item>

              <Divider style={{ margin: '16px 0' }} />

              {/* Action Buttons */}
              <Form.Item style={{ marginBottom: 16 }}>
                <Space size="middle">
                  <Button
                    icon={<ApiOutlined />}
                    onClick={handleTestConnection}
                    loading={testing}
                  >
                    {t('settings.testConnection')}
                  </Button>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleSave}
                    loading={saving}
                    disabled={connectionStatus.status !== 'connected'}
                    title={connectionStatus.status !== 'connected' ? t('settings.testConnectionFirst') : ''}
                  >
                    {t('settings.saveSettings')}
                  </Button>
                </Space>
              </Form.Item>

            </Form>
          </Card>
        </div>
      </Spin>
    </ErrorBoundary>
  );
};

export default Settings;
