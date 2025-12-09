//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

/**
 * Chat Assistants Management Page
 *
 * Lists chat assistants and their conversation sessions.
 */

import React, { useState } from 'react';
import { Table, Button, Space, Card, message, Input, Typography, Spin, Tag, Avatar, Badge, Modal } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, SearchOutlined, MessageOutlined, HistoryOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { chatApi, Chat, chatSessionApi, ChatSession } from '@/services/api';
import { useTableList } from '@/hooks/useTableList';
import { useConnectionCheck } from '@/hooks/useConnectionCheck';
import ErrorBoundary from '@/components/ErrorBoundary';
import ConfirmDelete from '@/components/ConfirmDelete';
import { translateErrorMessage } from '@/utils/i18n';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const ChatPage: React.FC = () => {
  const { t } = useTranslation();
  const { checking, connected } = useConnectionCheck();
  const [searchName, setSearchName] = useState('');
  const [sessionModalVisible, setSessionModalVisible] = useState(false);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSessionKeys, setSelectedSessionKeys] = useState<React.Key[]>([]);

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
  } = useTableList<Chat>({
    fetchFn: (params) => chatApi.list(params),
    defaultPageSize: 10,
    enabled: connected,
  });

  const onSearch = () => {
    handleSearch({ name: searchName || undefined });
  };

  const sortedData = [...data].sort((a, b) => 
    new Date(b.create_time || 0).getTime() - new Date(a.create_time || 0).getTime()
  );

  const handleDelete = async (ids: string[]) => {
    try {
      await chatApi.batchDelete(ids);
      message.success(t('common.deletedSuccess'));
      setSelectedRowKeys([]);
      refresh();
    } catch (error: any) {
      message.error(translateErrorMessage(error.message, t) || t('common.deleteFailed'));
    }
  };

  const handleViewSessions = async (chat: Chat) => {
    setSelectedChat(chat);
    setSessionModalVisible(true);
    setSessionsLoading(true);
    setSelectedSessionKeys([]);
    try {
      const result = await chatSessionApi.list(chat.id, { page: 1, page_size: 100 });
      setSessions(result.items || []);
    } catch (error: any) {
      message.error(translateErrorMessage(error.message, t) || t('chat.loadSessionsFailed'));
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleDeleteSessions = async () => {
    if (!selectedChat || selectedSessionKeys.length === 0) return;
    
    try {
      await chatSessionApi.batchDelete(selectedChat.id, selectedSessionKeys as string[]);
      message.success(t('common.deletedSuccess'));
      setSelectedSessionKeys([]);
      handleViewSessions(selectedChat);
    } catch (error: any) {
      message.error(translateErrorMessage(error.message, t) || t('common.deleteFailed'));
    }
  };

  const sessionColumns: ColumnsType<ChatSession> = [
    {
      title: t('chat.sessionName'),
      dataIndex: 'name',
      key: 'name',
      width: 150,
      ellipsis: true,
      render: (val) => val || t('chat.defaultSessionName'),
    },
    {
      title: t('chat.messageCount'),
      dataIndex: 'messages',
      key: 'messageCount',
      width: 80,
      align: 'center',
      render: (messages: any[]) => (
        <Tag color="blue">{messages?.length || 0}</Tag>
      ),
    },
    {
      title: t('chat.lastMessage'),
      dataIndex: 'messages',
      key: 'lastMessage',
      ellipsis: true,
      render: (messages: any[]) => {
        if (!messages || messages.length === 0) return '-';
        const lastMsg = messages[messages.length - 1];
        const prefix = lastMsg.role === 'user' ? '👤 ' : '🤖 ';
        return prefix + (lastMsg.content?.slice(0, 50) || '-');
      },
    },
    {
      title: t('common.updated'),
      dataIndex: 'update_time',
      key: 'update_time',
      width: 140,
      render: (val) => val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-',
    },
  ];

  const columns: ColumnsType<Chat> = [
    { 
      title: t('common.name'), 
      dataIndex: 'name', 
      key: 'name',
      width: 180,
      ellipsis: true,
      render: (val) => (
        <Space>
          <Avatar 
            icon={<MessageOutlined />}
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
      width: 200,
      ellipsis: true,
      render: (val) => val || '-',
    },
    {
      title: t('chat.owner'),
      key: 'owner',
      width: 180,
      ellipsis: true,
      render: (_, record) => record.owner_email || record.owner_nickname || '-',
    },
    {
      title: t('chat.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center',
      render: (val) => (
        <Badge 
          status={val === '1' ? 'success' : 'default'} 
          text={val === '1' ? t('chat.statusEnabled') : t('chat.statusDisabled')}
        />
      ),
    },
    {
      title: t('chat.sessions'),
      dataIndex: 'session_count',
      key: 'session_count',
      width: 90,
      align: 'center',
      render: (val) => <Tag color="purple">{val || 0}</Tag>,
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
            <Title level={4} style={{ margin: 0 }}>{t('chat.title')}</Title>
          </div>
          <Card>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
              <Space>
                <Input
                  placeholder={t('chat.searchPlaceholder')}
                  prefix={<SearchOutlined />}
                  allowClear
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  onPressEnter={onSearch}
                  style={{ width: 200 }}
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
              scroll={{ x: 1000 }}
              rowSelection={{
                selectedRowKeys,
                onChange: setSelectedRowKeys,
              }}
              onRow={(record) => ({
                onClick: (e) => {
                  // Prevent when clicking on checkbox or action buttons
                  const target = e.target as HTMLElement;
                  if (target.closest('.ant-checkbox-wrapper') || target.closest('button') || target.closest('a')) {
                    return;
                  }
                  handleViewSessions(record);
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

      {/* Sessions Modal */}
      <Modal
        title={
          <Space>
            <HistoryOutlined />
            {t('chat.sessions')} - {selectedChat?.name}
          </Space>
        }
        open={sessionModalVisible}
        onCancel={() => {
          setSessionModalVisible(false);
          setSelectedChat(null);
          setSessions([]);
          setSelectedSessionKeys([]);
        }}
        footer={null}
        width={700}
      >
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="secondary">
            {t('chat.totalSessions', { count: sessions.length })}
          </Text>
          <ConfirmDelete
            onConfirm={handleDeleteSessions}
            disabled={selectedSessionKeys.length === 0}
            buttonText={t('common.deleteSelected', { count: selectedSessionKeys.length })}
            buttonType="default"
            buttonSize="middle"
            buttonDanger
          />
        </div>
        <Table
          columns={sessionColumns}
          dataSource={sessions}
          rowKey="id"
          loading={sessionsLoading}
          size="small"
          rowSelection={{
            selectedRowKeys: selectedSessionKeys,
            onChange: setSelectedSessionKeys,
          }}
          pagination={{
            pageSize: 10,
            showSizeChanger: false,
            showTotal: (total) => t('common.total', { count: total }),
          }}
          locale={{
            emptyText: t('chat.noSessions'),
          }}
        />
      </Modal>
    </ErrorBoundary>
  );
};

export default ChatPage;
