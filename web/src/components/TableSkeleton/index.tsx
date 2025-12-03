//
// Copyright 2024 RAGFlow Admin Authors.
//
// Licensed under the Apache License, Version 2.0
//

import React from 'react';
import { Skeleton, Card } from 'antd';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

/**
 * Skeleton loading component for tables.
 */
const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 5, columns = 4 }) => {
  return (
    <Card>
      {/* Header skeleton */}
      <div style={{ display: 'flex', marginBottom: 16, gap: 16 }}>
        <Skeleton.Input active style={{ width: 200 }} />
        <Skeleton.Button active style={{ width: 80 }} />
        <div style={{ flex: 1 }} />
        <Skeleton.Button active style={{ width: 100 }} />
      </div>
      
      {/* Table header skeleton */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 16,
        padding: '12px 0',
        borderBottom: '1px solid #f0f0f0',
        marginBottom: 8
      }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton.Input key={i} active size="small" style={{ width: '80%' }} />
        ))}
      </div>
      
      {/* Table rows skeleton */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div 
          key={rowIndex}
          style={{ 
            display: 'grid', 
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: 16,
            padding: '16px 0',
            borderBottom: '1px solid #f0f0f0'
          }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton.Input 
              key={colIndex} 
              active 
              size="small" 
              style={{ width: colIndex === 0 ? '60%' : '80%' }} 
            />
          ))}
        </div>
      ))}
      
      {/* Pagination skeleton */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, gap: 8 }}>
        <Skeleton.Button active size="small" />
        <Skeleton.Input active size="small" style={{ width: 32 }} />
        <Skeleton.Button active size="small" />
      </div>
    </Card>
  );
};

export default TableSkeleton;
