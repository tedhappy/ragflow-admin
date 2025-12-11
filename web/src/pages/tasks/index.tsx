//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

import React, { useState, useEffect, useRef } from 'react';
import { Table, Button, Space, Card, message, Input, Typography, Spin, Tag, Progress, Select, Statistic, Row, Col, Tooltip, Alert } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { 
  ReloadOutlined, 
  SearchOutlined, 
  PlayCircleOutlined, 
  PauseCircleOutlined,
  RedoOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
  FolderOutlined,
  SettingOutlined,
  UserOutlined,
  FieldNumberOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'umi';
import { taskApi, ParsingTask, TaskStats, systemApi } from '@/services/api';
import { useConnectionCheck } from '@/hooks/useConnectionCheck';
import ErrorBoundary from '@/components/ErrorBoundary';
import dayjs from 'dayjs';

const { Title } = Typography;

const formatSize = (bytes?: number): string => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

const formatDuration = (seconds?: number): string => {
  if (!seconds) return '-';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
};

const StatusTag: React.FC<{ status?: string }> = ({ status }) => {
  const { t } = useTranslation();
  const statusMap: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
    UNSTART: { color: 'default', text: t('tasks.status.unstart'), icon: <ClockCircleOutlined /> },
    RUNNING: { color: 'processing', text: t('tasks.status.running'), icon: <SyncOutlined spin /> },
    CANCEL: { color: 'warning', text: t('tasks.status.cancel'), icon: <ExclamationCircleOutlined /> },
    DONE: { color: 'success', text: t('tasks.status.done'), icon: <CheckCircleOutlined /> },
    FAIL: { color: 'error', text: t('tasks.status.fail'), icon: <CloseCircleOutlined /> },
  };
  const info = statusMap[status || 'UNSTART'] || statusMap.UNSTART;
  return <Tag color={info.color} icon={info.icon}>{info.text}</Tag>;
};

