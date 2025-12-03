import React, { useEffect, useState } from 'react';
import { Card, Descriptions, Tag, Button, Skeleton, message, Typography } from 'antd';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  ExclamationCircleOutlined,
  ReloadOutlined,
  LoadingOutlined 
} from '@ant-design/icons';
import { systemApi, SystemStatus } from '@/services/api';
import ErrorBoundary from '@/components/ErrorBoundary';

const { Title } = Typography;

const Settings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SystemStatus | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const data = await systemApi.getStatus();
      setStatus(data);
    } catch (error: any) {
      message.error(error.message || 'Failed to fetch system status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const getStatusTag = () => {
    if (!status) return null;
    
    switch (status.ragflow_status) {
      case 'connected':
        return (
          <Tag icon={<CheckCircleOutlined />} color="success">
            Connected
          </Tag>
        );
      case 'disconnected':
        return (
          <Tag icon={<CloseCircleOutlined />} color="error">
            Disconnected
          </Tag>
        );
      case 'timeout':
        return (
          <Tag icon={<ExclamationCircleOutlined />} color="warning">
            Timeout
          </Tag>
        );
      case 'error':
        return (
          <Tag icon={<CloseCircleOutlined />} color="error">
            Error
          </Tag>
        );
      default:
        return (
          <Tag icon={<LoadingOutlined />} color="default">
            Unknown
          </Tag>
        );
    }
  };

  // Show skeleton on initial load
  if (loading && !status) {
    return (
      <div>
        <Title level={4} style={{ marginBottom: 24 }}>System Settings</Title>
        <Card>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div>
        <Title level={4} style={{ marginBottom: 24 }}>System Settings</Title>
        <Card
          extra={
            <Button 
              icon={<ReloadOutlined />} 
              onClick={fetchStatus}
              loading={loading}
            >
              Refresh
            </Button>
          }
        >
          <Descriptions bordered column={1}>
            <Descriptions.Item label="Connection Status">
              {getStatusTag()}
              {status?.error_message && (
                <span style={{ marginLeft: 8, color: '#ff4d4f' }}>
                  {status.error_message}
                </span>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="RAGFlow URL">
              {status?.ragflow_url || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="API Key">
              <code>{status?.api_key_masked || '-'}</code>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </div>
    </ErrorBoundary>
  );
};

export default Settings;
