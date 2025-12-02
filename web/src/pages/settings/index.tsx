import React from 'react';
import { Card, Descriptions, Tag, Button } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined } from '@ant-design/icons';

const Settings: React.FC = () => {
  return (
    <div className="p-6">
      <Card
        title="系统设置"
        extra={<Button icon={<ReloadOutlined />}>检查连接</Button>}
      >
        <Descriptions bordered column={1}>
          <Descriptions.Item label="RAGFlow 地址">
            http://localhost:9380
          </Descriptions.Item>
          <Descriptions.Item label="连接状态">
            <Tag icon={<CheckCircleOutlined />} color="success">
              已连接
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="API Key">
            ragflow-**********************
          </Descriptions.Item>
          <Descriptions.Item label="后台版本">
            v0.1.0
          </Descriptions.Item>
          <Descriptions.Item label="RAGFlow版本">
            v0.22.1
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
};

export default Settings;
