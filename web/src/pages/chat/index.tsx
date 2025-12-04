import React, { useState } from 'react';
import { Table, Button, Space, Card, message, Input, Typography, Spin, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { chatApi, Chat } from '@/services/api';
import { useTableList } from '@/hooks/useTableList';
import { useConnectionCheck } from '@/hooks/useConnectionCheck';
import ErrorBoundary from '@/components/ErrorBoundary';
import ConfirmDelete from '@/components/ConfirmDelete';
import { translateErrorMessage } from '@/utils/i18n';
import dayjs from 'dayjs';

const { Title } = Typography;

const ChatPage: React.FC = () => {
  const { t } = useTranslation();
  const { checking, connected } = useConnectionCheck();
  const [searchName, setSearchName] = useState('');

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

  const columns: ColumnsType<Chat> = [
    { 
      title: t('common.name'), 
      dataIndex: 'name', 
      key: 'name',
      width: '20%',
      ellipsis: true,
    },
    { 
      title: t('chat.llmModel'), 
      dataIndex: ['llm', 'model_name'], 
      key: 'llm_model',
      width: '20%',
      ellipsis: true,
      render: (val) => val || '-',
    },
    { 
      title: t('chat.linkedDatasets'), 
      dataIndex: 'dataset_ids', 
      key: 'dataset_ids',
      width: 100,
      align: 'center',
      render: (val: string[]) => (
        <Tag color="blue">{val?.length || 0}</Tag>
      ),
    },
    { 
      title: t('common.description'), 
      dataIndex: 'description', 
      key: 'description',
      width: '25%',
      ellipsis: true,
    },
    { 
      title: t('common.created'), 
      dataIndex: 'create_time', 
      key: 'create_time',
      width: 150,
      align: 'center',
      render: (val) => val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: t('common.actions'),
      key: 'action',
      width: 80,
      align: 'center',
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
          <Title level={4} style={{ marginBottom: 24 }}>{t('chat.title')}</Title>
          <Card>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
              <Space>
                <Input
                  placeholder={t('chat.searchPlaceholder')}
                  prefix={<SearchOutlined />}
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
              dataSource={data} 
              rowKey="id"
              loading={!initialLoading && loading}
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

export default ChatPage;
