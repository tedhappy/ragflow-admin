import React, { useState } from 'react';
import { Table, Button, Space, Card, message, Input, Typography, Spin } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { agentApi, Agent } from '@/services/api';
import { useTableList } from '@/hooks/useTableList';
import { useConnectionCheck } from '@/hooks/useConnectionCheck';
import ErrorBoundary from '@/components/ErrorBoundary';
import dayjs from 'dayjs';

const { Title } = Typography;

const Agents: React.FC = () => {
  const { t } = useTranslation();
  const { checking, connected } = useConnectionCheck();
  const [searchTitle, setSearchTitle] = useState('');

  const {
    data,
    total,
    loading,
    initialLoading,
    page,
    pageSize,
    refresh,
    handlePageChange,
    handleSearch,
  } = useTableList<Agent>({
    fetchFn: (params) => agentApi.list(params),
    defaultPageSize: 10,
    enabled: connected,
  });

  const onSearch = () => {
    handleSearch({ title: searchTitle || undefined });
  };

  const columns: ColumnsType<Agent> = [
    { 
      title: t('common.name'), 
      dataIndex: 'title', 
      key: 'title',
      width: '25%',
      ellipsis: true,
    },
    { 
      title: t('common.description'), 
      dataIndex: 'description', 
      key: 'description',
      width: '40%',
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
      title: t('common.updated'), 
      dataIndex: 'update_time', 
      key: 'update_time',
      width: 150,
      align: 'center',
      render: (val) => val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-',
    },
  ];

  const isLoading = checking || initialLoading;

  return (
    <ErrorBoundary>
      <Spin spinning={isLoading} size="large">
        <div style={{ minHeight: isLoading ? 400 : 'auto', visibility: isLoading ? 'hidden' : 'visible' }}>
          <Title level={4} style={{ marginBottom: 24 }}>{t('agents.title')}</Title>
          <Card>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
              <Space>
                <Input
                  placeholder={t('agents.searchPlaceholder')}
                  prefix={<SearchOutlined />}
                  value={searchTitle}
                  onChange={(e) => setSearchTitle(e.target.value)}
                  onPressEnter={onSearch}
                  style={{ width: 200 }}
                />
                <Button icon={<SearchOutlined />} onClick={onSearch}>{t('common.search')}</Button>
              </Space>
              <Button icon={<ReloadOutlined />} onClick={refresh}>{t('common.refresh')}</Button>
            </div>
            <Table 
              columns={columns} 
              dataSource={data} 
              rowKey="id"
              loading={!initialLoading && loading}
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
