//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Card, message, Input, Typography, Spin, Tag, Badge, Modal, Form, Alert, Avatar, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, SearchOutlined, UserOutlined, PlusOutlined, KeyOutlined, SettingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { userApi, RagflowUser, MySQLConfig } from '@/services/api';
import { useTableList } from '@/hooks/useTableList';
import ErrorBoundary from '@/components/ErrorBoundary';
import ConfirmDelete from '@/components/ConfirmDelete';
import { translateErrorMessage } from '@/utils/i18n';
import dayjs from 'dayjs';

const { Title } = Typography;

const Users: React.FC = () => {
  const { t } = useTranslation();
  const [searchEmail, setSearchEmail] = useState('');
  const [searchNickname, setSearchNickname] = useState('');
  const [searchStatus, setSearchStatus] = useState<string | undefined>(undefined);
  const [mysqlConfig, setMysqlConfig] = useState<MySQLConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  
  // Modal states
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  
  // Form instances
  const [configForm] = Form.useForm();
  const [createForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  
  // Test connection state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load MySQL config
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setConfigLoading(true);
      const config = await userApi.getConfig();
      setMysqlConfig(config);
      if (config.configured) {
        configForm.setFieldsValue({
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.user,
          password: '',
        });
      }
    } catch (error) {
      console.error('Failed to load MySQL config:', error);
    } finally {
      setConfigLoading(false);
    }
  };

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
    enabled: mysqlConfig?.configured || false,
  });

  const onSearch = () => {
    handleSearch({ 
      email: searchEmail || undefined,
      nickname: searchNickname || undefined,
      status: searchStatus,
    });
  };

  // Sort by create_time descending
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

  const handleTestConnection = async () => {
    try {
      const values = await configForm.validateFields();
      setTesting(true);
      setTestResult(null);
      
      const result = await userApi.testConnection(values);
      
      if (result.connected) {
        setTestResult({
          success: true,
          message: `${t('users.connectionSuccess')} (MySQL ${result.version})`,
        });
      } else {
        setTestResult({
          success: false,
          message: result.error || t('users.connectionFailed'),
        });
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message || t('users.connectionFailed'),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      const values = await configForm.validateFields();
      await userApi.saveConfig(values);
      message.success(t('users.configSaved'));
      setConfigModalVisible(false);
      loadConfig();
      refresh();
    } catch (error: any) {
      message.error(translateErrorMessage(error.message, t) || t('users.configSaveFailed'));
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
      width: '15%',
      ellipsis: true,
      render: (val) => val || '-',
    },
    {
      title: t('users.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
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
      width: 100,
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
              setPasswordModalVisible(true);
            }}
            title={t('users.updatePassword')}
          />
          <ConfirmDelete onConfirm={() => handleDelete([record.id])} />
        </Space>
      ),
    },
  ];

  const isLoading = configLoading || initialLoading;

  // If MySQL not configured, show configuration prompt
  if (!configLoading && !mysqlConfig?.configured) {
    return (
      <ErrorBoundary>
        <div style={{ marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>{t('users.title')}</Title>
        </div>
        <Card>
          <Alert
            message={t('users.mysqlNotConfigured')}
            description={t('users.mysqlNotConfiguredDesc')}
            type="warning"
            showIcon
            action={
              <Button type="primary" onClick={() => setConfigModalVisible(true)} style={{ marginTop: 4 }}>
                {t('users.configureMySQL')}
              </Button>
            }
            style={{ alignItems: 'center' }}
          />
        </Card>
        
        {/* Config Modal */}
        <Modal
          title={t('users.mysqlConfig')}
          open={configModalVisible}
          onOk={handleSaveConfig}
          onCancel={() => setConfigModalVisible(false)}
          okText={t('common.save')}
          width={500}
        >
          <Form 
            form={configForm} 
            layout="vertical"
            initialValues={{ host: 'localhost', port: 5455, database: 'rag_flow', user: 'root' }}
          >
            <Form.Item name="host" label={t('users.mysqlHost')} rules={[{ required: true }]}>
              <Input placeholder="localhost" />
            </Form.Item>
            <Form.Item name="port" label={t('users.mysqlPort')} rules={[{ required: true }]}>
              <Input type="number" placeholder="5455" />
            </Form.Item>
            <Form.Item name="database" label={t('users.mysqlDatabase')} rules={[{ required: true }]}>
              <Input placeholder="rag_flow" />
            </Form.Item>
            <Form.Item name="user" label={t('users.mysqlUser')} rules={[{ required: true }]}>
              <Input placeholder="root" />
            </Form.Item>
            <Form.Item name="password" label={t('users.mysqlPassword')}>
              <Input.Password placeholder="infini_rag_flow" />
            </Form.Item>
            
            <Space>
              <Button onClick={handleTestConnection} loading={testing}>
                {t('users.testConnection')}
              </Button>
              {testResult && (
                <Tag color={testResult.success ? 'success' : 'error'}>
                  {testResult.message}
                </Tag>
              )}
            </Space>
          </Form>
        </Modal>
      </ErrorBoundary>
    );
  }

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
                <Button icon={<SettingOutlined />} onClick={() => setConfigModalVisible(true)}>
                  {t('users.mysqlConfig')}
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

      {/* Config Modal */}
      <Modal
        title={t('users.mysqlConfig')}
        open={configModalVisible}
        onOk={handleSaveConfig}
        onCancel={() => setConfigModalVisible(false)}
        okText={t('common.save')}
        width={500}
      >
        <Form 
          form={configForm} 
          layout="vertical" 
          initialValues={{ host: 'localhost', port: 5455, database: 'rag_flow', user: 'root' }}
        >
          <Form.Item name="host" label={t('users.mysqlHost')} rules={[{ required: true }]}>
            <Input placeholder="localhost" />
          </Form.Item>
          <Form.Item name="port" label={t('users.mysqlPort')} rules={[{ required: true }]}>
            <Input type="number" placeholder="5455" />
          </Form.Item>
          <Form.Item name="database" label={t('users.mysqlDatabase')} rules={[{ required: true }]}>
            <Input placeholder="rag_flow" />
          </Form.Item>
          <Form.Item name="user" label={t('users.mysqlUser')} rules={[{ required: true }]}>
            <Input placeholder="root" />
          </Form.Item>
          <Form.Item name="password" label={t('users.mysqlPassword')}>
            <Input.Password placeholder="infini_rag_flow" />
          </Form.Item>
          
          <Space>
            <Button onClick={handleTestConnection} loading={testing}>
              {t('users.testConnection')}
            </Button>
            {testResult && (
              <Tag color={testResult.success ? 'success' : 'error'}>
                {testResult.message}
              </Tag>
            )}
          </Space>
        </Form>
      </Modal>

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
            <Input.Password placeholder="******" />
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
        title={t('users.updatePassword')}
        open={passwordModalVisible}
        onOk={handleUpdatePassword}
        onCancel={() => {
          setPasswordModalVisible(false);
          passwordForm.resetFields();
        }}
        okText={t('common.confirm')}
        width={400}
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item 
            name="password" 
            label={t('users.newPassword')} 
            rules={[{ required: true, message: t('users.passwordRequired') }]}
          >
            <Input.Password placeholder="******" />
          </Form.Item>
        </Form>
      </Modal>
    </ErrorBoundary>
  );
};

export default Users;
