import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Card, message, Input, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { datasetApi, Dataset } from '@/services/api';
import dayjs from 'dayjs';

const { Title } = Typography;

const Datasets: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Dataset[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [searchName, setSearchName] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: any = { page: 1, page_size: 100 };
      if (searchName) {
        params.name = searchName;
      }
      const result = await datasetApi.list(params);
      setData(result.items || []);
    } catch (error: any) {
      message.error(error.message || 'Failed to fetch datasets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (ids: string[]) => {
    try {
      await datasetApi.batchDelete(ids);
      message.success('Deleted successfully');
      setSelectedRowKeys([]);
      fetchData();
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

  return (
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
              onPressEnter={fetchData}
              style={{ width: 200 }}
            />
            <Button icon={<SearchOutlined />} onClick={fetchData}>Search</Button>
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchData}>Refresh</Button>
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
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `Total ${total} items`,
          }}
        />
      </Card>
    </div>
  );
};

export default Datasets;
