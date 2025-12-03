import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Typography, Skeleton, message } from 'antd';
import { 
  DatabaseOutlined, 
  MessageOutlined, 
  RobotOutlined, 
  FileOutlined,
} from '@ant-design/icons';
import { dashboardApi } from '@/services/api';
import ErrorBoundary from '@/components/ErrorBoundary';

const { Title } = Typography;

interface Stats {
  dataset_count: number;
  document_count: number;
  chat_count: number;
  agent_count: number;
}

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    dataset_count: 0,
    document_count: 0,
    chat_count: 0,
    agent_count: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await dashboardApi.getStats();
        setStats(data);
      } catch (error: any) {
        message.error(error.message || 'Failed to fetch statistics');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const statisticsData = [
    { title: 'Datasets', value: stats.dataset_count, icon: <DatabaseOutlined />, color: '#1677ff' },
    { title: 'Documents', value: stats.document_count, icon: <FileOutlined />, color: '#52c41a' },
    { title: 'Chats', value: stats.chat_count, icon: <MessageOutlined />, color: '#722ed1' },
    { title: 'Agents', value: stats.agent_count, icon: <RobotOutlined />, color: '#fa8c16' },
  ];

  // Show skeleton on initial load
  if (loading) {
    return (
      <div>
        <Title level={4} style={{ marginBottom: 24 }}>Dashboard Overview</Title>
        <Row gutter={[16, 16]}>
          {[1, 2, 3, 4].map((i) => (
            <Col xs={24} sm={12} md={8} lg={6} key={i}>
              <Card>
                <Skeleton active paragraph={{ rows: 1 }} />
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div>
        <Title level={4} style={{ marginBottom: 24 }}>Dashboard Overview</Title>
        <Row gutter={[16, 16]}>
          {statisticsData.map((item) => (
            <Col xs={24} sm={12} md={8} lg={6} key={item.title}>
              <Card hoverable>
                <Statistic
                  title={item.title}
                  value={item.value}
                  prefix={React.cloneElement(item.icon as React.ReactElement, {
                    style: { color: item.color, fontSize: 24 },
                  })}
                />
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </ErrorBoundary>
  );
};

export default Dashboard;
