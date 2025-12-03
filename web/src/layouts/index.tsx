import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'umi';
import { Layout, Menu, Avatar, Dropdown, Space, theme } from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  DatabaseOutlined,
  MessageOutlined,
  RobotOutlined,
  SettingOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
} from '@ant-design/icons';

import styles from './index.less';

const { Header, Sider, Content } = Layout;

const BasicLayout: React.FC = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { token } = theme.useToken();

  const menuItems = [
    { 
      key: '/dashboard', 
      icon: <DashboardOutlined />, 
      label: <Link to="/dashboard">Dashboard</Link> 
    },
    { 
      key: '/datasets', 
      icon: <DatabaseOutlined />, 
      label: <Link to="/datasets">Datasets</Link> 
    },
    { 
      key: '/chat', 
      icon: <MessageOutlined />, 
      label: <Link to="/chat">Chat</Link> 
    },
    { 
      key: '/agents', 
      icon: <RobotOutlined />, 
      label: <Link to="/agents">Agents</Link> 
    },
    { 
      key: '/settings', 
      icon: <SettingOutlined />, 
      label: <Link to="/settings">Settings</Link> 
    },
  ];

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
    },
  ];

  return (
    <Layout className={styles.layout}>
      <Sider 
        theme="light" 
        width={220}
        collapsedWidth={80}
        collapsed={collapsed}
        className={styles.sider}
      >
        <div className={styles.logo}>
          <img src="/logo.svg" alt="logo" />
          {!collapsed && <span className={styles.title}>RAGFlow Admin</span>}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          className={styles.menu}
        />
      </Sider>
      <Layout>
        <Header className={styles.header}>
          <Space>
            {React.createElement(
              collapsed ? MenuUnfoldOutlined : MenuFoldOutlined,
              {
                onClick: () => setCollapsed(!collapsed),
                style: { fontSize: 18, cursor: 'pointer' },
              }
            )}
            <span className={styles.headerTitle}>Admin Console</span>
          </Space>
          <div className={styles.headerRight}>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar 
                  size="small" 
                  icon={<UserOutlined />} 
                  style={{ backgroundColor: token.colorPrimary }}
                />
                <span>Admin</span>
              </Space>
            </Dropdown>
          </div>
        </Header>
        <Content className={styles.content}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default BasicLayout;
