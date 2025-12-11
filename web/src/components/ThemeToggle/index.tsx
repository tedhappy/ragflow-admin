//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

import React from 'react';
import { Button } from 'antd';
import { SunOutlined, MoonOutlined } from '@ant-design/icons';
import { useTheme, ThemeEnum } from '@/components/ThemeProvider';
import styles from './index.less';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <Button
      type="text"
      className={styles.themeToggle}
      onClick={toggleTheme}
    >
      <div className={styles.toggleContainer}>
        <div className={`${styles.iconWrapper} ${!isDark ? styles.active : ''}`}>
          <SunOutlined className={styles.icon} />
        </div>
        <div className={`${styles.iconWrapper} ${isDark ? styles.active : ''}`}>
          <MoonOutlined className={styles.icon} />
        </div>
      </div>
    </Button>
  );
};

export default ThemeToggle;
