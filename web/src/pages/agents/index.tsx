//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

import React, { useState } from 'react';
import { Table, Button, Space, Card, message, Input, Typography, Spin, Avatar, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, SearchOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { agentApi, Agent } from '@/services/api';
import { useTableList } from '@/hooks/useTableList';
import { useConnectionCheck } from '@/hooks/useConnectionCheck';
import ErrorBoundary from '@/components/ErrorBoundary';
import ConfirmDelete from '@/components/ConfirmDelete';
import { translateErrorMessage } from '@/utils/i18n';
import dayjs from 'dayjs';

const { Title } = Typography;

const Agents: React.FC = () => {
  const { t } = useTranslation();
  const { checking, connected } = useConnectionCheck();
  const [searchTitle, setSearchTitle] = useState('');
  const [searchOwner, setSearchOwner] = useState('');

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
  } = useTableList<Agent>({
    fetchFn: (params) => agentApi.list(params),
    defaultPageSize: 10,
    enabled: connected,
  });

  const onSearch = () => {
    handleSearch({ title: searchTitle || undefined, owner: searchOwner || undefined });
  };

  const handleDelete = async (ids: string[]) => {
    try {
      await agentApi.batchDelete(ids);
      message.success(t('common.deletedSuccess'));
      setSelectedRowKeys([]);
      refresh();
    } catch (error: any) {
      message.error(translateErrorMessage(error.message, t) || t('common.deleteFailed'));
    }
  };

  const sortedData = [...data].sort((a, b) => 
    new Date(b.create_time || 0).getTime() - new Date(a.create_time || 0).getTime()
  );

  const columns: ColumnsType<Agent> = [
    { 
      title: t('common.name'), 
      dataIndex: 'title', 
      key: 'title',
      width: '20%',
      ellipsis: true,
      render: (val) => (
        <Space>
          <Avatar 
            icon={<RobotOutlined />}
            size="small"
            style={{ backgroundColor: '#722ed1' }}
          />
          <span>{val}</span>
        </Space>
      ),
    },
    { 
      title: t('common.description'), 
      dataIndex: 'description', 
      key: 'description',
      width: '25%',
      ellipsis: true,
      render: (val) => val || '-',
    },
    {
      title: t('agents.type'),
      dataIndex: 'canvas_type',
      key: 'canvas_type',
      width: 100,
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
      title: t('agents.owner'),
      key: 'owner',
      width: 180,
      ellipsis: true,
      render: (_, record) => record.owner_email || record.owner_nickname || '-',
    },
    { 
      title: t('common.created'), 
      dataIndex: 'create_time', 
      key: 'create_time',
      width: 150,
      align: 'center',
      sorter: (a, b) => new Date(a.create_time || 0).getTime() - new Date(b.create_time || 0).getTime(),
      showSorterTooltip: false,
      render: (val) => val ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: t('common.actions'),
      key: 'action',
      width: 80,
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <ConfirmDelete onConfirm={() => handleDelete([record.id])} />
      ),
    },
  ];

  const isLoading = checking || initialLoading;

  return (
    <ErrorBoundary>
      <Spin spinning={isLoading} size="large">
        <div style={{ minHeight: isLoading ? 400 : 'auto', visibility: isLoading ? 'hidden' : 'visible' }}>
          <div style={{ marginBottom: 16 }}>
            <Title level={4} style={{ margin: 0 }}>{t('agents.title')}</Title>
          </div>
          <Card>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
              <Space>
                <Input
                  placeholder={t('agents.searchPlaceholder')}
                  prefix={<SearchOutlined />}
                  allowClear
                  value={searchTitle}
                  onChange={(e) => setSearchTitle(e.target.value)}
                  onPressEnter={onSearch}
                  style={{ width: 200 }}
                />
                <Input
                  placeholder={t('users.filterByOwner')}
                  prefix={<UserOutlined />}
                  allowClear
                  value={searchOwner}
                  onChange={(e) => setSearchOwner(e.target.value)}
                  onPressEnter={onSearch}
                  style={{ width: 180 }}
                />
                <Button icon={<SearchOutlined />} onClick={onSearch}>{t('common.search')}</Button>
              </Space>
              <Space>
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
              scroll={{ x: 900 }}
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
    </ErrorBoundary>
  );
};

export default Agents;
