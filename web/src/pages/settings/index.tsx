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
import { systemApi } from '@/services/api';
import ErrorBoundary from '@/components/ErrorBoundary';

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
      message.warning('RAGFlow is not connected. Please configure your connection settings.');
      // Clean URL
      window.history.replaceState({}, '', '/settings');
    } else if (reason === 'connection_failed') {
      message.error('Failed to connect to RAGFlow server. Please check your settings.');
      window.history.replaceState({}, '', '/settings');
    }
  }, []);

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

      setConnectionStatus({
        status: result.ragflow_status,
        message: result.error_message || undefined,
      });

      if (result.ragflow_status === 'connected') {
        message.success('Connection successful!');
      } else {
        message.error(result.error_message || 'Connection failed');
      }
    } catch (error: any) {
      setConnectionStatus({
        status: 'error',
        message: error.message,
      });
      message.error(error.message || 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  // Save settings to backend and config.yaml
  const handleSave = async () => {
    // Must test connection first
    if (connectionStatus.status !== 'connected') {
      message.warning('Please test the connection first before saving');
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
      
      message.success('Settings saved successfully!');
    } catch (error: any) {
      message.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Render connection status tag
  const renderStatusTag = () => {
    const { status, message: msg } = connectionStatus;
    
    const statusConfig = {
      connected: { icon: <CheckCircleOutlined />, color: 'success', text: 'Connected' },
      disconnected: { icon: <CloseCircleOutlined />, color: 'error', text: 'Disconnected' },
      error: { icon: <CloseCircleOutlined />, color: 'error', text: 'Error' },
      timeout: { icon: <ExclamationCircleOutlined />, color: 'warning', text: 'Timeout' },
      unknown: { icon: <LoadingOutlined />, color: 'default', text: 'Unknown' },
      untested: { icon: <ApiOutlined />, color: 'default', text: 'Not Tested' },
    };

    const config = statusConfig[status] || statusConfig.unknown;
    
    return (
      <Space>
        <Tag icon={config.icon} color={config.color}>
          {config.text}
        </Tag>
        {msg && <Text type="danger">{msg}</Text>}
      </Space>
    );
  };

  return (
    <ErrorBoundary>
      <Spin spinning={loading} size="large">
        <div style={{ minHeight: loading ? 400 : 'auto', visibility: loading ? 'hidden' : 'visible' }}>
          <Title level={4} style={{ marginBottom: 8 }}>System Settings</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
            Configure your RAGFlow connection settings
          </Text>

          <Card>
            <Form
              form={form}
              layout="vertical"
              requiredMark={false}
              style={{ maxWidth: 480 }}
            >
              {/* Connection Status */}
              <Form.Item label="Connection Status" style={{ marginBottom: 24 }}>
                {renderStatusTag()}
              </Form.Item>

              <Divider style={{ margin: '16px 0' }} />

              {/* RAGFlow URL */}
              <Form.Item
                name="ragflow_url"
                label="RAGFlow URL"
                rules={[
                  { required: true, message: 'Please enter RAGFlow URL' },
                  { type: 'url', message: 'Please enter a valid URL' },
                ]}
                tooltip="The base URL of your RAGFlow server"
                style={{ marginBottom: 20 }}
              >
                <Input 
                  prefix={<LinkOutlined style={{ color: '#bfbfbf' }} />}
                  placeholder="http://localhost:9380"
                  onChange={() => setConnectionStatus({ status: 'untested' })}
                />
              </Form.Item>

              {/* API Key */}
              <Form.Item
                name="api_key"
                label="API Key"
                rules={[
                  { required: true, message: 'Please enter API Key' },
                ]}
                tooltip="Your RAGFlow API key for authentication"
                style={{ marginBottom: 24 }}
              >
                <Input.Password 
                  prefix={<KeyOutlined style={{ color: '#bfbfbf' }} />}
                  placeholder="ragflow-xxxxxxxx"
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
                    Test Connection
                  </Button>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleSave}
                    loading={saving}
                    disabled={connectionStatus.status !== 'connected'}
                    title={connectionStatus.status !== 'connected' ? 'Please test connection first' : ''}
                  >
                    Save Settings
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
