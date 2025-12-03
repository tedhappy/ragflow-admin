import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Card, message, Input, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { agentApi, Agent } from '@/services/api';
import dayjs from 'dayjs';

const { Title } = Typography;

const Agents: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Agent[]>([]);
  const [searchTitle, setSearchTitle] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: any = { page: 1, page_size: 100 };
      if (searchTitle) {
        params.title = searchTitle;
      }
      const result = await agentApi.list(params);
      setData(result.items || []);
    } catch (error: any) {
      message.error(error.message || 'Failed to fetch agents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>Agents</Title>
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <Input
              placeholder="Search by title"
              prefix={<SearchOutlined />}
              value={searchTitle}
              onChange={(e) => setSearchTitle(e.target.value)}
              onPressEnter={fetchData}
              style={{ width: 200 }}
            />
            <Button icon={<SearchOutlined />} onClick={fetchData}>Search</Button>
          </Space>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>Refresh</Button>
        </div>
        <Table 
          columns={columns} 
          dataSource={data} 
          rowKey="id"
          loading={loading}
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

export default Agents;
