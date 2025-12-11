//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

import React, { useEffect, useState, useCallback } from 'react';
import { Card, Typography, Spin, message, Row, Col, Progress, Tooltip, Space } from 'antd';
import dayjs from 'dayjs';
import { 
  DatabaseOutlined, 
  MessageOutlined, 
  RobotOutlined, 
  FileOutlined,
  UserOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  ApiOutlined,
  HddOutlined,
  CloudServerOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  ReloadOutlined,
  RightOutlined,
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

const StatusDot: React.FC<{ status: string }> = ({ status }) => {
  const colorMap: Record<string, string> = {
    healthy: '#52c41a',
    ok: '#52c41a',
    unhealthy: '#ff4d4f',
    nok: '#ff4d4f',
    not_configured: '#faad14',
    partial: '#faad14',
    unknown: '#d9d9d9',
  };
  return (
    <span style={{
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: '50%',
      backgroundColor: colorMap[status] || colorMap.unknown,
    }} />
  );
};

const ServiceItem: React.FC<{ 
  icon: React.ReactNode; 
  name: string; 
  status: string;
  iconColor: string;
}> = ({ icon, name, status, iconColor }) => {
  const { t } = useTranslation();
  const statusTextMap: Record<string, string> = {
    healthy: t('monitoring.status.healthy'),
    ok: t('monitoring.status.healthy'),
    unhealthy: t('monitoring.status.unhealthy'),
    nok: t('monitoring.status.unhealthy'),
    not_configured: t('monitoring.status.notConfigured'),
    unknown: t('monitoring.status.unknown'),
  };
  
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      padding: '8px 12px',
      borderRadius: 8,
      backgroundColor: 'var(--bg-card-hover, rgba(0,0,0,0.02))',
      marginBottom: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {React.cloneElement(icon as React.ReactElement, { 
          style: { color: iconColor, fontSize: 16 } 
        })}
        <Text style={{ fontSize: 13 }}>{name}</Text>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <StatusDot status={status} />
        <Text style={{ fontSize: 12, color: 'var(--text-secondary, rgba(0,0,0,0.45))' }}>
          {statusTextMap[status] || statusTextMap.unknown}
        </Text>
      </div>
    </div>
  );
};

