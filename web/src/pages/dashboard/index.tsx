import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Typography, Spin, message } from 'antd';
import { 
  DatabaseOutlined, 
  MessageOutlined, 
  RobotOutlined, 
  FileOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { dashboardApi } from '@/services/api';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useConnectionCheck } from '@/hooks/useConnectionCheck';
import { translateErrorMessage } from '@/utils/i18n';

const { Title } = Typography;

interface Stats {
  dataset_count: number;
  document_count: number;
  chat_count: number;
  agent_count: number;
}

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const { checking, connected } = useConnectionCheck();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    dataset_count: 0,
    document_count: 0,
    chat_count: 0,
    agent_count: 0,
  });

  useEffect(() => {
    if (!connected) return;
    
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await dashboardApi.getStats();
        setStats(data);
      } catch (error: any) {
        message.error(translateErrorMessage(error.message, t) || t('dashboard.fetchFailed'));
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [connected, t]);

  const statisticsData = [
    { title: t('dashboard.datasets'), value: stats.dataset_count, icon: <DatabaseOutlined />, color: '#1677ff' },
    { title: t('dashboard.documents'), value: stats.document_count, icon: <FileOutlined />, color: '#52c41a' },
    { title: t('dashboard.chats'), value: stats.chat_count, icon: <MessageOutlined />, color: '#722ed1' },
    { title: t('dashboard.agents'), value: stats.agent_count, icon: <RobotOutlined />, color: '#fa8c16' },
  ];

  const isLoading = checking || loading;

  return (
    <ErrorBoundary>
      <Spin spinning={isLoading} size="large">
        <div style={{ minHeight: isLoading ? 300 : 'auto', visibility: isLoading ? 'hidden' : 'visible' }}>
          <Title level={4} style={{ marginBottom: 24, textAlign: 'center' }}>{t('dashboard.title')}</Title>
          <Row gutter={[16, 16]} justify="center">
            {statisticsData.map((item) => (
              <Col xs={24} sm={12} md={8} lg={6} key={item.title}>
                <Card hoverable>
                  <Statistic
                    title={<span style={{ display: 'block', textAlign: 'center' }}>{item.title}</span>}
                    value={item.value}
                    valueStyle={{ textAlign: 'center' }}
                    prefix={React.cloneElement(item.icon as React.ReactElement, {
                      style: { color: item.color, fontSize: 24 },
                    })}
                  />
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      </Spin>
    </ErrorBoundary>
  );
};

export default Dashboard;
