import React from 'react';
import { Table, Button, Space, Card } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

const Chat: React.FC = () => {
  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '描述', dataIndex: 'description', key: 'description' },
    { title: '会话数', dataIndex: 'session_count', key: 'session_count' },
    { title: '创建时间', dataIndex: 'create_time', key: 'create_time' },
    {
      title: '操作',
      key: 'action',
      render: () => (
        <Space>
          <Button type="link" size="small">查看会话</Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <Card
        title="聊天助手管理"
        extra={<Button icon={<ReloadOutlined />}>刷新</Button>}
      >
        <Table columns={columns} dataSource={[]} />
      </Card>
    </div>
  );
};

export default Chat;
