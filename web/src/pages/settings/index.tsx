//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

import React, { useEffect, useState } from 'react';
import { Form, Input, InputNumber, Button, Space, message, Typography, Spin, Tooltip, Card, Row, Col } from 'antd';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  ExclamationCircleOutlined,
  SaveOutlined,
  DatabaseOutlined,
  LinkOutlined,
  KeyOutlined,
  QuestionCircleOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { systemApi, MySQLTestResult, RagflowTestResult } from '@/services/api';
import ErrorBoundary from '@/components/ErrorBoundary';
import { translateErrorMessage } from '@/utils/i18n';

const { Title, Text } = Typography;

interface MySQLForm {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

interface RagflowForm {
  base_url: string;
  api_key: string;
}

type ConnectionStatusType = 'connected' | 'error' | 'untested' | 'not_configured';

interface ConnectionStatus {
  status: ConnectionStatusType;
  message?: string;
  version?: string;
}

const Settings: React.FC = () => {
  const { t } = useTranslation();
  const [mysqlForm] = Form.useForm<MySQLForm>();
  const [ragflowForm] = Form.useForm<RagflowForm>();
  const [loading, setLoading] = useState(true);
  const [mysqlSaving, setMysqlSaving] = useState(false);
  const [mysqlTesting, setMysqlTesting] = useState(false);
  const [mysqlStatus, setMysqlStatus] = useState<ConnectionStatus>({ status: 'untested' });
  const [ragflowSaving, setRagflowSaving] = useState(false);
  const [ragflowTesting, setRagflowTesting] = useState(false);
  const [ragflowStatus, setRagflowStatus] = useState<ConnectionStatus>({ status: 'untested' });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const config = await systemApi.getConfig();
        mysqlForm.setFieldsValue({
          host: config.mysql_host || '',
          port: config.mysql_port || 5455,
          database: config.mysql_database || '',
          user: config.mysql_user || '',
          password: '',
        });
        
        if (config.is_configured) {
          const status = await systemApi.getStatus();
          setMysqlStatus({ 
            status: status.mysql_status === 'connected' ? 'connected' : 
                   status.mysql_status === 'not_configured' ? 'not_configured' : 'error',
            message: status.error_message || undefined 
          });
        } else {
          setMysqlStatus({ status: 'not_configured' });
        }
        
        const ragflowConfig = await systemApi.getRagflowConfig();
        ragflowForm.setFieldsValue({ base_url: ragflowConfig.base_url || '', api_key: '' });
        setRagflowStatus({ status: ragflowConfig.is_configured ? 'connected' : 'not_configured' });
      } catch (error: any) {
        message.error(translateErrorMessage(error.message, t) || t('common.error'));
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mysqlForm, ragflowForm]);

  const handleMysqlTest = async () => {
    try {
      const values = await mysqlForm.validateFields();
      setMysqlTesting(true);
      const result: MySQLTestResult = await systemApi.testConnection(values);
      if (result.connected) {
        setMysqlStatus({ status: 'connected', version: result.version });
        message.success(t('users.connectionSuccess'));
      } else {
        setMysqlStatus({ status: 'error', message: result.error });
        message.error(result.error || t('users.connectionFailed'));
      }
    } catch (error: any) {
      setMysqlStatus({ status: 'error', message: error.message });
      message.error(translateErrorMessage(error.message, t) || t('common.error'));
    } finally {
      setMysqlTesting(false);
    }
  };

  const handleMysqlSave = async () => {
    if (mysqlStatus.status !== 'connected') {
      message.warning(t('users.testConnectionFirst'));
      return;
    }
    try {
      const values = await mysqlForm.validateFields();
      setMysqlSaving(true);
      await systemApi.saveConfig(values);
      message.success(t('users.configSaved'));
    } catch (error: any) {
      message.error(error.message || t('users.configSaveFailed'));
    } finally {
      setMysqlSaving(false);
    }
  };

  const handleRagflowTest = async () => {
    try {
      const values = await ragflowForm.validateFields();
      setRagflowTesting(true);
      const result: RagflowTestResult = await systemApi.testRagflowConnection(values);
      if (result.connected) {
        setRagflowStatus({ status: 'connected' });
        message.success(t('users.connectionSuccess'));
      } else {
        setRagflowStatus({ status: 'error', message: result.error });
        message.error(result.error || t('users.connectionFailed'));
      }
    } catch (error: any) {
      setRagflowStatus({ status: 'error', message: error.message });
      message.error(translateErrorMessage(error.message, t) || t('common.error'));
    } finally {
      setRagflowTesting(false);
    }
  };

  const handleRagflowSave = async () => {
    if (ragflowStatus.status !== 'connected') {
      message.warning(t('users.testConnectionFirst'));
      return;
    }
    try {
      const values = await ragflowForm.validateFields();
      setRagflowSaving(true);
      await systemApi.saveRagflowConfig(values);
      message.success(t('users.configSaved'));
    } catch (error: any) {
      message.error(error.message || t('users.configSaveFailed'));
    } finally {
      setRagflowSaving(false);
    }
  };

  const StatusBadge: React.FC<{ status: ConnectionStatus }> = ({ status }) => {
    const config: Record<ConnectionStatusType, { color: string; icon: React.ReactNode; text: string }> = {
      connected: { color: 'var(--success-color)', icon: <CheckCircleOutlined />, text: t('settings.status.connected') },
      error: { color: 'var(--error-color)', icon: <CloseCircleOutlined />, text: t('settings.status.error') },
      untested: { color: 'var(--text-secondary)', icon: <ExclamationCircleOutlined />, text: t('settings.status.untested') },
      not_configured: { color: 'var(--warning-color)', icon: <ExclamationCircleOutlined />, text: t('settings.status.notConfigured') },
    };
    const c = config[status.status];
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: c.color, fontSize: 13 }}>
        {c.icon}
        <span>{c.text}</span>
        {status.version && <span style={{ opacity: 0.7 }}>v{status.version}</span>}
      </span>
    );
  };

  const CardHeader: React.FC<{ 
    icon: React.ReactNode; 
    gradient: string; 
    title: string; 
    tag: string;
    tagColor?: string;
    status: ConnectionStatus;
  }> = ({ icon, gradient, title, tag, tagColor, status }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ 
          width: 32, height: 32, borderRadius: 8, 
          background: gradient,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
        <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>{title}</span>
        <span style={{ 
          fontSize: 11, padding: '2px 6px', borderRadius: 4, 
          background: tagColor || 'var(--bg-card)', 
          color: tagColor ? '#fff' : 'var(--text-secondary)',
        }}>{tag}</span>
      </div>
      <StatusBadge status={status} />
    </div>
  );

  return (
    <ErrorBoundary>
      <Spin spinning={loading} size="large">
        <div style={{ minHeight: loading ? 400 : 'auto', visibility: loading ? 'hidden' : 'visible' }}>
          {/* Page Header */}
          <div style={{ marginBottom: 24, textAlign: 'center' }}>
            <Title level={4} style={{ margin: 0 }}>{t('settings.title')}</Title>
            <Text type="secondary">{t('settings.subtitle')}</Text>
          </div>
          
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            {/* MySQL Configuration */}
            <Card 
              title={
                <CardHeader
                  icon={<DatabaseOutlined style={{ color: '#fff', fontSize: 16 }} />}
                  gradient="linear-gradient(135deg, #1677ff 0%, #4096ff 100%)"
                  title={t('settings.mysqlTitle')}
                  tag={t('settings.mysqlRequired')}
                  tagColor="#1677ff"
                  status={mysqlStatus}
                />
              }
              style={{ marginBottom: 16 }}
              styles={{ header: { borderBottom: '1px solid var(--border-default)' }, body: { padding: 20 } }}
            >
              {mysqlStatus.message && (
                <div style={{ 
                  color: 'var(--error-color)', fontSize: 12, marginBottom: 16, 
                  padding: '8px 12px', background: 'rgba(255, 77, 79, 0.1)', borderRadius: 6 
                }}>
                  {mysqlStatus.message}
                </div>
              )}
              <Form form={mysqlForm} layout="vertical" requiredMark={false} size="middle">
                <Row gutter={12}>
                  <Col span={18}>
                    <Form.Item 
                      name="host" 
                      label={
                        <span>
                          {t('users.mysqlHost')}
                          <Tooltip title={t('settings.mysqlHostTip')}>
                            <QuestionCircleOutlined style={{ marginLeft: 4, color: 'var(--text-secondary)' }} />
                          </Tooltip>
                        </span>
                      } 
                      rules={[{ required: true }]} 
                      style={{ marginBottom: 12 }}
                    >
                      <Input placeholder="host.docker.internal" onChange={() => setMysqlStatus({ status: 'untested' })} />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item 
                      name="port" 
                      label={
                        <span>
                          {t('users.mysqlPort')}
                          <Tooltip title={t('settings.mysqlPortTip')}>
                            <QuestionCircleOutlined style={{ marginLeft: 4, color: 'var(--text-secondary)' }} />
                          </Tooltip>
                        </span>
                      } 
                      rules={[{ required: true }]} 
                      style={{ marginBottom: 12 }}
                    >
                      <InputNumber style={{ width: '100%' }} min={1} max={65535} placeholder="5455" onChange={() => setMysqlStatus({ status: 'untested' })} />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item 
                  name="database" 
                  label={
                    <span>
                      {t('users.mysqlDatabase')}
                      <Tooltip title={t('settings.mysqlDatabaseTip')}>
                        <QuestionCircleOutlined style={{ marginLeft: 4, color: 'var(--text-secondary)' }} />
                      </Tooltip>
                    </span>
                  } 
                  rules={[{ required: true }]} 
                  style={{ marginBottom: 12 }}
                >
                  <Input placeholder="rag_flow" onChange={() => setMysqlStatus({ status: 'untested' })} />
                </Form.Item>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item 
                      name="user" 
                      label={
                        <span>
                          {t('users.mysqlUser')}
                          <Tooltip title={t('settings.mysqlUserTip')}>
                            <QuestionCircleOutlined style={{ marginLeft: 4, color: 'var(--text-secondary)' }} />
                          </Tooltip>
                        </span>
                      } 
                      rules={[{ required: true }]} 
                      style={{ marginBottom: 12 }}
                    >
                      <Input placeholder="root" onChange={() => setMysqlStatus({ status: 'untested' })} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item 
                      name="password" 
                      label={
                        <span>
                          {t('users.mysqlPassword')}
                          <Tooltip title={t('settings.mysqlPasswordTip')}>
                            <QuestionCircleOutlined style={{ marginLeft: 4, color: 'var(--text-secondary)' }} />
                          </Tooltip>
                        </span>
                      } 
                      style={{ marginBottom: 12 }}
                    >
                      <Input.Password placeholder="••••••••" onChange={() => setMysqlStatus({ status: 'untested' })} />
                    </Form.Item>
                  </Col>
                </Row>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>{t('settings.mysqlHelp')}</Text>
                <Space>
                  <Button onClick={handleMysqlTest} loading={mysqlTesting}>{t('users.testConnection')}</Button>
                  <Button type="primary" icon={<SaveOutlined />} onClick={handleMysqlSave} loading={mysqlSaving} disabled={mysqlStatus.status !== 'connected'}>
                    {t('common.save')}
                  </Button>
                </Space>
              </Form>
            </Card>

            {/* RAGFlow API Configuration */}
            <Card 
              title={
                <CardHeader
                  icon={<CloudServerOutlined style={{ color: '#fff', fontSize: 16 }} />}
                  gradient="linear-gradient(135deg, #722ed1 0%, #9254de 100%)"
                  title={t('settings.ragflowTitle')}
                  tag={t('settings.ragflowOptional')}
                  status={ragflowStatus}
                />
              }
              style={{ marginBottom: 16 }}
              styles={{ header: { borderBottom: '1px solid var(--border-default)' }, body: { padding: 20 } }}
            >
              {ragflowStatus.message && (
                <div style={{ 
                  color: 'var(--error-color)', fontSize: 12, marginBottom: 16, 
                  padding: '8px 12px', background: 'rgba(255, 77, 79, 0.1)', borderRadius: 6 
                }}>
                  {ragflowStatus.message}
                </div>
              )}
              <Form form={ragflowForm} layout="vertical" requiredMark={false} size="middle">
                <Row gutter={12}>
                  <Col span={16}>
                    <Form.Item 
                      name="base_url" 
                      label={
                        <span>
                          {t('settings.ragflowUrl')}
                          <Tooltip title={t('settings.ragflowUrlTip')}>
                            <QuestionCircleOutlined style={{ marginLeft: 4, color: 'var(--text-secondary)' }} />
                          </Tooltip>
                        </span>
                      } 
                      rules={[{ required: true }, { type: 'url', message: t('settings.ragflowUrlInvalid') }]} 
                      style={{ marginBottom: 12 }}
                    >
                      <Input prefix={<LinkOutlined style={{ color: 'var(--text-disabled)' }} />} placeholder="http://host.docker.internal:9380" onChange={() => setRagflowStatus({ status: 'untested' })} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item 
                      name="api_key" 
                      label={
                        <span>
                          {t('settings.ragflowApiKey')}
                          <Tooltip title={t('settings.ragflowApiKeyTip')}>
                            <QuestionCircleOutlined style={{ marginLeft: 4, color: 'var(--text-secondary)' }} />
                          </Tooltip>
                        </span>
                      } 
                      rules={[{ required: true }]} 
                      style={{ marginBottom: 12 }}
                    >
                      <Input.Password prefix={<KeyOutlined style={{ color: 'var(--text-disabled)' }} />} placeholder="ragflow-xxx" onChange={() => setRagflowStatus({ status: 'untested' })} />
                    </Form.Item>
                  </Col>
                </Row>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>{t('settings.ragflowHelp')}</Text>
                <Space>
                  <Button onClick={handleRagflowTest} loading={ragflowTesting}>{t('users.testConnection')}</Button>
                  <Button type="primary" icon={<SaveOutlined />} onClick={handleRagflowSave} loading={ragflowSaving} disabled={ragflowStatus.status !== 'connected'}>
                    {t('common.save')}
                  </Button>
                </Space>
              </Form>
            </Card>
          </div>
        </div>
      </Spin>
    </ErrorBoundary>
  );
};

export default Settings;
