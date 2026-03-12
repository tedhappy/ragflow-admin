//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Button, Space, Typography, Spin, Tag, Tabs, Table, Avatar, Descriptions,
  message, Modal, Select, Popconfirm
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowLeftOutlined, UserOutlined, DatabaseOutlined, RobotOutlined, MessageOutlined,
  TeamOutlined, PlusOutlined, DeleteOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { userApi, teamApi, UserDetail, UserDataset, UserAgent, UserChat, UserTeamRelations, TeamRelation, RagflowUser } from '@/services/api';
import ErrorBoundary from '@/components/ErrorBoundary';
import { translateErrorMessage } from '@/utils/i18n';
import dayjs from 'dayjs';

const { Title } = Typography;

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
  const [datasetsPageSize, setDatasetsPageSize] = useState(10);
  const [agents, setAgents] = useState<UserAgent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsTotal, setAgentsTotal] = useState(0);
  const [agentsPage, setAgentsPage] = useState(1);
  const [agentsPageSize, setAgentsPageSize] = useState(10);
  const [chats, setChats] = useState<UserChat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [chatsTotal, setChatsTotal] = useState(0);
  const [chatsPage, setChatsPage] = useState(1);
  const [chatsPageSize, setChatsPageSize] = useState(10);
  const [teamRelations, setTeamRelations] = useState<UserTeamRelations | null>(null);
  const [teamRelationsLoading, setTeamRelationsLoading] = useState(false);
  const [addMemberModalVisible, setAddMemberModalVisible] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>();
  const [selectedRole, setSelectedRole] = useState<string>('normal');
  const [allUsers, setAllUsers] = useState<RagflowUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [addingMember, setAddingMember] = useState(false);

  useEffect(() => {
    if (userId) {
      loadUser();
      loadDatasets(1);
      loadAgents(1);
      loadChats(1);
      loadTeamRelations();
    }
  }, [userId]);

  useEffect(() => {
    if (addMemberModalVisible) {
      loadAllUsers();
    }
  }, [addMemberModalVisible]);

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

  const loadDatasets = async (page: number, pageSize: number = datasetsPageSize) => {
    try {
      setDatasetsLoading(true);
      const result = await userApi.getDatasets(userId!, { page, page_size: pageSize });
      setDatasets(result.items || []);
      setDatasetsTotal(result.total || 0);
      setDatasetsPage(page);
      setDatasetsPageSize(pageSize);
    } catch (error: any) {
      message.error(translateErrorMessage(error.message, t) || t('users.loadDatasetsFailed'));
    } finally {
      setDatasetsLoading(false);
    }
  };

  const loadAgents = async (page: number, pageSize: number = agentsPageSize) => {
    try {
      setAgentsLoading(true);
      const result = await userApi.getAgents(userId!, { page, page_size: pageSize });
      setAgents(result.items || []);
      setAgentsTotal(result.total || 0);
      setAgentsPage(page);
      setAgentsPageSize(pageSize);
    } catch (error: any) {
      message.error(translateErrorMessage(error.message, t) || t('users.loadAgentsFailed'));
    } finally {
      setAgentsLoading(false);
    }
  };

  const loadChats = async (page: number, pageSize: number = chatsPageSize) => {
    try {
      setChatsLoading(true);
      const result = await userApi.getChats(userId!, { page, page_size: pageSize });
      setChats(result.items || []);
      setChatsTotal(result.total || 0);
      setChatsPage(page);
      setChatsPageSize(pageSize);
    } catch (error: any) {
      message.error(translateErrorMessage(error.message, t) || t('users.loadChatsFailed'));
    } finally {
      setChatsLoading(false);
    }
  };

  const loadTeamRelations = async () => {
    try {
      setTeamRelationsLoading(true);
      const result = await teamApi.getUserRelations(userId!);
      setTeamRelations(result);
    } catch (error: any) {
      message.error(translateErrorMessage(error.message, t) || t('teams.loadFailed'));
    } finally {
      setTeamRelationsLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      setUsersLoading(true);
      const result = await userApi.list({ page: 1, page_size: 1000 });
      setAllUsers(result.items || []);
    } catch (error: any) {
      message.error(translateErrorMessage(error.message, t) || t('users.loadFailed'));
    } finally {
      setUsersLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId) {
      message.warning(t('teams.selectUser'));
      return;
    }

    try {
      setAddingMember(true);
      await teamApi.addMember(userId!, selectedUserId, selectedRole);
      message.success(t('teams.addMemberSuccess'));
      setAddMemberModalVisible(false);
      setSelectedUserId(undefined);
      setSelectedRole('normal');
      loadTeamRelations();
    } catch (error: any) {
      message.error(translateErrorMessage(error.message, t) || t('teams.addMemberFailed'));
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await teamApi.removeMember(userId!, memberId);
      message.success(t('teams.removeMemberSuccess'));
      loadTeamRelations();
    } catch (error: any) {
      message.error(translateErrorMessage(error.message, t) || t('teams.removeMemberFailed'));
    }
  };

  const getRoleTag = (role: string) => {
    const roleMap: Record<string, { color: string; text: string }> = {
      owner: { color: 'gold', text: t('teams.roleOwner') },
      normal: { color: 'green', text: t('teams.roleMember') },
      invite: { color: 'orange', text: t('teams.rolePending') },
      admin: { color: 'blue', text: t('teams.roleAdmin') },
    };
    const config = roleMap[role] || { color: 'default', text: role };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 我的团队成员列表 - 显示成员信息
  const ownedTeamColumns: ColumnsType<TeamRelation> = [
    {
      title: t('teams.member'),
      key: 'member',
      render: (_, record) => (
        <Space>
          <Avatar
            src={record.member_avatar}
            icon={<UserOutlined />}
            size="small"
          />
          <div>
            <Space>
              <span>{record.member_nickname || record.nickname || '-'}</span>
              {getRoleTag(record.role)}
            </Space>
            <div style={{ fontSize: '12px', color: '#999' }}>
              {record.member_email || record.email || '-'}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: t('teams.joinedAt'),
      dataIndex: 'create_date',
      key: 'create_date',
      width: 180,
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 100,
      align: 'center',
      render: (_, record) => (
        record.role !== 'owner' ? (
          <Popconfirm
            title={t('teams.removeConfirm')}
            onConfirm={() => handleRemoveMember(record.user_id)}
            okText={t('common.yes')}
            cancelText={t('common.no')}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
            >
              {t('common.delete')}
            </Button>
          </Popconfirm>
        ) : null
      ),
    },
  ];

  // 已加入的团队列表 - 显示团队所有者信息
  const joinedTeamColumns: ColumnsType<TeamRelation> = [
    {
      title: t('teams.teamOwner'),
      key: 'owner',
      render: (_, record) => (
        <Space>
          <Avatar
            src={record.owner_avatar}
            icon={<UserOutlined />}
            size="small"
          />
          <div>
            <Space>
              <span>{record.owner_nickname || '-'}</span>
              {getRoleTag(record.role)}
            </Space>
            <div style={{ fontSize: '12px', color: '#999' }}>
              {record.owner_email || '-'}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: t('teams.joinedAt'),
      dataIndex: 'create_date',
      key: 'create_date',
      width: 180,
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-',
    },
  ];

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
      width: 160,
      render: (val) => val ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : '-',
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
      width: 160,
      render: (val) => val ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : '-',
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
      width: 160,
      render: (val) => val ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : '-',
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
            pageSize: datasetsPageSize,
            total: datasetsTotal,
            showSizeChanger: true,
            showTotal: (total) => t('common.total', { count: total }),
            onChange: (page, pageSize) => loadDatasets(page, pageSize),
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
            pageSize: agentsPageSize,
            total: agentsTotal,
            showSizeChanger: true,
            showTotal: (total) => t('common.total', { count: total }),
            onChange: (page, pageSize) => loadAgents(page, pageSize),
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
            pageSize: chatsPageSize,
            total: chatsTotal,
            showSizeChanger: true,
            showTotal: (total) => t('common.total', { count: total }),
            onChange: (page, pageSize) => loadChats(page, pageSize),
          }}
          locale={{
            emptyText: t('users.detail.noChats'),
          }}
        />
      ),
    },
    {
      key: 'teams',
      label: (
        <Space>
          <TeamOutlined />
          {t('users.detail.teams')}
          <Tag>
            {(teamRelations?.owned_teams.length || 0) +
              (teamRelations?.joined_teams.length || 0) +
              (teamRelations?.pending_invites.length || 0)}
          </Tag>
        </Space>
      ),
      children: (
        <Spin spinning={teamRelationsLoading}>
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            {/* 我的团队成员 */}
            <Card
              size="small"
              title={
                <Space>
                  <TeamOutlined />
                  {t('teams.ownedTeams')}
                  <Tag color="blue">{teamRelations?.owned_teams.length || 0}</Tag>
                </Space>
              }
              extra={
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => setAddMemberModalVisible(true)}
                >
                  {t('teams.addMember')}
                </Button>
              }
            >
              <Table
                columns={ownedTeamColumns}
                dataSource={teamRelations?.owned_teams || []}
                rowKey="id"
                size="small"
                pagination={false}
                locale={{
                  emptyText: t('teams.noMembers'),
                }}
              />
            </Card>

            {/* 已加入的团队 */}
            <Card
              size="small"
              title={
                <Space>
                  <UserOutlined />
                  {t('teams.joinedTeams')}
                  <Tag color="green">{teamRelations?.joined_teams.length || 0}</Tag>
                </Space>
              }
            >
              <Table
                columns={joinedTeamColumns}
                dataSource={teamRelations?.joined_teams || []}
                rowKey="id"
                size="small"
                pagination={false}
                locale={{
                  emptyText: t('teams.noJoinedTeams'),
                }}
              />
            </Card>

            {/* 待处理邀请 */}
            {(teamRelations?.pending_invites.length || 0) > 0 && (
              <Card
                size="small"
                title={
                  <Space>
                    <MessageOutlined />
                    {t('teams.pendingInvites')}
                    <Tag color="orange">{teamRelations?.pending_invites.length || 0}</Tag>
                  </Space>
                }
              >
                <Table
                  columns={joinedTeamColumns}
                  dataSource={teamRelations?.pending_invites || []}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  locale={{
                    emptyText: t('teams.noPendingInvites'),
                  }}
                />
              </Card>
            )}
          </Space>
        </Spin>
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

      <Modal
        title={t('teams.addMember')}
        open={addMemberModalVisible}
        onOk={handleAddMember}
        onCancel={() => {
          setAddMemberModalVisible(false);
          setSelectedUserId(undefined);
          setSelectedRole('normal');
        }}
        confirmLoading={addingMember}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        width={480}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('teams.selectUserToAdd')}</div>
          <Select
            style={{ width: '100%' }}
            placeholder={t('teams.selectUser')}
            value={selectedUserId}
            onChange={setSelectedUserId}
            loading={usersLoading}
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={allUsers
              .filter(u => u.id !== userId)
              .map(u => ({
                label: `${u.nickname || u.email} (${u.email})`,
                value: u.id,
              }))}
          />
        </div>
        <div style={{
          marginTop: 16,
          padding: 12,
          background: '#f5f5f5',
          borderRadius: 4,
          fontSize: 13,
          color: '#666'
        }}>
          <div style={{ marginBottom: 4 }}>
            💡 {t('teams.addMemberTip')}
          </div>
          <div>
            • {t('teams.addMemberTipDetail')}
          </div>
        </div>
      </Modal>
    </ErrorBoundary>
  );
};

export default UserDetailPage;
