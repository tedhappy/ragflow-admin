//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

/**
 * User Detail Page
 *
 * Displays detailed user information including datasets and agents.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, Button, Space, Typography, Spin, Tag, Tabs, Table, Avatar, Descriptions,
  message 
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { 
  ArrowLeftOutlined, UserOutlined, DatabaseOutlined, RobotOutlined, MessageOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { userApi, UserDetail, UserDataset, UserAgent, UserChat } from '@/services/api';
import ErrorBoundary from '@/components/ErrorBoundary';
import { translateErrorMessage } from '@/utils/i18n';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const UserDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserDetail | null>(null);
  const [datasets, setDatasets] = useState<UserDataset[]>([]);
  const [datasetsLoading, setDatasetsLoading] = useState(false);
  const [datasetsTotal, setDatasetsTotal] = useState(0);
  const [datasetsPage, setDatasetsPage] = useState(1);
  const [agents, setAgents] = useState<UserAgent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsTotal, setAgentsTotal] = useState(0);
  const [agentsPage, setAgentsPage] = useState(1);
  const [chats, setChats] = useState<UserChat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [chatsTotal, setChatsTotal] = useState(0);
  const [chatsPage, setChatsPage] = useState(1);

  useEffect(() => {
    if (userId) {
      loadUser();
      loadDatasets(1);
      loadAgents(1);
      loadChats(1);
    }
  }, [userId]);

  const loadUser = async () => {
    try {
      setLoading(true);
      const data = await userApi.get(userId!);
      setUser(data);
    } catch (error: any) {
      message.error(translateErrorMessage(error.message, t) || t('users.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const loadDatasets = async (page: number) => {
    try {
      setDatasetsLoading(true);
      const result = await userApi.getDatasets(userId!, { page, page_size: 10 });
      setDatasets(result.items || []);
      setDatasetsTotal(result.total || 0);
      setDatasetsPage(page);
    } catch (error: any) {
      message.error(translateErrorMessage(error.message, t) || t('users.loadDatasetsFailed'));
    } finally {
      setDatasetsLoading(false);
    }
  };

  const loadAgents = async (page: number) => {
    try {
      setAgentsLoading(true);
      const result = await userApi.getAgents(userId!, { page, page_size: 10 });
      setAgents(result.items || []);
      setAgentsTotal(result.total || 0);
      setAgentsPage(page);
    } catch (error: any) {
      message.error(translateErrorMessage(error.message, t) || t('users.loadAgentsFailed'));
    } finally {
      setAgentsLoading(false);
    }
  };

  const loadChats = async (page: number) => {
    try {
      setChatsLoading(true);
      const result = await userApi.getChats(userId!, { page, page_size: 10 });
      setChats(result.items || []);
      setChatsTotal(result.total || 0);
      setChatsPage(page);
    } catch (error: any) {
      message.error(translateErrorMessage(error.message, t) || t('users.loadChatsFailed'));
    } finally {
      setChatsLoading(false);
    }
  };

  const datasetColumns: ColumnsType<UserDataset> = [
    {
      title: t('common.name'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: t('datasets.documents'),
      dataIndex: 'doc_num',
      key: 'doc_num',
      width: 70,
      align: 'center',
      render: (val) => <Tag color="blue">{val || 0}</Tag>,
    },
    {
      title: t('datasets.chunks'),
      dataIndex: 'chunk_num',
      key: 'chunk_num',
      width: 80,
      align: 'center',
      render: (val) => <Tag color="green">{val || 0}</Tag>,
    },
    {
      title: 'Tokens',
      dataIndex: 'token_num',
      key: 'token_num',
      width: 85,
      align: 'right',
      render: (val) => {
        if (!val) return '-';
        if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
        return val;
      },
    },
    {
      title: t('users.detail.permission'),
      dataIndex: 'permission',
      key: 'permission',
      width: 100,
      align: 'center',
      render: (val) => {
        const permMap: Record<string, { color: string; text: string }> = {
          'me': { color: 'default', text: t('users.detail.permissionPrivate') },
          'team': { color: 'blue', text: t('users.detail.permissionTeam') },
        };
        const info = permMap[val] || { color: 'default', text: val || '-' };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: t('common.updated'),
      dataIndex: 'update_time',
      key: 'update_time',
      width: 130,
      render: (val) => val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-',
    },
  ];

  const agentColumns: ColumnsType<UserAgent> = [
    {
      title: t('common.name'),
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: t('common.description'),
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: true,
      render: (val) => val || '-',
    },
    {
      title: t('users.detail.agentType'),
      dataIndex: 'canvas_type',
      key: 'canvas_type',
      width: 80,
      align: 'center',
      render: (val) => {
        const typeMap: Record<string, { color: string; text: string }> = {
          'agent_canvas': { color: 'purple', text: t('users.detail.typeAgent') },
          'dataflow_canvas': { color: 'blue', text: t('users.detail.typeFlow') },
        };
        const info = typeMap[val] || { color: 'default', text: val || '-' };
        return val ? <Tag color={info.color}>{info.text}</Tag> : '-';
      },
    },
    {
      title: t('common.updated'),
      dataIndex: 'update_time',
      key: 'update_time',
      width: 130,
      render: (val) => val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-',
    },
  ];

  const chatColumns: ColumnsType<UserChat> = [
    {
      title: t('common.name'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: t('chat.sessions'),
      dataIndex: 'session_count',
      key: 'session_count',
      width: 80,
      align: 'center',
      render: (val) => <Tag color="purple">{val || 0}</Tag>,
    },
    {
      title: t('chat.status'),
      dataIndex: 'status',
      key: 'status',
      width: 80,
      align: 'center',
      render: (val) => (
        <Tag color={val === '1' ? 'success' : 'default'}>
          {val === '1' ? t('chat.statusEnabled') : t('chat.statusDisabled')}
        </Tag>
      ),
    },
    {
      title: t('common.updated'),
      dataIndex: 'update_time',
      key: 'update_time',
      width: 130,
      render: (val) => val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-',
    },
  ];

  const tabItems = [
    {
      key: 'datasets',
      label: (
        <Space>
          <DatabaseOutlined />
          {t('users.detail.datasets')}
          <Tag>{datasetsTotal}</Tag>
        </Space>
      ),
      children: (
        <Table
          columns={datasetColumns}
          dataSource={datasets}
          rowKey="id"
          loading={datasetsLoading}
          size="small"
          pagination={{
            current: datasetsPage,
            pageSize: 10,
            total: datasetsTotal,
            showTotal: (total) => t('common.total', { count: total }),
            onChange: (page) => loadDatasets(page),
          }}
          locale={{
            emptyText: t('users.detail.noDatasets'),
          }}
        />
      ),
    },
    {
      key: 'agents',
      label: (
        <Space>
          <RobotOutlined />
          {t('users.detail.agents')}
          <Tag>{agentsTotal}</Tag>
        </Space>
      ),
      children: (
        <Table
          columns={agentColumns}
          dataSource={agents}
          rowKey="id"
          loading={agentsLoading}
          size="small"
          pagination={{
            current: agentsPage,
            pageSize: 10,
            total: agentsTotal,
            showTotal: (total) => t('common.total', { count: total }),
            onChange: (page) => loadAgents(page),
          }}
          locale={{
            emptyText: t('users.detail.noAgents'),
          }}
        />
      ),
    },
    {
      key: 'chats',
      label: (
        <Space>
          <MessageOutlined />
          {t('users.detail.chats')}
          <Tag>{chatsTotal}</Tag>
        </Space>
      ),
      children: (
        <Table
          columns={chatColumns}
          dataSource={chats}
          rowKey="id"
          loading={chatsLoading}
          size="small"
          pagination={{
            current: chatsPage,
            pageSize: 10,
            total: chatsTotal,
            showTotal: (total) => t('common.total', { count: total }),
            onChange: (page) => loadChats(page),
          }}
          locale={{
            emptyText: t('users.detail.noChats'),
          }}
        />
      ),
    },
  ];

  return (
    <ErrorBoundary>
      <Spin spinning={loading} size="large">
        <div style={{ minHeight: loading ? 400 : 'auto', visibility: loading ? 'hidden' : 'visible' }}>
          {/* Back button and title - same style as documents page */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
            <Button 
              type="text" 
              icon={<ArrowLeftOutlined />} 
              onClick={() => navigate('/users')}
              style={{ marginRight: 8 }}
            />
            {user && (
              <Space>
                <Title level={4} style={{ margin: 0 }}>{user.email}</Title>
                <Tag color={user.status === '1' ? 'success' : 'default'}>
                  {user.status === '1' ? t('users.active') : t('users.inactive')}
                </Tag>
              </Space>
            )}
          </div>

          {user && (
            <>
              {/* User info card */}
              <Card style={{ marginBottom: 16 }}>
                <Space align="start" size={16}>
                  <Avatar 
                    size={64} 
                    src={user.avatar}
                    icon={!user.avatar && <UserOutlined />}
                    style={{ backgroundColor: !user.avatar ? '#1677ff' : undefined }}
                  />
                  <div style={{ flex: 1 }}>
                    {user.nickname && (
                      <Title level={5} style={{ margin: 0, marginBottom: 8 }}>{user.nickname}</Title>
                    )}
                    <Descriptions column={{ xs: 1, sm: 2, md: 3, lg: 4 }} size="small">
                      <Descriptions.Item label={t('users.detail.lastLoginTime')}>
                        {user.last_login_time ? dayjs(user.last_login_time).format('YYYY-MM-DD HH:mm:ss') : '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label={t('users.detail.createTime')}>
                        {user.create_time ? dayjs(user.create_time).format('YYYY-MM-DD HH:mm:ss') : '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label={t('users.detail.updateTime')}>
                        {user.update_time ? dayjs(user.update_time).format('YYYY-MM-DD HH:mm:ss') : '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label={t('users.detail.language')}>
                        {user.language || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label={t('users.detail.isAnonymous')}>
                        {user.is_anonymous === '1' ? t('common.yes') : t('common.no')}
                      </Descriptions.Item>
                      <Descriptions.Item label={t('users.detail.isSuperuser')}>
                        {user.is_superuser ? t('common.yes') : t('common.no')}
                      </Descriptions.Item>
                    </Descriptions>
                  </div>
                </Space>
              </Card>

              {/* Datasets and Agents tabs */}
              <Card>
                <Tabs items={tabItems} />
              </Card>
            </>
          )}
        </div>
      </Spin>
    </ErrorBoundary>
  );
};

export default UserDetailPage;
