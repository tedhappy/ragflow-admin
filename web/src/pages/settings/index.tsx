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
  status: 'connected' | 'disconnected' | 'error' | 'timeout' | 'unknown' | 'untested' | 'not_configured';
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
        
        // First try localStorage for form values
        const saved = localStorage.getItem(SETTINGS_KEY);
        if (saved) {
          const settings = JSON.parse(saved);
          form.setFieldsValue(settings);
        }
        
        // Always check backend status to show actual connection state
        try {
          const status = await systemApi.getStatus();
          
          // If localStorage is empty, use backend URL
          if (!saved && status.ragflow_url) {
            form.setFieldsValue({
              ragflow_url: status.ragflow_url,
              api_key: '', // Don't fill API key for security
            });
          }
          
          // Show actual connection status from backend
          const validStatuses = ['connected', 'disconnected', 'error', 'timeout', 'not_configured'] as const;
          type ValidStatus = typeof validStatuses[number];
          
          if (status.ragflow_status && validStatuses.includes(status.ragflow_status as ValidStatus)) {
            setConnectionStatus({
              status: status.ragflow_status as ConnectionStatus['status'],
              message: status.error_message || undefined,
            });
          }
        } catch {
          // Backend not available, keep untested status
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
      not_configured: { icon: <ExclamationCircleOutlined />, color: 'warning', text: t('settings.status.notConfigured') },
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
        <div style={{ minHeight: loading ? 400 : 'auto', visibility: loading ? 'hidden' : 'visible', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Title level={4} style={{ marginBottom: 8, textAlign: 'center' }}>{t('settings.title')}</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 24, textAlign: 'center' }}>
            {t('settings.subtitle')}
          </Text>

          <Card style={{ width: '100%', maxWidth: 560 }}>
            <Form
              form={form}
              layout="vertical"
              requiredMark={false}
            >
              {/* Connection Status */}
              <div style={{ marginBottom: 24, padding: '16px', background: 'rgba(0,0,0,0.02)', borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong>{t('settings.connectionStatus')}</Text>
                  {renderStatusTag()}
                </div>
              </div>

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
                  prefix={<LinkOutlined style={{ opacity: 0.45 }} />}
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
                  prefix={<KeyOutlined style={{ opacity: 0.45 }} />}
                  placeholder={t('settings.apiKeyPlaceholder')}
                  onChange={() => setConnectionStatus({ status: 'untested' })}
                />
              </Form.Item>

              {/* Action Buttons */}
              <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
                  <Button
                    icon={<ApiOutlined />}
                    onClick={handleTestConnection}
                    loading={testing}
                    size="large"
                  >
                    {t('settings.testConnection')}
                  </Button>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleSave}
                    loading={saving}
                    size="large"
                    disabled={connectionStatus.status !== 'connected'}
                    title={connectionStatus.status !== 'connected' ? t('settings.testConnectionFirst') : ''}
                  >
                    {t('settings.saveSettings')}
                  </Button>
                </div>
              </Form.Item>

            </Form>
          </Card>
        </div>
      </Spin>
    </ErrorBoundary>
  );
};

export default Settings;
