//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

import React, { useState } from 'react';
import { Table, Button, Space, Card, message, Input, Typography, Spin, Tag, Progress, Breadcrumb } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, SearchOutlined, ArrowLeftOutlined, FileOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Link } from 'umi';
import { useParams, useSearchParams } from 'react-router-dom';
import { documentApi, Document } from '@/services/api';
import { useTableList } from '@/hooks/useTableList';
import { useConnectionCheck } from '@/hooks/useConnectionCheck';
import ErrorBoundary from '@/components/ErrorBoundary';
import ConfirmDelete from '@/components/ConfirmDelete';
import { translateErrorMessage } from '@/utils/i18n';
import dayjs from 'dayjs';

const { Title } = Typography;

// Format file size
const formatSize = (bytes?: number): string => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

// Status tag component
const StatusTag: React.FC<{ status?: string }> = ({ status }) => {
  const { t } = useTranslation();
  const statusMap: Record<string, { color: string; text: string }> = {
    UNSTART: { color: 'default', text: t('documents.status.unstart') },
    RUNNING: { color: 'processing', text: t('documents.status.running') },
    CANCEL: { color: 'warning', text: t('documents.status.cancel') },
    DONE: { color: 'success', text: t('documents.status.done') },
    FAIL: { color: 'error', text: t('documents.status.fail') },
  };
  const info = statusMap[status || 'UNSTART'] || statusMap.UNSTART;
  return <Tag color={info.color}>{info.text}</Tag>;
};

const Documents: React.FC = () => {
  const { t } = useTranslation();
  const { datasetId } = useParams<{ datasetId: string }>();
  const [searchParams] = useSearchParams();
  const datasetName = searchParams.get('name') || datasetId;
  const { checking, connected } = useConnectionCheck();
  const [searchKeywords, setSearchKeywords] = useState('');

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
  } = useTableList<Document>({
    fetchFn: (params) => documentApi.list(datasetId!, params),
    defaultPageSize: 10,
    enabled: connected && !!datasetId,
  });

  const onSearch = () => {
    handleSearch({ keywords: searchKeywords || undefined });
  };

  const handleDelete = async (ids: string[]) => {
    try {
      await documentApi.batchDelete(datasetId!, ids);
      message.success(t('common.deletedSuccess'));
      setSelectedRowKeys([]);
      refresh();
    } catch (error: any) {
      message.error(translateErrorMessage(error.message, t) || t('common.deleteFailed'));
    }
  };

  const columns: ColumnsType<Document> = [
    { 
      title: t('common.name'), 
      dataIndex: 'name', 
      key: 'name',
      width: 250,
      render: (name: string) => (
        <Space>
          <FileOutlined />
          <span>{name}</span>
        </Space>
      ),
    },
    { 
      title: t('documents.size'), 
      dataIndex: 'size', 
      key: 'size',
      width: 100,
      render: (val) => formatSize(val),
    },
    { 
      title: t('documents.chunks'), 
      dataIndex: 'chunk_count', 
      key: 'chunk_count',
      width: 80,
      render: (val) => val || 0,
    },
    { 
      title: t('documents.tokens'), 
      dataIndex: 'token_count', 
      key: 'token_count',
      width: 100,
      render: (val) => val?.toLocaleString() || 0,
    },
    { 
      title: t('documents.progress'), 
      dataIndex: 'progress', 
      key: 'progress',
      width: 150,
      render: (val, record) => (
        <Progress 
          percent={Math.round((val || 0) * 100)} 
          size="small"
          status={record.run === 'FAIL' ? 'exception' : record.run === 'DONE' ? 'success' : 'active'}
        />
      ),
    },
    { 
      title: t('documents.statusLabel'), 
      dataIndex: 'run', 
      key: 'run',
      width: 100,
      render: (val) => <StatusTag status={val} />,
    },
    { 
      title: t('common.created'), 
      dataIndex: 'create_time', 
      key: 'create_time',
      width: 160,
      render: (val) => val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: t('common.actions'),
      key: 'action',
      width: 100,
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
          <Breadcrumb style={{ marginBottom: 16 }}>
            <Breadcrumb.Item>
              <Link to="/datasets">{t('datasets.title')}</Link>
            </Breadcrumb.Item>
            <Breadcrumb.Item>{datasetName}</Breadcrumb.Item>
          </Breadcrumb>
          
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
            <Link to="/datasets">
              <Button icon={<ArrowLeftOutlined />} style={{ marginRight: 16 }} />
            </Link>
            <Title level={4} style={{ margin: 0 }}>
              {t('documents.title')} - {datasetName}
            </Title>
          </div>
          
          <Card>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
              <Space>
                <Input
                  placeholder={t('documents.searchPlaceholder')}
                  prefix={<SearchOutlined />}
                  value={searchKeywords}
                  onChange={(e) => setSearchKeywords(e.target.value)}
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

export default Documents;