const ActivityStatItem: React.FC<{
  icon: React.ReactNode;
  value: number;
  label: string;
  color: string;
}> = ({ icon, value, label, color }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ 
      width: 44, 
      height: 44, 
      borderRadius: 10, 
      backgroundColor: `${color}15`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 8px',
    }}>
      {React.cloneElement(icon as React.ReactElement, { style: { color, fontSize: 20 } })}
    </div>
    <div style={{ fontSize: 20, fontWeight: 600, color }}>{value}</div>
    <div style={{ fontSize: 11, color: 'var(--text-secondary, rgba(0,0,0,0.45))' }}>{label}</div>
  </div>
);

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
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    if (!connected) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    const withTimeout = <T,>(promise: Promise<T>, ms: number = 8000): Promise<T | null> => 
      Promise.race([
        promise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))
      ]).catch(() => null);
    
    try {
      const [dashboardData, healthData, sysStatsData, ragflowHealth] = await Promise.all([
        withTimeout(dashboardApi.getStats()),
        withTimeout(monitoringApi.getHealthStatus()),
        withTimeout(monitoringApi.getSystemStats()),
        withTimeout(monitoringApi.getRagflowHealth()),
      ]);
      
      if (dashboardData) setStats(dashboardData);
      setHealth(healthData || {
        mysql: { status: 'unknown', message: 'Request failed or timeout' },
        ragflow_api: { status: 'unknown', message: 'Request failed or timeout' },
        overall: 'unknown'
      });
      if (sysStatsData) setSystemStats(sysStatsData);
      setRagflowServices(ragflowHealth?.services || null);
      
    } catch (error: any) {
      console.error('Dashboard fetch error:', error);
      message.error(translateErrorMessage(error.message, t) || t('dashboard.fetchFailed'));
    } finally {
      setLoading(false);
      setLastRefreshTime(new Date());
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
  
  const calculateOverallStatus = () => {
    const statuses: string[] = [];
    
    if (health?.mysql?.status) statuses.push(health.mysql.status);
    if (health?.ragflow_api?.status) statuses.push(health.ragflow_api.status);
    
    if (ragflowServices) {
      if (ragflowServices.redis) statuses.push(ragflowServices.redis);
      if (ragflowServices.doc_engine) statuses.push(ragflowServices.doc_engine);
      if (ragflowServices.storage) statuses.push(ragflowServices.storage);
    }
    
    if (statuses.length === 0) return 'unknown';
    if (statuses.some(s => s === 'unhealthy' || s === 'nok')) return 'unhealthy';
    if (statuses.every(s => s === 'healthy' || s === 'ok')) return 'healthy';
    if (statuses.some(s => s === 'not_configured' || s === 'unknown')) return 'partial';
    return 'unknown';
  };
  
  const overallStatus = calculateOverallStatus();
  
  const effectiveTotal = systemStats?.documents?.effective_total || systemStats?.documents?.total || 0;
  const parsingRate = effectiveTotal > 0 
    ? Math.round((systemStats!.documents.completed / effectiveTotal) * 100) 
    : 0;

  return (
    <ErrorBoundary>
      <Spin spinning={isLoading} size="large">
        <div style={{ minHeight: isLoading ? 300 : 'auto', visibility: isLoading ? 'hidden' : 'visible' }}>
          {/* Header */}
          <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={4} style={{ margin: 0 }}>{t('dashboard.title')}</Title>
            <Space size={12}>
              {lastRefreshTime && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('monitoring.lastUpdated')}: {dayjs(lastRefreshTime).format('HH:mm:ss')}
                </Text>
              )}
              <Tooltip title={t('common.refresh')}>
                <ReloadOutlined 
                  style={{ fontSize: 16, cursor: 'pointer', opacity: 0.65 }} 
                  onClick={fetchData}
                />
              </Tooltip>
            </Space>
          </div>
          
          {/* Quick Stats Cards - Full width responsive */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
            {statisticsData.map((item) => (
              <Card 
                key={item.title}
                hoverable 
                onClick={() => navigate(item.path)}
                style={{ flex: '1 1 160px', borderRadius: 12, minWidth: 160 }}
                bodyStyle={{ padding: '20px 16px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                  <div style={{
                    width: 52,
                    height: 52,
                    borderRadius: 12,
                    backgroundColor: item.bgColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {React.cloneElement(item.icon as React.ReactElement, {
                      style: { color: item.color, fontSize: 26 },
                    })}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 4 }}>{item.title}</div>
                    <div style={{ fontSize: 26, fontWeight: 600, lineHeight: 1 }}>{item.value}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Main Content Row */}
          <Row gutter={16}>
            {/* Service Health - Simplified */}
            <Col xs={24} lg={8}>
              <Card 
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{t('monitoring.serviceHealth')}</span>
                    <StatusDot status={overallStatus} />
                  </div>
                }
                size="small"
                style={{ borderRadius: 12, height: '100%' }}
                bodyStyle={{ padding: '12px 16px' }}
              >
                <ServiceItem 
                  icon={<DatabaseOutlined />}
                  name={t('monitoring.services.mysql')}
                  status={health?.mysql?.status || 'unknown'}
                  iconColor="#1890ff"
                />
                <ServiceItem 
                  icon={<ApiOutlined />}
                  name={t('monitoring.services.ragflowApi')}
                  status={health?.ragflow_api?.status || 'unknown'}
                  iconColor="#722ed1"
                />
                {ragflowServices && (
                  <>
                    <ServiceItem 
                      icon={<HddOutlined />}
                      name={t('monitoring.services.redis')}
                      status={ragflowServices.redis || 'unknown'}
                      iconColor="#eb2f96"
                    />
                    <ServiceItem 
                      icon={<CloudServerOutlined />}
                      name={t('monitoring.services.docEngine')}
                      status={ragflowServices.doc_engine || 'unknown'}
                      iconColor="#13c2c2"
                    />
                    <ServiceItem 
                      icon={<HddOutlined />}
                      name={t('monitoring.services.storage')}
                      status={ragflowServices.storage || 'unknown'}
                      iconColor="#fa8c16"
                    />
                  </>
                )}
              </Card>
            </Col>

            {/* Document Parsing Stats - Redesigned */}
            <Col xs={24} lg={8}>
              <Card 
                title={t('monitoring.stats.parsingStatus')} 
                size="small"
                style={{ borderRadius: 12, height: '100%' }}
                bodyStyle={{ padding: '16px' }}
                extra={
                  <a onClick={() => navigate('/tasks')} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {t('dashboard.viewAll')} <RightOutlined style={{ fontSize: 10 }} />
                  </a>
                }
              >
                {systemStats?.documents && (
                  <div>
                    {/* Main Progress Circle */}
                    <div style={{ textAlign: 'center', marginBottom: 16 }}>
                      <Progress
                        type="circle"
                        percent={parsingRate}
                        size={100}
                        strokeColor="#52c41a"
                        format={() => (
                          <div>
                            <div style={{ fontSize: 24, fontWeight: 600 }}>{parsingRate}%</div>
                            <div style={{ fontSize: 11, opacity: 0.65 }}>{t('monitoring.stats.completed')}</div>
                          </div>
                        )}
                      />
                    </div>
                    
                    {/* Status Grid */}
                    <Row gutter={8}>
                      <Col span={6}>
                        <div style={{ textAlign: 'center', padding: '8px 0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                            <span style={{ fontSize: 16, fontWeight: 600 }}>{systemStats.documents.completed}</span>
                          </div>
                          <div style={{ fontSize: 11, opacity: 0.65 }}>{t('monitoring.stats.completed')}</div>
                        </div>
                      </Col>
                      <Col span={6}>
                        <div style={{ textAlign: 'center', padding: '8px 0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            <SyncOutlined spin={systemStats.documents.running > 0} style={{ color: '#1890ff', fontSize: 12 }} />
                            <span style={{ fontSize: 16, fontWeight: 600, color: '#1890ff' }}>{systemStats.documents.running}</span>
                          </div>
                          <div style={{ fontSize: 11, opacity: 0.65 }}>{t('monitoring.stats.running')}</div>
                        </div>
                      </Col>
                      <Col span={6}>
                        <div style={{ textAlign: 'center', padding: '8px 0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            <ClockCircleOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />
                            <span style={{ fontSize: 16, fontWeight: 600 }}>{systemStats.documents.pending}</span>
                          </div>
                          <div style={{ fontSize: 11, opacity: 0.65 }}>{t('monitoring.stats.pending')}</div>
                        </div>
                      </Col>
                      <Col span={6}>
                        <div style={{ textAlign: 'center', padding: '8px 0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 12 }} />
                            <span style={{ fontSize: 16, fontWeight: 600, color: '#ff4d4f' }}>{systemStats.documents.failed}</span>
                          </div>
                          <div style={{ fontSize: 11, opacity: 0.65 }}>{t('monitoring.stats.failed')}</div>
                        </div>
                      </Col>
                    </Row>
                    
                    {/* Total Size */}
                    <div style={{ 
                      marginTop: 12, 
                      padding: '10px 12px', 
                      backgroundColor: 'var(--bg-card-hover, rgba(0,0,0,0.02))',
                      borderRadius: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <Text style={{ fontSize: 12, opacity: 0.65 }}>{t('monitoring.stats.totalSize')}</Text>
                      <Text strong>{formatBytes(systemStats.documents.total_size)}</Text>
                    </div>
                  </div>
                )}
              </Card>
            </Col>

            {/* Recent Activity - Redesigned */}
            <Col xs={24} lg={8}>
              <Card 
                title={t('monitoring.stats.recentActivity')} 
                size="small"
                style={{ borderRadius: 12, height: '100%' }}
                bodyStyle={{ padding: '16px' }}
              >
                {systemStats?.recent_activity && (
                  <div>
                    {/* Activity Stats */}
                    <Row gutter={16} style={{ marginBottom: 20 }}>
                      <Col span={8}>
                        <ActivityStatItem
                          icon={<UserOutlined />}
                          value={systemStats.recent_activity.new_users_24h}
                          label={t('monitoring.stats.newUsers24h')}
                          color="#52c41a"
                        />
                      </Col>
                      <Col span={8}>
                        <ActivityStatItem
                          icon={<FileOutlined />}
                          value={systemStats.recent_activity.new_docs_24h}
                          label={t('monitoring.stats.newDocs24h')}
                          color="#1890ff"
                        />
                      </Col>
                      <Col span={8}>
                        <ActivityStatItem
                          icon={<MessageOutlined />}
                          value={systemStats.recent_activity.new_sessions_24h}
                          label={t('monitoring.stats.newSessions24h')}
                          color="#722ed1"
                        />
                      </Col>
                    </Row>
                    
                    {/* Token Usage */}
                    <div style={{ 
                      marginTop: 12, 
                      padding: '10px 12px', 
                      backgroundColor: 'var(--bg-card-hover, rgba(0,0,0,0.02))',
                      borderRadius: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <Text style={{ fontSize: 12, opacity: 0.65 }}>{t('monitoring.stats.tokenUsage')}</Text>
                      <Text strong>{formatNumber(systemStats.datasets?.total_tokens || 0)} tokens</Text>
                    </div>
                    {/* Total Chunks */}
                    <div style={{ 
                      marginTop: 8, 
                      padding: '10px 12px', 
                      backgroundColor: 'var(--bg-card-hover, rgba(0,0,0,0.02))',
                      borderRadius: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <Text style={{ fontSize: 12, opacity: 0.65 }}>{t('monitoring.stats.totalChunks')}</Text>
                      <Text strong>{formatNumber(systemStats.datasets?.total_chunks || 0)}</Text>
                    </div>
                  </div>
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
