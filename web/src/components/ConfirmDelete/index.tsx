//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

import React from 'react';
import { Popconfirm, Button } from 'antd';
import type { PopconfirmProps, ButtonProps } from 'antd';
import { DeleteOutlined, ExclamationCircleFilled } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

interface ConfirmDeleteProps {
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  // Button props when using default button
  buttonText?: string;
  buttonType?: ButtonProps['type'];
  buttonSize?: ButtonProps['size'];
  buttonDanger?: boolean;
  showIcon?: boolean;
  // Popconfirm placement
  placement?: PopconfirmProps['placement'];
}

/**
 * Confirm delete component with popconfirm dialog.
 * Can wrap any children or render a default delete button.
 */
const ConfirmDelete: React.FC<ConfirmDeleteProps> = ({
  onConfirm,
  title,
  description,
  children,
  disabled = false,
  buttonText,
  buttonType = 'link',
  buttonSize = 'small',
  buttonDanger = true,
  showIcon = true,
  placement = 'topRight',
}) => {
  const { t } = useTranslation();

  const defaultTitle = title || t('common.deleteConfirm');
  const defaultButtonText = buttonText || t('common.delete');

  // Default delete button if no children provided
  const trigger = children || (
    <Button
      type={buttonType}
      size={buttonSize}
      danger={buttonDanger}
      icon={showIcon ? <DeleteOutlined /> : undefined}
      disabled={disabled}
    >
      {defaultButtonText}
    </Button>
  );

  if (disabled) {
    return <>{trigger}</>;
  }

  return (
    <Popconfirm
      title={defaultTitle}
      description={description}
      onConfirm={onConfirm}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      okButtonProps={{ danger: true }}
      icon={<ExclamationCircleFilled style={{ color: '#ff4d4f' }} />}
      placement={placement}
    >
      {trigger}
    </Popconfirm>
  );
};

export default ConfirmDelete;
