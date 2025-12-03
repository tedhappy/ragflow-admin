import React, { useState } from 'react';
import { Table, Button, Space, Card, message, Input, Typography, Spin } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { agentApi, Agent } from '@/services/api';
import { useTableList } from '@/hooks/useTableList';
import { useConnectionCheck } from '@/hooks/useConnectionCheck';
import ErrorBoundary from '@/components/ErrorBoundary';
import dayjs from 'dayjs';

const { Title } = Typography;

const Agents: React.FC = () => {
  const { checking, connected } = useConnectionCheck();
  const [searchTitle, setSearchTitle] = useState('');

  const {
    data,
    total,
    loading,
    initialLoading,
    page,
    pageSize,
    setParams,
    refresh,
    handlePageChange,
    handleSearch: triggerSearch,
  } = useTableList<Agent>({
    fetchFn: (params) => agentApi.list(params),
    defaultPageSize: 10,
    enabled: connected,
  });

  const handleSearch = () => {
    setParams({ title: searchTitle || undefined });
    triggerSearch();
  };

  const columns: ColumnsType<Agent> = [
    { 
      title: 'Title', 
      dataIndex: 'title', 
      key: 'title',
      width: 200,
    },
    { 
      title: 'Description', 
      dataIndex: 'description', 
      key: 'description',
      ellipsis: true,
    },
    { 
      title: 'Created', 
      dataIndex: 'create_time', 
      key: 'create_time',
      width: 180,
      render: (val) => val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-',
    },
    { 
      title: 'Updated', 
      dataIndex: 'update_time', 
      key: 'update_time',
      width: 180,
      render: (val) => val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-',
    },
  ];

  const isLoading = checking || initialLoading;

  return (
    <ErrorBoundary>
      <Spin spinning={isLoading} size="large">
        <div style={{ minHeight: isLoading ? 400 : 'auto', visibility: isLoading ? 'hidden' : 'visible' }}>
          <Title level={4} style={{ marginBottom: 24 }}>Agents</Title>
          <Card>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
              <Space>
                <Input
                  placeholder="Search by title"
                  prefix={<SearchOutlined />}
                  value={searchTitle}
                  onChange={(e) => setSearchTitle(e.target.value)}
                  onPressEnter={handleSearch}
                  style={{ width: 200 }}
                />
                <Button icon={<SearchOutlined />} onClick={handleSearch}>Search</Button>
              </Space>
              <Button icon={<ReloadOutlined />} onClick={refresh}>Refresh</Button>
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
                showTotal: (t) => `Total ${t} items`,
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
