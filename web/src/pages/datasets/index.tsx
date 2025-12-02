import React from 'react';
import { Table, Button, Space, Card } from 'antd';
import { PlusOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';

const Datasets: React.FC = () => {
  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '文档数', dataIndex: 'document_count', key: 'document_count' },
    { title: '创建时间', dataIndex: 'create_time', key: 'create_time' },
    {
      title: '操作',
      key: 'action',
      render: () => (
        <Space>
          <Button type="link" size="small">查看</Button>
          <Button type="link" size="small" danger>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <Card
        title="数据集管理"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />}>新建</Button>
            <Button danger icon={<DeleteOutlined />}>批量删除</Button>
          </Space>
        }
      >
        <Table columns={columns} dataSource={[]} rowSelection={{}} />
      </Card>
    </div>
  );
};

export default Datasets;
