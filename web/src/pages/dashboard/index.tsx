import React from 'react';
import { Card, Row, Col, Statistic, Typography } from 'antd';
import { 
  DatabaseOutlined, 
  MessageOutlined, 
  RobotOutlined, 
  FileOutlined,
  UserOutlined,
  TeamOutlined,
} from '@ant-design/icons';

const { Title } = Typography;

const Dashboard: React.FC = () => {
  const statisticsData = [
    { title: 'Datasets', value: 0, icon: <DatabaseOutlined />, color: '#1677ff' },
    { title: 'Documents', value: 0, icon: <FileOutlined />, color: '#52c41a' },
    { title: 'Chats', value: 0, icon: <MessageOutlined />, color: '#722ed1' },
    { title: 'Agents', value: 0, icon: <RobotOutlined />, color: '#fa8c16' },
    { title: 'Users', value: 0, icon: <UserOutlined />, color: '#eb2f96' },
    { title: 'Teams', value: 0, icon: <TeamOutlined />, color: '#13c2c2' },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>Dashboard Overview</Title>
      
      <Row gutter={[16, 16]}>
        {statisticsData.map((item) => (
          <Col xs={24} sm={12} md={8} lg={8} xl={4} key={item.title}>
            <Card hoverable>
              <Statistic
                title={item.title}
                value={item.value}
                prefix={React.cloneElement(item.icon as React.ReactElement, {
                  style: { color: item.color },
                })}
              />
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default Dashboard;
