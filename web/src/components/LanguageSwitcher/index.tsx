//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

import React from 'react';
import { Dropdown, Button } from 'antd';
import type { MenuProps } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Language, LanguageMap } from '@/locales';

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const items: MenuProps['items'] = Object.entries(LanguageMap).map(([key, label]) => ({
    key,
    label,
    onClick: () => i18n.changeLanguage(key),
  }));

  const currentLanguage = LanguageMap[i18n.language as Language] || LanguageMap[Language.En];

  return (
    <Dropdown menu={{ items, selectedKeys: [i18n.language] }} placement="bottomRight">
      <Button type="text" icon={<GlobalOutlined />}>
        {currentLanguage}
      </Button>
    </Dropdown>
  );
};

export default LanguageSwitcher;
