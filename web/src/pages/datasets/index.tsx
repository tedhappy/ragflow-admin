import React, { useState } from 'react';
import { Table, Button, Space, Card, message, Input, Typography, Spin, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, SearchOutlined, FileTextOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'umi';
import { datasetApi, Dataset } from '@/services/api';
import { useTableList } from '@/hooks/useTableList';
import { useConnectionCheck } from '@/hooks/useConnectionCheck';
import ErrorBoundary from '@/components/ErrorBoundary';
import ConfirmDelete from '@/components/ConfirmDelete';
import { translateErrorMessage } from '@/utils/i18n';
import dayjs from 'dayjs';

const { Title } = Typography;

const Datasets: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
  } = useTableList<Dataset>({
    fetchFn: (params) => datasetApi.list(params),
    defaultPageSize: 10,
    enabled: connected,
  });

  const onSearch = () => {
    handleSearch({ name: searchName || undefined });
  };

  const handleDelete = async (ids: string[]) => {
    try {
      await datasetApi.batchDelete(ids);
      message.success(t('common.deletedSuccess'));
      setSelectedRowKeys([]);
      refresh();
    } catch (error: any) {
      message.error(translateErrorMessage(error.message, t) || t('common.deleteFailed'));
    }
  };

  const columns: ColumnsType<Dataset> = [
    { 
      title: t('common.name'), 
      dataIndex: 'name', 
      key: 'name',
      width: '25%',
      ellipsis: true,
    },
    { 
      title: t('datasets.chunkMethod'), 
      dataIndex: 'chunk_method', 
      key: 'chunk_method',
      width: 100,
      align: 'center',
      render: (val) => val || 'naive',
    },
    { 
      title: t('datasets.embeddingModel'), 
      dataIndex: 'embedding_model', 
      key: 'embedding_model',
      width: '20%',
      ellipsis: true,
      render: (val) => val?.split('@')[0] || '-',
    },
    { 
      title: t('datasets.documents'), 
      dataIndex: 'document_count', 
      key: 'document_count',
      width: 70,
      align: 'center',
      render: (val) => val || 0,
    },
    { 
      title: t('datasets.chunks'), 
      dataIndex: 'chunk_count', 
      key: 'chunk_count',
      width: 70,
      align: 'center',
      render: (val) => val?.toLocaleString() || 0,
    },
    { 
      title: t('common.created'), 
      dataIndex: 'create_time', 
      key: 'create_time',
      width: 140,
      align: 'center',
      render: (val) => val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: t('common.actions'),
      key: 'action',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title={t('datasets.viewDocuments')}>
            <Link to={`/datasets/${record.id}/documents?name=${encodeURIComponent(record.name)}`}>
              <Button type="link" size="small" icon={<FileTextOutlined />} />
            </Link>
          </Tooltip>
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
          <Title level={4} style={{ marginBottom: 24 }}>{t('datasets.title')}</Title>
          <Card>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
              <Space>
                <Input
                  placeholder={t('datasets.searchPlaceholder')}
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
              onRow={(record) => ({
                onClick: (e) => {
                  // Prevent navigation when clicking on checkbox or action buttons
                  const target = e.target as HTMLElement;
                  if (target.closest('.ant-checkbox-wrapper') || target.closest('button') || target.closest('a')) {
                    return;
                  }
                  navigate(`/datasets/${record.id}/documents?name=${encodeURIComponent(record.name)}`);
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
    </ErrorBoundary>
  );
};

export default Datasets;
