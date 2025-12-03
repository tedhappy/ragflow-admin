import React, { useState } from 'react';
import { Table, Button, Space, Card, message, Input, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { datasetApi, Dataset } from '@/services/api';
import { useTableList } from '@/hooks/useTableList';
import ErrorBoundary from '@/components/ErrorBoundary';
import TableSkeleton from '@/components/TableSkeleton';
import dayjs from 'dayjs';

const { Title } = Typography;

const Datasets: React.FC = () => {
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
    setParams,
    refresh,
    handlePageChange,
    handleSearch: triggerSearch,
  } = useTableList<Dataset>({
    fetchFn: (params) => datasetApi.list(params),
    defaultPageSize: 10,
  });

  const handleSearch = () => {
    setParams({ name: searchName || undefined });
    triggerSearch();
  };

  const handleDelete = async (ids: string[]) => {
    try {
      await datasetApi.batchDelete(ids);
      message.success('Deleted successfully');
      setSelectedRowKeys([]);
      refresh();
    } catch (error: any) {
      message.error(error.message || 'Failed to delete');
    }
  };

  const columns: ColumnsType<Dataset> = [
    { 
      title: 'Name', 
      dataIndex: 'name', 
      key: 'name',
      width: 200,
    },
    { 
      title: 'Description', 
      dataIndex: 'description', 
      key: 'description',
      ellipsis: true,
    },
    { 
      title: 'Documents', 
      dataIndex: 'document_count', 
      key: 'document_count',
      width: 100,
      render: (val) => val || 0,
    },
    { 
      title: 'Chunks', 
      dataIndex: 'chunk_count', 
      key: 'chunk_count',
      width: 100,
      render: (val) => val || 0,
    },
    { 
      title: 'Created', 
      dataIndex: 'create_time', 
      key: 'create_time',
      width: 180,
      render: (val) => val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: 'Actions',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Button 
          type="link" 
          size="small" 
          danger
          onClick={() => handleDelete([record.id])}
        >
          Delete
        </Button>
      ),
    },
  ];

  // Show skeleton on initial load
  if (initialLoading) {
    return (
      <div>
        <Title level={4} style={{ marginBottom: 24 }}>Datasets</Title>
        <TableSkeleton rows={5} columns={5} />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div>
        <Title level={4} style={{ marginBottom: 24 }}>Datasets</Title>
        <Card>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <Space>
              <Input
                placeholder="Search by name"
                prefix={<SearchOutlined />}
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                onPressEnter={handleSearch}
                style={{ width: 200 }}
              />
              <Button icon={<SearchOutlined />} onClick={handleSearch}>Search</Button>
            </Space>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={refresh}>Refresh</Button>
              <Button 
                danger 
                icon={<DeleteOutlined />}
                disabled={selectedRowKeys.length === 0}
                onClick={() => handleDelete(selectedRowKeys as string[])}
              >
                Delete Selected ({selectedRowKeys.length})
              </Button>
            </Space>
          </div>
          <Table 
            columns={columns} 
            dataSource={data} 
            rowKey="id"
            loading={loading}
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
              showTotal: (t) => `Total ${t} items`,
              onChange: handlePageChange,
            }}
          />
        </Card>
      </div>
    </ErrorBoundary>
  );
};

export default Datasets;