const Tasks: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { checking, connected } = useConnectionCheck();
  
  const [ragflowConfigured, setRagflowConfigured] = useState<boolean | null>(null);
  
  const [searchDoc, setSearchDoc] = useState('');
  const [searchDataset, setSearchDataset] = useState('');
  const [searchOwner, setSearchOwner] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  
  const [tasks, setTasks] = useState<ParsingTask[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  const [stats, setStats] = useState<TaskStats | null>(null);
  
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const statusOptions = [
    { value: 'RUNNING', label: t('tasks.status.running') },
    { value: 'UNSTART', label: t('tasks.status.unstart') },
    { value: 'DONE', label: t('tasks.status.done') },
    { value: 'FAIL', label: t('tasks.status.fail') },
    { value: 'CANCEL', label: t('tasks.status.cancel') },
  ];

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

  const fetchTasks = async () => {
    if (!connected) return;
    
    setLoading(true);
    try {
      const params: any = { page, page_size: pageSize };
      if (filterStatus) params.status = filterStatus;
      if (searchDoc) params.doc_name = searchDoc;
      if (searchDataset) params.dataset_name = searchDataset;
      if (searchOwner) params.owner = searchOwner;
      
      const result = await taskApi.list(params);
      setTasks(result.items || []);
      setTotal(result.total || 0);
    } catch (error: any) {
      message.error(error.message || t('common.error'));
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!connected) return;
    
    try {
      const result = await taskApi.getStats();
      setStats(result);
    } catch (error) {
      // Silent fail
    }
  };

  useEffect(() => {
    if (connected) {
      fetchTasks();
      fetchStats();
    }
  }, [connected, page, pageSize, filterStatus]);

  useEffect(() => {
    const hasRunningTasks = tasks.some((task) => task.run === 'RUNNING');
    
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    
    if (hasRunningTasks) {
      refreshIntervalRef.current = setInterval(() => {
        fetchTasks();
        fetchStats();
      }, 3000);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [tasks]);

  const handleSearch = () => {
    setPage(1);
    fetchTasks();
  };

  const handlePageChange = (newPage: number, newPageSize: number) => {
    setPage(newPage);
    setPageSize(newPageSize);
  };

  const handleRefresh = () => {
    fetchTasks();
    fetchStats();
  };

  const checkRagflowApi = () => {
    if (ragflowConfigured === false) {
      message.warning(t('tasks.ragflowNotConfigured'));
      return false;
    }
    return true;
  };

  const groupTasksByDataset = (taskIds: React.Key[]) => {
    const groups: { [key: string]: string[] } = {};
    taskIds.forEach((id) => {
      const task = tasks.find((t) => t.id === id);
      if (task) {
        if (!groups[task.dataset_id]) {
          groups[task.dataset_id] = [];
        }
        groups[task.dataset_id].push(task.id);
      }
    });
    return Object.entries(groups).map(([dataset_id, document_ids]) => ({
      dataset_id,
      document_ids,
    }));
  };

  const handleBatchParse = async () => {
    if (!checkRagflowApi()) return;
    
    const parseableIds = selectedRowKeys.filter((id) => {
      const task = tasks.find((t) => t.id === id);
      return task && (task.run === 'UNSTART' || task.run === 'FAIL');
    });
    
    if (parseableIds.length === 0) {
      message.warning(t('tasks.noParseable'));
      return;
    }
    
    try {
      const taskGroups = groupTasksByDataset(parseableIds);
      const result = await taskApi.batchParse({ tasks: taskGroups });
      
      if (result.total_skipped > 0) {
        message.warning(t('tasks.ownerMismatchDesc', { count: result.total_skipped }));
      }
      if (result.total_success > 0) {
        message.success(t('tasks.parseStarted'));
      }
      
      setSelectedRowKeys([]);
      fetchTasks();
      fetchStats();
    } catch (error: any) {
      message.error(error.message || t('tasks.parseFailed'));
    }
  };

  const handleBatchStop = async () => {
    if (!checkRagflowApi()) return;
    
    const runningIds = selectedRowKeys.filter((id) => {
      const task = tasks.find((t) => t.id === id);
      return task && task.run === 'RUNNING';
    });
    
    if (runningIds.length === 0) {
      message.warning(t('tasks.noRunning'));
      return;
    }
    
    try {
      const taskGroups = groupTasksByDataset(runningIds);
      const result = await taskApi.batchStop({ tasks: taskGroups });
      
      if (result.total_skipped > 0) {
        message.warning(t('tasks.ownerMismatchDesc', { count: result.total_skipped }));
      }
      if (result.total_success > 0) {
        message.success(t('tasks.stopSuccess'));
      }
      
      setSelectedRowKeys([]);
      fetchTasks();
      fetchStats();
    } catch (error: any) {
      message.error(error.message || t('tasks.stopFailed'));
    }
  };

  const handleRetryFailed = async () => {
    if (!checkRagflowApi()) return;
    
    try {
      const result = await taskApi.retryFailed();
      
      if (result.skipped > 0) {
        message.warning(t('tasks.ownerMismatchDesc', { count: result.skipped }));
      }
      if (result.retried > 0) {
        message.success(t('tasks.retrySuccess', { count: result.retried }));
      } else if (result.skipped === 0) {
        message.info(t('tasks.noFailedTasks'));
      }
      
      fetchTasks();
      fetchStats();
    } catch (error: any) {
      message.error(error.message || t('tasks.retryFailed'));
    }
  };

  const getParseableCount = () => {
    return selectedRowKeys.filter((id) => {
      const task = tasks.find((t) => t.id === id);
      return task && (task.run === 'UNSTART' || task.run === 'FAIL');
    }).length;
  };

  const getRunningCount = () => {
    return selectedRowKeys.filter((id) => {
      const task = tasks.find((t) => t.id === id);
      return task && task.run === 'RUNNING';
    }).length;
  };

  const columns: ColumnsType<ParsingTask> = [
    { 
      title: t('tasks.documentName'), 
      dataIndex: 'name', 
      key: 'name',
      width: '25%',
      ellipsis: true,
    },
    { 
      title: t('tasks.dataset'), 
      dataIndex: 'dataset_name', 
      key: 'dataset_name',
      width: '15%',
      ellipsis: true,
      render: (val, record) => (
        <Space>
          <FolderOutlined style={{ color: '#8c8c8c' }} />
          {val || record.dataset_id}
        </Space>
      ),
    },
    { 
      title: t('tasks.size'), 
      dataIndex: 'size', 
      key: 'size',
      width: 80,
      align: 'center',
      sorter: (a, b) => (a.size || 0) - (b.size || 0),
      showSorterTooltip: false,
      render: (val) => formatSize(val),
    },
    { 
      title: t('tasks.progress'), 
      dataIndex: 'progress', 
      key: 'progress',
      width: 130,
      align: 'center',
      render: (val, record) => (
        <Tooltip title={record.progress_msg}>
          <Progress 
            percent={Math.round((val || 0) * 100)} 
            size="small"
            status={record.run === 'FAIL' ? 'exception' : record.run === 'DONE' ? 'success' : 'active'}
          />
        </Tooltip>
      ),
    },
    { 
      title: t('tasks.statusLabel'), 
      dataIndex: 'run', 
      key: 'run',
      width: 100,
      align: 'center',
      render: (val) => <StatusTag status={val} />,
    },
    { 
      title: t('tasks.queuePosition'), 
      key: 'queue_position',
      width: 80,
      align: 'center',
      render: (_, record) => {
        if (!record.queue_position) {
          return <span style={{ color: '#bfbfbf' }}>-</span>;
        }
        const position = record.queue_position;
        const total = record.pending_total || position;
        return (
          <Tooltip title={t('tasks.queuePositionTip', { position, total })}>
            <Tag 
              icon={<FieldNumberOutlined />} 
              color="blue"
              style={{ minWidth: 45, textAlign: 'center' }}
            >
              #{position}
            </Tag>
          </Tooltip>
        );
      },
    },
    { 
      title: t('tasks.duration'), 
      dataIndex: 'process_duration', 
      key: 'process_duration',
      width: 90,
      align: 'center',
      render: (val) => formatDuration(val),
    },
    { 
      title: t('tasks.chunks'), 
      dataIndex: 'chunk_count', 
      key: 'chunk_count',
      width: 70,
      align: 'center',
      sorter: (a, b) => (a.chunk_count || 0) - (b.chunk_count || 0),
      showSorterTooltip: false,
      render: (val) => val || 0,
    },
    { 
      title: t('tasks.owner'), 
      key: 'owner',
      width: '12%',
      ellipsis: true,
      render: (_, record) => record.owner_email || '-',
    },
    { 
      title: t('common.updated'), 
      dataIndex: 'update_time', 
      key: 'update_time',
      width: 160,
      align: 'center',
      sorter: (a, b) => new Date(a.update_time || 0).getTime() - new Date(b.update_time || 0).getTime(),
      showSorterTooltip: false,
      render: (val) => val ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
  ];

  const isLoading = checking || initialLoading;

  return (
    <ErrorBoundary>
      <Spin spinning={isLoading} size="large">
        <div style={{ minHeight: isLoading ? 400 : 'auto', visibility: isLoading ? 'hidden' : 'visible' }}>
          <Title level={4} style={{ margin: 0, marginBottom: 16 }}>{t('tasks.title')}</Title>
          
          {/* RAGFlow API Not Configured Warning */}
          {ragflowConfigured === false && (
            <Alert
              message={t('tasks.ragflowNotConfigured')}
              description={t('tasks.ragflowNotConfiguredDesc')}
              type="warning"
              showIcon
              style={{ marginBottom: 16, alignItems: 'center' }}
              action={
                <Button size="small" icon={<SettingOutlined />} onClick={() => navigate('/settings')}>
                  {t('tasks.configureRagflow')}
                </Button>
              }
            />
          )}
          
          {/* Statistics Cards */}
          {stats && (
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={4}>
                <Card size="small">
                  <Statistic 
                    title={t('tasks.stats.total')} 
                    value={stats.total} 
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
              <Col span={4}>
                <Card size="small">
                  <Statistic 
                    title={t('tasks.stats.running')} 
                    value={stats.running} 
                    prefix={<SyncOutlined spin={stats.running > 0} />}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
              <Col span={4}>
                <Card size="small">
                  <Statistic 
                    title={t('tasks.stats.pending')} 
                    value={stats.unstart} 
                    prefix={<ClockCircleOutlined />}
                    valueStyle={{ color: '#8c8c8c' }}
                  />
                </Card>
              </Col>
              <Col span={4}>
                <Card size="small">
                  <Statistic 
                    title={t('tasks.stats.completed')} 
                    value={stats.done} 
                    prefix={<CheckCircleOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col span={4}>
                <Card size="small">
                  <Statistic 
                    title={t('tasks.stats.failed')} 
                    value={stats.fail} 
                    prefix={<CloseCircleOutlined />}
                    valueStyle={{ color: '#ff4d4f' }}
                  />
                </Card>
              </Col>
              <Col span={4}>
                <Card size="small">
                  <Statistic 
                    title={t('tasks.stats.canceled')} 
                    value={stats.cancel} 
                    prefix={<ExclamationCircleOutlined />}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Card>
              </Col>
            </Row>
          )}
          
          <Card>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <Space wrap>
                <Input
                  placeholder={t('tasks.searchDoc')}
                  prefix={<SearchOutlined />}
                  allowClear
                  value={searchDoc}
                  onChange={(e) => setSearchDoc(e.target.value)}
                  onPressEnter={handleSearch}
                  style={{ width: 160 }}
                />
                <Input
                  placeholder={t('tasks.searchDataset')}
                  prefix={<FolderOutlined />}
                  allowClear
                  value={searchDataset}
                  onChange={(e) => setSearchDataset(e.target.value)}
                  onPressEnter={handleSearch}
                  style={{ width: 160 }}
                />
                <Input
                  placeholder={t('users.filterByOwner')}
                  prefix={<UserOutlined />}
                  allowClear
                  value={searchOwner}
                  onChange={(e) => setSearchOwner(e.target.value)}
                  onPressEnter={handleSearch}
                  style={{ width: 160 }}
                />
                <Select
                  placeholder={t('tasks.filterStatus')}
                  allowClear
                  value={filterStatus}
                  onChange={(val) => { setFilterStatus(val); setPage(1); }}
                  options={statusOptions}
                  style={{ width: 120 }}
                />
                <Button icon={<SearchOutlined />} onClick={handleSearch}>{t('common.search')}</Button>
              </Space>
              <Space wrap>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handleBatchParse}
                  disabled={ragflowConfigured === false || getParseableCount() === 0}
                >
                  {t('tasks.parseSelected', { count: getParseableCount() })}
                </Button>
                <Button
                  icon={<PauseCircleOutlined />}
                  onClick={handleBatchStop}
                  disabled={ragflowConfigured === false || getRunningCount() === 0}
                >
                  {t('tasks.stopSelected', { count: getRunningCount() })}
                </Button>
                <Button
                  icon={<RedoOutlined />}
                  onClick={handleRetryFailed}
                  disabled={ragflowConfigured === false || !stats || stats.fail === 0}
                >
                  {t('tasks.retryAll', { count: stats?.fail || 0 })}
                </Button>
                <Button icon={<ReloadOutlined />} onClick={handleRefresh}>{t('common.refresh')}</Button>
              </Space>
            </div>
            <Table 
              columns={columns} 
              dataSource={tasks} 
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
              scroll={{ x: 1200 }}
            />
          </Card>
        </div>
      </Spin>
    </ErrorBoundary>
  );
};

export default Tasks;
