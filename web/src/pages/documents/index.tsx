//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

/**
 * Documents Management Page
 *
 * Lists, uploads, parses, and manages documents within a dataset.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Table, Button, Space, Card, message, Input, Typography, Spin, Tag, Progress, Select, Upload, Modal, Alert } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile, UploadProps } from 'antd/es/upload';
import { ReloadOutlined, SearchOutlined, ArrowLeftOutlined, UploadOutlined, PlayCircleOutlined, PauseCircleOutlined, InboxOutlined, SettingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'umi';
import { useParams, useSearchParams } from 'react-router-dom';
import { documentApi, Document, systemApi } from '@/services/api';
import { useTableList } from '@/hooks/useTableList';
import { useConnectionCheck } from '@/hooks/useConnectionCheck';
import ErrorBoundary from '@/components/ErrorBoundary';
import ConfirmDelete from '@/components/ConfirmDelete';
import { translateErrorMessage } from '@/utils/i18n';
import dayjs from 'dayjs';

const { Title } = Typography;

const formatSize = (bytes?: number): string => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

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

const { Dragger } = Upload;

const Documents: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { datasetId } = useParams<{ datasetId: string }>();
  const [searchParams] = useSearchParams();
  const datasetName = searchParams.get('name') || datasetId;
  const { checking, connected } = useConnectionCheck();
  const [searchKeywords, setSearchKeywords] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  
  const [ragflowConfigured, setRagflowConfigured] = useState<boolean | null>(null);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadFileList, setUploadFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    const checkRagflowConfig = async () => {
      try {
        const config = await systemApi.getRagflowConfig();
        setRagflowConfigured(config.is_configured);
      } catch {
        setRagflowConfigured(false);
      }
    };
    checkRagflowConfig();
  }, []);

  const statusOptions = [
    { value: 'DONE', label: t('documents.status.done') },
    { value: 'RUNNING', label: t('documents.status.running') },
    { value: 'UNSTART', label: t('documents.status.unstart') },
    { value: 'FAIL', label: t('documents.status.fail') },
    { value: 'CANCEL', label: t('documents.status.cancel') },
  ];

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

  useEffect(() => {
    const hasRunningDocs = data.some((doc) => doc.run === 'RUNNING');
    
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    
    if (hasRunningDocs) {
      refreshIntervalRef.current = setInterval(() => {
        refresh();
      }, 3000);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [data, refresh]);

  const onSearch = () => {
    handleSearch({ 
      keywords: searchKeywords || undefined,
      run: filterStatus || undefined,
    });
  };

  const onFilterStatusChange = (value: string | undefined) => {
    setFilterStatus(value);
    handleSearch({ 
      keywords: searchKeywords || undefined,
      run: value || undefined,
    });
  };

  const sortedData = [...data].sort((a, b) => 
    new Date(b.create_time || 0).getTime() - new Date(a.create_time || 0).getTime()
  );

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

  const checkRagflowApi = (): boolean => {
    if (!ragflowConfigured) {
      message.warning(t('documents.ragflowNotConfigured'));
      return false;
    }
    return true;
  };

  const handleUpload = async () => {
    if (!checkRagflowApi()) return;
    
    if (uploadFileList.length === 0) {
      message.warning(t('documents.upload.noFiles'));
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      uploadFileList.forEach((file) => {
        if (file.originFileObj) {
          formData.append('file', file.originFileObj);
        }
      });

      await documentApi.upload(datasetId!, formData);
      message.success(t('documents.upload.success'));
      setUploadModalVisible(false);
      setUploadFileList([]);
      refresh();
    } catch (error: any) {
      message.error(translateErrorMessage(error.message, t) || t('documents.upload.failed'));
    } finally {
      setUploading(false);
    }
  };

  const uploadProps: UploadProps = {
    multiple: true,
    fileList: uploadFileList,
    beforeUpload: (file) => {
      const uploadFile: UploadFile = {
        uid: file.uid,
        name: file.name,
        size: file.size,
        type: file.type,
        originFileObj: file as any,
      };
      setUploadFileList((prev) => [...prev, uploadFile]);
      return false;
    },
    onRemove: (file) => {
      setUploadFileList((prev) => prev.filter((f) => f.uid !== file.uid));
    },
  };

  const handleParse = async (ids: string[]) => {
    if (!checkRagflowApi()) return;
    
    if (ids.length === 0) {
      message.warning(t('documents.parse.noDocuments'));
      return;
    }

    setParsing(true);
    try {
      await documentApi.parse(datasetId!, ids);
      message.success(t('documents.parse.started'));
      setSelectedRowKeys([]);
      refresh();
    } catch (error: any) {
      message.error(translateErrorMessage(error.message, t) || t('documents.parse.failed'));
    } finally {
      setParsing(false);
    }
  };

  const handleStopParse = async (ids: string[]) => {
    if (!checkRagflowApi()) return;
    if (ids.length === 0) return;

    try {
      await documentApi.stopParse(datasetId!, ids);
      message.success(t('documents.parse.stopped'));
      setSelectedRowKeys([]);
      refresh();
    } catch (error: any) {
      // If document already finished parsing, show info instead of error
      const errorMsg = error.message || '';
      if (errorMsg.includes('progress at 0 or 1') || errorMsg.includes('already')) {
        message.info(t('documents.parse.alreadyCompleted'));
      } else {
        message.error(translateErrorMessage(errorMsg, t) || t('documents.parse.stopFailed'));
      }
      refresh();
    }
  };

  const openUploadModal = () => {
    if (!checkRagflowApi()) return;
    setUploadModalVisible(true);
  };

  const getParseableDocuments = () => {
    return sortedData.filter(
      (doc) => doc.run === 'UNSTART' || doc.run === 'FAIL'
    );
  };

  const getSelectedParseableIds = () => {
    return selectedRowKeys.filter((id) => {
      const doc = data.find((d) => d.id === id);
      return doc && (doc.run === 'UNSTART' || doc.run === 'FAIL');
    }) as string[];
  };

  const getRunningDocumentIds = () => {
    return selectedRowKeys.filter((id) => {
      const doc = data.find((d) => d.id === id);
      return doc && doc.run === 'RUNNING';
    }) as string[];
  };

  const columns: ColumnsType<Document> = [
    { 
      title: t('common.name'), 
      dataIndex: 'name', 
      key: 'name',
      width: '35%',
      ellipsis: true,
    },
    { 
      title: t('documents.size'), 
      dataIndex: 'size', 
      key: 'size',
      width: 80,
      align: 'center',
      sorter: (a, b) => (a.size || 0) - (b.size || 0),
      showSorterTooltip: false,
      render: (val) => formatSize(val),
    },
    { 
      title: t('documents.chunks'), 
      dataIndex: 'chunk_count', 
      key: 'chunk_count',
      width: 80,
      align: 'center',
      sorter: (a, b) => (a.chunk_count || 0) - (b.chunk_count || 0),
      showSorterTooltip: false,
      render: (val) => val || 0,
    },
    { 
      title: t('documents.tokens'), 
      dataIndex: 'token_count', 
      key: 'token_count',
      width: 80,
      align: 'center',
      sorter: (a, b) => (a.token_count || 0) - (b.token_count || 0),
      showSorterTooltip: false,
      render: (val) => val?.toLocaleString() || 0,
    },
    { 
      title: t('documents.progress'), 
      dataIndex: 'progress', 
      key: 'progress',
      width: 120,
      align: 'center',
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
      width: 90,
      align: 'center',
      render: (val) => <StatusTag status={val} />,
    },
    { 
      title: t('common.created'), 
      dataIndex: 'create_time', 
      key: 'create_time',
      width: 160,
      align: 'center',
      sorter: (a, b) => new Date(a.create_time || 0).getTime() - new Date(b.create_time || 0).getTime(),
      showSorterTooltip: false,
      render: (val) => val ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: t('common.actions'),
      key: 'action',
      width: 70,
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
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
            <Link to="/datasets">
              <Button type="text" icon={<ArrowLeftOutlined />} style={{ marginRight: 8 }} />
            </Link>
            <Title level={4} style={{ margin: 0 }}>{datasetName}</Title>
          </div>
          
          {ragflowConfigured === false && (
            <Alert
              message={t('documents.ragflowNotConfigured')}
              description={t('documents.ragflowNotConfiguredDesc')}
              type="warning"
              showIcon
              style={{ marginBottom: 16, alignItems: 'center' }}
              action={
                <Button size="small" icon={<SettingOutlined />} onClick={() => navigate('/settings')}>
                  {t('documents.configureRagflow')}
                </Button>
              }
            />
          )}
          
          <Card>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <Space wrap>
                <Input
                  placeholder={t('documents.searchPlaceholder')}
                  prefix={<SearchOutlined />}
                  allowClear
                  value={searchKeywords}
                  onChange={(e) => setSearchKeywords(e.target.value)}
                  onPressEnter={onSearch}
                  style={{ width: 180 }}
                />
                <Select
                  placeholder={t('documents.filterByStatus')}
                  allowClear
                  value={filterStatus}
                  onChange={onFilterStatusChange}
                  options={statusOptions}
                  style={{ width: 120 }}
                />
                <Button icon={<SearchOutlined />} onClick={onSearch}>{t('common.search')}</Button>
              </Space>
              <Space wrap>
                <Button 
                  type="primary" 
                  icon={<UploadOutlined />} 
                  onClick={openUploadModal}
                >
                  {t('documents.upload.button')}
                </Button>
                <Button
                  icon={<PlayCircleOutlined />}
                  onClick={() => handleParse(getSelectedParseableIds())}
                  disabled={getSelectedParseableIds().length === 0}
                  loading={parsing}
                >
                  {t('documents.parse.selected', { count: getSelectedParseableIds().length })}
                </Button>
                <Button
                  icon={<PauseCircleOutlined />}
                  onClick={() => handleStopParse(getRunningDocumentIds())}
                  disabled={getRunningDocumentIds().length === 0}
                >
                  {t('documents.parse.stop')}
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

      {/* Upload Modal */}
      <Modal
        title={t('documents.upload.title')}
        open={uploadModalVisible}
        onOk={handleUpload}
        onCancel={() => {
          setUploadModalVisible(false);
          setUploadFileList([]);
        }}
        okText={t('documents.upload.confirm')}
        cancelText={t('common.cancel')}
        confirmLoading={uploading}
        okButtonProps={{ disabled: uploadFileList.length === 0 }}
        width={600}
      >
        <Dragger {...uploadProps} style={{ padding: '20px 0' }}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">{t('documents.upload.dragText')}</p>
          <p className="ant-upload-hint">{t('documents.upload.hint')}</p>
        </Dragger>
      </Modal>
    </ErrorBoundary>
  );
};

export default Documents;
