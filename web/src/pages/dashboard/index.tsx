//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

/**
 * Dashboard Page
 *
 * Overview page displaying system statistics, service health, and quick navigation.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Card, Typography, Spin, message, Row, Col, Tag, Progress, Divider, Alert, Tooltip, Statistic } from 'antd';
import { 
  DatabaseOutlined, 
  MessageOutlined, 
  RobotOutlined, 
  FileOutlined,
  UserOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  QuestionCircleOutlined,
  ApiOutlined,
  HddOutlined,
  CloudServerOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { dashboardApi, monitoringApi, HealthStatus, SystemStats } from '@/services/api';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useConnectionCheck } from '@/hooks/useConnectionCheck';
import { translateErrorMessage } from '@/utils/i18n';

const { Title, Text } = Typography;

interface Stats {
  dataset_count: number;
  document_count: number;
  chat_count: number;
  agent_count: number;
  user_count: number;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatNumber = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

const StatusIcon: React.FC<{ status: string }> = ({ status }) => {
  switch (status) {
    case 'healthy':
    case 'ok':
      return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />;
    case 'unhealthy':
    case 'nok':
      return <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />;
    case 'not_configured':
      return <ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 18 }} />;
    default:
      return <QuestionCircleOutlined style={{ color: '#8c8c8c', fontSize: 18 }} />;
  }
};

const StatusTag: React.FC<{ status: string }> = ({ status }) => {
  const { t } = useTranslation();
  const statusConfig: Record<string, { color: string; text: string }> = {
    healthy: { color: 'success', text: t('monitoring.status.healthy') },
    ok: { color: 'success', text: t('monitoring.status.healthy') },
    unhealthy: { color: 'error', text: t('monitoring.status.unhealthy') },
    nok: { color: 'error', text: t('monitoring.status.unhealthy') },
    not_configured: { color: 'warning', text: t('monitoring.status.notConfigured') },
    partial: { color: 'warning', text: t('monitoring.status.partial') },
    unknown: { color: 'default', text: t('monitoring.status.unknown') },
  };
  const config = statusConfig[status] || statusConfig.unknown;
  return <Tag color={config.color}>{config.text}</Tag>;
};

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { checking, connected } = useConnectionCheck();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    dataset_count: 0,
    document_count: 0,
    chat_count: 0,
    agent_count: 0,
    user_count: 0,
  });
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [ragflowServices, setRagflowServices] = useState<any>(null);

  const fetchData = useCallback(async () => {
    if (!connected) return;
    
    try {
      setLoading(true);
      const [dashboardData, healthData, sysStatsData] = await Promise.all([
        dashboardApi.getStats().catch(() => null),
        monitoringApi.getHealthStatus().catch(() => null),
        monitoringApi.getSystemStats().catch(() => null),
      ]);
      
      if (dashboardData) setStats(dashboardData);
      if (healthData) setHealth(healthData);
      if (sysStatsData) setSystemStats(sysStatsData);
      
      // Fetch RAGFlow internal services health
      try {
        const ragflowHealth = await monitoringApi.getRagflowHealth();
        setRagflowServices(ragflowHealth?.services);
      } catch {
        setRagflowServices(null);
      }
    } catch (error: any) {
      message.error(translateErrorMessage(error.message, t) || t('dashboard.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [connected, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const statisticsData = [
    { title: t('dashboard.datasets'), value: stats.dataset_count, icon: <DatabaseOutlined />, color: '#1677ff', bgColor: '#e6f4ff', path: '/datasets' },
    { title: t('dashboard.documents'), value: stats.document_count, icon: <FileOutlined />, color: '#52c41a', bgColor: '#f6ffed', path: '/tasks' },
    { title: t('dashboard.chats'), value: stats.chat_count, icon: <MessageOutlined />, color: '#722ed1', bgColor: '#f9f0ff', path: '/chat' },
    { title: t('dashboard.agents'), value: stats.agent_count, icon: <RobotOutlined />, color: '#fa8c16', bgColor: '#fff7e6', path: '/agents' },
    { title: t('dashboard.users'), value: stats.user_count, icon: <UserOutlined />, color: '#eb2f96', bgColor: '#fff0f6', path: '/users' },
  ];

  const isLoading = checking || loading;
  const overallStatus = health?.overall || 'unknown';

  return (
    <ErrorBoundary>
      <Spin spinning={isLoading} size="large">
        <div style={{ minHeight: isLoading ? 300 : 'auto', visibility: isLoading ? 'hidden' : 'visible' }}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={4} style={{ margin: 0 }}>{t('dashboard.title')}</Title>
            <Tooltip title={t('common.refresh')}>
              <ReloadOutlined 
                style={{ fontSize: 16, cursor: 'pointer', opacity: 0.65 }} 
                onClick={fetchData}
              />
            </Tooltip>
          </div>
          
          {/* Quick Stats */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            {statisticsData.map((item) => (
              <Card 
                key={item.title} 
                hoverable 
                onClick={() => navigate(item.path)}
                style={{ 
                  flex: 1,
                  borderRadius: 12,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
                bodyStyle={{ padding: '20px 16px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    backgroundColor: item.bgColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {React.cloneElement(item.icon as React.ReactElement, {
                      style: { color: item.color, fontSize: 24 },
                    })}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 2 }}>{item.title}</div>
                    <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1 }}>{item.value}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Service Health & Stats Row */}
          <Row gutter={16}>
            {/* Service Health */}
            <Col xs={24} lg={8}>
              <Card 
                title={t('monitoring.serviceHealth')} 
                size="small"
                style={{ height: '100%' }}
              >
                {/* Overall Status */}
                <Alert
                  message={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StatusIcon status={overallStatus} />
                      <StatusTag status={overallStatus} />
                      <Text style={{ fontSize: 12 }}>
                        {overallStatus === 'healthy' && t('monitoring.allSystemsOperational')}
                        {overallStatus === 'unhealthy' && t('monitoring.systemIssues')}
                        {overallStatus === 'partial' && t('monitoring.partiallyOperational')}
                        {overallStatus === 'unknown' && t('monitoring.statusUnknown')}
                      </Text>
                    </div>
                  }
                  type={overallStatus === 'healthy' ? 'success' : overallStatus === 'unhealthy' ? 'error' : 'warning'}
                  style={{ marginBottom: 12 }}
                />
                
                {/* Service List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* MySQL */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <DatabaseOutlined style={{ color: '#1890ff', fontSize: 14 }} />
                      <Text style={{ fontSize: 13 }}>{t('monitoring.services.mysql')}</Text>
                    </div>
                    <StatusTag status={health?.mysql?.status || 'unknown'} />
                  </div>
                  {/* RAGFlow API */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ApiOutlined style={{ color: '#722ed1', fontSize: 14 }} />
                      <Text style={{ fontSize: 13 }}>{t('monitoring.services.ragflowApi')}</Text>
                    </div>
                    <StatusTag status={health?.ragflow_api?.status || 'unknown'} />
                  </div>
                  {/* RAGFlow Internal Services */}
                  {ragflowServices && (
                    <>
                      {/* Redis */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <HddOutlined style={{ color: '#eb2f96', fontSize: 14 }} />
                          <Text style={{ fontSize: 13 }}>{t('monitoring.services.redis')}</Text>
                        </div>
                        <StatusTag status={ragflowServices.redis || 'unknown'} />
                      </div>
                      {/* Document Engine (Elasticsearch) */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <CloudServerOutlined style={{ color: '#13c2c2', fontSize: 14 }} />
                          <Text style={{ fontSize: 13 }}>{t('monitoring.services.docEngine')}</Text>
                        </div>
                        <StatusTag status={ragflowServices.doc_engine || 'unknown'} />
                      </div>
                      {/* Object Storage (MinIO) */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <HddOutlined style={{ color: '#fa8c16', fontSize: 14 }} />
                          <Text style={{ fontSize: 13 }}>{t('monitoring.services.storage')}</Text>
                        </div>
                        <StatusTag status={ragflowServices.storage || 'unknown'} />
                      </div>
                    </>
                  )}
                </div>
              </Card>
            </Col>

            {/* Document Parsing Stats */}
            <Col xs={24} lg={8}>
              <Card 
                title={t('monitoring.stats.parsingStatus')} 
                size="small"
                style={{ height: '100%' }}
                extra={
                  <a onClick={() => navigate('/tasks')} style={{ fontSize: 12 }}>
                    {t('dashboard.viewAll')}
                  </a>
                }
              >
                {systemStats?.documents && (
                  <>
                    <Row gutter={8} style={{ marginBottom: 16 }}>
                      <Col span={12}>
                        <div style={{ textAlign: 'center' }}>
                          <Progress
                            type="circle"
                            percent={systemStats.documents.total > 0 ? Math.round((systemStats.documents.completed / systemStats.documents.total) * 100) : 0}
                            size={70}
                            strokeColor="#52c41a"
                          />
                          <div style={{ marginTop: 8 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>{t('monitoring.stats.completed')}</Text>
                            <div><Text strong>{systemStats.documents.completed}</Text></div>
                          </div>
                        </div>
                      </Col>
                      <Col span={12}>
                        <div style={{ textAlign: 'center' }}>
                          <Progress
                            type="circle"
                            percent={systemStats.documents.total > 0 ? Math.round((systemStats.documents.failed / systemStats.documents.total) * 100) : 0}
                            size={70}
                            strokeColor="#ff4d4f"
                            status="exception"
                          />
                          <div style={{ marginTop: 8 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>{t('monitoring.stats.failed')}</Text>
                            <div><Text strong>{systemStats.documents.failed}</Text></div>
                          </div>
                        </div>
                      </Col>
                    </Row>
                    <Divider style={{ margin: '12px 0' }} />
                    <Row gutter={8}>
                      <Col span={8}>
                        <Statistic 
                          title={<span style={{ fontSize: 11 }}>{t('monitoring.stats.running')}</span>}
                          value={systemStats.documents.running} 
                          prefix={<SyncOutlined spin={systemStats.documents.running > 0} style={{ fontSize: 12 }} />}
                          valueStyle={{ fontSize: 18, color: '#1890ff' }}
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic 
                          title={<span style={{ fontSize: 11 }}>{t('monitoring.stats.pending')}</span>}
                          value={systemStats.documents.pending} 
                          prefix={<ClockCircleOutlined style={{ fontSize: 12 }} />}
                          valueStyle={{ fontSize: 18 }}
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic 
                          title={<span style={{ fontSize: 11 }}>{t('monitoring.stats.totalSize')}</span>}
                          value={formatBytes(systemStats.documents.total_size)} 
                          valueStyle={{ fontSize: 14 }}
                        />
                      </Col>
                    </Row>
                  </>
                )}
              </Card>
            </Col>

            {/* Recent Activity */}
            <Col xs={24} lg={8}>
              <Card 
                title={t('monitoring.stats.recentActivity')} 
                size="small"
                style={{ height: '100%' }}
              >
                {systemStats?.recent_activity && (
                  <>
                    <Row gutter={16}>
                      <Col span={8}>
                        <Statistic
                          title={<span style={{ fontSize: 11 }}>{t('monitoring.stats.newUsers24h')}</span>}
                          value={systemStats.recent_activity.new_users_24h}
                          prefix={<UserOutlined style={{ color: '#52c41a', fontSize: 14 }} />}
                          valueStyle={{ fontSize: 20, color: '#52c41a' }}
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic
                          title={<span style={{ fontSize: 11 }}>{t('monitoring.stats.newDocs24h')}</span>}
                          value={systemStats.recent_activity.new_docs_24h}
                          prefix={<FileOutlined style={{ color: '#1890ff', fontSize: 14 }} />}
                          valueStyle={{ fontSize: 20, color: '#1890ff' }}
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic
                          title={<span style={{ fontSize: 11 }}>{t('monitoring.stats.newSessions24h')}</span>}
                          value={systemStats.recent_activity.new_sessions_24h}
                          prefix={<MessageOutlined style={{ color: '#722ed1', fontSize: 14 }} />}
                          valueStyle={{ fontSize: 20, color: '#722ed1' }}
                        />
                      </Col>
                    </Row>
                    <Divider style={{ margin: '16px 0' }} />
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>{t('monitoring.stats.tokenUsage')}</Text>
                      <div style={{ marginTop: 4 }}>
                        <Text strong style={{ fontSize: 24 }}>
                          {formatNumber(systemStats.datasets.total_tokens)}
                        </Text>
                        <Text type="secondary" style={{ marginLeft: 4 }}>tokens</Text>
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {formatNumber(systemStats.datasets.total_chunks)} {t('monitoring.stats.totalChunks').toLowerCase()}
                        </Text>
                      </div>
                    </div>
                  </>
                )}
              </Card>
            </Col>
          </Row>
        </div>
      </Spin>
    </ErrorBoundary>
  );
};

export default Dashboard;
