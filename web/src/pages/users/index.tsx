//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

/**
 * Users Management Page
 *
 * User administration with create, status toggle, and password reset.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Space, Card, message, Input, Typography, Spin, Tag, Badge, Modal, Form, Avatar, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, SearchOutlined, UserOutlined, PlusOutlined, KeyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { userApi, RagflowUser } from '@/services/api';
import { useTableList } from '@/hooks/useTableList';
import { useConnectionCheck } from '@/hooks/useConnectionCheck';
import ErrorBoundary from '@/components/ErrorBoundary';
import ConfirmDelete from '@/components/ConfirmDelete';
import { translateErrorMessage } from '@/utils/i18n';
import dayjs from 'dayjs';

const { Title } = Typography;

const Users: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { checking, connected } = useConnectionCheck();
  const [searchEmail, setSearchEmail] = useState('');
  const [searchNickname, setSearchNickname] = useState('');
  const [searchStatus, setSearchStatus] = useState<string | undefined>(undefined);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedUserEmail, setSelectedUserEmail] = useState<string>('');
  const [createForm] = Form.useForm();
  const [passwordForm] = Form.useForm();

  const {
    data,
    total,
    loading,
    initialLoading,
    page,
    pageSize,
    selectedRowKeys,
    setSelectedRowKeys,
    refresh,
    handlePageChange,
    handleSearch,
  } = useTableList<RagflowUser>({
    fetchFn: (params) => userApi.list(params),
    defaultPageSize: 10,
    enabled: connected,
  });

  const onSearch = () => {
    handleSearch({ 
      email: searchEmail || undefined,
      nickname: searchNickname || undefined,
      status: searchStatus,
    });
  };

  const sortedData = [...data].sort((a, b) => 
    new Date(b.create_time || 0).getTime() - new Date(a.create_time || 0).getTime()
  );

  const handleDelete = async (ids: string[]) => {
    try {
      await userApi.batchDelete(ids);
      message.success(t('common.deletedSuccess'));
      setSelectedRowKeys([]);
      refresh();
    } catch (error: any) {
      message.error(translateErrorMessage(error.message, t) || t('common.deleteFailed'));
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === '1' ? '0' : '1';
      await userApi.updateStatus(userId, newStatus);
      message.success(t('users.statusUpdated'));
      refresh();
    } catch (error: any) {
      message.error(translateErrorMessage(error.message, t) || t('users.statusUpdateFailed'));
    }
  };

  const handleCreateUser = async () => {
    try {
      const values = await createForm.validateFields();
      await userApi.create(values);
      message.success(t('users.userCreated'));
      setCreateModalVisible(false);
      createForm.resetFields();
      refresh();
    } catch (error: any) {
      message.error(translateErrorMessage(error.message, t) || t('users.createFailed'));
    }
  };

  const handleUpdatePassword = async () => {
    try {
      const values = await passwordForm.validateFields();
      await userApi.updatePassword(selectedUserId, values.password);
      message.success(t('users.passwordUpdated'));
      setPasswordModalVisible(false);
      passwordForm.resetFields();
    } catch (error: any) {
      message.error(translateErrorMessage(error.message, t) || t('users.passwordUpdateFailed'));
    }
  };

  const columns: ColumnsType<RagflowUser> = [
    { 
      title: t('users.email'), 
      dataIndex: 'email', 
      key: 'email',
      width: '25%',
      ellipsis: true,
      render: (val, record) => (
        <Space>
          <Avatar 
            src={record.avatar} 
            icon={!record.avatar && <UserOutlined />} 
            size="small" 
            style={{ backgroundColor: !record.avatar ? '#1677ff' : undefined }}
          />
          <span>{val}</span>
        </Space>
      ),
    },
    { 
      title: t('users.nickname'), 
      dataIndex: 'nickname', 
      key: 'nickname',
      width: '12%',
      ellipsis: true,
      render: (val) => val || '-',
    },
    {
      title: t('users.datasets'),
      dataIndex: 'dataset_count',
      key: 'dataset_count',
      width: 80,
      align: 'center',
      sorter: (a, b) => (a.dataset_count || 0) - (b.dataset_count || 0),
      showSorterTooltip: false,
      render: (val) => <Tag color="blue">{val || 0}</Tag>,
    },
    {
      title: t('users.agents'),
      dataIndex: 'agent_count',
      key: 'agent_count',
      width: 80,
      align: 'center',
      sorter: (a, b) => (a.agent_count || 0) - (b.agent_count || 0),
      showSorterTooltip: false,
      render: (val) => <Tag color="purple">{val || 0}</Tag>,
    },
    {
      title: t('users.chats'),
      dataIndex: 'chat_count',
      key: 'chat_count',
      width: 80,
      align: 'center',
      sorter: (a, b) => (a.chat_count || 0) - (b.chat_count || 0),
      showSorterTooltip: false,
      render: (val) => <Tag color="cyan">{val || 0}</Tag>,
    },
    {
      title: t('users.status'),
      dataIndex: 'status',
      key: 'status',
      width: 80,
      align: 'center',
      render: (val, record) => (
        <Badge 
          status={val === '1' ? 'success' : 'default'} 
          text={
            <a onClick={() => handleToggleStatus(record.id, val)}>
              {val === '1' ? t('users.active') : t('users.inactive')}
            </a>
          }
        />
      ),
    },
    {
      title: t('users.superuser'),
      dataIndex: 'is_superuser',
      key: 'is_superuser',
      width: 80,
      align: 'center',
      render: (val) => val ? <Tag color="gold">{t('users.yes')}</Tag> : <Tag>{t('users.no')}</Tag>,
    },
    { 
      title: t('common.created'), 
      dataIndex: 'create_time', 
      key: 'create_time',
      width: 150,
      align: 'center',
      sorter: (a, b) => new Date(a.create_time || 0).getTime() - new Date(b.create_time || 0).getTime(),
      showSorterTooltip: false,
      render: (val) => val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: t('common.actions'),
      key: 'action',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Button 
            type="link" 
            size="small" 
            icon={<KeyOutlined />}
            onClick={() => {
              setSelectedUserId(record.id);
              setSelectedUserEmail(record.email);
              setPasswordModalVisible(true);
            }}
            title={t('users.updatePassword')}
          />
          <ConfirmDelete onConfirm={() => handleDelete([record.id])} />
        </Space>
      ),
    },
  ];

  const isLoading = checking || initialLoading;

  return (
    <ErrorBoundary>
      <Spin spinning={isLoading} size="large">
        <div style={{ minHeight: isLoading ? 400 : 'auto', visibility: isLoading ? 'hidden' : 'visible' }}>
          <div style={{ marginBottom: 16 }}>
            <Title level={4} style={{ margin: 0 }}>{t('users.title')}</Title>
          </div>
          <Card>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <Space wrap>
                <Input
                  placeholder={t('users.searchEmail')}
                  prefix={<SearchOutlined />}
                  allowClear
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  onPressEnter={onSearch}
                  style={{ width: 180 }}
                />
                <Input
                  placeholder={t('users.searchNickname')}
                  allowClear
                  value={searchNickname}
                  onChange={(e) => setSearchNickname(e.target.value)}
                  onPressEnter={onSearch}
                  style={{ width: 150 }}
                />
                <Select
                  placeholder={t('users.searchStatus')}
                  allowClear
                  value={searchStatus}
                  onChange={(value) => {
                    setSearchStatus(value);
                    handleSearch({ 
                      email: searchEmail || undefined,
                      nickname: searchNickname || undefined,
                      status: value,
                    });
                  }}
                  style={{ width: 120 }}
                  options={[
                    { value: '1', label: t('users.active') },
                    { value: '0', label: t('users.inactive') },
                  ]}
                />
                <Button icon={<SearchOutlined />} onClick={onSearch}>{t('common.search')}</Button>
              </Space>
              <Space wrap>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
                  {t('users.createUser')}
                </Button>
                <Button icon={<ReloadOutlined />} onClick={refresh}>{t('common.refresh')}</Button>
                <ConfirmDelete
                  onConfirm={() => handleDelete(selectedRowKeys as string[])}
                  disabled={selectedRowKeys.length === 0}
                  buttonText={t('common.deleteSelected', { count: selectedRowKeys.length })}
                  buttonType="default"
                  buttonSize="middle"
                />
              </Space>
            </div>
            <Table 
              columns={columns} 
              dataSource={sortedData} 
              rowKey="id"
              loading={!initialLoading && loading}
              scroll={{ x: 800 }}
              rowSelection={{
                selectedRowKeys,
                onChange: setSelectedRowKeys,
              }}
              onRow={(record) => ({
                onClick: (e) => {
                  // Prevent navigation when clicking on checkbox or action buttons
                  const target = e.target as HTMLElement;
                  if (target.closest('.ant-checkbox-wrapper') || target.closest('button') || target.closest('a')) {
                    return;
                  }
                  navigate(`/users/${record.id}`);
                },
                style: { cursor: 'pointer' },
              })}
              pagination={{
                current: page,
                pageSize: pageSize,
                total: total,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => t('common.total', { count: total }),
                onChange: handlePageChange,
              }}
            />
          </Card>
        </div>
      </Spin>

      {/* Create User Modal */}
      <Modal
        title={t('users.createUser')}
        open={createModalVisible}
        onOk={handleCreateUser}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        okText={t('common.confirm')}
        width={400}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item 
            name="email" 
            label={t('users.email')} 
            rules={[
              { required: true, message: t('users.emailRequired') },
              { type: 'email', message: t('users.emailInvalid') },
            ]}
          >
            <Input placeholder="user@example.com" />
          </Form.Item>
          <Form.Item 
            name="password" 
            label={t('users.password')} 
            rules={[{ required: true, message: t('users.passwordRequired') }]}
          >
            <Input.Password placeholder={t('users.newPasswordPlaceholder')} />
          </Form.Item>
          <Form.Item 
            name="confirmPassword" 
            label={t('users.confirmPassword')} 
            dependencies={['password']}
            rules={[
              { required: true, message: t('users.confirmPasswordRequired') },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(t('users.passwordMismatch')));
                },
              }),
            ]}
          >
            <Input.Password placeholder={t('users.confirmPasswordPlaceholder')} />
          </Form.Item>
          <Form.Item 
            name="nickname" 
            label={t('users.nickname')}
            rules={[{ required: true, message: t('users.nicknameRequired') }]}
          >
            <Input placeholder={t('users.nicknamePlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Update Password Modal */}
      <Modal
        title={t('users.changePassword')}
        open={passwordModalVisible}
        onOk={handleUpdatePassword}
        onCancel={() => {
          setPasswordModalVisible(false);
          passwordForm.resetFields();
        }}
        okText={t('users.changePassword')}
        width={450}
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item label={t('users.email')}>
            <Input value={selectedUserEmail} disabled />
          </Form.Item>
          <Form.Item 
            name="password" 
            label={t('users.newPassword')} 
            rules={[{ required: true, message: t('users.passwordRequired') }]}
          >
            <Input.Password placeholder={t('users.newPasswordPlaceholder')} />
          </Form.Item>
          <Form.Item 
            name="confirmPassword" 
            label={t('users.confirmPassword')} 
            dependencies={['password']}
            rules={[
              { required: true, message: t('users.confirmPasswordRequired') },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(t('users.passwordMismatch')));
                },
              }),
            ]}
          >
            <Input.Password placeholder={t('users.confirmPasswordPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </ErrorBoundary>
  );
};

export default Users;
