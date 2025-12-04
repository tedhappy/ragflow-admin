import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'umi';
import { Layout, Menu, Avatar, Dropdown, Space, theme, ConfigProvider, message } from 'antd';
import type { MenuProps } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
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
  GithubOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeToggle from '@/components/ThemeToggle';
import { ThemeProvider, useTheme } from '@/components/ThemeProvider';
import { useAuthStore } from '@/stores/auth';
import { Language } from '@/locales';

import styles from './BasicLayout.less';

const { Header, Sider, Content } = Layout;

// Inner layout component that uses theme context
const LayoutContent: React.FC = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const { token } = theme.useToken();
  const { isDark } = useTheme();
  const { user, logout } = useAuthStore();

  // Get Ant Design locale based on current language
  const antdLocale = i18n.language === Language.Zh ? zhCN : enUS;
  
  // Ant Design theme config for dark mode
  const antdTheme = {
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: '#1677ff',
    },
  };

  // Handle user menu click
  const handleUserMenuClick: MenuProps['onClick'] = async ({ key }) => {
    if (key === 'logout') {
      await logout();
      message.success(t('header.logoutSuccess'));
      navigate('/login', { replace: true });
    }
  };

  const menuItems = [
    { 
      key: '/dashboard', 
      icon: <DashboardOutlined />, 
      label: <Link to="/dashboard">{t('menu.dashboard')}</Link> 
    },
    { 
      key: '/datasets', 
      icon: <DatabaseOutlined />, 
      label: <Link to="/datasets">{t('menu.datasets')}</Link> 
    },
    { 
      key: '/chat', 
      icon: <MessageOutlined />, 
      label: <Link to="/chat">{t('menu.chat')}</Link> 
    },
    { 
      key: '/agents', 
      icon: <RobotOutlined />, 
      label: <Link to="/agents">{t('menu.agents')}</Link> 
    },
    { 
      key: '/settings', 
      icon: <SettingOutlined />, 
      label: <Link to="/settings">{t('menu.settings')}</Link> 
    },
  ];

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t('header.logout'),
    },
  ];

  return (
    <ConfigProvider locale={antdLocale} theme={antdTheme}>
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
            {!collapsed && <span className={styles.title}>{t('header.title')}</span>}
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
              <span className={styles.headerTitle}>{t('header.console')}</span>
            </Space>
            <div className={styles.headerRight}>
              <div 
                className={styles.iconCircle}
                onClick={() => window.open('https://github.com/tedhappy/ragflow-admin', '_blank')}
                title="GitHub"
              >
                <GithubOutlined />
              </div>
              <ThemeToggle />
              <LanguageSwitcher />
              <Dropdown 
                menu={{ items: userMenuItems, onClick: handleUserMenuClick }} 
                placement="bottomRight"
              >
                <Space style={{ cursor: 'pointer' }}>
                  <Avatar 
                    size="small" 
                    icon={<UserOutlined />} 
                    style={{ backgroundColor: token.colorPrimary }}
                  />
                  <span>{user?.username || t('header.profile')}</span>
                </Space>
              </Dropdown>
            </div>
          </Header>
          <Content className={styles.content}>
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
};

// Main layout component that wraps with ThemeProvider
const BasicLayout: React.FC = () => {
  return (
    <ThemeProvider>
      <LayoutContent />
    </ThemeProvider>
  );
};

export default BasicLayout;
