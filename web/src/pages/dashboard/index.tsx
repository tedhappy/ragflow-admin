import React, { useEffect, useState } from 'react';
import { Card, Typography, Spin, message } from 'antd';
import { 
  DatabaseOutlined, 
  MessageOutlined, 
  RobotOutlined, 
  FileOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
  user_count: number;
}

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
    { title: t('dashboard.datasets'), value: stats.dataset_count, icon: <DatabaseOutlined />, color: '#1677ff', bgColor: '#e6f4ff', path: '/datasets' },
    { title: t('dashboard.documents'), value: stats.document_count, icon: <FileOutlined />, color: '#52c41a', bgColor: '#f6ffed', path: '/datasets' },
    { title: t('dashboard.chats'), value: stats.chat_count, icon: <MessageOutlined />, color: '#722ed1', bgColor: '#f9f0ff', path: '/chat' },
    { title: t('dashboard.agents'), value: stats.agent_count, icon: <RobotOutlined />, color: '#fa8c16', bgColor: '#fff7e6', path: '/agents' },
    { title: t('dashboard.users'), value: stats.user_count, icon: <UserOutlined />, color: '#eb2f96', bgColor: '#fff0f6', path: '/users' },
  ];

  const isLoading = checking || loading;

  return (
    <ErrorBoundary>
      <Spin spinning={isLoading} size="large">
        <div style={{ minHeight: isLoading ? 300 : 'auto', visibility: isLoading ? 'hidden' : 'visible' }}>
          <div style={{ marginBottom: 16, textAlign: 'center' }}>
            <Title level={4} style={{ margin: 0 }}>{t('dashboard.title')}</Title>
          </div>
          <div style={{ 
            display: 'flex', 
            gap: 16, 
            padding: '20px 0',
          }}>
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
                bodyStyle={{ padding: '24px 20px' }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 16 
                }}>
                  <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    backgroundColor: item.bgColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {React.cloneElement(item.icon as React.ReactElement, {
                      style: { color: item.color, fontSize: 28 },
                    })}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ 
                      fontSize: 13, 
                      opacity: 0.65,
                      marginBottom: 4,
                    }}>
                      {item.title}
                    </div>
                    <div style={{ 
                      fontSize: 28, 
                      fontWeight: 600,
                      lineHeight: 1,
                    }}>
                      {item.value}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </Spin>
    </ErrorBoundary>
  );
};

export default Dashboard;
