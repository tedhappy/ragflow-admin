import React from 'react';
import { Outlet, Link, useLocation } from 'umi';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  DatabaseOutlined,
  MessageOutlined,
  RobotOutlined,
  SettingOutlined,
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;

const BasicLayout: React.FC = () => {
  const location = useLocation();

  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: <Link to="/dashboard">Dashboard</Link> },
    { key: '/datasets', icon: <DatabaseOutlined />, label: <Link to="/datasets">数据集</Link> },
    { key: '/chat', icon: <MessageOutlined />, label: <Link to="/chat">聊天助手</Link> },
    { key: '/agents', icon: <RobotOutlined />, label: <Link to="/agents">智能体</Link> },
    { key: '/settings', icon: <SettingOutlined />, label: <Link to="/settings">设置</Link> },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="light" width={220}>
        <div className="h-16 flex items-center justify-center border-b">
          <span className="text-xl font-bold text-primary">RAGFlow Admin</span>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header className="bg-white border-b px-6 flex items-center">
          <span className="text-lg">后台管理系统</span>
        </Header>
        <Content className="bg-gray-50">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default BasicLayout;
